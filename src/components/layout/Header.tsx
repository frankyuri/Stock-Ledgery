import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchTickers } from '@/services/stocks';
import { useAuthStore } from '@/store/useAuthStore';
import { useStockStore } from '@/store/useStockStore';
import { useTheme } from '@/lib/theme';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, toggle } = useTheme();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const watchlist = useStockStore((s) => s.watchlist);
  const addToWatchlist = useStockStore((s) => s.addToWatchlist);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(id);
  }, [query]);

  const { data: results = [] } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => searchTickers(debounced),
    enabled: debounced.length > 0,
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
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-black/5 bg-white/55 px-4 backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-zinc-900/55 md:px-6">
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-black/[0.05] dark:text-zinc-300 dark:hover:bg-white/10 md:hidden"
          aria-label="開啟選單"
        >
          <span aria-hidden className="text-xl leading-none">☰</span>
        </button>
      )}
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
          className="w-full rounded-lg border border-black/10 bg-white/80 py-2.5 pl-9 pr-3 text-[15px] text-ink placeholder:text-ink-faint shadow-sm focus:border-brand/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
        {open && query && results.length > 0 && (
          <ul className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-y-auto rounded-xl border border-black/5 bg-white/85 shadow-pop backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-zinc-900/90">
            {results.map((r) => {
              const inList = watchlist.includes(r.symbol);
              return (
                <li
                  key={r.symbol}
                  className="flex items-center justify-between gap-2 border-b border-black/5 px-2 last:border-0 dark:border-white/5"
                >
                  <button
                    type="button"
                    onClick={() => goto(r.symbol)}
                    className={cn(
                      'flex flex-1 items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm text-ink-soft transition hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/5',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="font-semibold text-ink dark:text-zinc-100">
                        {r.symbol}
                      </span>
                      <span className="ml-2 text-ink-mute">{r.name}</span>
                    </span>
                    <span className="chip shrink-0">{r.exchange}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (inList) return;
                      addToWatchlist(r.symbol);
                      toast.success(`已加入自選：${r.symbol}`);
                    }}
                    disabled={inList}
                    title={inList ? '已在自選清單' : '加入自選清單'}
                    className={cn(
                      'mr-1 shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition',
                      inList
                        ? 'cursor-not-allowed text-ink-faint'
                        : 'bg-brand-soft text-brand hover:bg-brand/15',
                    )}
                  >
                    {inList ? '✓' : '+ 自選'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={toggle}
        className="hidden h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/70 text-sm shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-zinc-800/70 dark:hover:bg-zinc-800 md:inline-flex"
        title={theme === 'dark' ? '切換到淺色' : '切換到深色'}
        aria-label="切換主題"
      >
        <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
      </button>
      <div className="hidden items-center gap-2 md:flex">
        <span className="chip">Yahoo Finance</span>
      </div>

      {user ? (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-sm shadow-sm transition hover:bg-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-sm font-semibold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden text-ink-soft md:inline">{user.name}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-black/5 bg-white/90 shadow-pop backdrop-blur-2xl">
              <div className="border-b border-black/5 px-4 py-3.5">
                <p className="text-[15px] font-medium text-ink">{user.name}</p>
                <p className="mt-0.5 text-sm text-ink-mute">{user.email}</p>
                <p className="mt-1.5 text-xs text-ink-faint">
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
                className="block px-4 py-2.5 text-sm text-ink-soft hover:bg-black/[0.04]"
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
                className="block w-full px-4 py-2.5 text-left text-sm text-down hover:bg-black/[0.04]"
              >
                登出
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn text-sm">
            登入
          </Link>
          <Link to="/register" className="btn btn-primary text-sm">
            註冊
          </Link>
        </div>
      )}
    </header>
  );
}
