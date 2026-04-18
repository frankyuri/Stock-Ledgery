import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

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
    section: '整合',
    items: [{ to: '/settings/line', label: 'LINE 綁定', icon: '◉' }],
  },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-black/5 bg-white/55 backdrop-blur-2xl backdrop-saturate-150 md:flex md:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-black/5 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_4px_14px_rgba(10,132,255,0.45)]">
          <span className="text-base font-semibold tracking-tight">S</span>
        </span>
        <div className="leading-tight">
          <p className="text-base font-semibold tracking-tight text-ink">Stocktify</p>
          <p className="text-xs text-ink-mute">個人股票追蹤</p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 p-3">
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
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition',
                      isActive
                        ? 'bg-brand-soft text-brand shadow-[inset_0_0_0_1px_rgba(10,132,255,0.18)]'
                        : 'text-ink-mute hover:bg-black/[0.04] hover:text-ink',
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
      <div className="border-t border-black/5 px-5 py-3 text-xs text-ink-mute">
        v0.3.0 · Yahoo Finance
      </div>
    </aside>
  );
}
