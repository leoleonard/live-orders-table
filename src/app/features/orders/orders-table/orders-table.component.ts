import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { OrderGroup } from '../../../core/models';
import { ProfitDirective } from './profit.directive';

/**
 * Presentational, self-contained table: it renders already-aggregated groups and reports
 * interactions. Which groups are expanded is owned by the container, because the detail rows
 * are only computed for open groups.
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
  /** Defaults to "nothing expanded" so the table also renders before the first binding. */
  readonly expanded = input<ReadonlySet<string>>(new Set());

  readonly toggled = output<string>();
  readonly closeOrder = output<number>();
  readonly closeGroup = output<string>();

  protected isExpanded(symbol: string): boolean {
    return this.expanded().has(symbol);
  }

  protected onCloseGroup(event: Event, symbol: string): void {
    event.stopPropagation(); // do not toggle the group
    this.closeGroup.emit(symbol);
  }
}
