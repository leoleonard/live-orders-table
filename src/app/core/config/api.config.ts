import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  ordersUrl: string;
  instrumentsUrl: string;
  contractTypesUrl: string;
  /**
   * WebSocket endpoint of a quotes server speaking the `/subscribe/addlist` protocol.
   * `null` runs the in-browser simulated feed instead, so the app works without a backend.
   */
  quotesSocketUrl: string | null;
}

/**
 * Defaults to the bundled sample data and the simulated feed. URLs are relative, so the
 * app can be served from any base path. Override the token to point at a real backend.
 */
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    ordersUrl: 'data/order-data.json',
    instrumentsUrl: 'data/instruments.json',
    contractTypesUrl: 'data/contract-types.json',
    quotesSocketUrl: null,
  }),
});
