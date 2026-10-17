import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  PieChart,
  Briefcase,
  ArrowLeftRight,
  Layers,
  Bell,
  Database,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { LogoMark } from '@/components/ui/LogoMark';
import { useStockStore } from '@/store/useStockStore';
import { version as APP_VERSION } from '../../../package.json';

interface Props {
  /** 行動版抽屜開關。桌機可忽略 */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: Props) {
  const selectedSymbol = useStockStore((s) => s.selectedSymbol);
  const holdings = useStockStore((s) => s.holdings);
  const transactions = useStockStore((s) => s.transactions);
  const watchlist = useStockStore((s) => s.watchlist);

  const NAV = [
    {
      section: '市場行情',
      items: [
        {
          to: '/',
          label: '大盤總覽',
          icon: LayoutDashboard,
          badge: `${watchlist.length} 自選`,
        },
        {
          to: `/stock/${selectedSymbol || 'AAPL'}`,
          label: '個股研究',
          icon: TrendingUp,
          badge: selectedSymbol,
        },
      ],
    },
    {
      section: '個人資產',
      items: [
        {
          to: '/overview',
          label: '資產總覽',
          icon: PieChart,
        },
        {
          to: '/portfolio',
          label: '持股明細',
          icon: Briefcase,
          badge: holdings.length > 0 ? `${holdings.length}` : undefined,
        },
        {
          to: '/transactions',
          label: '交易紀錄',
          icon: ArrowLeftRight,
          badge: transactions.length > 0 ? `${transactions.length}` : undefined,
        },
        {
          to: '/assets',
          label: '淨值快照',
          icon: Layers,
        },
      ],
    },
    {
      section: '系統與設定',
      items: [
        {
          to: '/settings/line',
          label: 'LINE 綁定',
          icon: Bell,
        },
        {
          to: '/settings/data',
          label: '資料備份',
          icon: Database,
        },
      ],
    },
  ];

  return (
    <>
      {/* mobile backdrop */}
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-black/5 bg-white/95 backdrop-blur-2xl backdrop-saturate-150 transition-transform dark:border-white/10 dark:bg-zinc-900/95',
          'md:static md:translate-x-0 md:bg-white/60 dark:md:bg-zinc-900/60',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-3 border-b border-black/5 px-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9 shrink-0 shadow-xs rounded-xl" />
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-1.5">
                Stock-Ledgery
                <span className="flex h-2 w-2 rounded-full bg-brand animate-pulse" />
              </p>
              <p className="text-xs text-ink-mute dark:text-zinc-400">專業股票追蹤管理</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-mute hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 md:hidden"
              aria-label="關閉選單"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-3.5">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint dark:text-zinc-500">
                {group.section}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          isActive
                            ? 'bg-brand-soft text-brand font-semibold shadow-[inset_0_0_0_1px_rgba(10,132,255,0.2)] dark:bg-brand/15 dark:text-brand'
                            : 'text-ink-soft hover:bg-black/[0.04] hover:text-ink dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100',
                        )
                      }
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-semibold text-ink-mute dark:bg-white/10 dark:text-zinc-400">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Footer Info */}
        <div className="border-t border-black/5 p-4 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-mute dark:text-zinc-400">
            <span>v{APP_VERSION}</span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Yahoo Finance
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
