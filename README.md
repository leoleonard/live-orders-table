# Orders table – recruitment task (Frontend Developer)

A small Angular application that renders a table of trading orders grouped by symbol,
with profit computed live from WebSocket quotes, a form for adding new orders and a
light/dark theme.

Design decisions and the AI-usage disclosure: [NOTES.md](./NOTES.md).

## Stack

- Angular 22 (standalone components, signals, zoneless, new control flow)
- TypeScript 6, SCSS
- [`@ngrx/signals`](https://ngrx.io/guide/signals) – state management (Signal Store + entities)
- Vitest – unit tests, ESLint (angular-eslint), Prettier
- no UI libraries – the table, form and snackbar are written from scratch

## Getting started

Requires Node **≥ 22.22** (an `.nvmrc` is included).

```bash
nvm use
npm install
npm start          # http://localhost:4200
```

```bash
npm test           # unit tests (vitest)
npm run lint       # eslint + angular-eslint (incl. template accessibility rules)
npm run build      # production build into dist/
```

Browser support follows Angular 22's default browserslist (latest Chrome, Opera, Safari
and their previous versions); no vendor-specific APIs are used.

## Structure

```
src/app
├── core
│   ├── api        # OrdersApi (HttpClient), QuotesSocket (WebSocket + reconnect)
│   ├── config     # API_CONFIG – endpoint URLs
│   ├── domain     # pure functions: calculateProfit, buildOrderGroups (+ tests)
│   ├── models     # domain types
│   └── store      # OrdersStore, QuotesStore, ThemeStore (@ngrx/signals)
├── features
│   ├── orders     # OrdersPage (container) + OrdersTable, OrderForm (presentational)
│   └── theme-toggle
└── shared/toast   # minimal snackbar (service + component)
```

## Features

- data fetched from 3 HTTP endpoints in parallel (`forkJoin`) through an Angular `resource()`
- grouping by `symbol`; the group row shows the order count, summed `size`/`swap`/`profit`
  and the average `openPrice`
- groups expand on click (also via a keyboard-accessible button)
- `openTime` formatted as `dd.MM.yyyy HH:mm:ss`
- closing a single order or a whole group + a snackbar message
  “Zamknięto zlecenie nr …”
- profit = `(bid − openPrice) · size · contractSize · sideMultiplier`, with `bid`
  coming from the WebSocket `wss://webquotes.geeksoft.pl/websocket/quotes`;
  symbol subscriptions are kept in sync with the orders that are still open
  (closing the last order of a symbol sends `removelist`), the socket reconnects
  automatically
- new-order form (symbol from the list in `order-data.json`, side, size, openPrice
  pre-filled with the current bid, openTime) with validation; the order is added to
  application state only
- light/dark theme using the palette from the task: detected from
  `prefers-color-scheme`, switchable manually, the choice is persisted in `localStorage`
