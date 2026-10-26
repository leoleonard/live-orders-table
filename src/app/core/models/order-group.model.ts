import { Order } from './order.model';

/**
 * Why a profit could not be computed:
 * - `awaiting-quote`   – normal, the first quote for the symbol has not arrived yet,
 * - `unknown-instrument` – the symbol is missing from instruments / contract-types,
 *   which is a data problem and must not be silently defaulted away.
 */
export type ProfitUnavailableReason = 'awaiting-quote' | 'unknown-instrument';

/** A single order enriched with values derived from quotes / instruments. */
export interface OrderRow extends Order {
  /** `null` when the instrument is not in the instruments list. */
  contractSize: number | null;
  /** Current bid; `null` until the first quote for the symbol arrives. */
  bid: number | null;
  /** `null` while the profit cannot be computed – see `profitUnavailable`. */
  profit: number | null;
  /** Set exactly when `profit` is `null`. */
  profitUnavailable: ProfitUnavailableReason | null;
}

export interface OrderGroup {
  symbol: string;
  count: number;
  size: number;
  swap: number;
  /** Arithmetic mean of the open prices. */
  avgOpenPrice: number;
  /** Sum of the profits that could be computed; `null` when none could. */
  profit: number | null;
  /** Set when at least one order of the group has no profit. */
  profitUnavailable: ProfitUnavailableReason | null;
  /**
   * Detail rows – populated only while the group is expanded. Collapsed groups are the
   * common case and their rows are never rendered, so they are not built.
   */
  orders: readonly OrderRow[];
}
