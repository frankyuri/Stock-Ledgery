import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
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

/**
 * holdings 不進 persist：它是 transactions 的純函數，存兩份只會讓兩邊
 * 對不起來。rehydrate 完用 onRehydrateStorage 重算一次即可。
 */
type PersistedStockState = Pick<
  StockState,
  | 'selectedSymbol'
  | 'resolution'
  | 'watchlist'
  | 'transactions'
  | 'assets'
  | 'linePrefs'
>;

export type AddTransactionResult =
  | { ok: true; realizedGainLoss?: number }
  | { ok: false; error: string };

interface StockState {
  selectedSymbol: string;
  resolution: Resolution;
  watchlist: string[];
  /** 由 transactions 自動 reconcile，不要直接 mutate */
  holdings: Holding[];
  transactions: Transaction[];
  assets: AssetSnapshot[];
  linePrefs: LinePrefs;
  setSelectedSymbol: (symbol: string) => void;
  setResolution: (resolution: Resolution) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  addTransaction: (
    t: Omit<Transaction, 'id' | 'realizedGainLoss'>,
  ) => AddTransactionResult;
  removeTransaction: (id: string) => void;
  addAssetSnapshot: (a: Omit<AssetSnapshot, 'id'>) => void;
  removeAssetSnapshot: (id: string) => void;
  setLinePrefs: (patch: Partial<LinePrefs>) => void;
  /** 完整匯入備份，覆寫所有資料 */
  importBackup: (snapshot: BackupSnapshot) => void;
}

export interface BackupSnapshot {
  version: number;
  exportedAt: string;
  watchlist: string[];
  transactions: Transaction[];
  assets: AssetSnapshot[];
  linePrefs?: LinePrefs;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * 從 transactions 重新計算 holdings（weighted-average 方法）。
 * 規則：
 *  - BUY：加權平均新成本 = (舊股數 × 舊均價 + 新股數 × 新單價 + 手續費) / 總股數
 *  - SELL：扣減股數，平均成本不變（已實現損益另外於 transaction 上記錄）
 *  - 賣超的部分視為無效（reconcile 時不會讓股數變負）
 */
export function reconcileHoldings(transactions: Transaction[]): Holding[] {
  const sorted = [...transactions].sort((a, b) =>
    a.tradedAt.localeCompare(b.tradedAt),
  );
  const map = new Map<string, Holding>();
  for (const t of sorted) {
    const prev = map.get(t.symbol);
    if (t.type === 'BUY') {
      if (!prev) {
        const avg = t.shares > 0 ? t.price + t.fee / t.shares : t.price;
        map.set(t.symbol, {
          symbol: t.symbol,
          shares: t.shares,
          avgCost: round(avg),
        });
      } else {
        const newShares = prev.shares + t.shares;
        const newAvg =
          newShares > 0
            ? (prev.shares * prev.avgCost + t.shares * t.price + t.fee) /
              newShares
            : prev.avgCost;
        map.set(t.symbol, {
          symbol: t.symbol,
          shares: newShares,
          avgCost: round(newAvg),
        });
      }
    } else if (t.type === 'SELL') {
      if (!prev) continue;
      const newShares = prev.shares - t.shares;
      if (newShares <= 1e-6) {
        map.delete(t.symbol);
      } else {
        map.set(t.symbol, {
          symbol: t.symbol,
          shares: newShares,
          avgCost: prev.avgCost,
        });
      }
    }
  }
  return Array.from(map.values());
}

/** 計算這筆 SELL 的已實現損益（用 reconcile 到此筆「之前」的 avg cost） */
export function computeRealizedForSell(
  transactions: Transaction[],
  pending: Omit<Transaction, 'id' | 'realizedGainLoss'>,
): number {
  const before = reconcileHoldings(transactions);
  const prev = before.find((h) => h.symbol === pending.symbol);
  if (!prev) return 0;
  return round((pending.price - prev.avgCost) * pending.shares - pending.fee);
}

const STORAGE_KEY = 'stock-ledgery-store';

const DEFAULT_LINE_PREFS: LinePrefs = {
  priceAlert: true,
  dailySummary: true,
  tradeConfirm: true,
};

const DEFAULT_PERSISTED_STATE: PersistedStockState = {
  selectedSymbol: 'AAPL',
  resolution: '1D',
  watchlist: DEFAULT_WATCHLIST,
  transactions: [],
  assets: [],
  linePrefs: DEFAULT_LINE_PREFS,
};

const STORAGE_VERSION = 5;

const safeStorage: PersistStorage<PersistedStockState> = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch {
      /* quota / disabled */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* noop */
    }
  },
};

