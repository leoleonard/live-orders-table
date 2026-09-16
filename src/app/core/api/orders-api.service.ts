import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import { ContractType, Instrument, Order, OrdersResponse } from '../models';

export interface OrdersBootstrapData {
  orders: Order[];
  instruments: Instrument[];
  contractTypes: ContractType[];
}

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  getOrders(): Observable<Order[]> {
    return this.http.get<OrdersResponse>(this.config.ordersUrl).pipe(map((res) => res.data));
  }

  getInstruments(): Observable<Instrument[]> {
    return this.http.get<Instrument[]>(this.config.instrumentsUrl);
  }

  getContractTypes(): Observable<ContractType[]> {
    return this.http.get<ContractType[]>(this.config.contractTypesUrl);
  }

  /** Everything the orders table needs, fetched in parallel. */
  loadAll(): Observable<OrdersBootstrapData> {
    return forkJoin({
      orders: this.getOrders(),
      instruments: this.getInstruments(),
      contractTypes: this.getContractTypes(),
    });
  }
}
