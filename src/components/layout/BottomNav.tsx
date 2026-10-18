import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  Briefcase,
  Coins,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useStockStore } from '@/store/useStockStore';

interface BottomNavProps {
  onOpenMenu: () => void;
}

export function BottomNav({ onOpenMenu }: BottomNavProps) {
  const holdings = useStockStore((s) => s.holdings);

  const NAV_ITEMS = [
    {
      to: '/',
      label: '大盤',
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/overview',
      label: '總覽',
      icon: PieChart,
      end: false,
    },
    {
      to: '/portfolio',
      label: '持股',
      icon: Briefcase,
      badge: holdings.length > 0 ? `${holdings.length}` : undefined,
      end: false,
    },
    {
      to: '/dividends',
      label: '股息',
      icon: Coins,
      end: false,
    },
  ];

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 pb-safe backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 md:hidden',
      )}
      aria-label="手持裝置行動導覽列"
    >
      <div className="flex h-14 items-center justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-medium transition-all touch-action-manipulation',
                  isActive
                    ? 'text-brand font-bold dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon
                      className={cn(
                        'h-5 w-5 transition-transform',
                        isActive && 'scale-110',
                      )}
                    />
                    {item.badge && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 leading-none tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}

        {/* More / Menu Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-medium text-slate-500 transition-all hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 touch-action-manipulation"
          aria-label="開啟所有功能選單"
        >
          <Menu className="h-5 w-5" />
          <span className="mt-1 leading-none tracking-tight">更多</span>
        </button>
      </div>
    </nav>
  );
}
