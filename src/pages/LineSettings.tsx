import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useStockStore } from '@/store/useStockStore';
import { cn } from '@/lib/cn';

// 之後把這個置換成後端回來的 OAuth URL
const LINE_OAUTH_URL =
  import.meta.env.VITE_LINE_OAUTH_URL ?? 'https://stock-ledgery.example.com/oauth/line/authorize';
const LINE_FRIEND_URL =
  import.meta.env.VITE_LINE_FRIEND_URL ?? 'https://line.me/R/ti/p/@stockledgery';

export function LineSettings() {
  const user = useAuthStore((s) => s.user);
  const bindLine = useAuthStore((s) => s.bindLine);
  const unbindLine = useAuthStore((s) => s.unbindLine);
  const linePrefs = useStockStore((s) => s.linePrefs);
  const setLinePrefs = useStockStore((s) => s.setLinePrefs);
  const [copied, setCopied] = useState(false);

  const bound = !!user?.lineUserId;

  function copy(value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function simulateBind() {
    // 之後改成 window.location.href = LINE_OAUTH_URL
    // backend 綁定完會 redirect 回來；這裡先用假資料示意
    const mockId = 'U' + Math.random().toString(36).slice(2, 12).toUpperCase();
    bindLine(mockId, user?.name ?? 'LINE User');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">LINE 通知綁定</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">
          綁定 LINE 後可以接收價格警示、每日資產摘要、以及交易確認訊息。
        </p>
      </div>

      {!user && (
        <div className="card card-body flex items-center justify-between gap-3 border-amber-300/60 bg-amber-50/60">
          <p className="text-sm text-ink-soft">登入後才能綁定 LINE 帳號。</p>
          <a href="/login" className="btn btn-primary text-xs">
            前往登入
          </a>
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">綁定狀態</h2>
            <p className="section-hint">授權將 LINE 帳號與 Stock-Ledgery 使用者對應</p>
          </div>
          <span
            className={cn(
              'chip',
              bound
                ? 'border-[#06C755]/30 bg-[#06C755]/[0.1] text-[#06C755]'
                : 'border-black/10 bg-white/70 text-ink-mute',
            )}
          >
            ● {bound ? '已綁定' : '尚未綁定'}
          </span>
        </div>

        <div className="card-body space-y-4">
          {bound ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Info label="LINE 顯示名稱" value={user?.lineDisplayName ?? '—'} />
              <Info label="LINE User ID" value={user?.lineUserId ?? '—'} mono />
              <Info
                label="綁定時間"
                value={
                  user?.lineBoundAt
                    ? new Date(user.lineBoundAt).toLocaleString('zh-Hant')
                    : '—'
                }
              />
            </div>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-soft">
              <li>
                先到 LINE 把 Stock-Ledgery 官方帳號加為好友：
                <a
                  href={LINE_FRIEND_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1.5 text-brand hover:underline"
                >
                  加入好友
                </a>
              </li>
              <li>點下方「綁定 LINE 帳號」，授權後自動回填你的 LINE User ID</li>
              <li>完成後可在「通知偏好」勾選要接收的訊息類型</li>
            </ol>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {bound ? (
              <button
                type="button"
                onClick={unbindLine}
                className="btn border-down/30 text-down hover:bg-down/[0.08]"
              >
                解除綁定
              </button>
            ) : (
              <>
                <a
                  href={LINE_OAUTH_URL}
                  onClick={(e) => {
                    // demo 模式攔截：如果還沒串好後端，先模擬綁定
                    if (!user) return;
                    e.preventDefault();
                    simulateBind();
                  }}
                  className="btn btn-primary"
                  style={{ backgroundColor: '#06C755', borderColor: '#06C755' }}
                >
                  <span className="inline-block h-3 w-3 rounded bg-white/90" />
                  綁定 LINE 帳號
                </a>
                <a
                  href={LINE_FRIEND_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                >
                  先加 LINE 官方帳號
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">通知偏好</h2>
            <p className="section-hint">後端會依照這裡的設定推送不同訊息</p>
          </div>
        </div>
        <div className="card-body divide-y divide-black/5">
          <Toggle
            label="價格警示"
            hint="單日漲跌幅超過門檻時推播"
            checked={linePrefs.priceAlert}
            onChange={(v) => setLinePrefs({ priceAlert: v })}
            disabled={!bound}
          />
          <Toggle
            label="每日資產摘要"
            hint="每日收盤後推播持股變動與總市值"
            checked={linePrefs.dailySummary}
            onChange={(v) => setLinePrefs({ dailySummary: v })}
            disabled={!bound}
          />
          <Toggle
            label="交易確認"
            hint="新增買賣紀錄時推播確認訊息"
            checked={linePrefs.tradeConfirm}
            onChange={(v) => setLinePrefs({ tradeConfirm: v })}
            disabled={!bound}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">後端 Webhook 預留</h2>
            <p className="section-hint">之後後端串 LINE Messaging API 用的設定值</p>
          </div>
        </div>
        <div className="card-body space-y-3 text-sm">
          <EnvRow label="Webhook URL" value="https://api.stock-ledgery.example.com/line/webhook" onCopy={copy} copied={copied} />
          <EnvRow label="OAuth 重導 URL" value={LINE_OAUTH_URL} onCopy={copy} copied={copied} />
          <EnvRow label="好友加入連結" value={LINE_FRIEND_URL} onCopy={copy} copied={copied} />
          <p className="text-xs text-ink-mute">
            這三個 URL 之後要改指向你的後端；目前是 placeholder，按鈕流程會走本地 mock。
          </p>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/60 p-4">
      <p className="label-caps">{label}</p>
      <p className={cn('mt-2 text-[15px] text-ink', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-3',
        disabled && 'opacity-50',
      )}
    >
      <div>
        <p className="text-[15px] font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-ink-mute">{hint}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full border transition',
          checked
            ? 'border-brand bg-brand'
            : 'border-black/15 bg-white',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

function EnvRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  copied: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
      <span className="label-caps">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 md:justify-end">
        <code className="truncate rounded bg-black/[0.05] px-2.5 py-1.5 font-mono text-sm text-ink-soft">
          {value}
        </code>
        <button
          type="button"
          onClick={() => onCopy(value)}
          className="btn text-xs"
        >
          {copied ? '已複製' : '複製'}
        </button>
      </div>
    </div>
  );
}
