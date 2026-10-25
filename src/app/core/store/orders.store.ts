import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, resource } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withLinkedState,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { OrdersApi } from '../api/orders-api.service';
import { ContractSizeBySymbol } from '../domain/order-groups';
import { NewOrder, Order } from '../models';

/** Turns a resource error (possibly wrapping an `HttpErrorResponse`) into a readable message. */
export function describeLoadError(error: unknown): string {
  if (error instanceof HttpErrorResponse) return error.message;
  if (error instanceof Error) {
    return error.cause instanceof HttpErrorResponse ? error.cause.message : error.message;
  }
  return 'Failed to load orders';
}

export const OrdersStore = signalStore(
  { providedIn: 'root' },
  // The one-off bootstrap fetch is an Angular `resource` (status / error / reload for free).
  withProps((_, api = inject(OrdersApi)) => ({
    bootstrap: resource({ loader: () => firstValueFrom(api.loadAll()) }),
  })),
  /**
   * Orders are *linked* to the resource instead of being copied into it by an effect:
   * resolving or reloading the resource reseeds the list, while `addOrder` / `closeOrder`
   * keep writing to the same signal in between.
   */
  withLinkedState(({ bootstrap }) => {
    const loaded = (): readonly Order[] => (bootstrap.hasValue() ? bootstrap.value().orders : []);
    return {
      orders: (): Order[] => [...loaded()],
      /** Monotonic id source: ids are never reused, even after orders are closed. */
      lastIssuedId: (): number => loaded().reduce((max, order) => Math.max(max, order.id), 0),
    };
  }),
  withComputed(({ orders, bootstrap }) => ({
    status: bootstrap.status,
    isLoading: bootstrap.isLoading,
    error: computed(() => (bootstrap.error() ? describeLoadError(bootstrap.error()) : null)),
    /** Orders keyed by id, for O(1) lookups. */
    orderById: computed(() => new Map(orders().map((order) => [order.id, order]))),
    /** Distinct symbols that currently have at least one open order. */
    activeSymbols: computed(() => [...new Set(orders().map((o) => o.symbol))]),
    /** Symbols present in the originally loaded order list (used by the "new order" form). */
    knownSymbols: computed(() =>
      bootstrap.hasValue()
        ? [...new Set(bootstrap.value().orders.map((o) => o.symbol))].sort()
        : [],
    ),
    contractSizeBySymbol: computed<ContractSizeBySymbol>(() => {
      if (!bootstrap.hasValue()) return {};
      const { instruments, contractTypes } = bootstrap.value();
      const sizeByType = new Map(contractTypes.map((ct) => [ct.contractType, ct.contractSize]));
      return Object.fromEntries(
        instruments
          .map((i) => [i.symbol, sizeByType.get(i.contractType)] as const)
          .filter((entry): entry is readonly [string, number] => entry[1] !== undefined),
      );
    }),
  })),
  withMethods((store) => ({
    /** Re-fetches everything; local additions / closures are discarded. */
    reload(): void {
      store.bootstrap.reload();
    },

    /** Adds a locally created order; returns the created entity. */
    addOrder(input: NewOrder): Order {
      const id = store.lastIssuedId() + 1;
      const order: Order = { ...input, id, swap: 0 };
      patchState(store, ({ orders }) => ({ orders: [...orders, order], lastIssuedId: id }));
      return order;
    },

    /** Closes a single order; returns its id or `null` when it does not exist. */
    closeOrder(id: number): number | null {
      if (!store.orderById().has(id)) return null;
      patchState(store, ({ orders }) => ({ orders: orders.filter((o) => o.id !== id) }));
      return id;
    },

    /** Closes every order of a symbol; returns the closed ids (in table order). */
    closeGroup(symbol: string): number[] {
      const ids = store
        .orders()
        .filter((o) => o.symbol === symbol)
        .map((o) => o.id);
      if (ids.length) {
        patchState(store, ({ orders }) => ({ orders: orders.filter((o) => o.symbol !== symbol) }));
      }
      return ids;
    },
  })),
);
