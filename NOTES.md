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
   typowany stan i metody bez akcji/reducerów/efektów. `OrdersStore` pobiera dane przez
   `resource()` Angulara (stabilne od v22 – status/błąd/`reload()` za darmo), a lista
   zleceń jest z nim **powiązana** przez `withLinkedState`: przeładowanie zasobu odtwarza
   listę, a `addOrder`/`closeOrder` piszą do tego samego sygnału pomiędzy. Dostęp po id
   zapewnia `computed` z mapą. `QuotesStore` trzyma mapę kwotowań, a stan socketu
   wystawia przez `withProps`; `ThemeStore` motyw.
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
   jest wypełniany aktualnym bidem **raz** po wyborze symbolu (gdy tylko kwotowanie
   jest dostępne – kolejne ticki nie nadpisują pola, które użytkownik edytuje);
   przycisk „bid: …” odświeża cenę na żądanie. Wybrany w formularzu symbol jest
   dopisywany do listy subskrybowanych na WebSockecie, więc cena jest dostępna także
   dla symbolu bez otwartych zleceń. Nowe zlecenie dostaje `swap = 0` i numer z licznika
   monotonicznego (`lastIssuedId`), więc identyfikator zamkniętego zlecenia nigdy nie wraca.
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

## Po feedbacku z code review

Po otrzymaniu feedbacku poprawiłem wskazane kwestie (po jednym commicie na temat):
usunięta nieużywana zależność i stub testowy poza kodem produkcyjnym, zawężone publiczne
API `QuotesSocket`, walidacja payloadów HTTP/WS na granicy aplikacji (strict dla HTTP,
pobłażliwa dla strumienia cen), jawny błąd zamiast `contractSize = 1`, monotoniczny licznik
identyfikatorów, zapominanie ceny przy `removelist`, usunięta zależność efektu subskrypcji
od stanu połączenia, deklaratywne wiązanie stanu (`withLinkedState`) zamiast efektów
przenoszących dane oraz memoizacja grup per symbol wraz z budowaniem wierszy szczegółowych
tylko dla rozwiniętych grup i kubełkowaniem kwotowań (100 ms).

## Co bym zmienił mając więcej czasu

- testy komponentów (rozwijanie grup, emitowanie zdarzeń, walidacja formularza)
  i test `QuotesSocket` z zamockowanym `WebSocket` (reconnect, resubskrypcja);
- wirtualizację / paginację tabeli – memoizacja per symbol i kubełkowanie ticków są już
  zrobione, ale przy tysiącach wierszy sam DOM stałby się wąskim gardłem;
- i18n (teksty są po polsku na sztywno), formatowanie liczb z `LOCALE_ID`;
- sortowanie / filtrowanie kolumn, potwierdzenie przed zamknięciem grupy.
