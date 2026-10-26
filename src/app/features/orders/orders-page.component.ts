import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { createOrderGroupsProjector } from '../../core/domain/order-groups';
import { NewOrder } from '../../core/models';
import { OrdersStore } from '../../core/store/orders.store';
import { QuotesStore } from '../../core/store/quotes.store';
import { ToastService } from '../../shared/toast/toast.service';
import { OrderFormComponent } from './order-form/order-form.component';
import { OrdersTableComponent } from './orders-table/orders-table.component';

/** Container: wires the stores together and hands plain data to presentational children. */
@Component({
  selector: 'app-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrdersTableComponent, OrderFormComponent],
  templateUrl: './orders-page.component.html',
  styleUrl: './orders-page.component.scss',
})
export class OrdersPageComponent {
  protected readonly ordersStore = inject(OrdersStore);
  protected readonly quotesStore = inject(QuotesStore);
  private readonly toast = inject(ToastService);

  /** Memoised across ticks: unchanged groups keep their object identity. */
  private readonly project = createOrderGroupsProjector();

  /**
   * Expanded symbols, pruned against the symbols that still have orders. It is derived from
   * `activeSymbols` rather than from `groups` on purpose: `groups` depends on this signal.
   */
  protected readonly expanded = linkedSignal<string[], ReadonlySet<string>>({
    source: this.ordersStore.activeSymbols,
    computation: (symbols, previous) => {
      const present = new Set(symbols);
      return new Set([...(previous?.value ?? [])].filter((s) => present.has(s)));
    },
    equal: (a, b) => a.size === b.size && [...a].every((s) => b.has(s)),
  });

  protected readonly groups = computed(() =>
    this.project(
      this.ordersStore.orders(),
      this.quotesStore.quotes(),
      this.ordersStore.contractSizeBySymbol(),
      this.expanded(),
    ),
  );

  protected toggle(symbol: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(symbol)) next.add(symbol);
      return next;
    });
  }

  /** Symbol picked in the "new order" form (may have no open orders yet). */
  protected readonly formSymbol = signal('');

  /** Symbols that need a live quote: every open order + whatever the form is pointing at. */
  private readonly watchedSymbols = computed(() => {
    const symbols = new Set(this.ordersStore.activeSymbols());
    if (this.formSymbol()) symbols.add(this.formSymbol());
    return [...symbols];
  });

  constructor() {
    // Keep the WebSocket subscription list in sync with what is on screen.
    effect(() => this.quotesStore.watchSymbols(this.watchedSymbols()));
  }

  protected onCloseOrder(id: number): void {
    const closed = this.ordersStore.closeOrder(id);
    if (closed !== null) this.notifyClosed([closed]);
  }

  protected onCloseGroup(symbol: string): void {
    const closed = this.ordersStore.closeGroup(symbol);
    if (closed.length) this.notifyClosed(closed);
  }

  protected onNewOrder(order: NewOrder): void {
    const created = this.ordersStore.addOrder(order);
    this.toast.show(`Dodano zlecenie nr ${created.id}`);
  }

  private notifyClosed(ids: number[]): void {
    this.toast.show(`Zamknięto zlecenie nr ${ids.join(', ')}`);
  }
}
