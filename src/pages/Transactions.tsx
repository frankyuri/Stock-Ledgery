import { useState, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStockStore } from '@/store/useStockStore';
import { SymbolSearchInput } from '@/components/ui/SymbolSearchInput';
import { fetchQuote } from '@/services/stocks';
import { cn } from '@/lib/cn';
import { formatNumber, formatShares } from '@/lib/format';
import type { Quote, SearchResult, TransactionType } from '@/types/stock';

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function Transactions() {
  const transactions = useStockStore((s) => s.transactions);
  const addTransaction = useStockStore((s) => s.addTransaction);
  const removeTransaction = useStockStore((s) => s.removeTransaction);
  const qc = useQueryClient();

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
  const [filter, setFilter] = useState<'ALL' | TransactionType>('ALL');

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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const s = symbol.trim().toUpperCase();
    const sh = Number(shares);
    const p = Number(price);
    const f = Number(fee) || 0;
    if (!s) return setError('請輸入股票代號');
    if (!Number.isFinite(sh) || sh <= 0) return setError('股數需為正數');
    if (!Number.isFinite(p) || p <= 0) return setError('成交價需為正數');

    addTransaction({ type, symbol: s, shares: sh, price: p, fee: f, tradedAt, note });
    setSymbol('');
    setShares('');
    setPrice('');
    setFee('0');
    setNote('');
    setQuote(null);
  }

  const filtered = useMemo(
    () => (filter === 'ALL' ? transactions : transactions.filter((t) => t.type === filter)),
    [filter, transactions],
  );

  const currency = quote?.currency;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">交易紀錄</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">
          記錄每筆買進 / 賣出，自動更新持股平均成本。
          <span className="ml-1.5 text-ink-faint">
            資料暫存於本機；登入後會同步至後端
          </span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="card">
        <div className="card-header">
          <div>
            <h3 className="section-title">新增交易</h3>
            <p className="section-hint">
              買進將加權計算新的平均成本；賣出會扣減股數（成本不變）
            </p>
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-black/10 bg-white/70">
            {(['BUY', 'SELL'] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'px-4 py-1.5 text-xs font-medium transition',
                  type === t
                    ? t === 'BUY'
                      ? 'bg-up text-white'
                      : 'bg-down text-white'
                    : 'text-ink-soft hover:bg-black/[0.04]',
                )}
              >
                {t === 'BUY' ? '買進' : '賣出'}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <SymbolSearchInput
              value={symbol}
              onChange={onSymbolChange}
              onSelect={handleSelect}
              className="sm:col-span-2 md:col-span-1"
            />
            <input
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              inputMode="decimal"
              placeholder="股數"
              className="input num font-mono"
            />
            <div className="relative">
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="成交價"
                className={cn('input num font-mono', quote && 'pr-20')}
              />
              {quote && (
                <button
                  type="button"
                  onClick={useLivePrice}
                  title={`使用現價 ${formatNumber(quote.price)} ${quote.currency}`}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand transition hover:bg-brand/15"
                >
                  用現價
                </button>
              )}
            </div>
            <div className="relative">
              <input
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                inputMode="decimal"
                placeholder="手續費"
                className={cn('input num font-mono', currency && 'pr-14')}
              />
              {currency && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[11px] font-semibold text-ink-mute">
                  {currency}
                </span>
              )}
            </div>
            <input
              type="date"
              value={tradedAt}
              onChange={(e) => setTradedAt(e.target.value)}
              className="input num font-mono"
            />
            <button
              type="submit"
              className={cn(
                'btn px-5',
                type === 'BUY' ? 'btn-primary' : 'border-down/50 bg-down text-white hover:bg-down/90',
              )}
            >
              {type === 'BUY' ? '加入買進' : '加入賣出'}
            </button>
          </div>

          {(loadingQuote || quote) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-mute">
              {loadingQuote && <span>查詢現價中…</span>}
              {quote && (
                <>
                  <span className="chip">{quote.symbol}</span>
                  <span className="truncate text-ink-soft">{quote.name}</span>
                  <span className="font-mono num text-ink">
                    現價 {formatNumber(quote.price)} {quote.currency}
                  </span>
                  {quote.exchangeName && (
                    <span className="text-ink-faint">· {quote.exchangeName}</span>
                  )}
                </>
              )}
            </div>
          )}

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備註（選填）"
            className="input"
          />
          {error && <p className="text-sm text-down">{error}</p>}
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h3 className="section-title">歷史紀錄</h3>
            <p className="section-hint">依成交日期排序；可篩選買 / 賣</p>
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-black/10 bg-white/70 text-xs">
            {(['ALL', 'BUY', 'SELL'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 font-medium transition',
                  filter === f
                    ? 'bg-brand text-white'
                    : 'text-ink-soft hover:bg-black/[0.04]',
                )}
              >
                {f === 'ALL' ? '全部' : f === 'BUY' ? '買進' : '賣出'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-black/5 text-sm">
            <thead>
              <tr className="bg-black/[0.02] text-xs uppercase tracking-[0.12em] text-ink-mute">
                <th className="px-5 py-3 text-left font-semibold">日期</th>
                <th className="px-5 py-3 text-left font-semibold">類別</th>
                <th className="px-5 py-3 text-left font-semibold">代號</th>
                <th className="px-5 py-3 text-right font-semibold">股數</th>
                <th className="px-5 py-3 text-right font-semibold">單價</th>
                <th className="px-5 py-3 text-right font-semibold">小計</th>
                <th className="px-5 py-3 text-right font-semibold">手續費</th>
                <th className="px-5 py-3 text-right font-semibold">合計</th>
                <th className="px-5 py-3 text-left font-semibold">備註</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filtered.map((t) => {
                const subtotal = t.shares * t.price;
                const total = t.type === 'BUY' ? subtotal + t.fee : subtotal - t.fee;
                return (
                  <tr key={t.id} className="text-ink-soft">
                    <td className="whitespace-nowrap px-5 py-3 font-mono num">
                      {t.tradedAt}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'chip',
                          t.type === 'BUY'
                            ? 'border-up/30 bg-up/[0.1] text-up'
                            : 'border-down/30 bg-down/[0.1] text-down',
                        )}
                      >
                        {t.type === 'BUY' ? '買進' : '賣出'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-semibold text-ink">
                      {t.symbol}
                    </td>
                    <td className="px-5 py-3 text-right font-mono num">
                      {formatShares(t.shares)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono num">
                      {formatNumber(t.price)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono num">
                      {formatNumber(subtotal)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-ink-mute num">
                      {formatNumber(t.fee)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-ink num">
                      {formatNumber(total)}
                    </td>
                    <td className="px-5 py-3 text-ink-mute">{t.note ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeTransaction(t.id)}
                        className="rounded-md px-2 py-1 text-xs text-ink-mute transition hover:bg-black/5 hover:text-down"
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-ink-mute">
                    {transactions.length === 0
                      ? '尚未有任何交易紀錄，先從上方新增一筆試試看'
                      : '沒有符合條件的交易'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
