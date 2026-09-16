import { OrderSide } from '../models';

export interface ProfitInput {
  side: OrderSide;
  size: number;
  openPrice: number;
  contractSize: number;
  priceBid: number;
}

export const sideMultiplier = (side: OrderSide): 1 | -1 => (side === 'BUY' ? 1 : -1);

/** profit = (priceBid - openPrice) * size * contractSize * sideMultiplier */
export function calculateProfit({
  side,
  size,
  openPrice,
  contractSize,
  priceBid,
}: ProfitInput): number {
  return (priceBid - openPrice) * size * contractSize * sideMultiplier(side);
}
