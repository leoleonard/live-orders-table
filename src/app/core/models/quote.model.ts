export interface Quote {
  /** symbol */
  s: string;
  /** bid */
  b: number;
  /** ask */
  a: number;
  /** unix timestamp (seconds) */
  t: number;
}

export type QuotesBySymbol = Readonly<Record<string, Quote>>;

export type QuotesCommand =
  { p: '/subscribe/addlist'; d: string[] } | { p: '/subscribe/removelist'; d: string[] };

export interface QuotesSubscribedMessage {
  p: '/quotes/subscribed';
  d: Quote[];
}

/** Any other frame the server may send (acks etc.) – we only care about `p`. */
export interface QuotesGenericMessage {
  p: string;
  [key: string]: unknown;
}

export type QuotesServerMessage = QuotesSubscribedMessage | QuotesGenericMessage;

export const isQuotesSubscribedMessage = (m: QuotesServerMessage): m is QuotesSubscribedMessage =>
  m.p === '/quotes/subscribed' && Array.isArray((m as QuotesSubscribedMessage).d);
