import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchTickers } from '@/services/stocks';
import { cn } from '@/lib/cn';

export function Header() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: results = [] } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTickers(query),
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function goto(symbol: string) {
    setOpen(false);
    setQuery('');
    navigate(`/stock/${encodeURIComponent(symbol)}`);
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-black/5 bg-white/55 px-4 backdrop-blur-2xl backdrop-saturate-150 md:px-6">
      <div ref={wrapRef} className="relative max-w-lg flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
          ⌕
        </span>
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) goto(results[0].symbol);
          }}
          placeholder="搜尋股票代號或公司名稱（例：AAPL、2330）"
          className="w-full rounded-lg border border-black/10 bg-white/80 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint shadow-sm focus:border-brand/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
        {open && query && results.length > 0 && (
          <ul className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-y-auto rounded-xl border border-black/5 bg-white/85 shadow-pop backdrop-blur-2xl backdrop-saturate-150">
            {results.map((r) => (
              <li key={r.symbol}>
                <button
                  type="button"
                  onClick={() => goto(r.symbol)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-ink-soft transition hover:bg-black/[0.04]',
                  )}
                >
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{r.symbol}</span>
                    <span className="ml-2 text-ink-mute">{r.name}</span>
                  </span>
                  <span className="chip shrink-0">{r.exchange}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="hidden items-center gap-2 text-xs md:flex">
        <span className="chip">Yahoo Finance</span>
        <span className="chip">React Query</span>
      </div>
    </header>
  );
}
