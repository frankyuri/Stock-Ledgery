import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '@/store/useStockStore';
import { fetchPortfolio } from '@/services/stocks';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { LineAreaChart } from '@/components/charts/LineAreaChart';

const CURRENCIES = ['TWD', 'USD', 'HKD', 'JPY', 'EUR'];

interface Row {
  id: string;
  currency: string;
  cash: string;
  securities: string;
  other: string;
}

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
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

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio', holdings],
    queryFn: () => fetchPortfolio(holdings),
    enabled: holdings.length > 0,
    staleTime: 60_000,
  });

  const securitiesByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of portfolio ?? []) {
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

  const latest = primary?.[1][primary[1].length - 1];
  const first = primary?.[1][0];
  const change =
    latest && first
      ? latest.cash + latest.securities + latest.other - (first.cash + first.securities + first.other)
      : 0;
  const spanDays =
    latest && first
      ? Math.max(
          1,
          Math.round(
            (new Date(latest.date).getTime() - new Date(first.date).getTime()) /
              86_400_000,
          ) + 1,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">淨值快照</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">
          週 / 月定期手動記錄現金、證券、其他資產，追蹤整體淨值時間軸（資產配置請看資產總覽）。
        </p>
      </div>

      <form onSubmit={onSubmit} className="card">
        <div className="card-header">
          <div>
            <h3 className="section-title">新增快照</h3>
            <p className="section-hint">
              一次可記多個幣別；證券市值可從目前持股一鍵帶入
            </p>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input num font-mono max-w-[180px]"
          />
        </div>
        <div className="card-body space-y-3">
          <div className="space-y-2.5">
            {rows.map((r) => {
              const suggestion = securitiesByCurrency.get(r.currency);
              const suggestionFilled =
                suggestion != null && Number(r.securities) === Math.round(suggestion * 100) / 100;
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-2 gap-2.5 md:grid-cols-[120px_1fr_1fr_1fr_auto]"
                >
                  <select
                    value={r.currency}
                    onChange={(e) => updateRow(r.id, { currency: e.target.value })}
                    className="input"
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
                    placeholder="現金"
                    className="input num font-mono"
                  />
                  <div className="relative">
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
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand transition hover:bg-brand/15"
                      >
                        帶入持股
                      </button>
                    )}
                  </div>
                  <input
                    value={r.other}
                    onChange={(e) => updateRow(r.id, { other: e.target.value })}
                    inputMode="decimal"
                    placeholder="其他"
                    className="input num font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    disabled={rows.length === 1}
                    className="btn px-3 disabled:opacity-30"
                    title="移除此幣別"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= CURRENCIES.length}
              className="btn disabled:opacity-40"
            >
              ＋ 新增幣別
            </button>
            <button type="submit" className="btn btn-primary px-5">
              加入快照
            </button>
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備註（如：領薪、再平衡）"
            className="input"
          />
          {error && <p className="text-sm text-down">{error}</p>}
        </div>
      </form>

      {primary ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card p-6">
              <p className="label-caps">最新淨值</p>
              <p className="mt-3 font-mono text-[28px] font-semibold text-ink num">
                {latest
                  ? formatCurrency(latest.cash + latest.securities + latest.other, latest.currency)
                  : '—'}
              </p>
              <p className="mt-1.5 text-sm text-ink-mute">{latest?.date ?? '—'}</p>
            </div>
            <div className="card p-6">
              <p className="label-caps">期間變動</p>
              <p
                className={cn(
                  'mt-3 font-mono text-[28px] font-semibold num',
                  change >= 0 ? 'text-up' : 'text-down',
                )}
              >
                {change >= 0 ? '+' : ''}
                {formatNumber(change)}
              </p>
              <p className="mt-1.5 text-sm text-ink-mute">
                {first?.date} → {latest?.date}
                {spanDays > 0 && (
                  <span className="ml-1.5 text-ink-faint">· 跨 {spanDays} 天</span>
                )}
              </p>
            </div>
          </div>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="section-title">淨值走勢 · {primary[0]}</h2>
                <p className="section-hint">依時間點繪製總淨值（現金 + 證券 + 其他）</p>
              </div>
            </div>
            <div className="card-body">
              <LineAreaChart data={chartData} />
            </div>
          </section>

          <div className="card overflow-hidden">
            <div className="card-header">
              <div>
                <h3 className="section-title">歷史快照</h3>
                <p className="section-hint">依日期排序</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-black/5 text-sm">
                <thead>
                  <tr className="bg-black/[0.02] text-xs uppercase tracking-[0.12em] text-ink-mute">
                    <th className="px-5 py-3 text-left font-semibold">日期</th>
                    <th className="px-5 py-3 text-left font-semibold">幣別</th>
                    <th className="px-5 py-3 text-right font-semibold">現金</th>
                    <th className="px-5 py-3 text-right font-semibold">證券</th>
                    <th className="px-5 py-3 text-right font-semibold">其他</th>
                    <th className="px-5 py-3 text-right font-semibold">總計</th>
                    <th className="px-5 py-3 text-left font-semibold">備註</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {assets
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((a) => {
                      const total = a.cash + a.securities + a.other;
                      return (
                        <tr key={a.id} className="text-ink-soft">
                          <td className="whitespace-nowrap px-5 py-3 font-mono num">{a.date}</td>
                          <td className="px-5 py-3">{a.currency}</td>
                          <td className="px-5 py-3 text-right font-mono num">
                            {formatNumber(a.cash)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono num">
                            {formatNumber(a.securities)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono num">
                            {formatNumber(a.other)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-semibold text-ink num">
                            {formatNumber(total)}
                          </td>
                          <td className="px-5 py-3 text-ink-mute">{a.note ?? '—'}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeAssetSnapshot(a.id)}
                              className="rounded-md px-2 py-1 text-xs text-ink-mute transition hover:bg-black/5 hover:text-down"
                            >
                              刪除
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
        <div className="card card-body py-12 text-center text-ink-mute">
          尚未有任何資產快照，從上方輸入今天的現金 / 證券市值試試看
        </div>
      )}
    </div>
  );
}
