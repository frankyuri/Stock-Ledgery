import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { LineAreaChart } from '@/components/charts/LineAreaChart';
import { portfolioQueryOptions } from '@/lib/queries/portfolio';
import { todayISO } from '@/lib/date';
import { convert, SUPPORTED_BASE_CURRENCIES, type BaseCurrency } from '@/lib/fx';

const CURRENCIES = ['TWD', 'USD', 'HKD', 'JPY', 'EUR'];

interface Row {
  id: string;
  currency: string;
  cash: string;
  securities: string;
  other: string;
}

function rowId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function newRow(currency = 'TWD'): Row {
  return { id: rowId(), currency, cash: '', securities: '', other: '0' };
}

export function Assets() {
  const assets = useStockStore((s) => s.assets);
  const holdings = useStockStore((s) => s.holdings);
  const addAssetSnapshot = useStockStore((s) => s.addAssetSnapshot);
  const removeAssetSnapshot = useStockStore((s) => s.removeAssetSnapshot);

  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([newRow('TWD')]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<BaseCurrency>('TWD');

  const { data: portfolio } = useQuery(portfolioQueryOptions(holdings));

  const securitiesByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of portfolio?.holdings ?? []) {
      m.set(p.currency, (m.get(p.currency) ?? 0) + p.marketValue);
    }
    return m;
  }, [portfolio]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.currency));
    const next = CURRENCIES.find((c) => !used.has(c)) ?? 'USD';
    setRows((rs) => [...rs, newRow(next)]);
  }

  function removeRow(id: string) {
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.id !== id)));
  }

  function fillSecurities(row: Row) {
    const v = securitiesByCurrency.get(row.currency);
    if (v != null) updateRow(row.id, { securities: String(Math.round(v * 100) / 100) });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed: Array<{
      currency: string;
      cash: number;
      securities: number;
      other: number;
    }> = [];
    for (const r of rows) {
      const c = Number(r.cash);
      const s = Number(r.securities);
      const o = Number(r.other) || 0;
      if (!Number.isFinite(c) || c < 0) return setError(`${r.currency} 現金需為非負數`);
      if (!Number.isFinite(s) || s < 0) return setError(`${r.currency} 證券市值需為非負數`);
      if (c + s + o === 0) continue;
      parsed.push({ currency: r.currency, cash: c, securities: s, other: o });
    }
    if (parsed.length === 0) return setError('至少需填入一個幣別的金額');

    for (const p of parsed) {
      addAssetSnapshot({ date, note, ...p });
    }

    setRows([newRow('TWD')]);
    setNote('');
  }

  const grouped = useMemo(() => {
    const m = new Map<string, typeof assets>();
    for (const a of assets) {
      const list = m.get(a.currency) ?? [];
      list.push(a);
      m.set(a.currency, list);
    }
    for (const list of m.values()) {
      list.sort((x, y) => x.date.localeCompare(y.date));
    }
    return Array.from(m.entries());
  }, [assets]);

  const primary = grouped[0];
  const chartData = useMemo(() => {
    if (!primary) return [];
    return primary[1].map((a) => ({
      time: a.date,
      value: a.cash + a.securities + a.other,
    }));
  }, [primary]);

  const { combinedSeries, unsupportedCurrencies } = useMemo(() => {
    if (assets.length === 0 || grouped.length <= 1) {
      return { combinedSeries: [], unsupportedCurrencies: [] as string[] };
    }
    const byDate = new Map<string, number>();
    const unsupported = new Set<string>();
    for (const a of assets) {
      const total = a.cash + a.securities + a.other;
      const inBase = convert(total, a.currency, baseCurrency);
      if (inBase == null) {
        unsupported.add(a.currency);
        continue;
      }
      byDate.set(a.date, (byDate.get(a.date) ?? 0) + inBase);
    }
    const series = Array.from(byDate.entries())
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([time, value]) => ({ time, value: Math.round(value * 100) / 100 }));
    return { combinedSeries: series, unsupportedCurrencies: Array.from(unsupported) };
  }, [assets, grouped.length, baseCurrency]);

  const latest = primary ? primary[1][primary[1].length - 1] : undefined;
  const first = primary ? primary[1][0] : undefined;
  const change =
    latest && first
      ? latest.cash + latest.securities + latest.other - (first.cash + first.securities + first.other)
      : 0;

  const combinedLatest = combinedSeries[combinedSeries.length - 1]?.value ?? 0;
  const combinedFirst = combinedSeries[0]?.value ?? 0;
  const combinedChange = combinedLatest - combinedFirst;

  const spanDays =
    latest && first
      ? Math.round(
          (new Date(latest.date).getTime() - new Date(first.date).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2.5">
          <Layers className="h-7 w-7 text-brand" />
          淨值快照與總資產趨勢
        </h1>
        <p className="mt-1 text-[15px] text-ink-mute dark:text-zinc-400">
          定期記錄現金存款、證券市值與其他資產，繪製個人的長期淨值成長曲線。
        </p>
      </div>

      {/* Input Snapshot Card */}
      <form onSubmit={onSubmit} className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">新增資產快照</h2>
            <p className="section-hint">支援多幣別分開記錄；可一鍵帶入目前證券部位現值</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-mute dark:text-zinc-400">快照日期：</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input w-auto font-mono text-xs py-1.5"
            />
          </div>
        </div>

        <div className="card-body space-y-4">
          <div className="space-y-3">
            {rows.map((r) => {
              const suggestion = securitiesByCurrency.get(r.currency);
              const suggestionFilled =
                suggestion != null && Math.abs(Number(r.securities) - suggestion) < 0.01;
              return (
                <div key={r.id} className="grid grid-cols-1 gap-3 sm:grid-cols-5 md:grid-cols-12">
                  <select
                    value={r.currency}
                    onChange={(e) => updateRow(r.id, { currency: e.target.value })}
                    className="input sm:col-span-2 md:col-span-2 font-semibold"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    value={r.cash}
                    onChange={(e) => updateRow(r.id, { cash: e.target.value })}
                    inputMode="decimal"
                    placeholder="現金存款"
                    className="input num font-mono sm:col-span-3 md:col-span-3"
                  />
                  <div className="relative sm:col-span-3 md:col-span-4">
                    <input
                      value={r.securities}
                      onChange={(e) => updateRow(r.id, { securities: e.target.value })}
                      inputMode="decimal"
                      placeholder="證券市值"
                      className={cn('input num font-mono', suggestion != null && 'pr-24')}
                    />
                    {suggestion != null && !suggestionFilled && (
                      <button
                        type="button"
                        onClick={() => fillSecurities(r)}
                        title={`帶入目前持股 ${formatNumber(suggestion)} ${r.currency}`}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand transition hover:bg-brand/15 dark:bg-brand/20"
                      >
                        帶入持股
                      </button>
                    )}
                  </div>
                  <input
                    value={r.other}
                    onChange={(e) => updateRow(r.id, { other: e.target.value })}
                    inputMode="decimal"
                    placeholder="其他資產"
                    className="input num font-mono sm:col-span-2 md:col-span-2"
                  />
                  <div className="flex items-center sm:col-span-1 md:col-span-1">
                    <button
                      type="button"
                      onClick={() => removeRow(r.id)}
                      disabled={rows.length === 1}
                      className="btn p-2.5 text-ink-mute hover:text-down disabled:opacity-30"
                      title="移除此幣別列"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= CURRENCIES.length}
              className="btn text-xs py-2 px-3 flex items-center gap-1.5 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>新增其他幣別</span>
            </button>
            <button type="submit" className="btn btn-primary text-xs py-2 px-4 shadow-sm font-semibold">
              儲存此快照
            </button>
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="快照備註說明（例如：季度結算、年終獎金入帳、定期平衡）"
            className="input text-xs py-2"
          />
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-300/40 bg-rose-50/80 px-3.5 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-950/20 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </form>

      {primary ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card p-5">
              <span className="label-caps flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-brand" />
                最新快照淨值
              </span>
              <p className="mt-2.5 font-mono text-[28px] font-bold text-ink dark:text-zinc-100 num">
                {latest
                  ? formatCurrency(latest.cash + latest.securities + latest.other, latest.currency)
                  : '—'}
              </p>
              <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400">
                記錄日期：{latest?.date ?? '—'}
              </p>
            </div>

            <div className="card p-5">
              <span className="label-caps flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-brand" />
                歷史期間淨資產變化
              </span>
              <p
                className={cn(
                  'mt-2.5 font-mono text-[28px] font-bold num',
                  change >= 0 ? 'text-up' : 'text-down',
                )}
              >
                {change >= 0 ? '+' : ''}
                {formatNumber(change)}
              </p>
              <p className="mt-1 text-xs text-ink-mute dark:text-zinc-400">
                {first?.date} → {latest?.date}
                {spanDays > 0 && (
                  <span className="ml-1.5 text-ink-faint">· 跨越 {spanDays} 天</span>
                )}
              </p>
            </div>
          </div>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="section-title">淨值成長趨勢線 · {primary[0]}</h2>
                <p className="section-hint">總淨值走勢（現金 + 證券市值 + 其他資產）</p>
              </div>
            </div>
            <div className="card-body">
              <LineAreaChart data={chartData} />
            </div>
          </section>

          {combinedSeries.length > 0 && (
            <section className="card">
              <div className="card-header flex-wrap gap-3">
                <div>
                  <h2 className="section-title">全幣別合計趨勢（折算 {baseCurrency}）</h2>
                  <p className="section-hint">
                    依即時匯率換算各幣別並疊加總額
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-black/10 bg-white/70 p-0.5 text-xs dark:border-white/10 dark:bg-zinc-800/70">
                  {SUPPORTED_BASE_CURRENCIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBaseCurrency(c)}
                      className={cn(
                        'rounded-md px-3 py-1 font-semibold transition',
                        baseCurrency === c
                          ? 'bg-brand text-white shadow-xs'
                          : 'text-ink-soft hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-body space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <span className="font-mono text-2xl font-bold text-ink dark:text-zinc-100 num">
                    {formatCurrency(combinedLatest, baseCurrency)}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold num',
                      combinedChange >= 0 ? 'text-up' : 'text-down',
                    )}
                  >
                    期間變動 {combinedChange >= 0 ? '+' : ''}
                    {formatNumber(combinedChange)} {baseCurrency}
                  </span>
                </div>
                {unsupportedCurrencies.length > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ⚠ 下列幣別暫無即時匯率對應：
                    <span className="ml-1 font-mono font-bold">
                      {unsupportedCurrencies.join('、')}
                    </span>
                  </p>
                )}
                <LineAreaChart data={combinedSeries} />
              </div>
            </section>
          )}

          {/* Historical Table */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <div>
                <h3 className="section-title">歷史快照明細</h3>
                <p className="section-hint">依時間倒序排列</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-black/5 dark:divide-white/10 text-sm">
                <thead>
                  <tr className="bg-black/[0.02] dark:bg-white/[0.02] text-xs uppercase tracking-[0.12em] text-ink-mute dark:text-zinc-400 font-bold">
                    <th className="px-5 py-3.5 text-left">快照日期</th>
                    <th className="px-5 py-3.5 text-left">幣別</th>
                    <th className="px-5 py-3.5 text-right">現金存款</th>
                    <th className="px-5 py-3.5 text-right">證券市值</th>
                    <th className="px-5 py-3.5 text-right">其他資產</th>
                    <th className="px-5 py-3.5 text-right">合計總淨值</th>
                    <th className="px-5 py-3.5 text-left">備註說明</th>
                    <th className="px-5 py-3.5 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {assets
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((a) => {
                      const total = a.cash + a.securities + a.other;
                      return (
                        <tr key={a.id} className="text-ink-soft dark:text-zinc-300 transition hover:bg-black/[0.02] dark:hover:bg-white/5">
                          <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs num">
                            {a.date}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-ink dark:text-zinc-100">
                            {a.currency}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono num">
                            {formatNumber(a.cash)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono num">
                            {formatNumber(a.securities)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono num">
                            {formatNumber(a.other)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-ink dark:text-zinc-100 num">
                            {formatNumber(total)}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-ink-mute dark:text-zinc-400">
                            {a.note || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeAssetSnapshot(a.id)}
                              className="rounded-lg p-1 text-ink-mute transition hover:bg-black/5 hover:text-down dark:hover:bg-white/10"
                              title="刪除此快照"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card card-body py-14 text-center text-sm text-ink-mute dark:text-zinc-500">
          尚未記錄任何資產快照。填入今天的現金與證券市值即可開始追蹤淨值成長曲線。
        </div>
      )}
    </div>
  );
}
