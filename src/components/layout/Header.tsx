import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchTickers } from '@/services/stocks';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/cn';

export function Header() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const { data: results = [] } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTickers(query),
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
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
      </div>

      {user ? (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-sm shadow-sm transition hover:bg-white"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-xs font-semibold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden text-ink-soft md:inline">{user.name}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-black/5 bg-white/90 shadow-pop backdrop-blur-2xl">
              <div className="border-b border-black/5 px-4 py-3">
                <p className="text-sm font-medium text-ink">{user.name}</p>
                <p className="text-xs text-ink-mute">{user.email}</p>
                <p className="mt-1 text-[11px] text-ink-faint">
                  LINE：
                  {user.lineDisplayName ? (
                    <span className="text-[#06C755]">● {user.lineDisplayName}</span>
                  ) : (
                    <span className="text-ink-faint">尚未綁定</span>
                  )}
                </p>
              </div>
              <Link
                to="/settings/line"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-ink-soft hover:bg-black/[0.04]"
              >
                LINE 綁定設定
              </Link>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setMenuOpen(false);
                  navigate('/login');
                }}
                className="block w-full px-4 py-2 text-left text-sm text-down hover:bg-black/[0.04]"
              >
                登出
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn text-xs">
            登入
          </Link>
          <Link to="/register" className="btn btn-primary text-xs">
            註冊
          </Link>
        </div>
      )}
    </header>
  );
}
