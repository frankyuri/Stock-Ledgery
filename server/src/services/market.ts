import axios from 'axios';
import { redis } from '../plugins/redis.js';
import { config } from '../config/env.js';

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  volume?: number;
  avgVolume?: number;
  currency: string;
  exchangeName?: string;
  marketCap?: number;
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DividendEvent {
  date: string;
  amount: number;
}

export interface SplitEvent {
  date: string;
  numerator: number;
  denominator: number;
  ratio: number;
}

export interface ChartBundle {
  candles: Candle[];
  quote: Quote;
  dividends: DividendEvent[];
  splits: SplitEvent[];
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

const http = axios.create({
  baseURL: config.YAHOO_BASE_URL,
  timeout: 10_000,
  headers: {
    'User-Agent': config.YAHOO_USER_AGENT,
    Accept: 'application/json',
  },
});

const INTERVAL_MAP: Record<string, { interval: string; range: string }> = {
  '1D': { interval: '1d', range: '2y' },
  '1W': { interval: '1wk', range: '5y' },
  '1M': { interval: '1mo', range: 'max' },
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseYahooMetaToQuote(meta: any): Quote {
  const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
  const previousClose =
    meta.chartPreviousClose ??
    meta.regularMarketPreviousClose ??
    meta.previousClose ??
    price;
  const change = round(price - previousClose);
  const changePercent = previousClose ? round((change / previousClose) * 100) : 0;

  return {
    symbol: meta.symbol,
    name: meta.longName || meta.shortName || meta.symbol,
    price: round(price),
    change,
    changePercent,
    previousClose: round(previousClose),
    open: meta.regularMarketOpen ? round(meta.regularMarketOpen) : undefined,
    dayHigh: meta.regularMarketDayHigh ? round(meta.regularMarketDayHigh) : undefined,
    dayLow: meta.regularMarketDayLow ? round(meta.regularMarketDayLow) : undefined,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ? round(meta.fiftyTwoWeekHigh) : undefined,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ? round(meta.fiftyTwoWeekLow) : undefined,
    volume: meta.regularMarketVolume,
    currency: meta.currency || (/\.TW$/i.test(meta.symbol) ? 'TWD' : 'USD'),
    exchangeName: meta.exchangeName || meta.fullExchangeName,
    marketCap: meta.marketCap,
  };
}

/**
 * 取得單一股票即時報價 (附帶 Redis 快取與 Stale 降級)
 */
export async function fetchQuote(symbol: string): Promise<{ quote: Quote; stale: boolean }> {
  const cacheKey = `quote:${symbol.toUpperCase()}`;
  const staleKey = `stale:quote:${symbol.toUpperCase()}`;

  // 1. 檢查快取
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return { quote: JSON.parse(cached), stale: false };
    }
  } catch (err) {
    console.warn('[Redis Read Warn]', (err as Error).message);
  }

  // 2. 向 Yahoo 請求
  try {
    const { data } = await http.get(`/v8/finance/chart/${encodeURIComponent(symbol)}`, {
      params: { interval: '1d', range: '1d', includePrePost: false },
    });

    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error(`No meta returned for ${symbol}`);

    const quote = parseYahooMetaToQuote(meta);

    // 快取 25 秒 (盤中) / 300 秒 (盤後)，並保存 Stale 資料供降級
    try {
      await redis.set(cacheKey, JSON.stringify(quote), 'EX', 25);
      await redis.set(staleKey, JSON.stringify(quote), 'EX', 86400 * 7); // 保留7天
    } catch {}

    return { quote, stale: false };
  } catch (err) {
    console.warn(`[Market Quote Error for ${symbol}]:`, (err as Error).message);
    // 3. 嘗試讀取 Stale 資料降級回傳
    try {
      const staleData = await redis.get(staleKey);
      if (staleData) {
        return { quote: JSON.parse(staleData), stale: true };
      }
    } catch {}

    throw new Error(`無法取得標的 ${symbol} 的即時報價`);
  }
}

/**
 * 批次取得多檔股票即時報價
 */
export async function fetchQuotes(
  symbols: string[]
): Promise<{ quotes: Quote[]; failed: string[]; stale: boolean }> {
  if (symbols.length === 0) return { quotes: [], failed: [], stale: false };

  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const quotes: Quote[] = [];
  const failed: string[] = [];
  let hasStale = false;

  await Promise.allSettled(
    unique.map(async (sym) => {
      try {
        const res = await fetchQuote(sym);
        quotes.push(res.quote);
        if (res.stale) hasStale = true;
      } catch (err) {
        failed.push(sym);
      }
    })
  );

  return { quotes, failed, stale: hasStale };
}

/**
 * 取得 K 線與除息分割數據
 */
