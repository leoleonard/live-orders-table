import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { filter, map, Observable, repeat, retry, share, Subject, timer } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { API_CONFIG } from '../config/api.config';
import { isQuotesSubscribedMessage, Quote, QuotesCommand, QuotesServerMessage } from '../models';
import { parseQuotes } from './payload';

const RECONNECT_DELAY_MS = 2000;

/**
 * Thin wrapper over the quotes WebSocket.
 *
 * The public surface is deliberately minimal – `quotes$` to read prices, `setSymbols` to
 * declare what should be watched and `connected` for presentation. Callers never manage
 * individual add/remove commands, so the subscription set cannot drift out of sync.
 *
 * - lazily connects on first `quotes$` subscription,
 * - re-connects with a delay after errors (`retry`) and after a clean server close (`repeat`),
 * - remembers subscribed symbols and re-subscribes them after a reconnect.
 */
@Injectable({ providedIn: 'root' })
export class QuotesSocket {
  private readonly config = inject(API_CONFIG);
  private readonly destroyRef = inject(DestroyRef);

  private readonly subscribedSymbols = new Set<string>();
  private readonly opened$ = new Subject<void>();
  private socket: WebSocketSubject<QuotesServerMessage | QuotesCommand> | null = null;

  /**
   * Plain field, not the signal below: `send()` is reached from a reactive `effect`
   * (the page syncing subscriptions), and reading a signal there would make that effect
   * depend on the connection state and re-run on every connect / disconnect.
   */
  private isOpen = false;

  private readonly _connected = signal(false);
  /** Whether the socket is currently open – for presentation only. */
  readonly connected = this._connected.asReadonly();

  /** Stream of quote updates (already flattened, one emission per server frame). */
  readonly quotes$: Observable<Quote[]> = new Observable<QuotesServerMessage>((subscriber) => {
    const subscription = this.getSocket().subscribe(subscriber);
    return () => subscription.unsubscribe();
  }).pipe(
    retry({ delay: () => timer(RECONNECT_DELAY_MS) }),
    repeat({ delay: () => timer(RECONNECT_DELAY_MS) }),
    filter(isQuotesSubscribedMessage),
    map((message) => parseQuotes(message.d)),
    filter((quotes) => quotes.length > 0),
    share(),
  );

  constructor() {
    this.opened$.subscribe(() => this.resubscribeAll());
    this.destroyRef.onDestroy(() => this.socket?.complete());
  }

  /** Makes the server-side subscription set equal to `symbols` (adds new, removes stale). */
  setSymbols(symbols: readonly string[]): void {
    const wanted = new Set(symbols);
    this.unsubscribe([...this.subscribedSymbols].filter((s) => !wanted.has(s)));
    this.subscribe(symbols);
  }

  private subscribe(symbols: readonly string[]): void {
    const fresh = symbols.filter((s) => !this.subscribedSymbols.has(s));
    if (!fresh.length) return;
    fresh.forEach((s) => this.subscribedSymbols.add(s));
    this.send({ p: '/subscribe/addlist', d: fresh });
  }

  private unsubscribe(symbols: readonly string[]): void {
    const known = symbols.filter((s) => this.subscribedSymbols.has(s));
    if (!known.length) return;
    known.forEach((s) => this.subscribedSymbols.delete(s));
    this.send({ p: '/subscribe/removelist', d: known });
  }

  private send(command: QuotesCommand): void {
    // While disconnected nothing is sent: the full symbol set is re-sent from `openObserver`,
    // which also avoids the duplicate frames `WebSocketSubject`'s own pre-open buffer would produce.
    if (this.isOpen) this.socket?.next(command);
  }

  private resubscribeAll(): void {
    if (this.subscribedSymbols.size) {
      this.send({ p: '/subscribe/addlist', d: [...this.subscribedSymbols] });
    }
  }

  private getSocket(): WebSocketSubject<QuotesServerMessage | QuotesCommand> {
    if (!this.socket) {
      this.socket = webSocket<QuotesServerMessage | QuotesCommand>({
        url: this.config.quotesSocketUrl,
        openObserver: {
          next: () => {
            this.isOpen = true;
            this._connected.set(true);
            this.opened$.next();
          },
        },
        closeObserver: {
          next: () => {
            this.isOpen = false;
            this._connected.set(false);
          },
        },
      });
    }
    return this.socket;
  }
}
