import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { buildOrderGroups } from '../../core/domain/order-groups';
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

  protected readonly groups = computed(() =>
    buildOrderGroups(
      this.ordersStore.orders(),
      this.quotesStore.quotes(),
      this.ordersStore.contractSizeBySymbol(),
    ),
  );

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
