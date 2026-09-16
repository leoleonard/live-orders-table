import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { OrderGroup } from '../../../core/models';
import { ProfitDirective } from './profit.directive';

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every((s) => b.has(s));

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

  /** Expanded symbols; automatically pruned when a group disappears from `groups`. */
  protected readonly expanded = linkedSignal<OrderGroup[], ReadonlySet<string>>({
    source: this.groups,
    computation: (groups, previous) => {
      const present = new Set(groups.map((g) => g.symbol));
      return new Set([...(previous?.value ?? [])].filter((s) => present.has(s)));
    },
    equal: sameSet,
  });

  protected isExpanded(symbol: string): boolean {
    return this.expanded().has(symbol);
  }

  protected toggle(symbol: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(symbol)) next.add(symbol);
      return next;
    });
  }

  protected onCloseGroup(event: Event, symbol: string): void {
    event.stopPropagation(); // do not toggle the group
    this.closeGroup.emit(symbol);
  }
}
