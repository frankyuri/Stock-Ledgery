import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Holding, Resolution } from '@/types/stock';

const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA', '2330.TW'];

interface StockState {
  selectedSymbol: string;
  resolution: Resolution;
  watchlist: string[];
  holdings: Holding[];
  setSelectedSymbol: (symbol: string) => void;
  setResolution: (resolution: Resolution) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  upsertHolding: (holding: Holding) => void;
  removeHolding: (symbol: string) => void;
}

export const useStockStore = create<StockState>()(
  persist(
    (set) => ({
      selectedSymbol: 'AAPL',
      resolution: '1D',
      watchlist: DEFAULT_WATCHLIST,
      holdings: [],
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
    }),
    { name: 'stocktify-store', version: 2 },
  ),
);
