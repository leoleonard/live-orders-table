import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG, ApiConfig } from '../config/api.config';
import { Order } from '../models';
import { describeLoadError, OrdersStore } from './orders.store';

const config: ApiConfig = {
  ordersUrl: '/orders.json',
  instrumentsUrl: '/instruments.json',
  contractTypesUrl: '/contract-types.json',
  quotesSocketUrl: 'wss://test',
};

const orders: Order[] = [
  { id: 10, symbol: 'BTCUSD', side: 'BUY', size: 0.1, openPrice: 100, openTime: 0, swap: 0 },
  { id: 11, symbol: 'ETHUSD', side: 'SELL', size: 1, openPrice: 10, openTime: 0, swap: 0 },
  { id: 12, symbol: 'BTCUSD', side: 'BUY', size: 0.2, openPrice: 110, openTime: 0, swap: 0 },
];

describe('OrdersStore', () => {
  let store: InstanceType<typeof OrdersStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: config },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(OrdersStore);
    TestBed.tick(); // lets the resource loader start its requests
  });

  afterEach(() => http.verify());

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  async function flushLoad(): Promise<void> {
    http.expectOne(config.ordersUrl).flush({ data: orders });
    http.expectOne(config.instrumentsUrl).flush([
      { symbol: 'BTCUSD', contractType: 0 },
      { symbol: 'ETHUSD', contractType: 2 },
      { symbol: 'NOTYPE', contractType: 99 },
    ]);
    http.expectOne(config.contractTypesUrl).flush([
      { contractType: 0, contractSize: 1 },
      { contractType: 2, contractSize: 100 },
    ]);
    await settle();
  }

  it('starts loading on init and stores the fetched data', async () => {
    expect(store.status()).toBe('loading');
    expect(store.isLoading()).toBe(true);
    await flushLoad();
    expect(store.status()).toBe('resolved');
    expect(store.error()).toBeNull();
    expect(store.orders()).toEqual(orders);
    expect(store.knownSymbols()).toEqual(['BTCUSD', 'ETHUSD']);
    expect(store.activeSymbols()).toEqual(['BTCUSD', 'ETHUSD']);
  });

  it('maps instruments to contract sizes and skips unknown contract types', async () => {
    expect(store.contractSizeBySymbol()).toEqual({});
    await flushLoad();
    expect(store.contractSizeBySymbol()).toEqual({ BTCUSD: 1, ETHUSD: 100 });
  });

  it('exposes a readable error when a request fails', async () => {
    http.expectOne(config.ordersUrl).flush('boom', { status: 500, statusText: 'Server Error' });
    // forkJoin cancels the remaining requests as soon as one of them fails
    http.match(config.instrumentsUrl).forEach((req) => expect(req.cancelled).toBe(true));
    http.match(config.contractTypesUrl).forEach((req) => expect(req.cancelled).toBe(true));
    await settle();
    expect(store.status()).toBe('error');
    expect(store.error()).toContain('500');
    expect(store.orders()).toEqual([]);
  });

  it('reload() re-fetches and replaces local changes', async () => {
    await flushLoad();
    store.closeGroup('BTCUSD');
    store.reload();
    TestBed.tick();
    await flushLoad();
    expect(store.orders()).toEqual(orders);
  });

  it('closes a single order and returns its id', async () => {
    await flushLoad();
    expect(store.closeOrder(11)).toBe(11);
    expect(store.orders().map((o) => o.id)).toEqual([10, 12]);
    expect(store.activeSymbols()).toEqual(['BTCUSD']);
    expect(store.closeOrder(999)).toBeNull();
  });

  it('closes a whole group and returns the ids in table order', async () => {
    await flushLoad();
    expect(store.closeGroup('BTCUSD')).toEqual([10, 12]);
    expect(store.orders().map((o) => o.id)).toEqual([11]);
    expect(store.closeGroup('BTCUSD')).toEqual([]);
  });

  it('adds a new order with the next free id, zero swap and keeps known symbols intact', async () => {
    await flushLoad();
    store.closeGroup('ETHUSD');
    const created = store.addOrder({
      symbol: 'ETHUSD',
      side: 'BUY',
      size: 2,
      openPrice: 20,
      openTime: 123,
    });
    expect(created).toEqual({
      id: 13,
      symbol: 'ETHUSD',
      side: 'BUY',
      size: 2,
      openPrice: 20,
      openTime: 123,
      swap: 0,
    });
    expect(store.orders()).toHaveLength(3);
    expect(store.activeSymbols()).toEqual(['BTCUSD', 'ETHUSD']);
    expect(store.knownSymbols()).toEqual(['BTCUSD', 'ETHUSD']);
  });
});

describe('describeLoadError', () => {
  it('unwraps an HttpErrorResponse (direct or as `cause`)', () => {
    const http = new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: '/x' });
    expect(describeLoadError(http)).toBe(http.message);
    expect(describeLoadError(new Error('wrapped', { cause: http }))).toBe(http.message);
  });

  it('falls back to the Error message or a generic text', () => {
    expect(describeLoadError(new Error('nope'))).toBe('nope');
    expect(describeLoadError('???')).toBe('Failed to load orders');
  });
});
