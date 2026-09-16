import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast">
          <span class="toast__message">{{ toast.message }}</span>
          <button
            type="button"
            class="toast__close"
            (click)="toasts.dismiss(toast.id)"
            aria-label="Zamknij komunikat"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      inset-inline: 0;
      bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      pointer-events: none;
      z-index: 100;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 1rem;
      max-width: min(90vw, 40rem);
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      background: var(--color-toast-bg);
      color: var(--color-toast-fg);
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);
      animation: toast-in 150ms ease-out;
    }
    .toast__message {
      word-break: break-word;
    }
    .toast__close {
      background: none;
      border: 0;
      color: inherit;
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
      opacity: 0.7;
    }
    .toast__close:hover {
      opacity: 1;
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(0.5rem);
      }
    }
  `,
})
export class ToastComponent {
  protected readonly toasts = inject(ToastService);
}
