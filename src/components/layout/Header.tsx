import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Menu,
  Sun,
  Moon,
  Plus,
  Check,
  LogOut,
  Settings,
  X,
  Command,
} from 'lucide-react';
import { useTickerSearch } from '@/lib/hooks/useTickerSearch';
import { useAuthStore } from '@/store/useAuthStore';
import { useStockStore } from '@/store/useStockStore';
import { useTheme } from '@/lib/theme';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { getTaiwanMarketStatus, getUSMarketStatus } from '@/lib/marketStatus';
import { QuickTradeModal } from '@/components/modals/QuickTradeModal';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, toggle } = useTheme();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const watchlist = useStockStore((s) => s.watchlist);
  const addToWatchlist = useStockStore((s) => s.addToWatchlist);

  const { data: results = [] } = useTickerSearch(query);

  const twMarket = getTaiwanMarketStatus();
  const usMarket = getUSMarketStatus();

  // Close menus when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Global hotkeys: Ctrl+K or / to search, T to trade (when not in input)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setOpen(true);
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setOpen(true);
      } else if (e.key.toLowerCase() === 't' && !isInput && !tradeModalOpen) {
        e.preventDefault();
        setTradeModalOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tradeModalOpen]);

  function goto(symbol: string) {
    setOpen(false);
    setQuery('');
    navigate(`/stock/${encodeURIComponent(symbol)}`);
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-black/5 bg-white/70 px-4 backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-zinc-900/70 md:px-6">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-black/[0.05] dark:text-zinc-300 dark:hover:bg-white/10 md:hidden"
            aria-label="開啟選單"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Global Search Bar */}
        <div ref={wrapRef} className="relative max-w-lg flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            ref={searchInputRef}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) goto(results[0].symbol);
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="搜尋股票代號或公司（如：AAPL、2330、NVDA）"
            className="w-full rounded-xl border border-black/10 bg-white/80 py-2 pl-9 pr-16 text-sm text-ink placeholder:text-ink-faint shadow-xs focus:border-brand/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/10 dark:bg-zinc-800/70 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-900"
          />

          {/* Shortcut badge / Clear button */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
                className="rounded p-0.5 text-ink-faint hover:text-ink dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-black/10 bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-ink-mute dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-400">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            )}
          </div>

          {/* Search Dropdown */}
          {open && query && results.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-y-auto rounded-xl border border-black/10 bg-white/95 shadow-pop backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/95">
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
                      className="flex flex-1 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-ink-soft transition hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/5"
                    >
                      <span className="min-w-0">
                        <span className="font-semibold text-ink dark:text-zinc-100">
                          {r.symbol}
                        </span>
                        <span className="ml-2 text-ink-mute dark:text-zinc-400">{r.name}</span>
                      </span>
                      <span className="chip shrink-0 text-[11px]">{r.exchange}</span>
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
                        'mr-1.5 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition',
                        inList
                          ? 'cursor-not-allowed text-ink-faint'
                          : 'bg-brand-soft text-brand hover:bg-brand/15 dark:bg-brand/20',
                      )}
                    >
                      {inList ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {inList ? '已自選' : '自選'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Market Status Badges */}
        <div className="hidden lg:flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white/60 px-2.5 py-1 text-[11px] font-medium text-ink-soft dark:border-white/10 dark:bg-zinc-800/60 dark:text-zinc-300"
            title={`台股 (TWSE): ${twMarket.statusText}`}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                twMarket.isOpen
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-zinc-400 dark:bg-zinc-600',
              )}
            />
            <span>{twMarket.name}</span>
            <span className="text-[10px] text-ink-mute dark:text-zinc-400">{twMarket.statusText}</span>
          </div>

          <div
            className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white/60 px-2.5 py-1 text-[11px] font-medium text-ink-soft dark:border-white/10 dark:bg-zinc-800/60 dark:text-zinc-300"
            title={`美股 (NYSE/NASDAQ): ${usMarket.statusText}`}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                usMarket.isOpen
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-zinc-400 dark:bg-zinc-600',
              )}
            />
            <span>{usMarket.name}</span>
            <span className="text-[10px] text-ink-mute dark:text-zinc-400">{usMarket.statusText}</span>
          </div>
        </div>

        {/* Global Quick Trade Button */}
        <button
          type="button"
          onClick={() => setTradeModalOpen(true)}
          className="btn btn-primary hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3"
          title="快速記錄一筆買進或賣出 (快捷鍵 T)"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>記帳</span>
        </button>

        {/* Theme Switcher Button */}
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/70 text-ink-soft shadow-xs transition hover:bg-white dark:border-white/10 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
          title={theme === 'dark' ? '切換到淺色模式' : '切換到深色模式'}
          aria-label="切換主題"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
        </button>

        {/* User Account Menu */}
        {user ? (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-black/10 bg-white/70 py-1 pl-1 pr-3 text-sm shadow-xs transition hover:bg-white dark:border-white/10 dark:bg-zinc-800/70 dark:hover:bg-zinc-800"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-xs font-bold text-white shadow-xs">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-ink-soft md:inline dark:text-zinc-300 font-medium">
                {user.name}
              </span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-pop backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/95">
                <div className="border-b border-black/5 px-4 py-3.5 dark:border-white/10">
                  <p className="text-sm font-semibold text-ink dark:text-zinc-100">{user.name}</p>
                  <p className="mt-0.5 text-xs text-ink-mute dark:text-zinc-400">{user.email}</p>
                  <p className="mt-2 text-xs text-ink-faint flex items-center gap-1.5">
                    LINE：
                    {user.lineDisplayName ? (
                      <span className="text-[#06C755] font-medium flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#06C755]" />
                        {user.lineDisplayName}
                      </span>
                    ) : (
                      <span className="text-ink-faint">尚未綁定</span>
                    )}
                  </p>
                </div>
                <Link
                  to="/settings/line"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs text-ink-soft hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/5"
                >
                  <Settings className="h-3.5 w-3.5" />
                  LINE 綁定與推播設定
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                    navigate('/login');
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-down hover:bg-black/[0.04] dark:hover:bg-white/5 border-t border-black/5 dark:border-white/5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  登出帳號
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn text-xs py-1.5 px-3">
              登入
            </Link>
            <Link to="/register" className="btn btn-primary text-xs py-1.5 px-3">
              註冊
            </Link>
          </div>
        )}
      </header>

      {/* Global Quick Trade Modal */}
      <QuickTradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
      />
    </>
  );
}
