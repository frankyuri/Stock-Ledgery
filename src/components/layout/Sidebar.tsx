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
  DatabaseZap,
  Coins,
  Activity,
  Flame,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { LogoMark } from '@/components/ui/LogoMark';
import { useStockStore } from '@/store/useStockStore';
import { version as APP_VERSION } from '../../../package.json';

interface Props {
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
          badge: `${watchlist.length}`,
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
          to: '/dividends',
          label: '股息現金流',
          icon: Coins,
        },
        {
          to: '/analytics',
          label: '績效與風險',
          icon: Activity,
        },
        {
          to: '/fire',
          label: 'FIRE 財務自由',
          icon: Flame,
        },
        {
          to: '/rebalance',
          label: '資產再平衡',
          icon: Scale,
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
      section: '系統與雲端',
      items: [
        {
          to: '/settings/line',
          label: '推播與通知中心',
          icon: Bell,
        },
        {
          to: '/settings/data',
          label: '資料備份與同步',
          icon: Database,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white transition-transform dark:border-zinc-800 dark:bg-zinc-900',
          'md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-14 items-center justify-between gap-3 border-b border-slate-200/80 px-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7 shrink-0 rounded-lg" />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                Stocktify
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">投資組合追蹤系統</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:text-zinc-500 dark:hover:bg-zinc-800 md:hidden"
              aria-label="關閉選單"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                {group.section}
              </p>
              <div className="space-y-0.5">
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
                          'group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition',
                          isActive
                            ? 'bg-slate-100 text-slate-950 font-semibold dark:bg-zinc-800 dark:text-white'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200',
                        )
                      }
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-600 dark:text-zinc-500 dark:group-hover:text-zinc-300" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
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
        <div className="border-t border-slate-200/80 p-3.5 dark:border-zinc-800">
          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
            <span>v{APP_VERSION}</span>
            <span className="flex items-center gap-1 font-mono">
              <DatabaseZap className="h-3 w-3 text-emerald-500" />
              Connected
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
