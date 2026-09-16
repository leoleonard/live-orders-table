import { TestBed } from '@angular/core/testing';
import { QuotesSocket } from '../api/quotes-socket.service';
import { QuotesSocketStub } from '../api/quotes-socket.stub';
import { QuotesStore } from './quotes.store';

describe('QuotesStore', () => {
  let store: InstanceType<typeof QuotesStore>;
  let socket: QuotesSocketStub;

  beforeEach(() => {
    socket = new QuotesSocketStub();
    TestBed.configureTestingModule({ providers: [{ provide: QuotesSocket, useValue: socket }] });
    store = TestBed.inject(QuotesStore);
  });

  it('stores incoming quotes by symbol, latest wins', () => {
    socket.quotes$.next([
      { s: 'BTCUSD', b: 1, a: 2, t: 1 },
      { s: 'ETHUSD', b: 3, a: 4, t: 1 },
    ]);
    socket.quotes$.next([{ s: 'BTCUSD', b: 10, a: 11, t: 2 }]);

    expect(store.quotes()['BTCUSD'].b).toBe(10);
    expect(store.quotes()['ETHUSD'].b).toBe(3);
  });

  it('ignores empty frames without touching state', () => {
    const before = store.quotes();
    socket.quotes$.next([]);
    expect(store.quotes()).toBe(before);
  });

  it('diffs the watched symbols against the socket subscriptions', () => {
    store.watchSymbols(['BTCUSD', 'ETHUSD']);
    store.watchSymbols(['ETHUSD', 'EURPLN']);

    expect(socket.calls).toEqual([
      { type: 'add', symbols: ['BTCUSD', 'ETHUSD'] },
      { type: 'remove', symbols: ['BTCUSD'] },
      { type: 'add', symbols: ['EURPLN'] },
    ]);
    expect([...socket.symbols]).toEqual(['ETHUSD', 'EURPLN']);
  });

  it('exposes the socket connection state', () => {
    expect(store.connected()).toBe(false);
    socket.connected.set(true);
    expect(store.connected()).toBe(true);
  });
});
