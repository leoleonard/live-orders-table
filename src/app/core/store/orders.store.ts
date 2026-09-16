import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  addEntity,
  removeEntities,
  removeEntity,
  setAllEntities,
  withEntities,
} from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { OrdersApi } from '../api/orders-api.service';
import { ContractSizeBySymbol } from '../domain/order-groups';
import { ContractType, Instrument, NewOrder, Order } from '../models';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface OrdersState {
  instruments: Instrument[];
  contractTypes: ContractType[];
  /** Symbols present in the originally loaded order list (used by the "new order" form). */
  knownSymbols: string[];
  status: LoadStatus;
  error: string | null;
}

const initialState: OrdersState = {
  instruments: [],
  contractTypes: [],
  knownSymbols: [],
  status: 'idle',
  error: null,
};

export const OrdersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withEntities<Order>(),
  withComputed(({ entities, instruments, contractTypes, status }) => ({
    orders: entities,
    isLoading: computed(() => status() === 'loading'),
    /** Distinct symbols that currently have at least one open order. */
    activeSymbols: computed(() => [...new Set(entities().map((o) => o.symbol))]),
    contractSizeBySymbol: computed<ContractSizeBySymbol>(() => {
      const sizeByType = new Map(contractTypes().map((ct) => [ct.contractType, ct.contractSize]));
      return Object.fromEntries(
        instruments()
          .map((i) => [i.symbol, sizeByType.get(i.contractType)] as const)
          .filter((entry): entry is readonly [string, number] => entry[1] !== undefined),
      );
    }),
  })),
  withMethods((store, api = inject(OrdersApi)) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(() =>
          api.loadAll().pipe(
            tapResponse({
              next: ({ orders, instruments, contractTypes }) =>
                patchState(store, setAllEntities(orders), {
                  instruments,
                  contractTypes,
                  knownSymbols: [...new Set(orders.map((o) => o.symbol))].sort(),
                  status: 'loaded',
                }),
              error: (err: unknown) =>
                patchState(store, {
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Failed to load orders',
                }),
            }),
          ),
        ),
      ),
    ),

    /** Adds a locally created order; returns the created entity. */
    addOrder(input: NewOrder): Order {
      const nextId = store.entities().reduce((max, o) => Math.max(max, o.id), 0) + 1;
      const order: Order = { ...input, id: nextId, swap: 0 };
      patchState(store, addEntity(order));
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
      store.load();
    },
  }),
);
