import { Quote } from '../models';
import { SimulatedQuotesFeed } from './simulated-quotes-feed';

describe('SimulatedQuotesFeed', () => {
  let feed: SimulatedQuotesFeed;
  let frames: Quote[][];
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    // 0.5 => every symbol ticks (0.5 <= probability) and the price does not move
    feed = new SimulatedQuotesFeed(() => 0.5);
    frames = [];
    const subscription = feed.quotes$.subscribe((quotes) => frames.push(quotes));
    unsubscribe = () => subscription.unsubscribe();
  });

  afterEach(() => {
    unsubscribe();
    vi.useRealTimers();
  });

  it('is connected only while someone listens', () => {
    expect(feed.connected()).toBe(true);
    unsubscribe();
    expect(feed.connected()).toBe(false);
  });

  it('emits nothing until a symbol is watched', () => {
    vi.advanceTimersByTime(1000);
    expect(frames).toEqual([]);
  });

  it('quotes a newly watched symbol on the next tick, at its reference price', () => {
    feed.setSymbols(['EURUSD']);
    vi.advanceTimersByTime(250);

    expect(frames.length).toBe(1);
    const [quote] = frames[0];
    expect(quote.s).toBe('EURUSD');
    expect(quote.b).toBe(1.085);
    expect(quote.a).toBeGreaterThan(quote.b);
  });

  it('stops quoting a symbol as soon as it is no longer watched', () => {
    feed.setSymbols(['EURUSD', 'BTCUSD']);
    vi.advanceTimersByTime(250);
    feed.setSymbols(['BTCUSD']);
    vi.advanceTimersByTime(500);

    const later = frames.slice(1).flat();
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((q) => q.s === 'BTCUSD')).toBe(true);
  });

  it('restarts from the reference price when a symbol is watched again', () => {
    let value = 0.5;
    feed = new SimulatedQuotesFeed(() => value);
    const seen: Quote[] = [];
    const sub = feed.quotes$.subscribe((quotes) => seen.push(...quotes));

    feed.setSymbols(['XAUUSD']);
    value = 0.59; // still ticks, and moves the price up
    vi.advanceTimersByTime(1000);
    expect(seen.at(-1)?.b).toBeGreaterThan(2650);

    feed.setSymbols([]);
    feed.setSymbols(['XAUUSD']);
    seen.length = 0;
    vi.advanceTimersByTime(250);
    expect(seen[0].b).toBe(2650);
    sub.unsubscribe();
  });

  it('keeps each tick within the configured step', () => {
    feed = new SimulatedQuotesFeed(() => 0);
    const seen: Quote[] = [];
    const sub = feed.quotes$.subscribe((quotes) => seen.push(...quotes));
    feed.setSymbols(['US500']);
    vi.advanceTimersByTime(500);

    const [first, second] = seen;
    expect(second.b).toBeLessThan(first.b);
    expect(Math.abs(second.b / first.b - 1)).toBeLessThanOrEqual(0.0005);
    sub.unsubscribe();
  });

  it('falls back to a generic price for an unknown symbol', () => {
    feed.setSymbols(['???']);
    vi.advanceTimersByTime(250);
    expect(frames[0][0]).toMatchObject({ s: '???', b: 100 });
  });
});
