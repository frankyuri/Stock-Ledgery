export type Resolution = '1D' | '1W' | '1M';

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  currency: string;
  marketCap?: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export interface Holding {
  symbol: string;
  shares: number;
  avgCost: number;
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  price: number;
  change: number;
  changePercent: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
  currency: string;
}
