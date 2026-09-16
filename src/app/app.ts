import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OrdersPageComponent } from './features/orders/orders-page.component';
import { ThemeToggleComponent } from './features/theme-toggle/theme-toggle.component';
import { ToastComponent } from './shared/toast/toast.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrdersPageComponent, ThemeToggleComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
