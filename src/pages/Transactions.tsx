import { useMemo, useState, type FormEvent } from 'react';
import { useStockStore } from '@/store/useStockStore';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { TransactionType } from '@/types/stock';

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function Transactions() {
  const transactions = useStockStore((s) => s.transactions);
  const addTransaction = useStockStore((s) => s.addTransaction);
  const removeTransaction = useStockStore((s) => s.removeTransaction);

  const [type, setType] = useState<TransactionType>('BUY');
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('0');
  const [tradedAt, setTradedAt] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | TransactionType>('ALL');

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
  }

  const filtered = useMemo(
    () => (filter === 'ALL' ? transactions : transactions.filter((t) => t.type === filter)),
    [filter, transactions],
  );

  const totals = useMemo(() => {
    let buyAmount = 0;
    let sellAmount = 0;
    for (const t of transactions) {
      const amt = t.shares * t.price + t.fee;
      if (t.type === 'BUY') buyAmount += amt;
      else sellAmount += t.shares * t.price - t.fee;
    }
    return { buyAmount, sellAmount, net: sellAmount - buyAmount };
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">交易紀錄</h1>
        <p className="mt-1 text-sm text-ink-mute">
          記錄每筆買進 / 賣出，自動更新持股平均成本。
          <span className="ml-1.5 text-ink-faint">
            資料暫存於本機；登入後會同步至後端
          </span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="card">
        <div className="card-header">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-ink">新增交易</h3>
            <p className="mt-0.5 text-xs text-ink-mute">
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="代號"
              className="input col-span-2 md:col-span-1"
            />
            <input
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              inputMode="decimal"
              placeholder="股數"
              className="input num font-mono"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="成交價"
              className="input num font-mono"
            />
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              inputMode="decimal"
              placeholder="手續費"
              className="input num font-mono"
            />
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
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備註（選填）"
            className="input"
          />
          {error && <p className="text-sm text-down">{error}</p>}
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
            累計買進
          </p>
          <p className="mt-2 font-mono text-[22px] font-semibold text-ink num">
            {formatNumber(totals.buyAmount)}
          </p>
          <p className="mt-1 text-xs text-ink-mute">含手續費</p>
        </div>
        <div className="card p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
            累計賣出
          </p>
          <p className="mt-2 font-mono text-[22px] font-semibold text-ink num">
            {formatNumber(totals.sellAmount)}
          </p>
          <p className="mt-1 text-xs text-ink-mute">扣除手續費</p>
        </div>
        <div className="card p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
            現金淨流入
          </p>
          <p
            className={cn(
              'mt-2 font-mono text-[22px] font-semibold num',
              totals.net >= 0 ? 'text-up' : 'text-down',
            )}
          >
            {totals.net >= 0 ? '+' : ''}
            {formatNumber(totals.net)}
          </p>
          <p className="mt-1 text-xs text-ink-mute">賣出 − 買進</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-ink">歷史紀錄</h3>
            <p className="mt-0.5 text-xs text-ink-mute">依成交日期排序；可篩選買 / 賣</p>
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
              <tr className="bg-black/[0.02] text-[11px] uppercase tracking-[0.12em] text-ink-mute">
                <th className="px-5 py-3 text-left font-semibold">日期</th>
                <th className="px-5 py-3 text-left font-semibold">類別</th>
                <th className="px-5 py-3 text-left font-semibold">代號</th>
                <th className="px-5 py-3 text-right font-semibold">股數</th>
                <th className="px-5 py-3 text-right font-semibold">單價</th>
                <th className="px-5 py-3 text-right font-semibold">金額</th>
                <th className="px-5 py-3 text-right font-semibold">手續費</th>
                <th className="px-5 py-3 text-left font-semibold">備註</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filtered.map((t) => (
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
                    {formatNumber(t.shares, 0)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono num">
                    {formatNumber(t.price)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono num">
                    {formatNumber(t.shares * t.price)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono num">
                    {formatNumber(t.fee)}
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
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-ink-mute">
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
