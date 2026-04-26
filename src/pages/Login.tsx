import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthShell } from '@/components/auth/AuthShell';

export function Login() {
  const loginMock = useAuthStore((s) => s.loginMock);
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
    // TODO(backend): 這裡之後換成 api.post('/auth/login', { email, password })
    await new Promise((r) => setTimeout(r, 400));
    loginMock(email, password);
    setSubmitting(false);
    navigate(redirectTo, { replace: true });
  }

  return (
    <AuthShell
      title="登入"
      subtitle="輸入你的 Email 與密碼，進入個人持股儀表板"
    >
      <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
        Demo 模式：本機 mock，密碼僅檢查長度、不會送到後端驗證
      </div>
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
        <div className="h-px flex-1 bg-black/10" />
        <span>或</span>
        <div className="h-px flex-1 bg-black/10" />
      </div>

      <button
        type="button"
        disabled
        className="btn w-full justify-center py-2.5 opacity-60"
        title="尚未串接 LINE OAuth"
      >
        <span className="inline-block h-4 w-4 rounded bg-[#06C755]" />
        使用 LINE 登入（待串接）
      </button>

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
