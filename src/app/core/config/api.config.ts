import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  ordersUrl: string;
  instrumentsUrl: string;
  contractTypesUrl: string;
  quotesSocketUrl: string;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    ordersUrl: 'https://geeksoft.pl/assets/2026-task/order-data.json',
    instrumentsUrl: 'https://geeksoft.pl/assets/2026-task/instruments.json',
    contractTypesUrl: 'https://geeksoft.pl/assets/2026-task/contract-types.json',
    quotesSocketUrl: 'wss://webquotes.geeksoft.pl/websocket/quotes',
  }),
});
