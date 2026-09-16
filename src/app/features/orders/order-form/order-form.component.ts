import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NewOrder, OrderSide, QuotesBySymbol } from '../../../core/models';

type OrderForm = FormGroup<{
  symbol: FormControl<string>;
  side: FormControl<OrderSide>;
  size: FormControl<number | null>;
  openPrice: FormControl<number | null>;
  openTime: FormControl<string>;
}>;

/** Formats a date for an `<input type="datetime-local">` (local time, seconds precision). */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

@Component({
  selector: 'app-order-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.scss',
})
export class OrderFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  /** Symbols the user may pick from. */
  readonly symbols = input.required<readonly string[]>();
  /** Live quotes – used to pre-fill / refresh the open price. */
  readonly quotes = input<QuotesBySymbol>({});

  readonly submitted = output<NewOrder>();

  protected readonly sides: readonly OrderSide[] = ['BUY', 'SELL'];

  protected readonly form: OrderForm = this.fb.group({
    symbol: this.fb.control('', Validators.required),
    side: this.fb.control<OrderSide>('BUY', Validators.required),
    size: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(Number.EPSILON),
    ]),
    openPrice: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(Number.EPSILON),
    ]),
    openTime: this.fb.control(toDateTimeLocal(new Date()), Validators.required),
  });

  private readonly selectedSymbol = toSignal(this.form.controls.symbol.valueChanges, {
    initialValue: this.form.controls.symbol.value,
  });

  /** Current bid of the selected symbol (or `null` when unknown). */
  protected readonly currentBid = computed(() => this.quotes()[this.selectedSymbol()]?.b ?? null);

  constructor() {
    // Pre-fill the open price with the current bid whenever the user picks another symbol.
    effect(() => {
      const symbol = this.selectedSymbol();
      const bid = this.quotes()[symbol]?.b;
      if (bid !== undefined && this.form.controls.openPrice.pristine) {
        this.form.controls.openPrice.setValue(bid);
      }
    });
  }

  protected useCurrentPrice(): void {
    const bid = this.currentBid();
    if (bid !== null) {
      this.form.controls.openPrice.setValue(bid);
      this.form.controls.openPrice.markAsDirty();
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { symbol, side, size, openPrice, openTime } = this.form.getRawValue();
    this.submitted.emit({
      symbol,
      side,
      size: size!,
      openPrice: openPrice!,
      openTime: new Date(openTime).getTime(),
    });
    this.reset();
  }

  protected reset(): void {
    this.form.reset({
      symbol: '',
      side: 'BUY',
      size: null,
      openPrice: null,
      openTime: toDateTimeLocal(new Date()),
    });
  }

  protected showError(name: keyof OrderForm['controls']): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }
}