export async function fetchChartBundle(
  symbol: string,
  resolution = '1D'
): Promise<ChartBundle> {
  const normSymbol = symbol.toUpperCase();
  const cacheKey = `chart:${normSymbol}:${resolution}`;
  const staleKey = `stale:chart:${normSymbol}:${resolution}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const { interval, range } = INTERVAL_MAP[resolution] || INTERVAL_MAP['1D'];

  try {
    const { data } = await http.get(`/v8/finance/chart/${encodeURIComponent(normSymbol)}`, {
      params: { interval, range, events: 'div,split', includePrePost: false },
    });

    const res = data?.chart?.result?.[0];
    if (!res) throw new Error(`No chart data returned for ${normSymbol}`);

    const meta = res.meta;
    const timestamps: number[] = res.timestamp || [];
    const q = res.indicators?.quote?.[0];

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      const v = q.volume?.[i];
      if (o == null || h == null || l == null || c == null) continue;

      candles.push({
        time: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        open: round(o),
        high: round(h),
        low: round(l),
        close: round(c),
        volume: v ?? 0,
      });
    }

    // Dividends
    const dividends: DividendEvent[] = [];
    if (res.events?.dividends) {
      for (const d of Object.values<any>(res.events.dividends)) {
        if (typeof d.amount === 'number' && typeof d.date === 'number') {
          dividends.push({
            date: new Date(d.date * 1000).toISOString().slice(0, 10),
            amount: round(d.amount),
          });
        }
      }
      dividends.sort((a, b) => b.date.localeCompare(a.date));
    }

    // Splits
    const splits: SplitEvent[] = [];
    if (res.events?.splits) {
      for (const s of Object.values<any>(res.events.splits)) {
        if (typeof s.date === 'number') {
          splits.push({
            date: new Date(s.date * 1000).toISOString().slice(0, 10),
            numerator: s.numerator ?? 1,
            denominator: s.denominator ?? 1,
            ratio: s.denominator ? round(s.numerator / s.denominator) : 1,
          });
        }
      }
    }

    const bundle: ChartBundle = {
      candles,
      quote: parseYahooMetaToQuote(meta),
      dividends,
      splits,
    };

    // 快取 1 小時 (日K)
    try {
      await redis.set(cacheKey, JSON.stringify(bundle), 'EX', 3600);
      await redis.set(staleKey, JSON.stringify(bundle), 'EX', 86400 * 14);
    } catch {}

    return bundle;
  } catch (err) {
    try {
      const stale = await redis.get(staleKey);
      if (stale) return JSON.parse(stale);
    } catch {}
    throw new Error(`無法載入標的 ${symbol} 的圖表走勢`);
  }
}

/**
 * 股票搜尋與自動補齊
 */
export async function searchTickers(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `search:${trimmed.toUpperCase()}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  try {
    const { data } = await http.get('/v1/finance/search', {
      params: { q: trimmed, quotesCount: 10, newsCount: 0, enableFuzzyQuery: true },
    });

    const results: SearchResult[] = (data?.quotes || [])
      .filter((q: any) =>
        ['EQUITY', 'ETF', 'INDEX', 'MUTUALFUND'].includes(q.quoteType || '')
      )
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchDisp || q.exchange || '',
      }));

    try {
      await redis.set(cacheKey, JSON.stringify(results), 'EX', 86400); // 24小時
    } catch {}

    return results;
  } catch (err) {
    console.warn(`[Search error for ${trimmed}]:`, (err as Error).message);
    return [];
  }
}

/**
 * 取得最新基準外幣兌台幣 (TWD) 匯率
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  const cacheKey = 'fx:rates:twd';
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  // 預設防禦匯率
  const fallback: Record<string, number> = {
    TWD: 1,
    USD: 32.0,
    HKD: 4.1,
    JPY: 0.21,
    EUR: 34.5,
  };

  try {
    const symbols = ['USDTWD=X', 'HKDTWD=X', 'JPYTWD=X', 'EURTWD=X'];
    const { quotes } = await fetchQuotes(symbols);

    const rates: Record<string, number> = { TWD: 1 };
    for (const q of quotes) {
      if (q.symbol.startsWith('USD')) rates.USD = round(q.price);
      if (q.symbol.startsWith('HKD')) rates.HKD = round(q.price);
      if (q.symbol.startsWith('JPY')) rates.JPY = round(q.price);
      if (q.symbol.startsWith('EUR')) rates.EUR = round(q.price);
    }

    const merged = { ...fallback, ...rates };
    await redis.set(cacheKey, JSON.stringify(merged), 'EX', 3600); // 快取1小時
    return merged;
  } catch {
    return fallback;
  }
}
