import {
  InvalidPayloadError,
  parseContractTypes,
  parseInstruments,
  parseOrdersResponse,
  parseQuotes,
} from './payload';

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  symbol: 'BTCUSD',
  side: 'BUY',
  size: 0.1,
  openPrice: 100,
  openTime: 1750740422000,
  swap: -1,
  ...overrides,
});

describe('parseOrdersResponse', () => {
  it('accepts a well-formed payload', () => {
    expect(parseOrdersResponse({ data: [order()] })).toEqual([order()]);
  });

  it.each([
    ['not an object', 'null'],
    ['a missing data array', { nope: [] }],
    ['data that is not an array', { data: 'x' }],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseOrdersResponse(raw === 'null' ? null : raw)).toThrow(InvalidPayloadError);
  });

  it.each([
    ['a non-numeric size', { size: '0.1' }],
    ['NaN as openPrice', { openPrice: Number.NaN }],
    ['Infinity as swap', { swap: Number.POSITIVE_INFINITY }],
    ['an unknown side', { side: 'LONG' }],
    ['an empty symbol', { symbol: '' }],
    ['a missing id', { id: undefined }],
  ])('rejects an order with %s', (_label, overrides) => {
    expect(() => parseOrdersResponse({ data: [order(overrides)] })).toThrow(InvalidPayloadError);
  });

  it('names the offending index so the error is actionable', () => {
    expect(() => parseOrdersResponse({ data: [order(), order({ size: null })] })).toThrow(
      /index 1/,
    );
  });
});

describe('parseInstruments / parseContractTypes', () => {
  it('accept well-formed payloads', () => {
    expect(parseInstruments([{ symbol: 'BTCUSD', contractType: 0 }])).toHaveLength(1);
    expect(parseContractTypes([{ contractType: 0, contractSize: 1 }])).toHaveLength(1);
  });

  it('reject malformed records', () => {
    expect(() => parseInstruments([{ symbol: 'BTCUSD' }])).toThrow(InvalidPayloadError);
    expect(() => parseContractTypes([{ contractType: 0, contractSize: '1' }])).toThrow(
      InvalidPayloadError,
    );
  });
});

describe('parseQuotes', () => {
  const quote = { s: 'BTCUSD', b: 1, a: 2, t: 3 };

  it('keeps valid quotes', () => {
    expect(parseQuotes([quote])).toEqual([quote]);
  });

  it('skips malformed entries instead of failing the whole frame', () => {
    expect(parseQuotes([quote, { s: 'X', b: 'nope', a: 2, t: 3 }, { b: 1 }])).toEqual([quote]);
  });

  it('never lets NaN through as a price', () => {
    expect(parseQuotes([{ s: 'X', b: Number.NaN, a: 2, t: 3 }])).toEqual([]);
  });

  it('returns an empty list for a non-array payload', () => {
    expect(parseQuotes(undefined)).toEqual([]);
    expect(parseQuotes({ d: [] })).toEqual([]);
  });
});
