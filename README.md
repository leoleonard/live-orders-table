# Orders table – zadanie rekrutacyjne (Frontend Developer)

Prosta aplikacja w Angularze prezentująca tabelę zleceń pogrupowanych po symbolu,
z profitem liczonym na żywo na podstawie kwotowań z WebSocketu, formularzem dodawania
zlecenia oraz motywem jasnym/ciemnym.

Opis decyzji projektowych i udziału AI: [NOTES.md](./NOTES.md).

## Stack

- Angular 22 (standalone components, signals, zoneless, nowa składnia control flow)
- TypeScript 6, SCSS
- [`@ngrx/signals`](https://ngrx.io/guide/signals) – zarządzanie stanem (Signal Store + entities)
- Vitest – testy jednostkowe
- brak bibliotek UI – tabela, formularz i snackbar napisane od zera

## Uruchomienie

Wymagany Node **≥ 22.22** (w repo jest `.nvmrc`).

```bash
nvm use
npm install
npm start          # http://localhost:4200
```

```bash
npm test           # testy jednostkowe (vitest)
npm run build      # build produkcyjny do dist/
```

## Struktura

```
src/app
├── core
│   ├── api        # OrdersApi (HttpClient), QuotesSocket (WebSocket + reconnect)
│   ├── config     # API_CONFIG – adresy endpointów
│   ├── domain     # czyste funkcje: calculateProfit, buildOrderGroups (+ testy)
│   ├── models     # typy domenowe
│   └── store      # OrdersStore, QuotesStore, ThemeStore (@ngrx/signals)
├── features
│   ├── orders     # OrdersPage (kontener) + OrdersTable, OrderForm (prezentacyjne)
│   └── theme-toggle
└── shared/toast   # minimalny snackbar (serwis + komponent)
```

## Funkcjonalności

- dane z 3 endpointów HTTP pobierane równolegle (`forkJoin`)
- grupowanie po `symbol`; wiersz grupy: liczba zleceń, suma `size`/`swap`/`profit`, średni `openPrice`
- rozwijanie grupy kliknięciem (także klawiaturą: Enter / Spacja)
- `openTime` w formacie `dd.MM.yyyy HH:mm:ss`
- zamykanie pojedynczego zlecenia lub całej grupy + komunikat
  „Zamknięto zlecenie nr …” (snackbar)
- profit = `(bid − openPrice) · size · contractSize · sideMultiplier`,
  `bid` z WebSocketu `wss://webquotes.geeksoft.pl/websocket/quotes`;
  subskrypcje symboli są synchronizowane z aktualnie otwartymi zleceniami
  (zamknięcie ostatniego zlecenia symbolu → `removelist`)
- formularz nowego zlecenia (symbol z listy z `order-data.json`, side, size, openPrice
  podpowiadany z aktualnego bida, openTime) z walidacją; zlecenie trafia tylko do stanu
- motyw jasny/ciemny wg palety z zadania: wykrywany z `prefers-color-scheme`,
  przełączany ręcznie, wybór zapamiętywany w `localStorage`
