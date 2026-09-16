import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG, ApiConfig } from '../config/api.config';
import { Order } from '../models';
import { OrdersStore } from './orders.store';

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
  });

  afterEach(() => http.verify());

  function flushLoad(): void {
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
  }

  it('starts loading on init and stores the fetched data', () => {
    expect(store.status()).toBe('loading');
    flushLoad();
    expect(store.status()).toBe('loaded');
    expect(store.orders()).toEqual(orders);
    expect(store.knownSymbols()).toEqual(['BTCUSD', 'ETHUSD']);
    expect(store.activeSymbols()).toEqual(['BTCUSD', 'ETHUSD']);
  });

  it('maps instruments to contract sizes and skips unknown contract types', () => {
    flushLoad();
    expect(store.contractSizeBySymbol()).toEqual({ BTCUSD: 1, ETHUSD: 100 });
  });

  it('exposes the error state when a request fails', () => {
    http.expectOne(config.ordersUrl).flush('boom', { status: 500, statusText: 'Server Error' });
    // forkJoin cancels the remaining requests as soon as one of them fails
    http.match(config.instrumentsUrl).forEach((req) => expect(req.cancelled).toBe(true));
    http.match(config.contractTypesUrl).forEach((req) => expect(req.cancelled).toBe(true));
    expect(store.status()).toBe('error');
    expect(store.error()).toBeTruthy();
  });

  it('closes a single order and returns its id', () => {
    flushLoad();
    expect(store.closeOrder(11)).toBe(11);
    expect(store.orders().map((o) => o.id)).toEqual([10, 12]);
    expect(store.activeSymbols()).toEqual(['BTCUSD']);
    expect(store.closeOrder(999)).toBeNull();
  });

  it('closes a whole group and returns the ids in table order', () => {
    flushLoad();
    expect(store.closeGroup('BTCUSD')).toEqual([10, 12]);
    expect(store.orders().map((o) => o.id)).toEqual([11]);
    expect(store.closeGroup('BTCUSD')).toEqual([]);
  });

  it('adds a new order with the next free id, zero swap and keeps known symbols intact', () => {
    flushLoad();
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
