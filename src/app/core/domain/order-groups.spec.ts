import { Order } from '../models';
import { buildOrderGroups, toOrderRow } from './order-groups';

const order = (overrides: Partial<Order>): Order => ({
  id: 1,
  symbol: 'BTCUSD',
  side: 'BUY',
  size: 1,
  openPrice: 100,
  openTime: 0,
  swap: 0,
  ...overrides,
});

const quote = (s: string, b: number) => ({ s, b, a: b + 1, t: 0 });

describe('toOrderRow', () => {
  it('computes profit from the bid and contract size', () => {
    const row = toOrderRow(
      order({ size: 2, openPrice: 100 }),
      { BTCUSD: quote('BTCUSD', 150) },
      { BTCUSD: 10 },
    );
    expect(row.bid).toBe(150);
    expect(row.contractSize).toBe(10);
    expect(row.profit).toBe(1000);
  });

  it('has null profit when there is no quote yet', () => {
    const row = toOrderRow(order({}), {}, { BTCUSD: 10 });
    expect(row.bid).toBeNull();
    expect(row.profit).toBeNull();
    expect(row.profitUnavailable).toBe('awaiting-quote');
  });

  it('reports an unknown instrument instead of assuming a contract size', () => {
    const row = toOrderRow(
      order({ symbol: 'XXX', size: 1, openPrice: 1 }),
      { XXX: quote('XXX', 3) },
      {},
    );
    expect(row.contractSize).toBeNull();
    expect(row.profit).toBeNull();
    expect(row.profitUnavailable).toBe('unknown-instrument');
  });
});

describe('buildOrderGroups', () => {
  const orders: Order[] = [
    order({ id: 1, symbol: 'BTCUSD', size: 0.1, openPrice: 100, swap: -1 }),
    order({ id: 2, symbol: 'ETHUSD', size: 1, openPrice: 10, swap: 0.5 }),
    order({ id: 3, symbol: 'BTCUSD', size: 0.3, openPrice: 200, swap: -2, side: 'SELL' }),
  ];

  it('groups by symbol preserving first-appearance order', () => {
    const groups = buildOrderGroups(orders, {}, {});
    expect(groups.map((g) => g.symbol)).toEqual(['BTCUSD', 'ETHUSD']);
    expect(groups[0].orders.map((o) => o.id)).toEqual([1, 3]);
  });

  it('sums size and swap, averages open price and counts orders', () => {
    const [btc] = buildOrderGroups(orders, {}, {});
    expect(btc.count).toBe(2);
    expect(btc.size).toBeCloseTo(0.4);
    expect(btc.swap).toBe(-3);
    expect(btc.avgOpenPrice).toBe(150);
  });

  it('sums profits and keeps null until a quote arrives', () => {
    const withoutQuote = buildOrderGroups(orders, {}, { BTCUSD: 1 });
    expect(withoutQuote[0].profit).toBeNull();
    expect(withoutQuote[0].profitUnavailable).toBe('awaiting-quote');

    const [btc] = buildOrderGroups(orders, { BTCUSD: quote('BTCUSD', 120) }, { BTCUSD: 1 });
    // BUY: (120-100)*0.1 = 2 ; SELL: (120-200)*0.3*-1 = 24
    expect(btc.profit).toBeCloseTo(26);
  });

  it('returns an empty list for no orders', () => {
    expect(buildOrderGroups([], {}, {})).toEqual([]);
  });
});

describe('unknown instruments', () => {
  const unknown = order({ id: 9, symbol: 'NOPE', size: 1, openPrice: 1 });

  it('flags the whole group when one order has no contract size', () => {
    const [group] = buildOrderGroups(
      [order({ id: 1, symbol: 'NOPE', size: 1, openPrice: 1 }), unknown],
      { NOPE: quote('NOPE', 2) },
      {},
    );
    expect(group.profit).toBeNull();
    expect(group.profitUnavailable).toBe('unknown-instrument');
  });

  it('prefers the data error over a missing quote', () => {
    const [group] = buildOrderGroups([unknown], {}, {});
    expect(group.profitUnavailable).toBe('unknown-instrument');
  });

  it('still sums the orders it can compute', () => {
    const [group] = buildOrderGroups(
      [
        order({ id: 1, symbol: 'OK', size: 1, openPrice: 1 }),
        order({ id: 2, symbol: 'OK', size: 1, openPrice: 1 }),
      ],
      { OK: quote('OK', 3) },
      { OK: 1 },
    );
    expect(group.profit).toBe(4);
    expect(group.profitUnavailable).toBeNull();
  });
});
