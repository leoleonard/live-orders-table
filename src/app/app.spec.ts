import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { QuotesSocket } from './core/api/quotes-socket.service';
import { QuotesSocketStub } from './core/api/quotes-socket.stub';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: QuotesSocket, useClass: QuotesSocketStub },
      ],
    }).compileComponents();
  });

  it('renders the header and the orders page', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    // resolve the bootstrap resource so the fixture can become stable
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((req) => req.url.endsWith('order-data.json')).flush({ data: [] });
    http.expectOne((req) => req.url.endsWith('instruments.json')).flush([]);
    http.expectOne((req) => req.url.endsWith('contract-types.json')).flush([]);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Zlecenia');
    expect(el.querySelector('app-orders-page')).not.toBeNull();
  });
});
