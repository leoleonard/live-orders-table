# Notes

## How it was built

Built in a pair with Claude Code. The split:

- **Mine:** requirements analysis, the architecture and stack decisions below, review and verification of every file, manual testing in the browser, the fixes after code review.
- **AI, under my direction:** most of the implementation of components, stores, services, styles and unit tests, generated against the structure I defined and corrected after my review.

## Design decisions

1. **`@ngrx/signals` (Signal Store) instead of classic NgRx Store.** The app is small and signal-based end to end (zoneless, OnPush). Signal Store gives explicit, typed state and methods without actions, reducers and effects. `OrdersStore` loads data through Angular's `resource()` (status, error and `reload()` for free) and the order list is linked to it with `withLinkedState`: reloading the resource rebuilds the list, while `addOrder` / `closeOrder` write to the same signal in between.
2. **Domain logic as pure functions** (`core/domain`). `calculateProfit` and `buildOrderGroups` know nothing about Angular, so they are trivial to test. Stores hold raw data only; the view (groups + profit) is a `computed()` in the container, so profit follows every tick automatically.
3. **Container + presentational components.** `OrdersPage` injects the stores and composes the data; `OrdersTable` and `OrderForm` only take `input()` and emit `output()`. The table owns nothing but its UI state (which groups are expanded).
4. **No UI library.** A table, a form and a snackbar are little code; Angular Material would add more (bundle size, theming against a fixed palette) than it gives. The snackbar is about 30 lines of signal-based service.
5. **WebSocket through `rxjs/webSocket`** with `retry` (errors) and `repeat` (clean server close - `WebSocketSubject` _completes_ in that case), both after 2 s, and re-subscription of the remembered symbols once the connection opens. Callers only declare the wanted symbol set (`setSymbols`), so the subscription state cannot drift.
6. **One interface, two feeds.** `SimulatedQuotesFeed` has the same public surface as `QuotesSocket` and is selected by configuration in `provideQuotesFeed()`. Stores and components do not know which one they got.
7. **Validation at the boundary.** HTTP payloads are validated strictly - every record feeds money calculations, so a malformed one is a load error, not a silently different total. Quote frames are validated leniently - one bad entry must not tear down the stream.
8. **Profit is `null` until a quote arrives** - the table shows a dash rather than a misleading `0`; a group total skips orders without a quote. A symbol missing from the instrument list is surfaced as an error instead of defaulting the contract size to 1.
9. **Performance.** Groups are memoised per symbol, detail rows are built only for expanded groups, and quote frames are batched over 100 ms.
10. **Ids from a monotonic counter**, so the id of a closed order is never reused.
11. **Table accessibility.** Expanding works by clicking the row and by a button with `aria-expanded`; no `role="button"` on `<tr>`, which broke row semantics and caught key presses from the nested close button.
12. **Order form.** Typed `FormGroup`; the open price is filled with the current bid once per symbol choice, so later ticks do not overwrite what the user is editing. The selected symbol is added to the watched set, so a price is available even for a symbol with no open orders.

## Rejected along the way

- `QuotesStore.syncSubscriptions(symbols, previous)`, which made the caller pass the previous state - replaced by `setSymbols()` on the socket, which knows its own subscriptions.
- `[disabled]` on the submit button - worse accessibility; validation after `markAllAsTouched()` shows the errors anyway.
- Loading through `rxMethod` + `tapResponse` with hand-maintained status and error - replaced by `resource()`.
- Effects that copied data between pieces of state - replaced by declarative linking (`withLinkedState`, `linkedSignal`).

## With more time

- component tests (expanding groups, emitted events, form validation) and a `QuotesSocket` test against a mocked `WebSocket` (reconnect, re-subscription)
- virtualisation or pagination - with thousands of rows the DOM itself becomes the bottleneck
- i18n (copy is hard-coded in Polish) and number formatting from `LOCALE_ID`
