import axios from 'axios';
import type { Candle, Quote, Resolution, SearchResult } from '@/types/stock';

const YAHOO_BASE_URL = import.meta.env.VITE_YAHOO_PROXY_URL ?? '/yahoo';
const yahoo = axios.create({ baseURL: YAHOO_BASE_URL, timeout: 12_000 });

interface YahooChartResult {
  meta: {
    symbol: string;
    currency?: string;
    regularMarketPrice?: number;
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

export async function yahooChart(
  symbol: string,
  resolution: Resolution,
): Promise<{ candles: Candle[]; quote: Quote }> {
  const { interval, range } = INTERVAL_MAP[resolution];
  const { data } = await yahoo.get<YahooChartResponse>(
    `/v8/finance/chart/${encodeURIComponent(symbol)}`,
    { params: { interval, range, includePrePost: false } },
  );
  if (data.chart.error) throw new Error(data.chart.error.description);
  const result = data.chart.result?.[0];
  if (!result) throw new Error(`Yahoo 無此代號的資料：${symbol}`);

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
  const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh ?? estimateRecent(candles, 'high', 252);
  const fiftyTwoWeekLow = meta.fiftyTwoWeekLow ?? estimateRecent(candles, 'low', 252);

  const quote: Quote = {
    symbol: meta.symbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol,
    price: r2(price),
    change,
    changePercent,
    previousClose: r2(prevClose),
    open: meta.regularMarketPrice != null && last ? r2(last.open) : last?.open,
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

  return { candles, quote };
}

export async function yahooQuote(symbol: string): Promise<Quote> {
  const { quote } = await yahooChart(symbol, '1D');
  return quote;
}

export async function yahooQuotes(symbols: string[]): Promise<Quote[]> {
  const results = await Promise.allSettled(symbols.map(yahooQuote));
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export async function yahooSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const { data } = await yahoo.get<YahooSearchResponse>('/v1/finance/search', {
    params: { q: query, quotesCount: 8, newsCount: 0 },
  });
  return (data.quotes ?? [])
    .filter((q) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'INDEX')
    .map((q) => ({
      symbol: q.symbol,
      name: q.longname ?? q.shortname ?? q.symbol,
      exchange: q.exchDisp ?? q.exchange ?? 'N/A',
    }));
}

function unixToISODate(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
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
