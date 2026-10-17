import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthShell } from '@/components/auth/AuthShell';

export function Login() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string })?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return setError('請輸入合法 Email');
    }
    if (password.length < 6) return setError('密碼至少 6 位');

    setSubmitting(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err.message || '登入失敗，請確認帳號密碼');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="登入"
      subtitle="輸入你的 Email 與密碼，進入個人持股儀表板"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-[0.14em] text-ink-mute">
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="input mt-1.5"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-[0.14em] text-ink-mute">
            密碼
          </label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="至少 6 位"
            className="input mt-1.5"
            required
          />
        </div>
        {error && <p className="text-sm text-down">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary w-full py-2.5 disabled:opacity-60"
        >
          {submitting ? '登入中…' : '登入'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-faint">
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        <span>或</span>
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      <a
        href="/api/v1/line/oauth/start"
        className="btn w-full justify-center py-2.5 hover:bg-[#06C755]/10 border border-[#06C755]/30 text-[#06C755] font-semibold"
      >
        <span className="inline-block h-4 w-4 rounded-full bg-[#06C755]" />
        使用 LINE 帳號登入 / 綁定
      </a>

      <p className="mt-6 text-center text-sm text-ink-mute">
        還沒有帳號？
        <Link
          to="/register"
          className="ml-1.5 font-medium text-brand hover:underline"
        >
          免費註冊
        </Link>
      </p>
    </AuthShell>
  );
}
