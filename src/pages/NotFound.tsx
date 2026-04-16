import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-semibold text-ink">404</h1>
      <p className="mt-2 text-ink-mute">找不到你要的頁面</p>
      <Link to="/" className="btn btn-primary mt-6">
        回到首頁
      </Link>
    </div>
  );
}
