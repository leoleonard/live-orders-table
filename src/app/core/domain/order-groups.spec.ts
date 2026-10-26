import { Order } from '../models';
import { buildOrderGroups, createOrderGroupsProjector, toOrderRow } from './order-groups';

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

describe('createOrderGroupsProjector', () => {
  const btc1 = order({ id: 1, symbol: 'BTCUSD', size: 1, openPrice: 100 });
  const btc2 = order({ id: 2, symbol: 'BTCUSD', size: 2, openPrice: 200 });
  const eth = order({ id: 3, symbol: 'ETHUSD', size: 1, openPrice: 10 });
  const all = [btc1, btc2, eth];
  const sizes = { BTCUSD: 1, ETHUSD: 1 };
  const none = new Set<string>();

  it('returns the same group objects when nothing changed', () => {
    const project = createOrderGroupsProjector();
    const first = project(all, { BTCUSD: quote('BTCUSD', 150) }, sizes, none);
    const second = project(all, { BTCUSD: quote('BTCUSD', 150) }, sizes, none);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it('rebuilds only the symbol whose bid changed', () => {
    const project = createOrderGroupsProjector();
    const first = project(
      all,
      { BTCUSD: quote('BTCUSD', 150), ETHUSD: quote('ETHUSD', 20) },
      sizes,
      none,
    );
    const second = project(
      all,
      { BTCUSD: quote('BTCUSD', 151), ETHUSD: quote('ETHUSD', 20) },
      sizes,
      none,
    );
    expect(second[0]).not.toBe(first[0]); // BTCUSD repriced
    expect(second[1]).toBe(first[1]); // ETHUSD untouched
  });

  it('does not build detail rows for collapsed groups', () => {
    const project = createOrderGroupsProjector();
    const [btc] = project(all, { BTCUSD: quote('BTCUSD', 150) }, sizes, none);
    expect(btc.count).toBe(2);
    expect(btc.orders).toEqual([]);
    // (150-100)*1 + (150-200)*2 = -50
    expect(btc.profit).toBeCloseTo(-50);
  });

  it('builds detail rows once a group is expanded, and drops them again', () => {
    const project = createOrderGroupsProjector();
    project(all, { BTCUSD: quote('BTCUSD', 150) }, sizes, none);
    const [expandedBtc] = project(
      all,
      { BTCUSD: quote('BTCUSD', 150) },
      sizes,
      new Set(['BTCUSD']),
    );
    expect(expandedBtc.orders.map((o) => o.id)).toEqual([1, 2]);
    const [collapsedAgain] = project(all, { BTCUSD: quote('BTCUSD', 150) }, sizes, none);
    expect(collapsedAgain.orders).toEqual([]);
  });

  it('aggregates to the same numbers whether or not the group is expanded', () => {
    const project = createOrderGroupsProjector();
    const quotes = { BTCUSD: quote('BTCUSD', 150) };
    const [collapsed] = project(all, quotes, sizes, none);
    const [expanded] = project(all, quotes, sizes, new Set(['BTCUSD']));
    expect(expanded.profit).toBe(collapsed.profit);
    expect(expanded.size).toBe(collapsed.size);
    expect(expanded.swap).toBe(collapsed.swap);
    expect(expanded.avgOpenPrice).toBe(collapsed.avgOpenPrice);
    // and the sum still matches the individual rows
    expect(expanded.orders.reduce((acc, o) => acc + (o.profit ?? 0), 0)).toBe(expanded.profit);
  });

  it('rebuilds a symbol whose orders changed and forgets removed symbols', () => {
    const project = createOrderGroupsProjector();
    const quotes = { BTCUSD: quote('BTCUSD', 150), ETHUSD: quote('ETHUSD', 20) };
    const first = project(all, quotes, sizes, none);
    const withoutBtc2 = project([btc1, eth], quotes, sizes, none);
    expect(withoutBtc2[0]).not.toBe(first[0]);
    expect(withoutBtc2[0].count).toBe(1);
    expect(withoutBtc2[1]).toBe(first[1]); // ETHUSD identical despite the new array
    expect(project([eth], quotes, sizes, none).map((g) => g.symbol)).toEqual(['ETHUSD']);
  });

  it('reacts to a contract size arriving later', () => {
    const project = createOrderGroupsProjector();
    const quotes = { BTCUSD: quote('BTCUSD', 150) };
    const [before] = project(all, quotes, {}, none);
    expect(before.profitUnavailable).toBe('unknown-instrument');
    const [after] = project(all, quotes, sizes, none);
    expect(after.profitUnavailable).toBeNull();
    expect(after.profit).toBeCloseTo(-50);
  });
});
