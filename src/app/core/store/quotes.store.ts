import { inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { QuotesSocket } from '../api/quotes-socket.service';
import { Quote, QuotesBySymbol } from '../models';

interface QuotesState {
  /**
   * Current price per symbol. Only subscribed symbols are kept: a price stops being current
   * the moment we send `removelist`, and presenting a minutes-old bid as "the current price"
   * (e.g. pre-filling the order form) would be misleading in a trading app.
   */
  quotes: QuotesBySymbol;
}

export const QuotesStore = signalStore(
  { providedIn: 'root' },
  withState<QuotesState>({ quotes: {} }),
  withProps((_, socket = inject(QuotesSocket)) => ({
    /** Whether the quotes socket is currently open. */
    connected: socket.connected,
  })),
  withMethods((store, socket = inject(QuotesSocket)) => ({
    /**
     * Keeps live quotes flowing exactly for `symbols` (subscribes new ones, drops stale ones)
     * and forgets the prices of the symbols that are no longer watched, so a later
     * re-subscription waits for a fresh quote instead of reusing the old one.
     */
    watchSymbols(symbols: readonly string[]): void {
      socket.setSymbols(symbols);
      const watched = new Set(symbols);
      patchState(store, ({ quotes }) => {
        const kept = Object.entries(quotes).filter(([symbol]) => watched.has(symbol));
        return kept.length === Object.keys(quotes).length
          ? {}
          : { quotes: Object.fromEntries(kept) };
      });
    },

    applyQuotes(quotes: readonly Quote[]): void {
      if (!quotes.length) return;
      patchState(store, ({ quotes: current }) => ({
        quotes: { ...current, ...Object.fromEntries(quotes.map((q) => [q.s, q])) },
      }));
    },
  })),
  withHooks({
    onInit(store, socket = inject(QuotesSocket)) {
      socket.quotes$.pipe(takeUntilDestroyed()).subscribe((quotes) => store.applyQuotes(quotes));
    },
  }),
);
