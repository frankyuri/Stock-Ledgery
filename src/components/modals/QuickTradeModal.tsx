import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calculator,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';
import { useAuthStore } from '@/store/useAuthStore';
import { SymbolSearchInput } from '@/components/ui/SymbolSearchInput';
import { fetchQuote } from '@/services/stocks';
import { todayISO } from '@/lib/date';
import { formatNumber, formatCurrency, changeColor } from '@/lib/format';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import type { Quote, SearchResult, Transaction, TransactionType } from '@/types/stock';

interface QuickTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSymbol?: string;
  initialType?: TransactionType;
  editTransaction?: Transaction | null;
}

export function QuickTradeModal({
  isOpen,
  onClose,
  initialSymbol = '',
  initialType = 'BUY',
  editTransaction = null,
}: QuickTradeModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const holdings = useStockStore((s) => s.holdings);
  const addTransaction = useStockStore((s) => s.addTransaction);
  const updateTransaction = useStockStore((s) => s.updateTransaction);
  const isDemo = useStockStore((s) => s.isDemo);
  const user = useAuthStore((s) => s.user);
  const [clearDemoOnAdd, setClearDemoOnAdd] = useState(true);

  const [type, setType] = useState<TransactionType>(initialType);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('0');
  const [tradedAt, setTradedAt] = useState(todayISO());
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset when modal opens or edit target changes
  useEffect(() => {
    if (isOpen) {
      if (editTransaction) {
        setType(editTransaction.type);
        setSymbol(editTransaction.symbol);
        setShares(String(editTransaction.shares));
        setPrice(String(editTransaction.price));
        setFee(String(editTransaction.fee));
        setTradedAt(editTransaction.tradedAt);
        setNote(editTransaction.note ?? '');
      } else {
        setType(initialType);
        setSymbol(initialSymbol);
        setShares('');
        setPrice('');
        setFee('0');
        setTradedAt(todayISO());
        setNote('');
      }
      setError(null);
      setQuote(null);

      const targetSym = editTransaction ? editTransaction.symbol : initialSymbol;
      if (targetSym) {
        loadLiveQuote(targetSym);
      }
    }
  }, [isOpen, editTransaction, initialSymbol, initialType]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentHolding = useMemo(() => {
    const s = symbol.trim().toUpperCase();
    return holdings.find((h) => h.symbol === s) ?? null;
  }, [holdings, symbol]);

  async function loadLiveQuote(sym: string) {
    if (!sym) return;
    setLoadingQuote(true);
    try {
      const q = await qc.fetchQuery({
        queryKey: ['quote', sym],
        queryFn: () => fetchQuote(sym),
        staleTime: 20_000,
      });
      setQuote(q);
      // Auto-fill price if currently empty
      if (!price && !editTransaction) {
        setPrice(String(q.price));
      }
    } catch {
      // ignore
    } finally {
      setLoadingQuote(false);
    }
  }

  function handleSelectSymbol(r: SearchResult) {
    setSymbol(r.symbol);
    loadLiveQuote(r.symbol);
  }

  function fillLivePrice() {
    if (quote?.price != null) {
      setPrice(String(quote.price));
    }
  }

  // Previews
  const parsedShares = Number(shares) || 0;
  const parsedPrice = Number(price) || 0;
  const parsedFee = Number(fee) || 0;
  const totalAmount = parsedShares * parsedPrice + (type === 'BUY' ? parsedFee : -parsedFee);

  // Estimated Sell Realized Gain / Loss
  const estimatedSellGain = useMemo(() => {
    if (type !== 'SELL' || !currentHolding || parsedShares <= 0 || parsedPrice <= 0) return null;
    return (parsedPrice - currentHolding.avgCost) * parsedShares - parsedFee;
  }, [type, currentHolding, parsedShares, parsedPrice, parsedFee]);

  // Estimated New Avg Cost after Buy
  const estimatedNewAvgCost = useMemo(() => {
    if (type !== 'BUY' || parsedShares <= 0 || parsedPrice <= 0) return null;
    const oldShares = currentHolding?.shares ?? 0;
    const oldCost = currentHolding ? oldShares * currentHolding.avgCost : 0;
    const newShares = oldShares + parsedShares;
    const newTotalCost = oldCost + parsedShares * parsedPrice + parsedFee;
    return newShares > 0 ? newTotalCost / newShares : parsedPrice;
  }, [type, currentHolding, parsedShares, parsedPrice, parsedFee]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const s = symbol.trim().toUpperCase();
    if (!s) {
      setError('請輸入股票代號');
      return;
    }
    if (parsedShares <= 0) {
      setError('股數需大於 0');
      return;
    }
    if (parsedPrice <= 0) {
      setError('成交價需大於 0');
      return;
    }
    if (parsedFee < 0) {
      setError('手續費不可為負數');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editTransaction) {
        const res = await updateTransaction(editTransaction.id, {
          symbol: s,
          type,
          shares: parsedShares,
          price: parsedPrice,
          fee: parsedFee,
          tradedAt,
          note,
        });
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success(`已更新 ${s} 交易紀錄${res.synced ? '（已同步至雲端）' : ''}`);
        onClose();
      } else {
        const res = await addTransaction({
          symbol: s,
          type,
          shares: parsedShares,
          price: parsedPrice,
          fee: parsedFee,
          tradedAt,
          note,
        }, { clearDemoFirst: isDemo && clearDemoOnAdd });
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        if (res.warning) {
          toast.warning(res.warning);
        }
        if (type === 'SELL' && typeof res.realizedGainLoss === 'number') {
          const sign = res.realizedGainLoss >= 0 ? '+' : '';
          toast.success(
            `已記帳 ${s} 賣出 · 已實現損益 ${sign}${formatNumber(res.realizedGainLoss)}${
              res.synced ? '（已同步至雲端）' : '（已安全儲存於本地離線帳本）'
            }`
          );
        } else {
          toast.success(
            `已記帳 ${s} 買進 ${parsedShares} 股${
              res.synced ? '（已同步至雲端）' : '（已安全儲存於本地離線帳本）'
            }`
          );
        }
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border border-black/10 bg-white/95 p-4 sm:p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/95 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 pb-3.5 shrink-0 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl font-bold text-white shadow-sm',
                type === 'BUY'
                  ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                  : 'bg-gradient-to-br from-rose-500 to-red-600',
              )}
            >
              {type === 'BUY' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink dark:text-zinc-100">
                {editTransaction ? '編輯交易紀錄' : '快速記帳 / 交易'}
                </h2>
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  {user ? '雲端同步' : '本地離線儲存 (免註冊)'}
                </span>
              </div>
              <p className="text-xs text-ink-mute dark:text-zinc-400">
                即時同步持股平均成本與已實現損益
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-mute transition hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body (Scrollable on short screens) */}
        {isDemo && !editTransaction && (
          <div className="mt-3 rounded-lg border border-blue-200/80 bg-blue-50/70 p-2.5 dark:border-blue-900/60 dark:bg-blue-950/40">
            <label className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={clearDemoOnAdd}
                onChange={(e) => setClearDemoOnAdd(e.target.checked)}
                className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
              <span>同時清空示範數據，以此筆交易開始記錄我的真實帳本</span>
            </label>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 overflow-y-auto pr-1">
          {/* Transaction Type Tabs */}
          <div>
            <label className="label-caps mb-1.5 block">交易類別</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.04]">
              <button
                type="button"
                onClick={() => setType('BUY')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition',
                  type === 'BUY'
                    ? 'bg-up text-white shadow-sm'
                    : 'text-ink-mute hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200',
                )}
              >
                <TrendingUp className="h-4 w-4" /> 買進 (BUY)
              </button>
              <button
                type="button"
                onClick={() => setType('SELL')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition',
                  type === 'SELL'
                    ? 'bg-down text-white shadow-sm'
                    : 'text-ink-mute hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200',
                )}
              >
                <TrendingDown className="h-4 w-4" /> 賣出 (SELL)
              </button>
            </div>
          </div>

          {/* Symbol Input */}
          <div>
            <div className="flex items-center justify-between">
              <label className="label-caps mb-1.5 block">股票標的</label>
              {quote && (
                <span className="mb-1.5 text-xs text-ink-mute dark:text-zinc-400">
                  {quote.name} · {quote.currency}
                </span>
              )}
            </div>
            <SymbolSearchInput
              value={symbol}
              onChange={(s) => {
                setSymbol(s);
                if (s.length >= 2) loadLiveQuote(s);
              }}
              onSelect={handleSelectSymbol}
              placeholder="輸入代號，如 AAPL、2330.TW、NVDA"
              disabled={!!editTransaction}
            />
          </div>

          {/* Current Holding Banner if available */}
          {currentHolding && (
            <div className="flex items-center justify-between rounded-xl border border-brand/20 bg-brand-soft/50 px-3.5 py-2.5 text-xs text-brand dark:bg-brand/10">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                目前持股：
                <strong className="font-mono">{formatNumber(currentHolding.shares)}</strong> 股
                · 均價 <strong className="font-mono">{formatNumber(currentHolding.avgCost)}</strong>
              </span>
              {type === 'SELL' && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShares(String(currentHolding.shares / 2))}
                    className="rounded bg-white/80 px-2 py-0.5 font-medium text-brand shadow-xs hover:bg-white dark:bg-zinc-800"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setShares(String(currentHolding.shares))}
                    className="rounded bg-brand px-2 py-0.5 font-medium text-white shadow-xs hover:bg-brand-dark"
                  >
                    全部 (100%)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Shares and Price Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-caps mb-1.5 block">成交股數</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="例如：100"
                className="input font-mono"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label-caps mb-1.5 block">每股成交價</label>
                {quote?.price != null && (
                  <button
                    type="button"
                    onClick={fillLivePrice}
                    className="mb-1 text-[11px] font-medium text-brand hover:underline"
                  >
                    帶入現價 {formatNumber(quote.price)}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="例如：175.5"
                  className="input font-mono pr-10"
                />
                {loadingQuote && (
                  <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-faint dark:text-zinc-500" />
                )}
              </div>
            </div>
          </div>

          {/* Fee & Date Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-caps mb-1.5 block">手續費 / 交易稅</label>
              <input
                type="number"
                step="any"
                min="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0"
                className="input font-mono"
              />
            </div>
            <div>
              <label className="label-caps mb-1.5 block">交易日期</label>
              <input
                type="date"
                required
                value={tradedAt}
                onChange={(e) => setTradedAt(e.target.value)}
                className="input font-mono"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="label-caps mb-1.5 block">備註說明（選填）</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：定期定額、波段停利、加碼"
              className="input text-sm"
            />
          </div>

          {/* Impact & Calculation Preview Card */}
          {parsedShares > 0 && parsedPrice > 0 && (
            <div className="rounded-xl border border-black/5 bg-surface-muted/50 p-3.5 text-xs text-ink-soft dark:border-white/5 dark:bg-zinc-800/50 dark:text-zinc-300">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5 text-ink-mute dark:text-zinc-400">
                  <Calculator className="h-3.5 w-3.5" />
                  預估總交割金額：
                </span>
                <span className="font-mono text-sm font-semibold text-ink dark:text-zinc-100">
                  {formatCurrency(totalAmount, quote?.currency ?? 'USD')}
                </span>
              </div>

              {type === 'SELL' && estimatedSellGain != null && (
                <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 dark:border-white/5">
                  <span className="text-ink-mute dark:text-zinc-400">預估已實現損益：</span>
                  <span
                    className={cn(
                      'font-mono font-semibold',
                      changeColor(estimatedSellGain),
                    )}
                  >
                    {estimatedSellGain >= 0 ? '+' : ''}
                    {formatNumber(estimatedSellGain)}
                  </span>
                </div>
              )}

              {type === 'BUY' && estimatedNewAvgCost != null && currentHolding && (
                <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 dark:border-white/5">
                  <span className="text-ink-mute dark:text-zinc-400">買入後新均價：</span>
                  <span className="font-mono font-semibold text-brand">
                    {formatNumber(estimatedNewAvgCost)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-300/40 bg-rose-50/80 px-3.5 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn text-sm"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'btn text-sm text-white disabled:opacity-50',
                type === 'BUY'
                  ? 'border-up bg-up hover:bg-emerald-600'
                  : 'border-down bg-down hover:bg-rose-600',
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting
                ? '同步儲存中…'
                : editTransaction
                ? '確認儲存'
                : type === 'BUY'
                ? '確認買進記帳'
                : '確認賣出記帳'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
