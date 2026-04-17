import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthShell } from '@/components/auth/AuthShell';

export function Register() {
  const registerMock = useAuthStore((s) => s.registerMock);
  const bindLine = useAuthStore((s) => s.bindLine);
  const navigate = useNavigate();
  const [search] = useSearchParams();

  // 預留 LINE 綁定流程：?line_user_id=U1234&line_display_name=xxx
  const lineUserId = search.get('line_user_id');
  const lineDisplayName = search.get('line_display_name');

  const [name, setName] = useState(lineDisplayName ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('請輸入姓名 / 暱稱');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('請輸入合法 Email');
    if (password.length < 6) return setError('密碼至少 6 位');
    if (password !== password2) return setError('兩次密碼不一致');

    setSubmitting(true);
    // TODO(backend): api.post('/auth/register', { email, password, name, lineUserId })
    await new Promise((r) => setTimeout(r, 400));
    registerMock(email, name.trim());
    if (lineUserId && lineDisplayName) {
      bindLine(lineUserId, lineDisplayName);
    }
    setSubmitting(false);
    navigate('/', { replace: true });
  }

  return (
    <AuthShell title="註冊" subtitle="建立你的 Stocktify 帳號，管理你的持股資產">
      {lineUserId && (
        <div className="mb-4 rounded-lg border border-[#06C755]/30 bg-[#06C755]/[0.08] px-3 py-2 text-xs text-ink-soft">
          偵測到 LINE 授權，註冊完成後將自動綁定
          <span className="ml-1 font-mono text-ink">{lineDisplayName ?? lineUserId}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-[0.14em] text-ink-mute">
            名稱
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="你的顯示名稱"
            className="input mt-1.5"
          />
        </div>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.14em] text-ink-mute">
              密碼
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="至少 6 位"
              className="input mt-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.14em] text-ink-mute">
              再次輸入
            </label>
            <input
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="確認密碼"
              className="input mt-1.5"
            />
          </div>
        </div>
        {error && <p className="text-sm text-down">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary w-full py-2.5 disabled:opacity-60"
        >
          {submitting ? '送出中…' : '建立帳號'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-mute">
        已經有帳號？
        <Link to="/login" className="ml-1.5 font-medium text-brand hover:underline">
          直接登入
        </Link>
      </p>
    </AuthShell>
  );
}
