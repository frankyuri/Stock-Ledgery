import { useState, type FormEvent } from 'react';
import { useStockStore } from '@/store/useStockStore';

export function HoldingForm() {
  const upsert = useStockStore((s) => s.upsertHolding);
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const s = symbol.trim().toUpperCase();
    const sh = Number(shares);
    const ac = Number(avgCost);
    if (!s) return setError('請輸入股票代號');
    if (!Number.isFinite(sh) || sh <= 0) return setError('股數需為正數');
    if (!Number.isFinite(ac) || ac <= 0) return setError('平均成本需為正數');

    upsert({ symbol: s, shares: sh, avgCost: ac });
    setSymbol('');
    setShares('');
    setAvgCost('');
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <div className="card-header">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-ink">
            新增 / 更新持股
          </h3>
          <p className="mt-0.5 text-xs text-ink-mute">
            代號同時存在時會覆寫。台股請使用{' '}
            <code className="rounded bg-black/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">
              2330.TW
            </code>{' '}
            格式
          </p>
        </div>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="代號（AAPL / 2330.TW）"
            className="input"
          />
          <input
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="股數"
            inputMode="decimal"
            className="input num font-mono"
          />
          <input
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            placeholder="平均成本"
            inputMode="decimal"
            className="input num font-mono"
          />
          <button type="submit" className="btn btn-primary px-5">
            加入
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-down">{error}</p>}
      </div>
    </form>
  );
}
