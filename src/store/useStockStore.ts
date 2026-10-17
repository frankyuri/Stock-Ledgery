import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import type {
  AssetSnapshot,
  Holding,
  Resolution,
  Transaction,
} from '@/types/stock';
import { DEFAULT_FIRE_SETTINGS, type FireSettings } from '@/lib/fireAnalytics';
import { apiClient } from '@/services/api';
import { useAuthStore } from './useAuthStore';

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
  | 'fireSettings'
>;

export type AddTransactionResult =
  | { ok: true; realizedGainLoss?: number; synced?: boolean; warning?: string }
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
  fireSettings: FireSettings;
  isSyncing?: boolean;
  setSelectedSymbol: (symbol: string) => void;
  setResolution: (resolution: Resolution) => void;
  addToWatchlist: (symbol: string) => Promise<void>;
  removeFromWatchlist: (symbol: string) => Promise<void>;
  setFireSettings: (patch: Partial<FireSettings>) => void;
  addTransaction: (
    t: Omit<Transaction, 'id' | 'realizedGainLoss'>,
  ) => Promise<AddTransactionResult>;
  updateTransaction: (
    id: string,
    patch: Partial<Omit<Transaction, 'id'>>,
  ) => Promise<AddTransactionResult>;
  removeTransaction: (id: string) => Promise<void>;
  addAssetSnapshot: (a: Omit<AssetSnapshot, 'id'>) => Promise<void>;
  removeAssetSnapshot: (id: string) => Promise<void>;
  setLinePrefs: (patch: Partial<LinePrefs>) => void;
  /** 完整匯入備份，覆寫所有資料 */
  importBackup: (snapshot: BackupSnapshot) => void;
  /** 從雲端 PostgreSQL 拉取最新資料 */
  syncFromCloud: () => Promise<boolean>;
}

