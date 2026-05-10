import axios from 'axios';
import type {
  Candle,
  DividendEvent,
  Quote,
  Resolution,
  SearchResult,
  SplitEvent,
} from '@/types/stock';

const YAHOO_BASE_URL = import.meta.env.VITE_YAHOO_PROXY_URL ?? '/yahoo';
const yahoo = axios.create({ baseURL: YAHOO_BASE_URL, timeout: 12_000 });

interface YahooEvents {
  dividends?: Record<string, { amount: number; date: number }>;
  splits?: Record<
    string,
    { date: number; numerator: number; denominator: number; splitRatio?: string }
  >;
}

interface YahooChartResult {
  meta: {
    symbol: string;
    currency?: string;
    regularMarketPrice?: number;
    regularMarketOpen?: number;
    regularMarketPreviousClose?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    longName?: string;
    shortName?: string;
    exchangeName?: string;
    fullExchangeName?: string;
    marketCap?: number;
  };
  timestamp?: number[];
  events?: YahooEvents;
  indicators: {
    quote: [
      {
        open: (number | null)[];
        high: (number | null)[];
        low: (number | null)[];
        close: (number | null)[];
        volume: (number | null)[];
      },
    ];
  };
}

interface YahooChartResponse {
  chart: {
    result?: YahooChartResult[];
    error: { code: string; description: string } | null;
  };
}

interface YahooSearchResponse {
  quotes?: Array<{
    symbol: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    exchDisp?: string;
    quoteType?: string;
  }>;
}

const INTERVAL_MAP: Record<Resolution, { interval: string; range: string }> = {
  '1D': { interval: '1d', range: '2y' },
  '1W': { interval: '1wk', range: '5y' },
  '1M': { interval: '1mo', range: 'max' },
};

export interface ChartBundle {
  candles: Candle[];
  quote: Quote;
  dividends: DividendEvent[];
  splits: SplitEvent[];
}

/**
 * 包一層 retry：429 / 5xx / 網路錯誤指數退避一次。
 * 不重試的情況：4xx（除 429）—— 那通常是代號錯，重打也沒用。
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { response?: { status?: number } })?.response?.status;
      const retryable = status == null || status === 429 || status >= 500;
      if (!retryable || i === attempts - 1) throw err;
      // 250ms → 750ms 退避，加抖動避免同步重打
      const delay = 250 * Math.pow(3, i) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** 完整版：抓 K 線 + meta + events，給 StockDetail / Dashboard 主圖用 */
export async function yahooChart(
  symbol: string,
  resolution: Resolution,
): Promise<ChartBundle> {
  const { interval, range } = INTERVAL_MAP[resolution];
  const { data } = await withRetry(() =>
    yahoo.get<YahooChartResponse>(
      `/v8/finance/chart/${encodeURIComponent(symbol)}`,
      { params: { interval, range, includePrePost: false, events: 'div,split' } },
    ),
  );
  if (data.chart.error) throw new Error(data.chart.error.description);
  const result = data.chart.result?.[0];
  if (!result) throw new Error(`Yahoo 無此代號的資料：${symbol}`);

  const { meta, timestamp = [], indicators, events } = result;
  const q = indicators.quote[0];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamp.length; i += 1) {
    const o = q.open[i];
    const h = q.high[i];
    const l = q.low[i];
    const c = q.close[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({
      time: unixToISODate(timestamp[i]),
      open: r2(o),
      high: r2(h),
      low: r2(l),
      close: r2(c),
      volume: q.volume[i] ?? 0,
    });
  }

  const quote = buildQuoteFromMeta(meta, candles);

  const dividends: DividendEvent[] = events?.dividends
    ? Object.values(events.dividends).map((d) => ({
        date: unixToISODate(d.date),
        amount: r4(d.amount),
      }))
    : [];

  const splits: SplitEvent[] = events?.splits
    ? Object.values(events.splits).map((s) => ({
        date: unixToISODate(s.date),
        numerator: s.numerator,
        denominator: s.denominator,
        ratio: s.denominator > 0 ? s.numerator / s.denominator : 1,
      }))
    : [];

  return { candles, quote, dividends, splits };
}

export async function yahooQuote(symbol: string): Promise<Quote> {
  const { quote } = await yahooChart(symbol, '1D');
  return quote;
}

/**
 * 精簡版：每支只抓 5 天 1d K 線，比完整版省 ~100x 資料量。
 * 分批送 + 每支自帶 retry，避免 watchlist 變大後一次打掛被 429。
 */
export interface QuotesResult {
  quotes: Quote[];
  failed: string[];
}

const QUOTES_CHUNK_SIZE = 5;

