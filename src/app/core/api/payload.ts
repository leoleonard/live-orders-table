import { ContractType, Instrument, Order, OrderSide, Quote } from '../models';

/** Thrown when a payload from the backend does not match the expected shape. */
export class InvalidPayloadError extends Error {
  constructor(what: string, detail: string) {
    super(`Invalid ${what} payload: ${detail}`);
    this.name = 'InvalidPayloadError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Rejects NaN / Infinity too – both would silently poison every aggregate downstream. */
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isSide = (value: unknown): value is OrderSide => value === 'BUY' || value === 'SELL';

function describe(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function isOrder(value: unknown): value is Order {
  return (
    isRecord(value) &&
    isFiniteNumber(value['id']) &&
    typeof value['symbol'] === 'string' &&
    value['symbol'] !== '' &&
    isSide(value['side']) &&
    isFiniteNumber(value['size']) &&
    isFiniteNumber(value['openPrice']) &&
    isFiniteNumber(value['openTime']) &&
    isFiniteNumber(value['swap'])
  );
}

function isInstrument(value: unknown): value is Instrument {
  return (
    isRecord(value) &&
    typeof value['symbol'] === 'string' &&
    value['symbol'] !== '' &&
    isFiniteNumber(value['contractType'])
  );
}

function isContractType(value: unknown): value is ContractType {
  return (
    isRecord(value) &&
    isFiniteNumber(value['contractType']) &&
    isFiniteNumber(value['contractSize'])
  );
}

function isQuote(value: unknown): value is Quote {
  return (
    isRecord(value) &&
    typeof value['s'] === 'string' &&
    value['s'] !== '' &&
    isFiniteNumber(value['b']) &&
    isFiniteNumber(value['a']) &&
    isFiniteNumber(value['t'])
  );
}

/**
 * HTTP payloads are validated strictly: the bootstrap data is loaded once and every record
 * feeds the money calculations, so a malformed record is surfaced as a load error rather
 * than silently dropped (which would quietly change the totals).
 */
function parseStrictArray<T>(
  what: string,
  raw: unknown,
  isItem: (value: unknown) => value is T,
): T[] {
  if (!Array.isArray(raw))
    throw new InvalidPayloadError(what, `expected an array, got ${describe(raw)}`);
  const invalid = raw.findIndex((item) => !isItem(item));
  if (invalid !== -1) {
    throw new InvalidPayloadError(
      what,
      `item at index ${invalid} is malformed: ${describe(raw[invalid])}`,
    );
  }
  return raw as T[];
}

export function parseOrdersResponse(raw: unknown): Order[] {
  if (!isRecord(raw))
    throw new InvalidPayloadError('orders', `expected an object, got ${describe(raw)}`);
  return parseStrictArray('orders', raw['data'], isOrder);
}

export const parseInstruments = (raw: unknown): Instrument[] =>
  parseStrictArray('instruments', raw, isInstrument);

export const parseContractTypes = (raw: unknown): ContractType[] =>
  parseStrictArray('contract types', raw, isContractType);

/**
 * Quote frames are validated leniently: prices stream continuously, so one malformed entry
 * must not tear down the feed. Bad entries are skipped and the rest of the frame is applied.
 */
export function parseQuotes(raw: unknown): Quote[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isQuote);
}
