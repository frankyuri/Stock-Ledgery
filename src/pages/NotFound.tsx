import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand dark:bg-brand/20">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-4xl font-bold text-ink dark:text-zinc-100">404</h1>
      <p className="mt-2 text-sm text-ink-mute dark:text-zinc-400">找不到你要尋找的頁面或股票代號</p>
      <Link to="/" className="btn btn-primary mt-6 text-sm py-2 px-4 shadow-sm">
        回到大盤總覽
      </Link>
    </div>
  );
}
