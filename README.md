# Live Orders Table

A trading-style orders table in Angular 22: orders grouped by symbol, profit recalculated live from a stream of quotes, a form for adding orders, and a light/dark theme. No UI library - the table, form and snackbar are written from scratch.

**Live demo:** https://leoleonard.github.io/live-orders-table/

The demo runs without a backend: it loads bundled sample data and a simulated quote feed. Point `API_CONFIG` at real endpoints and the same code talks to an HTTP API and a quotes WebSocket (with reconnect and re-subscription). UI copy is in Polish.

Design decisions and how the project was built: [NOTES.md](./NOTES.md).

## Stack

- Angular 22 - standalone components, signals, zoneless, `resource()`, `linkedSignal`
- TypeScript 6, SCSS
- [`@ngrx/signals`](https://ngrx.io/guide/signals) - Signal Store for state
- RxJS for the WebSocket stream
- Vitest, ESLint (angular-eslint, including template accessibility rules), Prettier

## Getting started

Requires Node **>= 22.22** (an `.nvmrc` is included).

```bash
nvm use
npm install
npm start          # http://localhost:4200
npm test           # unit tests (vitest)
npm run lint
npm run build
```

## Structure

```
src/app
├── core
│   ├── api        # OrdersApi (HttpClient), QuotesSocket (WebSocket + reconnect),
│   │              # SimulatedQuotesFeed, payload validation
│   ├── config     # API_CONFIG - endpoint URLs
│   ├── domain     # pure functions: calculateProfit, buildOrderGroups
│   ├── models     # domain types
│   └── store      # OrdersStore, QuotesStore, ThemeStore (@ngrx/signals)
├── features
│   ├── orders     # OrdersPage (container) + OrdersTable, OrderForm (presentational)
│   └── theme-toggle
└── shared/toast   # minimal snackbar (service + component)
public/data        # sample orders, instruments and contract types
```

## Features

- three HTTP resources fetched in parallel through an Angular `resource()`, validated at the boundary before anything reaches the domain logic
- grouping by symbol; the group row shows the order count, summed size / swap / profit and the average open price
- groups expand on click and through a keyboard-accessible button
- closing a single order or a whole group, with a snackbar confirmation
- profit = `(bid - openPrice) * size * contractSize * sideMultiplier`, with `bid` from the quote stream; subscriptions follow the symbols that still have open orders
- quote frames are batched (100 ms) and groups are memoised per symbol, so a busy feed does not re-render the whole table
- new-order form with validation; open price is pre-filled with the current bid
- light/dark theme from `prefers-color-scheme`, switchable, persisted in `localStorage`

## Using a real backend

```ts
{ provide: API_CONFIG, useValue: {
    ordersUrl: 'https://example.com/orders.json',
    instrumentsUrl: 'https://example.com/instruments.json',
    contractTypesUrl: 'https://example.com/contract-types.json',
    quotesSocketUrl: 'wss://example.com/quotes',   // null = simulated feed
} }
```

The socket protocol is `{ p: '/subscribe/addlist' | '/subscribe/removelist', d: string[] }` outbound and `{ p: '/quotes/subscribed', d: Quote[] }` inbound.
