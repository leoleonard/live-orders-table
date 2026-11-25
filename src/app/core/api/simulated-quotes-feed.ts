import { signal } from '@angular/core';
import { filter, finalize, interval, map, Observable, share } from 'rxjs';
import { Quote } from '../models';
import { QuotesFeed } from './quotes-socket.service';

/** Starting bid per symbol and the number of decimals it is quoted with. */
const REFERENCE: Readonly<Record<string, { price: number; digits: number }>> = {
  EURUSD: { price: 1.085, digits: 5 },
  GBPUSD: { price: 1.27, digits: 5 },
  USDJPY: { price: 151.2, digits: 3 },
  XAUUSD: { price: 2650, digits: 2 },
  BTCUSD: { price: 92000, digits: 2 },
  ETHUSD: { price: 3300, digits: 2 },
  US500: { price: 5900, digits: 1 },
  DE40: { price: 19300, digits: 1 },
};
const FALLBACK = { price: 100, digits: 2 };

const TICK_MS = 250;
/** Share of watched symbols that move on a given tick – real feeds are uneven too. */
const TICK_PROBABILITY = 0.6;
/** Largest relative move of a single tick. */
const MAX_STEP = 0.0004;
const SPREAD = 0.0002;

const round = (value: number, digits: number): number => Number(value.toFixed(digits));

/**
 * In-browser stand-in for the quotes WebSocket: a bounded random walk per watched symbol.
 * It has the same public surface as `QuotesSocket`, so stores and components cannot tell
 * the difference. A newly watched symbol gets its first quote on the next tick and an
 * unwatched one stops immediately, like `addlist` / `removelist` on the real server.
 */
export class SimulatedQuotesFeed implements QuotesFeed {
  private readonly bids = new Map<string, number>();
  /** Symbols that have not been quoted yet since they were (re)subscribed. */
  private readonly pending = new Set<string>();

  private readonly _connected = signal(false);
  readonly connected = this._connected.asReadonly();

  readonly quotes$: Observable<Quote[]>;

  /** `random` is injectable so tests can make the walk deterministic. */
  constructor(private readonly random: () => number = Math.random) {
    this.quotes$ = new Observable<number>((subscriber) => {
      this._connected.set(true);
      return interval(TICK_MS).subscribe(subscriber);
    }).pipe(
      finalize(() => this._connected.set(false)),
      map(() => this.tick()),
      filter((quotes) => quotes.length > 0),
      share(),
    );
  }

  setSymbols(symbols: readonly string[]): void {
    const wanted = new Set(symbols);
    for (const symbol of [...this.bids.keys()]) {
      if (!wanted.has(symbol)) {
        this.bids.delete(symbol);
        this.pending.delete(symbol);
      }
    }
    for (const symbol of wanted) {
      if (!this.bids.has(symbol)) {
        this.bids.set(symbol, (REFERENCE[symbol] ?? FALLBACK).price);
        this.pending.add(symbol);
      }
    }
  }

  private tick(): Quote[] {
    const now = Math.floor(Date.now() / 1000);
    const quotes: Quote[] = [];
    for (const [symbol, bid] of this.bids) {
      const first = this.pending.delete(symbol);
      if (!first && this.random() > TICK_PROBABILITY) continue;
      const { digits } = REFERENCE[symbol] ?? FALLBACK;
      const next = first ? bid : bid * (1 + (this.random() * 2 - 1) * MAX_STEP);
      this.bids.set(symbol, next);
      quotes.push({
        s: symbol,
        b: round(next, digits),
        a: round(next * (1 + SPREAD), digits),
        t: now,
      });
    }
    return quotes;
  }
}
