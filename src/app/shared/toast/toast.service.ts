import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
}

const DEFAULT_DURATION_MS = 5000;

/** Minimal snackbar replacement – keeps a queue of messages that auto-dismiss. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, durationMs = DEFAULT_DURATION_MS): Toast {
    const toast: Toast = { id: ++this.nextId, message };
    this._toasts.update((list) => [...list, toast]);
    if (durationMs > 0) setTimeout(() => this.dismiss(toast.id), durationMs);
    return toast;
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
