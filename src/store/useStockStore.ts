import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AssetSnapshot,
  Holding,
  Resolution,
  Transaction,
} from '@/types/stock';

const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA', '2330.TW'];

interface LinePrefs {
  priceAlert: boolean;
  dailySummary: boolean;
  tradeConfirm: boolean;
}

interface StockState {
  selectedSymbol: string;
  resolution: Resolution;
  watchlist: string[];
  holdings: Holding[];
  transactions: Transaction[];
  assets: AssetSnapshot[];
  linePrefs: LinePrefs;
  setSelectedSymbol: (symbol: string) => void;
  setResolution: (resolution: Resolution) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  upsertHolding: (holding: Holding) => void;
  removeHolding: (symbol: string) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  removeTransaction: (id: string) => void;
  addAssetSnapshot: (a: Omit<AssetSnapshot, 'id'>) => void;
  removeAssetSnapshot: (id: string) => void;
  setLinePrefs: (patch: Partial<LinePrefs>) => void;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function applyTransaction(holdings: Holding[], t: Transaction): Holding[] {
  const idx = holdings.findIndex((h) => h.symbol === t.symbol);
  if (t.type === 'BUY') {
    if (idx === -1) {
      return [...holdings, { symbol: t.symbol, shares: t.shares, avgCost: t.price }];
    }
    const prev = holdings[idx];
    const newShares = prev.shares + t.shares;
    const newAvg =
      newShares > 0
        ? (prev.shares * prev.avgCost + t.shares * t.price + t.fee) / newShares
        : prev.avgCost;
    const next = holdings.slice();
    next[idx] = { symbol: prev.symbol, shares: newShares, avgCost: round(newAvg) };
    return next;
  }
  if (idx === -1) return holdings;
  const prev = holdings[idx];
  const newShares = Math.max(0, prev.shares - t.shares);
  if (newShares === 0) return holdings.filter((h) => h.symbol !== t.symbol);
  const next = holdings.slice();
  next[idx] = { symbol: prev.symbol, shares: newShares, avgCost: prev.avgCost };
  return next;
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export const useStockStore = create<StockState>()(
  persist(
    (set) => ({
      selectedSymbol: 'AAPL',
      resolution: '1D',
      watchlist: DEFAULT_WATCHLIST,
      holdings: [],
      transactions: [],
      assets: [],
      linePrefs: { priceAlert: true, dailySummary: true, tradeConfirm: true },
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      setResolution: (resolution) => set({ resolution }),
      addToWatchlist: (symbol) =>
        set((s) => ({
          watchlist: s.watchlist.includes(symbol) ? s.watchlist : [...s.watchlist, symbol],
        })),
      removeFromWatchlist: (symbol) =>
        set((s) => ({ watchlist: s.watchlist.filter((x) => x !== symbol) })),
      upsertHolding: (holding) =>
        set((s) => {
          const idx = s.holdings.findIndex((h) => h.symbol === holding.symbol);
          if (idx === -1) return { holdings: [...s.holdings, holding] };
          const next = s.holdings.slice();
          next[idx] = holding;
          return { holdings: next };
        }),
      removeHolding: (symbol) =>
        set((s) => ({ holdings: s.holdings.filter((h) => h.symbol !== symbol) })),
      addTransaction: (t) =>
        set((s) => {
          const full: Transaction = { id: genId(), ...t };
          return {
            transactions: [full, ...s.transactions],
            holdings: applyTransaction(s.holdings, full),
          };
        }),
      removeTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),
      addAssetSnapshot: (a) =>
        set((s) => ({
          assets: [...s.assets, { id: genId(), ...a }].sort((x, y) =>
            x.date.localeCompare(y.date),
          ),
        })),
      removeAssetSnapshot: (id) =>
        set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
      setLinePrefs: (patch) =>
        set((s) => ({ linePrefs: { ...s.linePrefs, ...patch } })),
    }),
    { name: 'stocktify-store', version: 3 },
  ),
);
