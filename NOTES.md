# NOTES

## Udział AI

Projekt powstał w parze z Claude Code (Claude Opus). Podział wyglądał tak:

- **Ja**: analiza zadania, decyzje architektoniczne (poniżej), wybór stacku
  (NgRx Signal Store, brak bibliotek UI, zakres testów), review i weryfikacja
  każdego pliku, testy manualne w przeglądarce, treść tego pliku.
- **AI z dużym udziałem**: szkielet projektu, większość kodu komponentów, store'ów
  i serwisów, SCSS, testy jednostkowe, README. Kod był generowany na podstawie
  ustalonej przeze mnie struktury i poprawiany po moim review.
- **Samodzielnie / z niewielkim udziałem**: doprecyzowanie wymagań (np. że „open
  price uśredniony” to średnia arytmetyczna, a nie ważona wolumenem), decyzja o
  utrzymywaniu listy symboli do formularza niezależnie od zamkniętych zleceń,
  weryfikacja działania WebSocketu (protokół, resubskrypcja po reconnect).

## Decyzje projektowe

1. **`@ngrx/signals` (Signal Store) zamiast klasycznego NgRx Store.** Aplikacja jest
   mała i w całości oparta na signals (zoneless, `OnPush`). Signal Store daje jawny,
   typowany stan i metody bez akcji/reducerów/efektów. `OrdersStore` korzysta z
   `withEntities` (edytowalna lista zleceń) i z `resource()` Angulara (stabilne od v22)
   dla jednorazowego pobrania danych – status/błąd/`reload()` są za darmo, a `effect`
   w `withHooks` przepisuje wynik do encji. `QuotesStore` trzyma mapę kwotowań, a stan
   socketu wystawia przez `withProps`; `ThemeStore` motyw.
2. **Logika domenowa jako czyste funkcje** (`core/domain`): `calculateProfit` i
   `buildOrderGroups` nie znają Angulara, więc są trywialne w testowaniu; store'y
   przechowują tylko surowe dane, a widok (grupy + profit) jest `computed()` w
   kontenerze. Dzięki temu profit przelicza się automatycznie przy każdym ticku.
3. **Kontener + komponenty prezentacyjne.** `OrdersPage` wstrzykuje store'y i
   składa dane; `OrdersTable` i `OrderForm` dostają tylko `input()` i emitują
   `output()`. Tabela posiada wyłącznie własny stan UI (które grupy są rozwinięte).
4. **Brak bibliotek UI.** Zadanie wyklucza biblioteki tabel, a snackbar/formularz to
   na tyle mało kodu, że Angular Material wnosiłby więcej (rozmiar bundle,
   theming pod narzuconą paletę) niż daje. Snackbar to ~30 linii serwisu na signalach.
5. **WebSocket przez `rxjs/webSocket`** z `retry` (reconnect po 2 s) i ponowną
   subskrypcją zapamiętanych symboli po otwarciu połączenia. Lista subskrypcji jest
   synchronizowana z symbolami, które mają otwarte zlecenia (`effect` w kontenerze),
   więc zamknięcie ostatniego zlecenia symbolu wysyła `removelist`.
6. **Profit `null` dopóki nie ma kwotowania** – zamiast pokazywać `0` (co byłoby
   nieprawdą) tabela pokazuje „—”; suma grupy pomija zlecenia bez kwotowania.
7. **Motyw**: zmienne CSS na `:root[data-theme]`; start z `prefers-color-scheme`,
   ręczny wybór zapisywany w `localStorage` i od tego momentu zmiany systemowe
   są ignorowane.
8. **Formularz**: typowany `FormGroup` z `NonNullableFormBuilder`; `openPrice`
   jest wypełniany aktualnym bidem przy zmianie symbolu (`effect` czyta kwotowania
   przez `untracked`, żeby tick z WebSocketu nie nadpisywał pola, które użytkownik
   właśnie edytuje); przycisk „bid: …” odświeża cenę na żądanie. Nowe zlecenie dostaje
   `id = max(id) + 1` i `swap = 0`.
9. **Tabela**: stan „rozwinięte grupy” to `linkedSignal` zależny od listy grup, więc
   symbol zamkniętej grupy jest automatycznie usuwany z zestawu. Rozwijanie działa
   kliknięciem w wiersz (wymaganie) i przyciskiem z `aria-expanded` dla klawiatury /
   czytników – bez `role="button"` na `<tr>`.

### Co odrzuciłem / zmieniłem po code review

- pierwszą wersję API `QuotesStore.syncSubscriptions(symbols, previous)`, która
  wymagała przekazywania poprzedniego stanu – zastąpiona przez `setSymbols()` w
  serwisie socketu, który sam zna swoje subskrypcje;
- `[disabled]` na przycisku „Dodaj zlecenie” – gorsza dostępność, a walidacja po
  `markAllAsTouched()` i tak pokazuje błędy;
- pierwszą wersję ładowania danych przez `rxMethod` + `tapResponse` z ręcznie
  utrzymywanym `status`/`error` – zastąpiona przez `resource()`;
- reconnect WebSocketu tylko przez `retry` – `WebSocketSubject` przy czystym
  zamknięciu przez serwer *kończy* strumień, więc potrzebny jest też `repeat`;
- `role="button"` + `keydown` na `<tr>` – klawisze na zagnieżdżonym przycisku
  „zamknij” przechodziły do wiersza i przełączały grupę; `<tr>` tracił semantykę.

## Co bym zmienił mając więcej czasu

- testy komponentów (rozwijanie grup, emitowanie zdarzeń, walidacja formularza)
  i test `QuotesSocket` z zamockowanym `WebSocket` (reconnect, resubskrypcja);
- wirtualizację / paginację tabeli – przy 200+ zleceniach jest OK, przy tysiącach
  `buildOrderGroups` przy każdym ticku byłby do zoptymalizowania (np. memoizacja
  per symbol albo `computed` per grupa);
- throttling aktualizacji z WebSocketu (np. `auditTime(100)`), żeby nie renderować
  częściej niż to potrzebne;
- i18n (teksty są po polsku na sztywno), formatowanie liczb z `LOCALE_ID`;
- sortowanie / filtrowanie kolumn, potwierdzenie przed zamknięciem grupy.
