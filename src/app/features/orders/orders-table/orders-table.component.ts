import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { OrderGroup } from '../../../core/models';
import { ProfitDirective } from './profit.directive';

/**
 * Presentational, self-contained table: receives already-aggregated groups and
 * only owns the "which groups are expanded" UI state.
 */
@Component({
  selector: 'app-orders-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, ProfitDirective],
  templateUrl: './orders-table.component.html',
  styleUrl: './orders-table.component.scss',
})
export class OrdersTableComponent {
  readonly groups = input.required<OrderGroup[]>();

  readonly closeOrder = output<number>();
  readonly closeGroup = output<string>();

  protected readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected isExpanded(symbol: string): boolean {
    return this.expanded().has(symbol);
  }

  protected toggle(symbol: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      next.has(symbol) ? next.delete(symbol) : next.add(symbol);
      return next;
    });
  }

  protected onCloseGroup(event: Event, symbol: string): void {
    event.stopPropagation(); // do not toggle the group
    this.closeGroup.emit(symbol);
  }
}
