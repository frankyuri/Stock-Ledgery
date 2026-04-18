import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStockStore } from '@/store/useStockStore';
import { SymbolSearchInput } from '@/components/ui/SymbolSearchInput';
import { fetchQuote } from '@/services/stocks';
import { formatNumber } from '@/lib/format';
import type { Quote, SearchResult } from '@/types/stock';

export function HoldingForm() {
  const upsert = useStockStore((s) => s.upsertHolding);
  const qc = useQueryClient();

  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (!avgCost) setAvgCost(String(q.price));
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
    setQuote(null);
  }

  const currency = quote?.currency;

  return (
    <form onSubmit={onSubmit} className="card">
      <div className="card-header">
        <div>
          <h3 className="section-title">新增 / 更新持股</h3>
          <p className="section-hint">
            輸入公司名或代號即會帶出搜尋建議；選中後會自動帶入現價作為成本
          </p>
        </div>
      </div>
      <div className="card-body space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1.2fr_auto]">
          <SymbolSearchInput
            value={symbol}
            onChange={onSymbolChange}
            onSelect={handleSelect}
          />
          <input
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="股數"
            inputMode="decimal"
            className="input num font-mono"
          />
          <div className="relative">
            <input
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder="平均成本"
              inputMode="decimal"
              className="input num font-mono pr-14"
            />
            {currency && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[11px] font-semibold text-ink-mute">
                {currency}
              </span>
            )}
          </div>
          <button type="submit" className="btn btn-primary px-5">
            加入
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

        {error && <p className="text-[15px] text-down">{error}</p>}
      </div>
    </form>
  );
}
