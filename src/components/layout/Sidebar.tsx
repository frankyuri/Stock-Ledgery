import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { LogoMark } from '@/components/ui/LogoMark';
import { version as APP_VERSION } from '../../../package.json';

const NAV = [
  {
    section: '市場',
    items: [
      { to: '/', label: '大盤總覽', icon: '◐' },
      { to: '/stock/AAPL', label: '個股研究', icon: '◎' },
    ],
  },
  {
    section: '我的資產',
    items: [
      { to: '/overview', label: '資產總覽', icon: '◐' },
      { to: '/portfolio', label: '持股明細', icon: '◇' },
      { to: '/transactions', label: '交易紀錄', icon: '⇄' },
      { to: '/assets', label: '淨值快照', icon: '◈' },
    ],
  },
  {
    section: '整合與設定',
    items: [
      { to: '/settings/line', label: 'LINE 綁定', icon: '◉' },
      { to: '/settings/data', label: '資料備份', icon: '⇪' },
    ],
  },
];

interface Props {
  /** 行動版抽屜開關。桌機可忽略 */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: Props) {
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
          'md:static md:translate-x-0 md:bg-white/55 dark:md:bg-zinc-900/55',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-3 border-b border-black/5 px-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9 shrink-0" />
            <div className="leading-tight">
              <p className="text-base font-semibold tracking-tight text-ink dark:text-zinc-100">
                Stock-Ledgery
              </p>
              <p className="text-xs text-ink-mute">個人股票追蹤</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-ink-mute hover:bg-black/5 dark:hover:bg-white/10 md:hidden"
              aria-label="關閉選單"
            >
              ✕
            </button>
          )}
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {group.section}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition',
                        isActive
                          ? 'bg-brand-soft text-brand shadow-[inset_0_0_0_1px_rgba(10,132,255,0.18)] dark:bg-brand/15'
                          : 'text-ink-mute hover:bg-black/[0.04] hover:text-ink dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100',
                      )
                    }
                  >
                    <span className="text-lg leading-none">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-black/5 px-5 py-3 text-xs text-ink-mute dark:border-white/10">
          v{APP_VERSION} · Yahoo Finance
        </div>
      </aside>
    </>
  );
}
