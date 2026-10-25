import { Order, OrderGroup, OrderRow, ProfitUnavailableReason, QuotesBySymbol } from '../models';
import { calculateProfit } from './profit';

export type ContractSizeBySymbol = Readonly<Record<string, number>>;

export function toOrderRow(
  order: Order,
  quotes: QuotesBySymbol,
  contractSizes: ContractSizeBySymbol,
): OrderRow {
  // No fallback contract size: an unknown instrument is a data problem, and defaulting to 1
  // would silently produce a wrong profit instead of surfacing it.
  const contractSize = contractSizes[order.symbol] ?? null;
  const bid = quotes[order.symbol]?.b ?? null;

  if (contractSize === null) {
    return { ...order, contractSize, bid, profit: null, profitUnavailable: 'unknown-instrument' };
  }
  if (bid === null) {
    return { ...order, contractSize, bid, profit: null, profitUnavailable: 'awaiting-quote' };
  }
  return {
    ...order,
    contractSize,
    bid,
    profit: calculateProfit({
      side: order.side,
      size: order.size,
      openPrice: order.openPrice,
      contractSize,
      priceBid: bid,
    }),
    profitUnavailable: null,
  };
}

/**
 * Groups orders by symbol (preserving first-appearance order) and aggregates:
 * size / swap / profit are summed, openPrice is averaged.
 */
export function buildOrderGroups(
  orders: readonly Order[],
  quotes: QuotesBySymbol,
  contractSizes: ContractSizeBySymbol,
): OrderGroup[] {
  const groups = new Map<string, OrderRow[]>();
  for (const order of orders) {
    const rows = groups.get(order.symbol) ?? [];
    rows.push(toOrderRow(order, quotes, contractSizes));
    groups.set(order.symbol, rows);
  }

  return [...groups].map(([symbol, rows]) => aggregateGroup(symbol, rows));
}

function aggregateGroup(symbol: string, orders: OrderRow[]): OrderGroup {
  const profits = orders.map((o) => o.profit).filter((p): p is number => p !== null);
  return {
    symbol,
    count: orders.length,
    size: sum(orders.map((o) => o.size)),
    swap: sum(orders.map((o) => o.swap)),
    avgOpenPrice: sum(orders.map((o) => o.openPrice)) / orders.length,
    profit: profits.length ? sum(profits) : null,
    profitUnavailable: groupUnavailableReason(orders),
    orders,
  };
}

/** A missing instrument outranks a missing quote: it is an error, not a waiting state. */
function groupUnavailableReason(orders: OrderRow[]): ProfitUnavailableReason | null {
  if (orders.some((o) => o.profitUnavailable === 'unknown-instrument')) return 'unknown-instrument';
  if (orders.some((o) => o.profitUnavailable === 'awaiting-quote')) return 'awaiting-quote';
  return null;
}

const sum = (values: number[]): number => values.reduce((acc, v) => acc + v, 0);
