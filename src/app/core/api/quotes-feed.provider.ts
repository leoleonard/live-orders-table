import { inject, Provider } from '@angular/core';
import { API_CONFIG } from '../config/api.config';
import { QuotesSocket } from './quotes-socket.service';
import { SimulatedQuotesFeed } from './simulated-quotes-feed';

/**
 * Chooses the source of quotes from configuration: the real WebSocket when
 * `quotesSocketUrl` is set, the simulated feed otherwise. Consumers keep injecting
 * `QuotesSocket`; both implementations share its public surface (`QuotesFeed`).
 */
export function provideQuotesFeed(): Provider {
  return {
    provide: QuotesSocket,
    useFactory: () =>
      inject(API_CONFIG).quotesSocketUrl
        ? new QuotesSocket()
        : (new SimulatedQuotesFeed() as unknown as QuotesSocket),
  };
}
