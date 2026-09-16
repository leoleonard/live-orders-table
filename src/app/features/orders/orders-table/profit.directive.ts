import { computed, Directive, input } from '@angular/core';

/** Colours the host green / red depending on the sign of the profit. */
@Directive({
  selector: '[appProfit]',
  host: {
    '[class.profit--positive]': 'sign() > 0',
    '[class.profit--negative]': 'sign() < 0',
  },
})
export class ProfitDirective {
  readonly appProfit = input.required<number | null>();

  protected readonly sign = computed(() => Math.sign(this.appProfit() ?? 0));
}
