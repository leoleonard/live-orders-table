import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Quote } from '../app/core/models';
import { QuotesSocket } from '../app/core/api/quotes-socket.service';

/** Test double for `QuotesSocket` – records subscriptions and lets tests push quotes. */
export class QuotesSocketStub implements Pick<
  QuotesSocket,
  'quotes$' | 'connected' | 'setSymbols' | 'subscribe' | 'unsubscribe'
> {
  readonly quotes$ = new Subject<Quote[]>();
  readonly connected = signal(false);
  readonly symbols = new Set<string>();
  readonly calls: { type: 'add' | 'remove'; symbols: string[] }[] = [];

  setSymbols(symbols: readonly string[]): void {
    const wanted = new Set(symbols);
    this.unsubscribe([...this.symbols].filter((s) => !wanted.has(s)));
    this.subscribe(symbols);
  }

  subscribe(symbols: readonly string[]): void {
    const fresh = symbols.filter((s) => !this.symbols.has(s));
    if (!fresh.length) return;
    fresh.forEach((s) => this.symbols.add(s));
    this.calls.push({ type: 'add', symbols: fresh });
  }

  unsubscribe(symbols: readonly string[]): void {
    const known = symbols.filter((s) => this.symbols.has(s));
    if (!known.length) return;
    known.forEach((s) => this.symbols.delete(s));
    this.calls.push({ type: 'remove', symbols: known });
  }
}
