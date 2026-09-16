import { Order } from './order.model';

/** A single order enriched with values derived from quotes / instruments. */
export interface OrderRow extends Order {
  contractSize: number;
  /** Current bid; `null` until the first quote for the symbol arrives. */
  bid: number | null;
  /** `null` while the profit cannot be computed (no quote yet). */
  profit: number | null;
}

export interface OrderGroup {
  symbol: string;
  count: number;
  size: number;
  swap: number;
  /** Arithmetic mean of the open prices. */
  avgOpenPrice: number;
  /** Sum of order profits; `null` when none of the orders has a profit yet. */
  profit: number | null;
  orders: OrderRow[];
}
