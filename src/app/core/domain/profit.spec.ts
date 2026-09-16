import { calculateProfit, sideMultiplier } from './profit';

describe('calculateProfit', () => {
  it('returns 1 for BUY and -1 for SELL', () => {
    expect(sideMultiplier('BUY')).toBe(1);
    expect(sideMultiplier('SELL')).toBe(-1);
  });

  it('computes profit for a BUY order', () => {
    // (110 - 100) * 2 * 10 * 1 = 200
    expect(
      calculateProfit({ side: 'BUY', size: 2, openPrice: 100, contractSize: 10, priceBid: 110 }),
    ).toBe(200);
  });

  it('inverts the sign for a SELL order', () => {
    expect(
      calculateProfit({ side: 'SELL', size: 2, openPrice: 100, contractSize: 10, priceBid: 110 }),
    ).toBe(-200);
  });

  it('is zero when bid equals open price', () => {
    expect(
      calculateProfit({ side: 'BUY', size: 1, openPrice: 50, contractSize: 100000, priceBid: 50 }),
    ).toBe(0);
  });
});