async function fetchOneQuoteLite(sym: string): Promise<Quote> {
  const { data } = await withRetry(() =>
    yahoo.get<YahooChartResponse>(
      `/v8/finance/chart/${encodeURIComponent(sym)}`,
      { params: { interval: '1d', range: '5d', includePrePost: false } },
    ),
  );
  if (data.chart.error) throw new Error(data.chart.error.description);
  const result = data.chart.result?.[0];
  if (!result) throw new Error(`no data for ${sym}`);
  const { meta, timestamp = [], indicators } = result;
  const q = indicators.quote[0];
  const candles: Candle[] = [];
  for (let i = 0; i < timestamp.length; i += 1) {
    const o = q.open[i];
    const h = q.high[i];
    const l = q.low[i];
    const c = q.close[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({
      time: unixToISODate(timestamp[i]),
      open: r2(o),
      high: r2(h),
      low: r2(l),
      close: r2(c),
      volume: q.volume[i] ?? 0,
    });
  }
  return buildQuoteFromMeta(meta, candles);
}

export async function yahooQuotesLite(
  symbols: string[],
): Promise<QuotesResult> {
  if (symbols.length === 0) return { quotes: [], failed: [] };

  const quotes: Quote[] = [];
  const failed: string[] = [];

  for (let i = 0; i < symbols.length; i += QUOTES_CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + QUOTES_CHUNK_SIZE);
    const settled = await Promise.allSettled(chunk.map(fetchOneQuoteLite));
    settled.forEach((s, idx) => {
      if (s.status === 'fulfilled') quotes.push(s.value);
      else failed.push(chunk[idx]);
    });
  }

  return { quotes, failed };
}

export async function yahooSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const { data } = await withRetry(() =>
    yahoo.get<YahooSearchResponse>('/v1/finance/search', {
      params: { q: query, quotesCount: 8, newsCount: 0 },
    }),
  );
  return (data.quotes ?? [])
    .filter(
      (q) =>
        q.quoteType === 'EQUITY' ||
        q.quoteType === 'ETF' ||
        q.quoteType === 'INDEX',
    )
    .map((q) => ({
      symbol: q.symbol,
      name: q.longname ?? q.shortname ?? q.symbol,
      exchange: q.exchDisp ?? q.exchange ?? 'N/A',
    }));
}

function buildQuoteFromMeta(
  meta: YahooChartResult['meta'],
  candles: Candle[],
): Quote {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const price = meta.regularMarketPrice ?? last?.close ?? 0;
  const prevClose =
    meta.regularMarketPreviousClose ??
    meta.previousClose ??
    prev?.close ??
    meta.chartPreviousClose ??
    last?.close ??
    0;
  const change = r2(price - prevClose);
  const changePercent = prevClose ? r2((change / prevClose) * 100) : 0;
  const avgVolume = estimateAvgVolume(candles, 20);
  const fiftyTwoWeekHigh =
    meta.fiftyTwoWeekHigh ?? estimateRecent(candles, 'high', 252);
  const fiftyTwoWeekLow =
    meta.fiftyTwoWeekLow ?? estimateRecent(candles, 'low', 252);

  return {
    symbol: meta.symbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol,
    price: r2(price),
    change,
    changePercent,
    previousClose: r2(prevClose),
    open: meta.regularMarketOpen != null ? r2(meta.regularMarketOpen) : last?.open,
    dayHigh: meta.regularMarketDayHigh ?? last?.high,
    dayLow: meta.regularMarketDayLow ?? last?.low,
    fiftyTwoWeekHigh: fiftyTwoWeekHigh != null ? r2(fiftyTwoWeekHigh) : undefined,
    fiftyTwoWeekLow: fiftyTwoWeekLow != null ? r2(fiftyTwoWeekLow) : undefined,
    volume: meta.regularMarketVolume ?? last?.volume,
    avgVolume,
    currency: meta.currency ?? 'USD',
    exchangeName: meta.fullExchangeName ?? meta.exchangeName,
    marketCap: meta.marketCap,
  };
}

function unixToISODate(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function r4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function estimateAvgVolume(candles: Candle[], window: number): number | undefined {
  if (candles.length === 0) return undefined;
  const slice = candles.slice(-window);
  const sum = slice.reduce((s, c) => s + (c.volume || 0), 0);
  return slice.length ? Math.round(sum / slice.length) : undefined;
}

function estimateRecent(
  candles: Candle[],
  key: 'high' | 'low',
  window: number,
): number | undefined {
  if (candles.length === 0) return undefined;
  const slice = candles.slice(-window);
  if (key === 'high') return Math.max(...slice.map((c) => c.high));
  return Math.min(...slice.map((c) => c.low));
}
