import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

const NAV = [
  { to: '/', label: '大盤總覽', icon: '◐' },
  { to: '/portfolio', label: '個人持股', icon: '◇' },
  { to: '/stock/AAPL', label: '個股研究', icon: '◎' },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-black/5 bg-white/55 backdrop-blur-2xl backdrop-saturate-150 md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b border-black/5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_4px_14px_rgba(10,132,255,0.45)]">
          <span className="text-sm font-semibold tracking-tight">S</span>
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-ink">Stocktify</p>
          <p className="text-[11px] text-ink-mute">個人股票追蹤</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-soft text-brand shadow-[inset_0_0_0_1px_rgba(10,132,255,0.18)]'
                  : 'text-ink-mute hover:bg-black/[0.04] hover:text-ink',
              )
            }
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-black/5 px-4 py-3 text-[11px] text-ink-mute">
        v0.2.0 · Yahoo Finance
      </div>
    </aside>
  );
}