export const useStockStore = create<StockState>()(
  persist<StockState, [], [], PersistedStockState>(
    (set): StockState => ({
      selectedSymbol: 'AAPL',
      resolution: '1D',
      watchlist: DEFAULT_WATCHLIST,
      holdings: [],
      transactions: [],
      assets: [],
      linePrefs: DEFAULT_LINE_PREFS,
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      setResolution: (resolution) => set({ resolution }),
      addToWatchlist: (symbol) =>
        set((s) => ({
          watchlist: s.watchlist.includes(symbol)
            ? s.watchlist
            : [...s.watchlist, symbol],
        })),
      removeFromWatchlist: (symbol) =>
        set((s) => ({
          watchlist: s.watchlist.filter((x) => x !== symbol),
        })),
      addTransaction: (t) => {
        const state = useStockStore.getState();
        if (!Number.isFinite(t.shares) || t.shares <= 0) {
          return { ok: false, error: '股數需為正數' };
        }
        if (!Number.isFinite(t.price) || t.price <= 0) {
          return { ok: false, error: '成交價需為正數' };
        }
        if (t.type === 'SELL') {
          const prev = state.holdings.find((h) => h.symbol === t.symbol);
          if (!prev) {
            return { ok: false, error: `尚未持有 ${t.symbol}，無法賣出` };
          }
          if (t.shares > prev.shares + 1e-6) {
            return {
              ok: false,
              error: `賣出股數 ${t.shares} 超過持有 ${prev.shares}`,
            };
          }
        }
        const realized =
          t.type === 'SELL'
            ? computeRealizedForSell(state.transactions, t)
            : undefined;
        const full: Transaction = {
          id: genId(),
          ...t,
          ...(realized != null ? { realizedGainLoss: realized } : {}),
        };
        const nextTxns = [full, ...state.transactions];
        set({
          transactions: nextTxns,
          holdings: reconcileHoldings(nextTxns),
        });
        return { ok: true, realizedGainLoss: realized };
      },
      removeTransaction: (id: string) =>
        set((s) => {
          const nextTxns = s.transactions.filter((t) => t.id !== id);
          return {
            transactions: nextTxns,
            holdings: reconcileHoldings(nextTxns),
          };
        }),
      addAssetSnapshot: (a: Omit<AssetSnapshot, 'id'>) =>
        set((s) => ({
          assets: [...s.assets, { id: genId(), ...a }].sort((x, y) =>
            x.date.localeCompare(y.date),
          ),
        })),
      removeAssetSnapshot: (id: string) =>
        set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
      setLinePrefs: (patch: Partial<LinePrefs>) =>
        set((s) => ({ linePrefs: { ...s.linePrefs, ...patch } })),
      importBackup: (snapshot: BackupSnapshot) =>
        set((s) => ({
          watchlist: snapshot.watchlist?.length
            ? snapshot.watchlist
            : s.watchlist,
          transactions: snapshot.transactions ?? [],
          assets: snapshot.assets ?? [],
          linePrefs: snapshot.linePrefs ?? s.linePrefs,
          holdings: reconcileHoldings(snapshot.transactions ?? []),
        })),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: safeStorage,
      partialize: (state) => ({
        selectedSymbol: state.selectedSymbol,
        resolution: state.resolution,
        watchlist: state.watchlist,
        transactions: state.transactions,
        assets: state.assets,
        linePrefs: state.linePrefs,
      }),
      migrate: (persistedState, version): PersistedStockState => {
        const state = (persistedState ?? {}) as Partial<PersistedStockState> & {
          holdings?: Holding[];
        };
        if (version < 4) {
          // v3 以前：可能只有 holdings 沒有 transactions，要把 holdings 反推成 BUY 交易
          const txns = state.transactions ?? [];
          const oldHoldings = state.holdings ?? [];
          let nextTxns = txns;
          if (txns.length === 0 && oldHoldings.length > 0) {
            const today = new Date().toISOString().slice(0, 10);
            nextTxns = oldHoldings.map((h) => ({
              id: genId(),
              type: 'BUY' as const,
              symbol: h.symbol,
              shares: h.shares,
              price: h.avgCost,
              fee: 0,
              tradedAt: today,
              note: '初始部位（資料升級自動建立）',
            }));
          }
          return {
            ...DEFAULT_PERSISTED_STATE,
            ...state,
            transactions: nextTxns,
            linePrefs: state.linePrefs ?? DEFAULT_LINE_PREFS,
          };
        }
        // v4 → v5：把已存的 holdings 欄位丟掉（onRehydrateStorage 會重算）
        return {
          ...DEFAULT_PERSISTED_STATE,
          ...state,
          linePrefs: state.linePrefs ?? DEFAULT_LINE_PREFS,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.holdings = reconcileHoldings(state.transactions);
        }
      },
    },
  ),
);

/** 給匯出備份用 */
export function buildBackupSnapshot(): BackupSnapshot {
  const s = useStockStore.getState();
  return {
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    watchlist: s.watchlist,
    transactions: s.transactions,
    assets: s.assets,
    linePrefs: s.linePrefs,
  };
}
