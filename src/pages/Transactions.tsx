import { useState, useMemo, useRef, type FormEvent, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  Pencil,
  Trash2,
  Download,
  Upload,
  Search,
  DollarSign,
  Percent,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';
import { SymbolSearchInput } from '@/components/ui/SymbolSearchInput';
import { QuickTradeModal } from '@/components/modals/QuickTradeModal';
import { fetchQuote } from '@/services/stocks';
import { cn } from '@/lib/cn';
import { changeColor, formatNumber, formatShares } from '@/lib/format';
import { todayISO } from '@/lib/date';
import { useToast } from '@/lib/toast';
import type { Quote, SearchResult, Transaction, TransactionType } from '@/types/stock';

export function Transactions() {
  const transactions = useStockStore((s) => s.transactions);
  const addTransaction = useStockStore((s) => s.addTransaction);
  const removeTransaction = useStockStore((s) => s.removeTransaction);
  const qc = useQueryClient();
  const toast = useToast();

  const [type, setType] = useState<TransactionType>('BUY');
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('0');
  const [tradedAt, setTradedAt] = useState(todayISO());
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters & Modal
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>('ALL');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSelect(r: SearchResult) {
    setError(null);
    setQuote(null);
    setLoadingQuote(true);
    try {
      const q = await qc.fetchQuery({
        queryKey: ['quote', r.symbol],
        queryFn: () => fetchQuote(r.symbol),
        staleTime: 30_000,
      });
      setQuote(q);
      if (!price) setPrice(String(q.price));
    } catch (err) {
      setError(err instanceof Error ? err.message : '取得報價失敗');
    } finally {
      setLoadingQuote(false);
    }
  }

  function onSymbolChange(raw: string) {
    setSymbol(raw);
    if (quote && raw !== quote.symbol) setQuote(null);
  }

  function useLivePrice() {
    if (!quote) return;
    setPrice(String(quote.price));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const s = symbol.trim().toUpperCase();
    const sh = Number(shares);
    const p = Number(price);
    const f = Number(fee) || 0;
    if (!s) return setError('請輸入股票代號');
    if (!Number.isFinite(sh) || sh <= 0) return setError('股數需為正數');
    if (!Number.isFinite(p) || p <= 0) return setError('成交價需為正數');
    if (f < 0) return setError('手續費不可為負數');

    setIsSubmitting(true);
    try {
      const result = await addTransaction({
        type,
        symbol: s,
        shares: sh,
        price: p,
        fee: f,
        tradedAt,
        note,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      if (result.warning) {
        toast.warning(result.warning);
      }
      if (type === 'SELL' && typeof result.realizedGainLoss === 'number') {
        const r = result.realizedGainLoss;
        toast.success(
          `已記錄 ${s} 賣出 · 已實現損益 ${r >= 0 ? '+' : ''}${formatNumber(r)}${
            result.synced ? '（已同步至雲端）' : ''
          }`,
        );
      } else {
        toast.success(
          `已記錄 ${s} ${type === 'BUY' ? '買進' : '賣出'} ${sh} 股${
            result.synced ? '（已同步至雲端）' : ''
          }`,
        );
      }
      setSymbol('');
      setShares('');
      setPrice('');
      setFee('0');
      setNote('');
      setQuote(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Summary statistics
  const summary = useMemo(() => {
    let totalBuy = 0;
    let totalSell = 0;
    let totalFee = 0;
    let totalRealized = 0;
    let sellWins = 0;
    let sellCount = 0;

    for (const t of transactions) {
      totalFee += t.fee;
      if (t.type === 'BUY') {
        totalBuy += t.shares * t.price + t.fee;
      } else {
        totalSell += t.shares * t.price - t.fee;
        if (t.realizedGainLoss != null) {
          totalRealized += t.realizedGainLoss;
          sellCount++;
          if (t.realizedGainLoss > 0) sellWins++;
        }
      }
    }

    const winRate = sellCount > 0 ? (sellWins / sellCount) * 100 : 0;
    return { totalBuy, totalSell, totalFee, totalRealized, winRate, sellCount };
  }, [transactions]);

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchType = filterType === 'ALL' || t.type === filterType;
      const matchSym = !searchSymbol || t.symbol.toUpperCase().includes(searchSymbol.trim().toUpperCase());
      return matchType && matchSym;
    });
  }, [transactions, filterType, searchSymbol]);

  // Export CSV
  function handleExportCSV() {
    if (transactions.length === 0) {
      toast.info('目前沒有任何交易紀錄可匯出');
      return;
    }
    const headers = ['id', 'tradedAt', 'symbol', 'type', 'shares', 'price', 'fee', 'realizedGainLoss', 'note'];
    const rows = transactions.map((t) => [
      t.id,
      t.tradedAt,
      t.symbol,
      t.type,
      t.shares,
      t.price,
      t.fee,
      t.realizedGainLoss ?? '',
      `"${(t.note ?? '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`已匯出 ${transactions.length} 筆交易紀錄 CSV`);
  }

  // Import CSV
  function handleImportCSV(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new Error('CSV 檔案內容為空或無標題列');

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('traded') || h.includes('日'));
        const symIdx = headers.findIndex((h) => h.includes('symbol') || h.includes('ticker') || h.includes('標') || h.includes('代號'));
        const typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('方向') || h.includes('類'));
        const sharesIdx = headers.findIndex((h) => h.includes('share') || h.includes('股'));
        const priceIdx = headers.findIndex((h) => h.includes('price') || h.includes('價'));
        const feeIdx = headers.findIndex((h) => h.includes('fee') || h.includes('費'));
        const noteIdx = headers.findIndex((h) => h.includes('note') || h.includes('備註') || h.includes('說明'));

        if (symIdx === -1 || sharesIdx === -1 || priceIdx === -1) {
          throw new Error('CSV 缺少必要的欄位（代號、股數、價格）');
        }

        let importedCount = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          const s = (cols[symIdx] || '').toUpperCase();
          const sh = Number(cols[sharesIdx]);
          const p = Number(cols[priceIdx]);
          if (!s || !sh || !p) continue;

          let tType: TransactionType = 'BUY';
          if (typeIdx !== -1) {
            const rawType = (cols[typeIdx] || '').toUpperCase();
            if (rawType.includes('SELL') || rawType.includes('賣')) tType = 'SELL';
          }

          const f = feeIdx !== -1 ? Number(cols[feeIdx]) || 0 : 0;
          const dt = dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx] : todayISO();
          const nt = noteIdx !== -1 ? cols[noteIdx] : '';

          await addTransaction({
            type: tType,
            symbol: s,
            shares: sh,
            price: p,
            fee: f,
            tradedAt: dt,
            note: nt,
          });
          importedCount++;
        }

        toast.success(`成功匯入 ${importedCount} 筆交易紀錄！`);
      } catch (err) {
        toast.error(`匯入失敗：${err instanceof Error ? err.message : '格式解析錯誤'}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2.5">
            <ArrowLeftRight className="h-6 w-6 text-brand" />
            交易紀錄與記帳簿
          </h1>
          <p className="mt-1 text-sm text-ink-mute dark:text-zinc-400">
            記錄每筆買進與賣出，即時加權計算平均成本與已實現獲利。
          </p>
        </div>

        {/* Import / Export actions */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn text-xs py-2 px-3 flex items-center gap-1.5"
            title="從 CSV 匯入歷史交易"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>匯入 CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn text-xs py-2 px-3 flex items-center gap-1.5"
            title="將所有交易紀錄匯出為 CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>匯出 CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5 min-w-0">
          <span className="label-caps flex items-center gap-1.5 truncate">
            <TrendingUp className="h-3.5 w-3.5 text-up" />
            累計買進總額
          </span>
          <p
            className="mt-2 font-mono text-xl sm:text-2xl font-bold truncate tracking-tight text-ink dark:text-zinc-100 num"
            title={`$${formatNumber(summary.totalBuy)}`}
          >
            ${formatNumber(summary.totalBuy)}
          </p>
          <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400 truncate">
            包含手續費總支出：${formatNumber(summary.totalFee)}
          </p>
        </div>

        <div className="card p-5 min-w-0">
          <span className="label-caps flex items-center gap-1.5 truncate">
            <TrendingDown className="h-3.5 w-3.5 text-down" />
            累計賣出回收金額
          </span>
          <p
            className="mt-2 font-mono text-xl sm:text-2xl font-bold truncate tracking-tight text-ink dark:text-zinc-100 num"
            title={`$${formatNumber(summary.totalSell)}`}
          >
            ${formatNumber(summary.totalSell)}
          </p>
          <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400 truncate">
            共結清 {summary.sellCount} 筆賣出交易
          </p>
        </div>

        <div className="card p-5 min-w-0">
          <span className="label-caps flex items-center gap-1.5 truncate">
            <DollarSign className="h-3.5 w-3.5 text-brand" />
            已實現總損益
          </span>
          <p
            className={cn(
              'mt-2 font-mono text-xl sm:text-2xl font-bold truncate tracking-tight num',
              changeColor(summary.totalRealized),
            )}
            title={`${summary.totalRealized > 0 ? '+' : ''}$${formatNumber(summary.totalRealized)}`}
          >
            {summary.totalRealized > 0 ? '+' : ''}
            ${formatNumber(summary.totalRealized)}
          </p>
          <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400 truncate">
            賣出時已落袋結算之真實盈虧
          </p>
        </div>

        <div className="card p-5 min-w-0">
          <span className="label-caps flex items-center gap-1.5 truncate">
            <Percent className="h-3.5 w-3.5 text-brand" />
            已結清交易勝率
          </span>
          <p
            className="mt-2 font-mono text-xl sm:text-2xl font-bold truncate tracking-tight text-ink dark:text-zinc-100 num"
            title={summary.sellCount > 0 ? `${summary.winRate.toFixed(1)}%` : undefined}
          >
            {summary.sellCount > 0 ? `${summary.winRate.toFixed(1)}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400 truncate">
            {summary.sellCount > 0 ? `勝率基於 ${summary.sellCount} 筆獲利 / 停損賣出` : '尚無賣出平倉紀錄'}
          </p>
        </div>
      </div>

      {/* New Transaction Form */}
      <form onSubmit={onSubmit} className="card">
        <div className="card-header">
          <div>
            <h3 className="section-title">快速新增交易</h3>
            <p className="section-hint">
              買進會自動與現有持股加權重算平均成本；賣出會核對目前持有股數
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.04]">
            {(['BUY', 'SELL'] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-xs font-semibold transition',
                  type === t
                    ? t === 'BUY'
                      ? 'bg-up text-white shadow-xs'
                      : 'bg-down text-white shadow-xs'
                    : 'text-ink-soft hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/5',
                )}
              >
                {t === 'BUY' ? '買進 (BUY)' : '賣出 (SELL)'}
              </button>
            ))}
          </div>
        </div>

        <div className="card-body space-y-3.5">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className="label-caps mb-1 block">股票代號</label>
              <SymbolSearchInput
                value={symbol}
                onChange={onSymbolChange}
                onSelect={handleSelect}
                placeholder="代號如 AAPL、2330.TW"
              />
            </div>
            <div>
              <label className="label-caps mb-1 block">股數</label>
              <input
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                inputMode="decimal"
                type="number"
                step="any"
                min="0.0001"
                placeholder="例如 100"
                className="input num font-mono"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label-caps block">成交單價</label>
                {quote && (
                  <button
                    type="button"
                    onClick={useLivePrice}
                    className="text-[11px] font-semibold text-brand hover:underline"
                  >
                    現價 {formatNumber(quote.price)}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  type="number"
                  step="any"
                  min="0.0001"
                  placeholder="例如 175.5"
                  className={cn("input num font-mono", loadingQuote && "pr-9")}
                />
                {loadingQuote && (
                  <RefreshCw className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-ink-faint" />
                )}
              </div>
            </div>
            <div>
              <label className="label-caps mb-1 block">手續費 / 稅</label>
              <input
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                inputMode="decimal"
                type="number"
                step="any"
                min="0"
                placeholder="0"
                className="input num font-mono"
              />
            </div>
            <div>
              <label className="label-caps mb-1 block">交易日期</label>
              <input
                type="date"
                value={tradedAt}
                onChange={(e) => setTradedAt(e.target.value)}
                className="input num font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex-1 min-w-[200px]">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="交易備註說明（選填：例如 定期定額、除息加碼）"
                className="input text-xs py-2"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'btn font-semibold text-xs py-2 px-5 text-white shadow-xs disabled:opacity-50',
                type === 'BUY'
                  ? 'border-up bg-up hover:bg-emerald-600'
                  : 'border-down bg-down hover:bg-rose-600',
              )}
            >
              <PlusCircle className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? '同步儲存中…'
                  : type === 'BUY'
                  ? '確認加入買進'
                  : '確認加入賣出'}
              </span>
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-300/40 bg-rose-50/80 px-3.5 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </form>

      {/* Transaction Table Card */}
      <section className="card overflow-hidden">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h3 className="section-title">歷史交易流水帳</h3>
            <p className="section-hint">
              共 {transactions.length} 筆交易紀錄 · 支援按方向與代號篩選
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search by Symbol */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <input
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                placeholder="依代號過濾…"
                className="input py-1.5 pl-8 pr-3 text-xs w-36 sm:w-44"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="inline-flex rounded-lg border border-black/10 bg-white/70 p-0.5 text-xs dark:border-white/10 dark:bg-zinc-800/70">
              {(['ALL', 'BUY', 'SELL'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-semibold transition',
                    filterType === t
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-ink-soft hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5',
                  )}
                >
                  {t === 'ALL' ? '全部' : t === 'BUY' ? '買進' : '賣出'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-black/5 dark:divide-white/10 text-sm">
            <thead>
              <tr className="bg-black/[0.02] dark:bg-white/[0.02]">
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                  交易日期
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                  標的代號
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                  交易方向
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                  成交股數
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                  成交單價
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                  手續費
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                  結算交割金額
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                  已實現損益
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                  備註
                </th>
                <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-[0.1em] text-ink-mute dark:text-zinc-400">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filtered.map((t) => {
                const subtotal = t.shares * t.price + (t.type === 'BUY' ? t.fee : -t.fee);
                return (
                  <tr
                    key={t.id}
                    className="transition hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-ink-soft dark:text-zinc-300">
                      {t.tradedAt}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-bold text-ink dark:text-zinc-100">
                      {t.symbol}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold',
                          t.type === 'BUY'
                            ? 'bg-emerald-500/10 text-up dark:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-down dark:bg-rose-500/20',
                        )}
                      >
                        {t.type === 'BUY' ? '買進' : '賣出'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono font-medium num text-ink dark:text-zinc-100">
                      {formatShares(t.shares)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono num text-ink-soft dark:text-zinc-300">
                      ${formatNumber(t.price)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono text-xs text-ink-mute num">
                      ${formatNumber(t.fee)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono font-bold num text-ink dark:text-zinc-100">
                      ${formatNumber(subtotal)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono font-bold num">
                      {t.realizedGainLoss != null ? (
                        <span className={changeColor(t.realizedGainLoss)}>
                          {t.realizedGainLoss >= 0 ? '+' : ''}
                          ${formatNumber(t.realizedGainLoss)}
                        </span>
                      ) : (
                        <span className="text-ink-faint text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-mute dark:text-zinc-400 max-w-[180px] truncate">
                      {t.note || '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTxn(t);
                            setTradeModalOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-ink-mute transition hover:bg-black/5 hover:text-brand dark:hover:bg-white/10"
                          title="編輯交易資料"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await removeTransaction(t.id);
                            toast.info(`已刪除 ${t.symbol} 交易紀錄`);
                          }}
                          className="rounded-lg p-1.5 text-ink-mute transition hover:bg-black/5 hover:text-down dark:hover:bg-white/10"
                          title="刪除此筆交易"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm text-ink-mute dark:text-zinc-500"
                  >
                    <p>尚無符合條件的交易紀錄</p>
                    {transactions.length === 0 && (
                      <div className="mt-3 flex justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            useStockStore.getState().loadDemoData();
                            toast.success('已載入示範交易紀錄與持倉！');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 dark:bg-brand/10"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>載入示範交易數據 (Demo)</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit / Quick Trade Modal */}
      {tradeModalOpen && (
        <QuickTradeModal
          isOpen={tradeModalOpen}
          onClose={() => {
            setTradeModalOpen(false);
            setEditingTxn(null);
          }}
          editTransaction={editingTxn}
        />
      )}
    </div>
  );
}
