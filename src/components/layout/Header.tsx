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
  ZoomIn,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { useTickerSearch } from '@/lib/hooks/useTickerSearch';
import { useAuthStore } from '@/store/useAuthStore';
import { useStockStore } from '@/store/useStockStore';
import { useTheme } from '@/lib/theme';
import { useDisplayScale } from '@/lib/displayScale';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { getTaiwanMarketStatus, getUSMarketStatus } from '@/lib/marketStatus';
import { QuickTradeModal } from '@/components/modals/QuickTradeModal';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scaleMenuOpen, setScaleMenuOpen] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const scaleMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, toggle } = useTheme();
  const { scale, setScale, scaleOptions } = useDisplayScale();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const watchlist = useStockStore((s) => s.watchlist);
  const addToWatchlist = useStockStore((s) => s.addToWatchlist);
  const isDemo = useStockStore((s) => s.isDemo);
  const loadDemoData = useStockStore((s) => s.loadDemoData);
  const transactions = useStockStore((s) => s.transactions);

  const { data: results = [] } = useTickerSearch(query);

  const twMarket = getTaiwanMarketStatus();
  const usMarket = getUSMarketStatus();

  // Close menus when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
      if (!scaleMenuRef.current?.contains(e.target as Node)) setScaleMenuOpen(false);
    }
    document.addEventListener('pointerdown', onClick);
    return () => document.removeEventListener('pointerdown', onClick);
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
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 sm:gap-3 border-b border-slate-200/80 bg-white/95 px-3 sm:px-4 md:px-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="-ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 md:hidden"
              aria-label="開啟選單"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          {/* Global Search Bar */}
          <div ref={wrapRef} className="relative max-w-md flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
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
              placeholder="搜尋代號（如 AAPL、2330）"
              className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 py-1.5 pl-7 sm:pl-9 pr-7 sm:pr-14 text-xs text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-900"
            />

            {/* Shortcut badge / Clear button */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-medium text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  <Command className="h-2.5 w-2.5" />K
                </kbd>
              )}
            </div>

            {/* Search Dropdown */}
            {open && query && results.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                {results.map((r) => {
                  const inList = watchlist.includes(r.symbol);
                  return (
                    <li
                      key={r.symbol}
                      className="flex items-center justify-between gap-2 border-b border-slate-100 px-2 last:border-0 dark:border-zinc-800/60"
                    >
                      <button
                        type="button"
                        onClick={() => goto(r.symbol)}
                        className="flex flex-1 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                      >
                        <span className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-zinc-100">
                            {r.symbol}
                          </span>
                          <span className="ml-2 text-slate-500 dark:text-zinc-400 truncate">{r.name}</span>
                        </span>
                        <span className="chip shrink-0 text-[10px]">{r.exchange}</span>
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
                          'mr-1.5 flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium transition',
                          inList
                            ? 'cursor-not-allowed text-slate-400 dark:text-zinc-600'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400',
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
        </div>

        {/* Right Action Area */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 shrink-0">
          {/* Market Status Badges (顯示於較寬螢幕) */}
          <div className="hidden xl:flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-slate-50/60 px-2 py-1 text-[11px] font-medium text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300"
              title={`台股 (TWSE): ${twMarket.statusText}`}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  twMarket.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-zinc-500',
                )}
              />
              <span>台股</span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">{twMarket.statusText}</span>
            </div>

            <div
              className="flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-slate-50/60 px-2 py-1 text-[11px] font-medium text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300"
              title={`美股 (NYSE/NASDAQ): ${usMarket.statusText}`}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  usMarket.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-zinc-500',
                )}
              />
              <span>美股</span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">{usMarket.statusText}</span>
            </div>
          </div>

          {/* Quick Trade Button */}
          <button
            type="button"
            onClick={() => setTradeModalOpen(true)}
            className="btn btn-primary text-xs font-semibold py-1.5 px-2 sm:px-3 touch-action-manipulation shrink-0"
            title="快速記帳 (快捷鍵 T)"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">記帳</span>
          </button>

          {/* Currency Toggle (TWD / USD) */}
          <div className="hidden md:inline-flex">
            <CurrencyToggle />
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 touch-action-manipulation shrink-0"
            title={theme === 'dark' ? '切換淺色模式' : '切換深色模式'}
            aria-label="切換主題"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>

          {/* Display Scale Dropdown (Desktop/Tablet only) */}
          <div ref={scaleMenuRef} className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setScaleMenuOpen((v) => !v)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              title="介面顯示縮放比例"
              aria-label="介面顯示縮放比例"
            >
              <ZoomIn className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
              <span className="font-mono">{scale}</span>
            </button>

            {scaleMenuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800">
                  介面顯示比例
                </div>
                <div className="py-1">
                  {scaleOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setScale(opt.value);
                        setScaleMenuOpen(false);
                        toast.info(`已切換介面比例為 ${opt.value}（${opt.desc}）`);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between px-3.5 py-2 text-left text-xs transition',
                        scale === opt.value
                          ? 'bg-blue-50 font-bold text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {scale === opt.value ? (
                          <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <div className="w-3.5" />
                        )}
                        <span>{opt.label}</span>
                      </div>
                      <span className="text-[11px] font-normal text-slate-400 dark:text-zinc-500">
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Account / Login */}
          {user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-1 sm:pr-2.5 text-xs shadow-xs transition hover:bg-slate-50 dark:border-zinc-700/80 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline font-semibold text-slate-800 dark:text-zinc-200 max-w-[100px] truncate">
                  {user.name}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-30 mt-1.5 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">{user.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400 truncate">{user.email}</p>
                    <p className="mt-1.5 text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                      LINE:
                      {user.lineDisplayName ? (
                        <span className="text-[#06C755] font-semibold truncate">{user.lineDisplayName}</span>
                      ) : (
                        <span>未綁定</span>
                      )}
                    </p>
                  </div>
                  <Link
                    to="/settings/line"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Settings className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                    LINE 綁定與推播設定
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                      navigate('/login');
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-rose-600 hover:bg-slate-50 dark:text-rose-400 dark:hover:bg-zinc-800 border-t border-slate-100 dark:border-zinc-800"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    登出帳號
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {!isDemo && transactions.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    loadDemoData();
                    toast.success('已成功載入示範帳本數據！包含台美股多元投資組合。');
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/20 transition"
                  title="一鍵體驗台美股投資組合與完整資產功能"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>體驗示範帳本</span>
                </button>
              )}
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"
                title="所有個人資產均安全儲存於您的瀏覽器本機，無需註冊即可享有完整記帳與分析功能"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                本地記帳 (免註冊)
              </span>
              <Link to="/login" className="btn text-xs py-1.5 px-2 sm:px-3">
                登入
              </Link>
              <Link to="/register" className="hidden sm:inline-flex btn btn-primary text-xs py-1.5 px-2.5 sm:px-3">
                註冊
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Global Quick Trade Modal */}
      <QuickTradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
      />
    </>
  );
}
