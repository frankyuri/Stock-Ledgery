import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 flex items-center gap-2.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_4px_14px_rgba(10,132,255,0.45)]">
            <span className="text-sm font-semibold tracking-tight">S</span>
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">
            Stocktify
          </span>
        </Link>
        <div className="card p-7">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-mute">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-5 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} Stocktify · 僅供個人使用
        </p>
      </div>
    </div>
  );
}
