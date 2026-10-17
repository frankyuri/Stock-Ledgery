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
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-6 flex items-center justify-center gap-2.5 text-slate-900 dark:text-zinc-100 hover:opacity-90"
        >
          <LogoMark className="h-7 w-7 shrink-0" />
          <span className="text-base font-bold tracking-tight">
            Stocktify
          </span>
        </Link>
        <div className="card p-6 sm:p-7">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">{title}</h1>
          {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-zinc-500">
          © {new Date().getFullYear()} Stocktify · 個人投資資產管理
        </p>
      </div>
    </div>
  );
}
