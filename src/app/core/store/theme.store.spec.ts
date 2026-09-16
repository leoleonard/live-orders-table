import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeStore } from './theme.store';

describe('ThemeStore', () => {
  let prefersDark: boolean;
  let mediaListener: ((e: MediaQueryListEvent) => void) | null;

  beforeEach(() => {
    prefersDark = false;
    mediaListener = null;
    localStorage.clear();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        get matches() {
          return prefersDark;
        },
        addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => (mediaListener = cb),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset['theme'];
  });

  const init = () => {
    const store = TestBed.inject(ThemeStore);
    TestBed.tick();
    return store;
  };

  it('follows the device theme by default and reflects it on <html>', () => {
    prefersDark = true;
    const store = init();
    expect(store.theme()).toBe('dark');
    expect(store.userOverride()).toBe(false);
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('prefers a stored user choice over the device theme', () => {
    prefersDark = true;
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const store = init();
    expect(store.theme()).toBe('light');
    expect(store.userOverride()).toBe(true);
  });

  it('toggling persists the choice and stops following device changes', () => {
    const store = init();
    store.toggle();
    TestBed.tick();
    expect(store.theme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    mediaListener?.({ matches: false } as MediaQueryListEvent);
    expect(store.theme()).toBe('dark');
  });

  it('reacts to device theme changes while there is no user override', () => {
    const store = init();
    expect(store.theme()).toBe('light');
    mediaListener?.({ matches: true } as MediaQueryListEvent);
    TestBed.tick();
    expect(store.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
