import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeStore } from '../../core/store/theme.store';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="toggle"
      role="switch"
      [attr.aria-checked]="theme.theme() === 'dark'"
      [attr.aria-label]="
        theme.theme() === 'dark' ? 'Przełącz na motyw jasny' : 'Przełącz na motyw ciemny'
      "
      (click)="theme.toggle()"
    >
      <span aria-hidden="true">{{ theme.theme() === 'dark' ? '☾' : '☀' }}</span>
      <span class="toggle__label">{{ theme.theme() === 'dark' ? 'Ciemny' : 'Jasny' }}</span>
    </button>
  `,
  styles: `
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-row);
      cursor: pointer;
    }
    .toggle:hover {
      background: var(--color-row-hover);
    }
    .toggle:focus-visible {
      outline: 2px solid var(--color-accent);
    }
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeStore);
}
