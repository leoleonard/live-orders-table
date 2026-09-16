import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ToastService();
  });

  afterEach(() => vi.useRealTimers());

  it('queues messages', () => {
    service.show('a');
    service.show('b');
    expect(service.toasts().map((t) => t.message)).toEqual(['a', 'b']);
  });

  it('auto-dismisses after the duration', () => {
    service.show('a', 1000);
    vi.advanceTimersByTime(999);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('dismisses manually and never auto-dismisses when duration is 0', () => {
    const toast = service.show('a', 0);
    vi.advanceTimersByTime(60_000);
    expect(service.toasts()).toHaveLength(1);
    service.dismiss(toast.id);
    expect(service.toasts()).toHaveLength(0);
  });
});
