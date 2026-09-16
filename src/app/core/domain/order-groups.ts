import { Order, OrderGroup, OrderRow, QuotesBySymbol } from '../models';
import { calculateProfit } from './profit';

export type ContractSizeBySymbol = Readonly<Record<string, number>>;

/** Contract size used when an instrument is missing from the instruments list. */
export const DEFAULT_CONTRACT_SIZE = 1;

export function toOrderRow(
  order: Order,
  quotes: QuotesBySymbol,
  contractSizes: ContractSizeBySymbol,
): OrderRow {
  const contractSize = contractSizes[order.symbol] ?? DEFAULT_CONTRACT_SIZE;
  const bid = quotes[order.symbol]?.b ?? null;
  const profit =
    bid === null
      ? null
      : calculateProfit({
          side: order.side,
          size: order.size,
          openPrice: order.openPrice,
          contractSize,
          priceBid: bid,
        });
  return { ...order, contractSize, bid, profit };
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
    orders,
  };
}

const sum = (values: number[]): number => values.reduce((acc, v) => acc + v, 0);
