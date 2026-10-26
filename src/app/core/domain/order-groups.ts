import { Order, OrderGroup, OrderRow, ProfitUnavailableReason, QuotesBySymbol } from '../models';
import { calculateProfit } from './profit';

export type ContractSizeBySymbol = Readonly<Record<string, number>>;

const NO_ORDERS: readonly OrderRow[] = [];

/** All orders of a group share the symbol, so they share the bid and the contract size. */
function unavailableReason(
  bid: number | null,
  contractSize: number | null,
): ProfitUnavailableReason | null {
  if (contractSize === null) return 'unknown-instrument';
  if (bid === null) return 'awaiting-quote';
  return null;
}

export function toOrderRow(
  order: Order,
  quotes: QuotesBySymbol,
  contractSizes: ContractSizeBySymbol,
): OrderRow {
  // No fallback contract size: an unknown instrument is a data problem, and defaulting to 1
  // would silently produce a wrong profit instead of surfacing it.
  return buildRow(order, quotes[order.symbol]?.b ?? null, contractSizes[order.symbol] ?? null);
}

function buildRow(order: Order, bid: number | null, contractSize: number | null): OrderRow {
  const unavailable = unavailableReason(bid, contractSize);
  return {
    ...order,
    contractSize,
    bid,
    profit:
      unavailable !== null
        ? null
        : calculateProfit({
            side: order.side,
            size: order.size,
            openPrice: order.openPrice,
            contractSize: contractSize as number,
            priceBid: bid as number,
          }),
    profitUnavailable: unavailable,
  };
}

function buildGroup(
  symbol: string,
  orders: readonly Order[],
  bid: number | null,
  contractSize: number | null,
  expanded: boolean,
): OrderGroup {
  const unavailable = unavailableReason(bid, contractSize);

  // One pass for the aggregates, in the original order so the floating-point result is
  // identical to summing the individual rows.
  let size = 0;
  let swap = 0;
  let openPriceSum = 0;
  let profit = unavailable === null ? 0 : null;
  for (const order of orders) {
    size += order.size;
    swap += order.swap;
    openPriceSum += order.openPrice;
    if (profit !== null) {
      profit += calculateProfit({
        side: order.side,
        size: order.size,
        openPrice: order.openPrice,
        contractSize: contractSize as number,
        priceBid: bid as number,
      });
    }
  }

  return {
    symbol,
    count: orders.length,
    size,
    swap,
    avgOpenPrice: openPriceSum / orders.length,
    profit,
    profitUnavailable: unavailable,
    // Detail rows are built only when the group is open – collapsed groups are the common
    // case and their rows are never rendered.
    orders: expanded ? orders.map((order) => buildRow(order, bid, contractSize)) : NO_ORDERS,
  };
}

function groupBySymbol(orders: readonly Order[]): Map<string, Order[]> {
  const bySymbol = new Map<string, Order[]>();
  for (const order of orders) {
    const existing = bySymbol.get(order.symbol);
    if (existing) existing.push(order);
    else bySymbol.set(order.symbol, [order]);
  }
  return bySymbol;
}

const sameOrders = (a: readonly Order[], b: readonly Order[]): boolean =>
  a.length === b.length && a.every((order, i) => order === b[i]);

interface CacheEntry {
  orders: readonly Order[];
  bid: number | null;
  contractSize: number | null;
  expanded: boolean;
  group: OrderGroup;
}

export type OrderGroupsProjector = (
  orders: readonly Order[],
  quotes: QuotesBySymbol,
  contractSizes: ContractSizeBySymbol,
  expanded: ReadonlySet<string>,
) => OrderGroup[];

/**
 * Builds the table rows, memoised per symbol.
 *
 * A quote frame typically touches a handful of symbols, so rebuilding all ~108 groups on
 * every tick is wasted work. Groups whose orders, bid, contract size and expanded state are
 * unchanged are returned as the *same object*, which lets change detection skip their rows.
 *
 * Groups keep first-appearance order, as before.
 */
export function createOrderGroupsProjector(): OrderGroupsProjector {
  const cache = new Map<string, CacheEntry>();
  let lastOrders: readonly Order[] | null = null;
  let bySymbol = new Map<string, Order[]>();

  return (orders, quotes, contractSizes, expanded) => {
    // The order list only changes on add / close / reload – never on a quote tick.
    if (orders !== lastOrders) {
      lastOrders = orders;
      bySymbol = groupBySymbol(orders);
      for (const [symbol, entry] of cache) {
        const current = bySymbol.get(symbol);
        if (!current) cache.delete(symbol);
        else if (!sameOrders(current, entry.orders)) cache.delete(symbol);
        else entry.orders = current;
      }
    }

    const groups: OrderGroup[] = [];
    for (const [symbol, symbolOrders] of bySymbol) {
      const bid = quotes[symbol]?.b ?? null;
      const contractSize = contractSizes[symbol] ?? null;
      const isExpanded = expanded.has(symbol);
      const cached = cache.get(symbol);

      if (
        cached &&
        cached.bid === bid &&
        cached.contractSize === contractSize &&
        cached.expanded === isExpanded
      ) {
        groups.push(cached.group);
        continue;
      }

      const group = buildGroup(symbol, symbolOrders, bid, contractSize, isExpanded);
      cache.set(symbol, { orders: symbolOrders, bid, contractSize, expanded: isExpanded, group });
      groups.push(group);
    }
    return groups;
  };
}

/**
 * Groups orders by symbol and aggregates them: size / swap / profit are summed, openPrice is
 * averaged. Stateless convenience wrapper – the app uses `createOrderGroupsProjector`.
 */
export function buildOrderGroups(
  orders: readonly Order[],
  quotes: QuotesBySymbol,
  contractSizes: ContractSizeBySymbol,
  expanded: ReadonlySet<string> = ALL_EXPANDED,
): OrderGroup[] {
  return createOrderGroupsProjector()(orders, quotes, contractSizes, expanded);
}

/** Set-like that reports every symbol as expanded (used by the stateless wrapper and tests). */
const ALL_EXPANDED: ReadonlySet<string> = {
  has: () => true,
  size: Number.POSITIVE_INFINITY,
  keys: () => [][Symbol.iterator](),
  values: () => [][Symbol.iterator](),
  entries: () => [][Symbol.iterator](),
  forEach: () => undefined,
  [Symbol.iterator]: () => [][Symbol.iterator](),
} as ReadonlySet<string>;
