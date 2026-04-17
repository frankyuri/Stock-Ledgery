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

export type TransactionType = 'BUY' | 'SELL';

export interface Transaction {
  id: string;
  symbol: string;
  type: TransactionType;
  shares: number;
  price: number;
  fee: number;
  tradedAt: string;
  note?: string;
}

export interface AssetSnapshot {
  id: string;
  date: string;
  cash: number;
  securities: number;
  other: number;
  currency: string;
  note?: string;
}
