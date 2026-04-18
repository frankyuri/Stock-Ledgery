import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/ui/LogoMark';

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
          <LogoMark className="h-9 w-9 shrink-0" />
          <span className="text-base font-semibold tracking-tight text-ink">
            Stock-Ledgery
          </span>
        </Link>
        <div className="card p-8">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-ink-mute">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} Stock-Ledgery · 僅供個人使用
        </p>
      </div>
    </div>
  );
}
