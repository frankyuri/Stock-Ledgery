import { useMemo, useState, type FormEvent } from 'react';
import { useStockStore } from '@/store/useStockStore';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { LineAreaChart } from '@/components/charts/LineAreaChart';

const CURRENCIES = ['TWD', 'USD', 'HKD', 'JPY', 'EUR'];

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function Assets() {
  const assets = useStockStore((s) => s.assets);
  const addAssetSnapshot = useStockStore((s) => s.addAssetSnapshot);
  const removeAssetSnapshot = useStockStore((s) => s.removeAssetSnapshot);

  const [date, setDate] = useState(todayISO());
  const [cash, setCash] = useState('');
  const [securities, setSecurities] = useState('');
  const [other, setOther] = useState('0');
  const [currency, setCurrency] = useState('TWD');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const c = Number(cash);
    const s = Number(securities);
    const o = Number(other) || 0;
    if (!Number.isFinite(c) || c < 0) return setError('現金需為非負數');
    if (!Number.isFinite(s) || s < 0) return setError('證券市值需為非負數');
    addAssetSnapshot({ date, cash: c, securities: s, other: o, currency, note });
    setCash('');
    setSecurities('');
    setOther('0');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">資產紀錄</h1>
        <p className="mt-1 text-sm text-ink-mute">
          週 / 月定期記錄現金、證券、其他資產快照，追蹤總淨值變化。
        </p>
      </div>

      <form onSubmit={onSubmit} className="card">
        <div className="card-header">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-ink">新增快照</h3>
            <p className="mt-0.5 text-xs text-ink-mute">
              每次輸入都是一筆獨立的時間點紀錄，不會覆蓋既有資料
            </p>
          </div>
        </div>
        <div className="card-body space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input num font-mono"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="input"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              inputMode="decimal"
              placeholder="現金"
              className="input num font-mono"
            />
            <input
              value={securities}
              onChange={(e) => setSecurities(e.target.value)}
              inputMode="decimal"
              placeholder="證券市值"
              className="input num font-mono"
            />
            <input
              value={other}
              onChange={(e) => setOther(e.target.value)}
              inputMode="decimal"
              placeholder="其他"
              className="input num font-mono"
            />
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="card p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
                最新淨值
              </p>
              <p className="mt-2 font-mono text-[24px] font-semibold text-ink num">
                {latest
                  ? formatCurrency(latest.cash + latest.securities + latest.other, latest.currency)
                  : '—'}
              </p>
              <p className="mt-1 text-xs text-ink-mute">{latest?.date ?? '—'}</p>
            </div>
            <div className="card p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
                期間變動
              </p>
              <p
                className={cn(
                  'mt-2 font-mono text-[24px] font-semibold num',
                  change >= 0 ? 'text-up' : 'text-down',
                )}
              >
                {change >= 0 ? '+' : ''}
                {formatNumber(change)}
              </p>
              <p className="mt-1 text-xs text-ink-mute">
                {first?.date} → {latest?.date}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
                資產結構
              </p>
              {latest && (
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-mute">現金</span>
                    <span className="font-mono num">
                      {formatCurrency(latest.cash, latest.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-mute">證券</span>
                    <span className="font-mono num">
                      {formatCurrency(latest.securities, latest.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-mute">其他</span>
                    <span className="font-mono num">
                      {formatCurrency(latest.other, latest.currency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-ink">
                  淨值走勢 · {primary[0]}
                </h2>
                <p className="mt-0.5 text-xs text-ink-mute">
                  依時間點繪製總淨值（現金 + 證券 + 其他）
                </p>
              </div>
            </div>
            <div className="card-body">
              <LineAreaChart data={chartData} />
            </div>
          </section>

          <div className="card overflow-hidden">
            <div className="card-header">
              <div>
                <h3 className="text-base font-semibold tracking-tight text-ink">歷史快照</h3>
                <p className="mt-0.5 text-xs text-ink-mute">依日期排序</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-black/5 text-sm">
                <thead>
                  <tr className="bg-black/[0.02] text-[11px] uppercase tracking-[0.12em] text-ink-mute">
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