export interface BackupSnapshot {
  version: number;
  exportedAt: string;
  watchlist: string[];
  transactions: Transaction[];
  assets: AssetSnapshot[];
  linePrefs?: LinePrefs;
  fireSettings?: FireSettings;
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

/** 依時間順序重新計算所有 SELL 交易的已實現損益 */
export function recalculateAllRealizedGains(transactions: Transaction[]): Transaction[] {
  const indexed = transactions.map((t, index) => ({ t, index }));
  indexed.sort((a, b) => a.t.tradedAt.localeCompare(b.t.tradedAt) || b.index - a.index);

  const runningHoldings = new Map<string, Holding>();
  const updatedMap = new Map<string, Transaction>();

  for (const { t } of indexed) {
    const prev = runningHoldings.get(t.symbol);
    if (t.type === 'BUY') {
      if (!prev) {
        const avg = t.shares > 0 ? t.price + t.fee / t.shares : t.price;
        runningHoldings.set(t.symbol, { symbol: t.symbol, shares: t.shares, avgCost: round(avg) });
      } else {
        const newShares = prev.shares + t.shares;
        const newAvg =
          newShares > 0
            ? (prev.shares * prev.avgCost + t.shares * t.price + t.fee) / newShares
            : prev.avgCost;
        runningHoldings.set(t.symbol, { symbol: t.symbol, shares: newShares, avgCost: round(newAvg) });
      }
      updatedMap.set(t.id, { ...t, realizedGainLoss: undefined });
    } else if (t.type === 'SELL') {
      const realized = prev ? round((t.price - prev.avgCost) * t.shares - t.fee) : 0;
      if (prev) {
        const newShares = prev.shares - t.shares;
        if (newShares <= 1e-6) {
          runningHoldings.delete(t.symbol);
        } else {
          runningHoldings.set(t.symbol, { symbol: t.symbol, shares: newShares, avgCost: prev.avgCost });
        }
      }
      updatedMap.set(t.id, { ...t, realizedGainLoss: realized });
    }
  }

  return transactions.map((t) => updatedMap.get(t.id) ?? t);
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
  fireSettings: DEFAULT_FIRE_SETTINGS,
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
    (set, get): StockState => ({
      selectedSymbol: 'AAPL',
      resolution: '1D',
      watchlist: DEFAULT_WATCHLIST,
      holdings: [],
      transactions: [],
      assets: [],
      linePrefs: DEFAULT_LINE_PREFS,
      fireSettings: DEFAULT_FIRE_SETTINGS,
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      setResolution: (resolution) => set({ resolution }),
      setFireSettings: (patch) =>
        set((s) => ({ fireSettings: { ...s.fireSettings, ...patch } })),
      addToWatchlist: async (symbol) => {
        const norm = symbol.trim().toUpperCase();
        set((s) => ({
          watchlist: s.watchlist.includes(norm) ? s.watchlist : [...s.watchlist, norm],
        }));
        const token = useAuthStore.getState().token;
        if (token && !token.startsWith('mock-')) {
          try {
            await apiClient.post('/watchlist', { symbol: norm });
          } catch {}
        }
      },
      removeFromWatchlist: async (symbol) => {
        const norm = symbol.trim().toUpperCase();
        set((s) => ({
          watchlist: s.watchlist.filter((x) => x !== norm),
        }));
        const token = useAuthStore.getState().token;
        if (token && !token.startsWith('mock-')) {
          try {
            await apiClient.delete(`/watchlist/${norm}`);
          } catch {}
        }
      },
      addTransaction: async (t) => {
        const state = useStockStore.getState();
        if (!Number.isFinite(t.shares) || t.shares <= 0) {
          return { ok: false, error: '股數需為正數' };
        }
        if (!Number.isFinite(t.price) || t.price <= 0) {
          return { ok: false, error: '成交價需為正數' };
        }
        if (t.fee < 0) {
          return { ok: false, error: '手續費不可為負數' };
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

        const token = useAuthStore.getState().token;
        const isCloudActive = Boolean(token && !token.startsWith('mock-'));

        if (isCloudActive) {
          try {
            const res = await apiClient.post('/transactions', {
              symbol: t.symbol,
              type: t.type,
              shares: t.shares,
              price: t.price,
              fee: t.fee,
              tax: 0,
              tradedAt: t.tradedAt,
              note: t.note || null,
            });

            if (res.data?.success && res.data?.data?.transaction) {
              const serverTxn = res.data.data.transaction;
              const full: Transaction = {
                id: serverTxn.id,
                symbol: serverTxn.symbol,
                type: serverTxn.type,
                shares: serverTxn.shares,
                price: serverTxn.price,
                fee: serverTxn.fee,
                tradedAt: serverTxn.tradedAt,
                note: serverTxn.note || undefined,
                realizedGainLoss: serverTxn.realizedGainLoss != null ? serverTxn.realizedGainLoss : undefined,
              };

              const currentList = state.transactions.filter((x) => x.id !== full.id);
              const nextTxns = [full, ...currentList].sort((a, b) => b.tradedAt.localeCompare(a.tradedAt));
              set({
                transactions: nextTxns,
                holdings: reconcileHoldings(nextTxns),
              });

              return {
                ok: true,
                realizedGainLoss: full.realizedGainLoss,
                synced: true,
              };
            }
          } catch (apiErr: any) {
            if (apiErr.response?.data?.error?.message) {
              return { ok: false, error: apiErr.response.data.error.message };
            }
            console.warn('[Cloud transaction save failed, falling back to local]', apiErr);
          }
        }

        // Local fallback / offline mode
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
        return {
          ok: true,
          realizedGainLoss: realized,
          synced: false,
          warning: isCloudActive ? '網路暫時無法連線至雲端，已為您安全暫存於本機' : undefined,
        };
      },
      updateTransaction: async (id, patch) => {
        const state = useStockStore.getState();
        const existing = state.transactions.find((t) => t.id === id);
        if (!existing) {
          return { ok: false, error: '找不到指定交易紀錄' };
        }
        const updatedTarget = { ...existing, ...patch };
        if (!Number.isFinite(updatedTarget.shares) || updatedTarget.shares <= 0) {
          return { ok: false, error: '股數需為正數' };
        }
        if (!Number.isFinite(updatedTarget.price) || updatedTarget.price <= 0) {
          return { ok: false, error: '成交價需為正數' };
        }
        if (updatedTarget.fee < 0) {
          return { ok: false, error: '手續費不能為負數' };
        }

        const token = useAuthStore.getState().token;
        const isCloudActive = Boolean(token && !token.startsWith('mock-'));

        if (isCloudActive) {
          try {
            const res = await apiClient.put(`/transactions/${id}`, {
              symbol: updatedTarget.symbol,
              type: updatedTarget.type,
              shares: updatedTarget.shares,
              price: updatedTarget.price,
              fee: updatedTarget.fee,
              tradedAt: updatedTarget.tradedAt,
              note: updatedTarget.note || null,
            });

            if (res.data?.success && res.data?.data?.transaction) {
              const serverTxn = res.data.data.transaction;
              const candidateTxns = state.transactions.map((t) =>
                t.id === id
                  ? {
                      ...t,
                      symbol: serverTxn.symbol,
                      type: serverTxn.type,
                      shares: serverTxn.shares,
                      price: serverTxn.price,
                      fee: serverTxn.fee,
                      tradedAt: serverTxn.tradedAt,
                      note: serverTxn.note || undefined,
                      realizedGainLoss: serverTxn.realizedGainLoss != null ? serverTxn.realizedGainLoss : undefined,
                    }
                  : t
              );
              const recalculated = recalculateAllRealizedGains(candidateTxns);
              set({
                transactions: recalculated,
                holdings: reconcileHoldings(recalculated),
              });
              const targetAfter = recalculated.find((t) => t.id === id);
              return { ok: true, realizedGainLoss: targetAfter?.realizedGainLoss, synced: true };
            }
          } catch (apiErr: any) {
            if (apiErr.response?.data?.error?.message) {
              return { ok: false, error: apiErr.response.data.error.message };
            }
            console.warn('[Cloud update failed, falling back to local]', apiErr);
          }
        }

        // Local fallback
        const candidateTxns = state.transactions.map((t) =>
          t.id === id ? updatedTarget : t
        );
        const recalculated = recalculateAllRealizedGains(candidateTxns);
        set({
          transactions: recalculated,
          holdings: reconcileHoldings(recalculated),
        });
        const targetAfter = recalculated.find((t) => t.id === id);
        return { ok: true, realizedGainLoss: targetAfter?.realizedGainLoss, synced: false };
      },
      removeTransaction: async (id: string) => {
        const token = useAuthStore.getState().token;
        const isCloudActive = Boolean(token && !token.startsWith('mock-'));

        if (isCloudActive) {
          try {
            await apiClient.delete(`/transactions/${id}`);
          } catch (apiErr) {
            console.warn('[Cloud delete failed, falling back to local delete]', apiErr);
          }
        }

        useStockStore.setState((s) => {
          const nextTxns = recalculateAllRealizedGains(
            s.transactions.filter((t) => t.id !== id)
          );
          return {
            transactions: nextTxns,
            holdings: reconcileHoldings(nextTxns),
          };
        });
      },
      addAssetSnapshot: async (a: Omit<AssetSnapshot, 'id'>) => {
        const token = useAuthStore.getState().token;
        const isCloudActive = Boolean(token && !token.startsWith('mock-'));

        if (isCloudActive) {
          try {
            const res = await apiClient.post('/assets', {
              date: a.date,
              currency: a.currency,
              cash: a.cash,
              securities: a.securities,
              other: a.other,
              note: a.note || null,
            });
            if (res.data?.success && res.data?.data) {
              const serverAsset = res.data.data;
              const item: AssetSnapshot = {
                id: serverAsset.id,
                date: serverAsset.date,
                currency: serverAsset.currency,
                cash: serverAsset.cash,
                securities: serverAsset.securities,
                other: serverAsset.other,
                note: serverAsset.note || undefined,
              };
              set((s) => ({
                assets: [...s.assets.filter((x) => x.id !== item.id), item].sort((x, y) =>
                  x.date.localeCompare(y.date)
                ),
              }));
              return;
            }
          } catch (apiErr) {
            console.warn('[Cloud asset snapshot save failed, falling back to local]', apiErr);
          }
        }

        set((s) => ({
          assets: [...s.assets, { id: genId(), ...a }].sort((x, y) =>
            x.date.localeCompare(y.date)
          ),
        }));
      },
      removeAssetSnapshot: async (id: string) => {
        const token = useAuthStore.getState().token;
        const isCloudActive = Boolean(token && !token.startsWith('mock-'));

        if (isCloudActive) {
          try {
            await apiClient.delete(`/assets/${id}`);
          } catch (apiErr) {
            console.warn('[Cloud asset delete failed]', apiErr);
          }
        }

        set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));
      },
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
          fireSettings: snapshot.fireSettings ?? s.fireSettings,
          holdings: reconcileHoldings(snapshot.transactions ?? []),
        })),
      syncFromCloud: async () => {
        const token = useAuthStore.getState().token;
        if (!token || token.startsWith('mock-')) return false;

        set({ isSyncing: true });
        try {
          const res = await apiClient.get('/backup/export');
          if (res.data?.success && res.data?.data) {
            const data = res.data.data;
            const hasCloudTxns =
              Array.isArray(data.transactions) && data.transactions.length > 0;
            const hasCloudAssets =
              Array.isArray(data.assets) && data.assets.length > 0;

            if (hasCloudTxns || hasCloudAssets) {
              const cloudTxns: Transaction[] = (data.transactions || []).map(
                (t: any) => ({
                  id: t.id,
                  symbol: t.symbol,
                  type: t.type,
                  shares: Number(t.shares),
                  price: Number(t.price),
                  fee: Number(t.fee || 0),
                  tradedAt: t.tradedAt,
                  note: t.note || undefined,
                  realizedGainLoss:
                    t.realizedGainLoss != null
                      ? Number(t.realizedGainLoss)
                      : undefined,
                })
              );
              const cloudAssets: AssetSnapshot[] = (data.assets || []).map(
                (a: any) => ({
                  id: a.id,
                  date: a.date,
                  currency: a.currency,
                  cash: Number(a.cash),
                  securities: Number(a.securities),
                  other: Number(a.other),
                  note: a.note || undefined,
                })
              );

              set({
                transactions: cloudTxns,
                holdings: reconcileHoldings(cloudTxns),
                assets: cloudAssets,
                ...(Array.isArray(data.watchlist) && data.watchlist.length > 0
                  ? { watchlist: data.watchlist }
                  : {}),
                ...(data.linePrefs ? { linePrefs: data.linePrefs } : {}),
              });
              return true;
            } else {
              // 雲端目前無紀錄：若本地有累積資料，自動備份推送至雲端
              const localTxns = get().transactions;
              const localAssets = get().assets;
              if (localTxns.length > 0 || localAssets.length > 0) {
                try {
                  await apiClient.post('/backup/import', {
                    version: 1,
                    watchlist: get().watchlist,
                    transactions: localTxns,
                    assets: localAssets,
                    linePrefs: get().linePrefs,
                  });
                  return true;
                } catch (e) {
                  console.warn('[Auto upload local data to cloud failed]', e);
                }
              }
            }
          }
        } catch (err) {
          console.warn('[Sync from cloud error]:', err);
        } finally {
          set({ isSyncing: false });
        }
        return false;
      },
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
        fireSettings: state.fireSettings,
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
            fireSettings: state.fireSettings ?? DEFAULT_FIRE_SETTINGS,
          };
        }
        // v4 → v5：把已存的 holdings 欄位丟掉（onRehydrateStorage 會重算）
        return {
          ...DEFAULT_PERSISTED_STATE,
          ...state,
          linePrefs: state.linePrefs ?? DEFAULT_LINE_PREFS,
          fireSettings: state.fireSettings ?? DEFAULT_FIRE_SETTINGS,
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
    fireSettings: s.fireSettings,
  };
}
