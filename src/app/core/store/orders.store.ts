import { HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, resource } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {
  addEntity,
  removeEntities,
  removeEntity,
  setAllEntities,
  withEntities,
} from '@ngrx/signals/entities';
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
  // Orders are editable local state (add / close), so they live as entities …
  withEntities<Order>(),
  // Monotonic id source: ids are never reused, even after orders are closed or reloaded.
  withState({ lastIssuedId: 0 }),
  // … while the one-off bootstrap fetch is an Angular `resource` (status / error / reload for free).
  withProps((_, api = inject(OrdersApi)) => ({
    bootstrap: resource({ loader: () => firstValueFrom(api.loadAll()) }),
  })),
  withComputed(({ entities, bootstrap }) => ({
    orders: entities,
    status: bootstrap.status,
    isLoading: bootstrap.isLoading,
    error: computed(() => (bootstrap.error() ? describeLoadError(bootstrap.error()) : null)),
    /** Distinct symbols that currently have at least one open order. */
    activeSymbols: computed(() => [...new Set(entities().map((o) => o.symbol))]),
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
      patchState(store, addEntity(order), { lastIssuedId: id });
      return order;
    },

    /** Closes a single order; returns its id or `null` when it does not exist. */
    closeOrder(id: number): number | null {
      if (!store.entityMap()[id]) return null;
      patchState(store, removeEntity(id));
      return id;
    },

    /** Closes every order of a symbol; returns the closed ids (in table order). */
    closeGroup(symbol: string): number[] {
      const ids = store
        .entities()
        .filter((o) => o.symbol === symbol)
        .map((o) => o.id);
      patchState(store, removeEntities(ids));
      return ids;
    },
  })),
  withHooks({
    onInit(store) {
      // Seed the editable entity list every time the bootstrap resource resolves.
      effect(() => {
        if (store.bootstrap.hasValue()) {
          const orders = store.bootstrap.value().orders;
          patchState(store, setAllEntities(orders), ({ lastIssuedId }) => ({
            // never hand out an id that a loaded order already uses
            lastIssuedId: orders.reduce((max, o) => Math.max(max, o.id), lastIssuedId),
          }));
        }
      });
    },
  }),
);
