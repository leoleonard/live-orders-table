import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import { ContractType, Instrument, Order } from '../models';
import { parseContractTypes, parseInstruments, parseOrdersResponse } from './payload';

export interface OrdersBootstrapData {
  orders: Order[];
  instruments: Instrument[];
  contractTypes: ContractType[];
}

/**
 * Loads the bootstrap data. Responses are typed as `unknown` on purpose: the shape is
 * validated here, at the boundary, so nothing unchecked reaches the domain logic.
 */
@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  getOrders(): Observable<Order[]> {
    return this.http.get<unknown>(this.config.ordersUrl).pipe(map(parseOrdersResponse));
  }

  getInstruments(): Observable<Instrument[]> {
    return this.http.get<unknown>(this.config.instrumentsUrl).pipe(map(parseInstruments));
  }

  getContractTypes(): Observable<ContractType[]> {
    return this.http.get<unknown>(this.config.contractTypesUrl).pipe(map(parseContractTypes));
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
