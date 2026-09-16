import { inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { QuotesSocket } from '../api/quotes-socket.service';
import { Quote, QuotesBySymbol } from '../models';

interface QuotesState {
  quotes: QuotesBySymbol;
}

export const QuotesStore = signalStore(
  { providedIn: 'root' },
  withState<QuotesState>({ quotes: {} }),
  withMethods((store, socket = inject(QuotesSocket)) => ({
    connected: socket.connected,

    /** Keeps live quotes flowing exactly for `symbols` (subscribes new ones, drops stale ones). */
    watchSymbols(symbols: readonly string[]): void {
      socket.setSymbols(symbols);
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
