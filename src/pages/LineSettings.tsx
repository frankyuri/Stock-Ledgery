import { useState } from 'react';
import {
  Bell,
  MessageSquare,
  Check,
  Copy,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
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
    const mockId = 'U' + Math.random().toString(36).slice(2, 12).toUpperCase();
    bindLine(mockId, user?.name ?? 'LINE User');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2.5">
            <Bell className="h-7 w-7 text-emerald-500" />
            LINE 通知與推播設定
          </h1>
          <p className="mt-1 text-[15px] text-ink-mute dark:text-zinc-400">
            綁定 LINE 官方帳號接收每日收盤資產報告、個股極端價格警示與即時記帳確認。
          </p>
        </div>
        <span
          className="chip border-amber-400/40 bg-amber-50/80 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 font-semibold"
          title="UI 已完成，推播需等後端 LINE Messaging API 串接"
        >
          ● 待後端 API 串接
        </span>
      </div>

      <div className="card border-amber-300/40 bg-amber-50/60 px-5 py-3 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          目前為 Demo 體驗模式：「綁定」走前端模擬授權、「通知偏好」保存在本機。
          待自架後端 LINE Webhook 接通後即可接收實際推播。
        </span>
      </div>

      {!user && (
        <div className="card card-body flex items-center justify-between gap-3 border-amber-300/60 bg-amber-50/60">
          <p className="text-sm text-ink-soft">登入帳號後方可綁定 LINE 個人通知。</p>
          <a href="/login" className="btn btn-primary text-xs py-1.5 px-3">
            前往登入
          </a>
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">LINE 帳號綁定狀態</h2>
            <p className="section-hint">授權將 LINE 帳號與 Stock-Ledgery 個人帳號連結</p>
          </div>
          <span
            className={cn(
              'chip font-semibold',
              bound
                ? 'border-[#06C755]/30 bg-[#06C755]/[0.1] text-[#06C755]'
                : 'border-black/10 bg-white/70 text-ink-mute dark:border-white/10 dark:bg-zinc-800',
            )}
          >
            ● {bound ? '已成功綁定' : '尚未綁定'}
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
            <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-soft dark:text-zinc-300 leading-relaxed">
              <li>
                先將 Stock-Ledgery 官方帳號加入好友：
                <a
                  href={LINE_FRIEND_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1.5 font-semibold text-brand hover:underline inline-flex items-center gap-0.5"
                >
                  前往加為好友
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
              <li>點擊下方「綁定 LINE 帳號」，授權後自動同步 LINE User ID</li>
              <li>完成後即可自訂開啟價格警示與每日收盤行情摘要</li>
            </ol>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {bound ? (
              <button
                type="button"
                onClick={unbindLine}
                className="btn border-rose-300/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold py-2 px-4"
              >
                解除 LINE 綁定
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!user) return;
                    simulateBind();
                  }}
                  className="btn btn-primary text-xs font-semibold py-2 px-4 flex items-center gap-1.5 shadow-sm"
                  style={{ backgroundColor: '#06C755', borderColor: '#06C755' }}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>模擬綁定 LINE 帳號</span>
                </button>
                <a
                  href={LINE_FRIEND_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn text-xs py-2 px-3.5 flex items-center gap-1"
                >
                  <span>加官方帳號為好友</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">訊息推播偏好設定</h2>
            <p className="section-hint">勾選想接收的即時推播通知項目</p>
          </div>
          <span className="chip">本地偏好</span>
        </div>
        <div className="card-body divide-y divide-black/5 dark:divide-white/10">
          <Toggle
            label="價格波動警示"
            hint="自選股單日漲跌幅超過指定幅度時自動推播"
            checked={linePrefs.priceAlert}
            onChange={(v) => setLinePrefs({ priceAlert: v })}
            disabled={!bound}
          />
          <Toggle
            label="每日收盤資產摘要"
            hint="每日收盤後推播個人持股部位總市值與損益變動"
            checked={linePrefs.dailySummary}
            onChange={(v) => setLinePrefs({ dailySummary: v })}
            disabled={!bound}
          />
          <Toggle
            label="交易成功確認"
            hint="新增買進或賣出記帳時發送即時推播通知"
            checked={linePrefs.tradeConfirm}
            onChange={(v) => setLinePrefs({ tradeConfirm: v })}
            disabled={!bound}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">後端串接參數設定 (開發者預留)</h2>
            <p className="section-hint">自架後端串接 LINE Messaging API 所需之 Webhook 與 Redirect URL</p>
          </div>
        </div>
        <div className="card-body space-y-3.5 text-sm">
          <EnvRow label="Webhook URL" value="https://api.stock-ledgery.example.com/line/webhook" onCopy={copy} copied={copied} />
          <EnvRow label="OAuth 重導 URL" value={LINE_OAUTH_URL} onCopy={copy} copied={copied} />
          <EnvRow label="好友加入連結" value={LINE_FRIEND_URL} onCopy={copy} copied={copied} />
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/60 p-4 dark:border-white/10 dark:bg-zinc-800/40">
      <p className="label-caps">{label}</p>
      <p className={cn('mt-2 text-[15px] font-semibold text-ink dark:text-zinc-100', mono && 'font-mono')}>
        {value}
      </p>
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
        'flex items-center justify-between gap-4 py-3.5',
        disabled && 'opacity-50',
      )}
    >
      <div>
        <p className="text-[15px] font-semibold text-ink dark:text-zinc-100">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-mute dark:text-zinc-400">{hint}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full border transition-colors',
          checked
            ? 'border-brand bg-brand'
            : 'border-black/15 bg-black/10 dark:border-white/20 dark:bg-zinc-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform',
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
      <span className="label-caps shrink-0">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 md:justify-end">
        <code className="truncate rounded-lg bg-black/[0.05] px-2.5 py-1.5 font-mono text-xs text-ink-soft dark:bg-white/[0.06] dark:text-zinc-300">
          {value}
        </code>
        <button
          type="button"
          onClick={() => onCopy(value)}
          className="btn text-xs py-1.5 px-3 flex items-center gap-1 shrink-0"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? '已複製' : '複製'}</span>
        </button>
      </div>
    </div>
  );
}
