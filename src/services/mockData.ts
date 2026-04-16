import type { Candle, PortfolioHolding, Quote, SearchResult } from '@/types/stock';

const UNIVERSE: Record<string, { name: string; base: number; currency: string; exchange: string }> = {
  AAPL: { name: 'Apple Inc.', base: 185, currency: 'USD', exchange: 'NASDAQ' },
  MSFT: { name: 'Microsoft Corp.', base: 410, currency: 'USD', exchange: 'NASDAQ' },
  NVDA: { name: 'NVIDIA Corp.', base: 920, currency: 'USD', exchange: 'NASDAQ' },
  TSLA: { name: 'Tesla Inc.', base: 175, currency: 'USD', exchange: 'NASDAQ' },
  GOOGL: { name: 'Alphabet Inc.', base: 168, currency: 'USD', exchange: 'NASDAQ' },
  AMZN: { name: 'Amazon.com Inc.', base: 182, currency: 'USD', exchange: 'NASDAQ' },
  META: { name: 'Meta Platforms Inc.', base: 495, currency: 'USD', exchange: 'NASDAQ' },
  '2330.TW': { name: '台積電', base: 780, currency: 'TWD', exchange: 'TWSE' },
  '2454.TW': { name: '聯發科', base: 1045, currency: 'TWD', exchange: 'TWSE' },
  '0050.TW': { name: '元大台灣50', base: 168, currency: 'TWD', exchange: 'TWSE' },
};

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function hashSymbol(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    h = (h * 31 + symbol.charCodeAt(i)) % 2147483647;
  }
  return h || 1;
}

export function buildMockCandles(symbol: string, count = 260): Candle[] {
  const meta = UNIVERSE[symbol] ?? { base: 100 };
  const rng = seededRandom(hashSymbol(symbol));
  const out: Candle[] = [];
  let price = meta.base;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const drift = (rng() - 0.48) * meta.base * 0.025;
    const open = price;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + rng() * meta.base * 0.012;
    const low = Math.min(open, close) - rng() * meta.base * 0.012;
    const volume = Math.round(500_000 + rng() * 2_500_000);

    out.push({
      time: d.toISOString().slice(0, 10),
      open: round(open),
      high: round(high),
      low: Math.max(1, round(low)),
      close: round(close),
      volume,
    });
    price = close;
  }
  return out;
}

export function buildMockQuote(symbol: string): Quote {
  const meta = UNIVERSE[symbol] ?? {
    name: symbol,
    base: 100,
    currency: 'USD',
    exchange: 'N/A',
  };
  const candles = buildMockCandles(symbol, 5);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const change = round(last.close - prev.close);
  return {
    symbol,
    name: meta.name,
    price: last.close,
    change,
    changePercent: round((change / prev.close) * 100),
    previousClose: prev.close,
    currency: meta.currency,
    marketCap: Math.round(last.close * 1_000_000_000),
  };
}

export function searchSymbols(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return Object.entries(UNIVERSE)
    .filter(([sym, info]) =>
      sym.toLowerCase().includes(q) || info.name.toLowerCase().includes(q),
    )
    .slice(0, 8)
    .map(([sym, info]) => ({ symbol: sym, name: info.name, exchange: info.exchange }));
}

export function defaultWatchlist(): string[] {
  return ['AAPL', 'MSFT', 'NVDA', 'TSLA', '2330.TW'];
}

export function buildMockPortfolio(): PortfolioHolding[] {
  const holdings: Array<{ symbol: string; shares: number; avgCost: number }> = [
    { symbol: 'AAPL', shares: 40, avgCost: 150 },
    { symbol: 'NVDA', shares: 10, avgCost: 620 },
    { symbol: 'MSFT', shares: 15, avgCost: 330 },
    { symbol: '2330.TW', shares: 200, avgCost: 640 },
    { symbol: '0050.TW', shares: 500, avgCost: 140 },
  ];
  return holdings.map((h) => {
    const q = buildMockQuote(h.symbol);
    const marketValue = round(h.shares * q.price);
    const cost = h.shares * h.avgCost;
    const gainLoss = round(marketValue - cost);
    return {
      symbol: h.symbol,
      name: q.name,
      shares: h.shares,
      avgCost: h.avgCost,
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      marketValue,
      gainLoss,
      gainLossPercent: round((gainLoss / cost) * 100),
      currency: q.currency,
    };
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
