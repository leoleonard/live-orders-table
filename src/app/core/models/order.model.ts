export type OrderSide = 'BUY' | 'SELL';

export interface Order {
  id: number;
  symbol: string;
  side: OrderSide;
  size: number;
  openPrice: number;
  openTime: number; // unix epoch in milliseconds
  swap: number;
}

/** Data needed to create a new order locally (id / swap are assigned by the store). */
export type NewOrder = Omit<Order, 'id' | 'swap'>;

export interface OrdersResponse {
  data: Order[];
}
