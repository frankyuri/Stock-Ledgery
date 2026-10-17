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
          <LogoMark className="h-9 w-9 shrink-0 shadow-xs" />
          <span className="text-base font-bold tracking-tight text-ink dark:text-zinc-100">
            Stock-Ledgery
          </span>
        </Link>
        <div className="card p-8">
          <h1 className="text-[26px] font-bold tracking-tight text-ink dark:text-zinc-100">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ink-mute dark:text-zinc-400">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} Stock-Ledgery · 僅供個人使用
        </p>
      </div>
    </div>
  );
}
