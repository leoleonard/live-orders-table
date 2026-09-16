import { DOCUMENT, effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  /** `true` once the user picked a theme manually – system changes are then ignored. */
  userOverride: boolean;
}

export const THEME_STORAGE_KEY = 'orders-app.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState<ThemeState>({ theme: 'light', userOverride: false }),
  withMethods((store) => ({
    setTheme(theme: Theme, userOverride = true): void {
      patchState(store, { theme, userOverride });
    },
    toggle(): void {
      patchState(store, { theme: store.theme() === 'dark' ? 'light' : 'dark', userOverride: true });
    },
  })),
  withHooks({
    onInit(store, document = inject(DOCUMENT)) {
      const window = document.defaultView;
      const media = window?.matchMedia?.(DARK_QUERY);

      // 1. stored user preference, 2. device theme
      const stored = readStoredTheme(window);
      if (stored) {
        store.setTheme(stored, true);
      } else if (media) {
        store.setTheme(media.matches ? 'dark' : 'light', false);
      }

      // follow device theme until the user overrides it
      media?.addEventListener('change', (e) => {
        if (!store.userOverride()) store.setTheme(e.matches ? 'dark' : 'light', false);
      });

      effect(() => {
        document.documentElement.dataset['theme'] = store.theme();
        if (store.userOverride()) writeStoredTheme(window, store.theme());
      });
    },
  }),
);

function readStoredTheme(window: Window | null): Theme | null {
  try {
    const value = window?.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(window: Window | null, theme: Theme): void {
  try {
    window?.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable (private mode etc.) – ignore */
  }
}
