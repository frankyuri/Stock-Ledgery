import { useState, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  ExternalLink,
  Send,
  RefreshCw,
  Plus,
  Trash2,
  Play,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useStockStore } from '@/store/useStockStore';
import { apiClient } from '@/services/api';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';

const LINE_FRIEND_URL =
  import.meta.env.VITE_LINE_FRIEND_URL ?? 'https://line.me/R/ti/p/@stockledgery';

interface PriceAlertItem {
  id: string;
  symbol: string;
  direction: 'ABOVE' | 'BELOW' | 'PCT_UP' | 'PCT_DOWN';
  threshold: number;
  isActive: boolean;
  lastFiredAt: string | null;
  createdAt: string;
}

export function LineSettings() {
  const user = useAuthStore((s) => s.user);
  const bindLine = useAuthStore((s) => s.bindLine);
  const unbindLine = useAuthStore((s) => s.unbindLine);
  const linePrefs = useStockStore((s) => s.linePrefs);
  const setLinePrefs = useStockStore((s) => s.setLinePrefs);
  const toast = useToast();

  const [testing, setTesting] = useState(false);
  const [triggeringDaily, setTriggeringDaily] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Webhook
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);

  // Price Alerts
  const [alerts, setAlerts] = useState<PriceAlertItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newDirection, setNewDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [newThreshold, setNewThreshold] = useState('');
  const [creatingAlert, setCreatingAlert] = useState(false);

  const bound = !!user?.lineUserId;
  const hasAnyChannel = bound || Boolean(webhookUrl.trim());

  useEffect(() => {
    if (user) {
      loadPrefs();
      loadAlerts();
    }
  }, [user]);

  async function loadPrefs() {
    try {
      const res = await apiClient.get('/line/prefs');
      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        if (d.webhookUrl) setWebhookUrl(d.webhookUrl);
        setLinePrefs({
          priceAlert: Boolean(d.priceAlert),
          dailySummary: Boolean(d.dailySummary),
          tradeConfirm: Boolean(d.tradeConfirm),
        });
      }
    } catch {}
  }

  async function loadAlerts() {
    try {
      const res = await apiClient.get('/line/alerts');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAlerts(res.data.data);
      }
    } catch {}
  }

  async function handleStartBind() {
    if (!user) {
      toast.error('請先登入帳號');
      return;
    }

    setConnecting(true);
    try {
      const res = await apiClient.get('/line/oauth/start');
      const data = res.data?.data;

      if (data?.mock) {
        bindLine(
          'U_MOCK_' + Math.random().toString(36).slice(2, 8).toUpperCase(),
          '測試用戶 (LINE)',
        );
        toast.success('已啟用模擬綁定模式');
      } else if (data?.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      }
    } catch (err: any) {
      toast.error(
        `無法發起 LINE 綁定：${err?.response?.data?.error?.message || err.message}`,
      );
    } finally {
      setConnecting(false);
    }
  }

  async function handleUnbind() {
    const ok = window.confirm(
      '確定解除 LINE 帳號綁定？解除後將不再接收收盤推播報告。',
    );
    if (!ok) return;

    try {
      await apiClient.delete('/line/binding');
      unbindLine();
      toast.success('已成功解除 LINE 帳號綁定');
    } catch (err: any) {
      unbindLine();
      toast.info('已清除本機綁定狀態');
    }
  }

  async function handleSaveWebhook() {
    setSavingWebhook(true);
    try {
      await apiClient.put('/line/prefs', {
        ...linePrefs,
        webhookUrl: webhookUrl.trim(),
      });
      toast.success('已儲存 Webhook 推播管道設定！');
    } catch (err: any) {
      toast.error(
        `儲存失敗：${err?.response?.data?.error?.message || err.message}`,
      );
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleSendTestPush() {
    if (!hasAnyChannel) {
      toast.error('請先綁定 LINE 或填寫 Webhook URL');
      return;
    }
    setTesting(true);
    try {
      const res = await apiClient.post('/line/test');
      if (res.data?.success) {
        toast.success('🔔 測試推播訊息已成功發送！');
      } else {
        toast.error(`發送失敗：${res.data?.data?.message || '未知錯誤'}`);
      }
    } catch (err: any) {
      toast.error(
        `推播失敗：${err?.response?.data?.error?.message || err.message}`,
      );
    } finally {
      setTesting(false);
    }
  }

  async function handleTriggerDailySummary() {
    if (!hasAnyChannel) {
      toast.error('請先綁定 LINE 或填寫 Webhook URL');
      return;
    }
    setTriggeringDaily(true);
    try {
      const res = await apiClient.post('/line/trigger-daily');
      if (res.data?.success) {
        toast.success('📊 完整收盤資產報告已觸發並發送至推播管道！');
      }
    } catch (err: any) {
      toast.error(
        `觸發失敗：${err?.response?.data?.error?.message || err.message}`,
      );
    } finally {
      setTriggeringDaily(false);
    }
  }

  async function handlePrefChange(patch: Partial<typeof linePrefs>) {
    setLinePrefs(patch);
    try {
      await apiClient.put('/line/prefs', {
        ...linePrefs,
        ...patch,
        webhookUrl: webhookUrl.trim(),
      });
    } catch {}
  }

  async function handleCreateAlert(e: React.FormEvent) {
    e.preventDefault();
    const sym = newSymbol.trim().toUpperCase();
    const val = Number(newThreshold);
    if (!sym) {
      toast.error('請輸入股票代號');
      return;
    }
    if (!val || val <= 0) {
      toast.error('請輸入有效的目標價格');
      return;
    }

    setCreatingAlert(true);
    try {
      const res = await apiClient.post('/line/alerts', {
        symbol: sym,
        direction: newDirection,
        threshold: val,
      });
      if (res.data?.success) {
        toast.success(`已建立 ${sym} 股價警示！`);
        setNewSymbol('');
        setNewThreshold('');
        loadAlerts();
      }
    } catch (err: any) {
      toast.error(
        `建立失敗：${err?.response?.data?.error?.message || err.message}`,
      );
    } finally {
      setCreatingAlert(false);
    }
  }

  async function handleDeleteAlert(id: string, sym: string) {
    try {
      await apiClient.delete(`/line/alerts/${id}`);
      toast.info(`已移除 ${sym} 價格警示`);
      setAlerts((arr) => arr.filter((a) => a.id !== id));
    } catch (err: any) {
      toast.error('移除失敗');
    }
  }

  return (
    <div className="space-y-6">
      {/* 標題與狀態 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-emerald-500" />
            自動化通知與推播中心
          </h1>
          <p className="mt-1 text-sm text-ink-mute dark:text-zinc-400">
            支援 LINE 官方帳號、Discord Webhook、Telegram Bot 多管道收盤資產日報與盤中股價警示。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={triggeringDaily || !hasAnyChannel}
            onClick={handleTriggerDailySummary}
            className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
            title="立即試算當前部位並推播收盤日報"
          >
            <Play className={cn('h-3.5 w-3.5 text-brand', triggeringDaily && 'animate-spin')} />
            <span>{triggeringDaily ? '發送中...' : '立即觸發收盤日報'}</span>
          </button>
          <span
            className="chip border-emerald-400/40 bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 font-semibold"
            title="BullMQ 排程服務器運行中 (每日 16:30 收盤日報 + 每分鐘價格巡檢)"
          >
            ● 背景排程服務運行中
          </span>
        </div>
      </div>

      {!user && (
        <div className="card card-body flex items-center justify-between gap-3 border-amber-300/60 bg-amber-50/60">
          <p className="text-sm text-ink-soft">
            登入帳號後方可儲存雲端推播設定與啟用自動巡檢。
          </p>
          <a href="/login" className="btn btn-primary text-xs py-1.5 px-3">
            前往登入
          </a>
        </div>
      )}

      {/* 管道 1: LINE 官方帳號綁定 */}
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">管道 1：LINE 官方帳號綁定</h2>
            <p className="section-hint">透過 LINE Login 授權個人帳號接收 Flex Message 互動卡片</p>
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
              <Info label="LINE 顯示名稱" value={user?.lineDisplayName ?? '已綁定用戶'} />
              <Info label="LINE User ID" value={user?.lineUserId ?? '—'} mono />
              <Info
                label="綁定狀態"
                value="正常連線推播"
              />
            </div>
          ) : (
            <p className="text-sm text-ink-mute dark:text-zinc-400 leading-relaxed">
              點選下方按鈕前往 LINE 授權頁面，即可將您的 LINE 帳號與 Stocktify 綁定。
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/5 dark:border-white/5">
            {bound ? (
              <>
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleSendTestPush}
                  className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs"
                >
                  <Send className={cn('h-3.5 w-3.5', testing && 'animate-spin')} />
                  <span>{testing ? '推播發送中...' : '發送測試推播'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleUnbind}
                  className="btn btn-danger text-xs py-1.5 px-3"
                >
                  解除 LINE 綁定
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={connecting || !user}
                  onClick={handleStartBind}
                  className="btn btn-primary text-xs font-semibold py-2 px-4 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  style={{ backgroundColor: '#06C755', borderColor: '#06C755' }}
                >
                  {connecting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                  <span>前往授權綁定 LINE 帳號</span>
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

      {/* 管道 2: Discord / Telegram / Slack 自訂 Webhook */}
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">管道 2：自訂 Webhook 推播（Discord / Telegram / Slack）</h2>
            <p className="section-hint">
              100% 免費無每月則數上限，支援 Discord 伺服器頻道 Webhook 或 Telegram Bot
            </p>
          </div>
          <span className="chip border-purple-400/40 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300">
            高頻推播推薦
          </span>
        </div>

        <div className="card-body space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Webhook URL (支援 Discord Webhooks 或相容端點)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/... 或 https://api.telegram.org/..."
                className="input flex-1 text-xs font-mono"
              />
              <button
                type="button"
                disabled={savingWebhook || !user}
                onClick={handleSaveWebhook}
                className="btn btn-primary text-xs py-1.5 px-4 shrink-0 disabled:opacity-50"
              >
                {savingWebhook ? '儲存中...' : '儲存設定'}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
              💡 提示：在 Discord 頻道「編輯頻道 &gt; 整合 &gt; Webhook」建立連結貼上，即可在群組中第一時間掌握每日收盤資產報告！
            </p>
          </div>

          {webhookUrl && (
            <div className="flex items-center gap-2 pt-2 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                disabled={testing}
                onClick={handleSendTestPush}
                className="btn text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>發送 Webhook 測試訊息</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 盤中價格警示條件管理 */}
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">個股盤中價格警示 (Price Alerts)</h2>
            <p className="section-hint">背景 Worker 每 60 秒自動巡檢，觸發時即刻推播提醒</p>
          </div>
          <span className="chip">{alerts.length} 組警示</span>
        </div>

        <div className="card-body space-y-4">
          {/* 新增警示表單 */}
          <form
            onSubmit={handleCreateAlert}
            className="flex flex-wrap items-end gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
          >
            <div className="w-32">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                股票代號
              </label>
              <input
                type="text"
                placeholder="AAPL, 2330.TW"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="input text-xs uppercase"
              />
            </div>

            <div className="w-36">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                觸發條件
              </label>
              <select
                value={newDirection}
                onChange={(e) => setNewDirection(e.target.value as any)}
                className="input text-xs"
              >
                <option value="ABOVE">≥ 突破目標價</option>
                <option value="BELOW">≤ 跌破支撐價</option>
              </select>
            </div>

            <div className="w-32">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                目標價格 ($)
              </label>
              <input
                type="number"
                step="any"
                placeholder="例如 180"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                className="input text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={creatingAlert || !user}
              className="btn btn-primary text-xs py-2 px-3.5 flex items-center gap-1 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{creatingAlert ? '設定中...' : '建立警示'}</span>
            </button>
          </form>

          {/* 現有警示清單 */}
          {alerts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-400 dark:border-zinc-800">
                    <th className="py-2.5">標的代號</th>
                    <th className="py-2.5">觸發條件</th>
                    <th className="py-2.5 text-right">目標價位</th>
                    <th className="py-2.5 text-center">狀態</th>
                    <th className="py-2.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {alerts.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2.5 font-bold text-brand">{a.symbol}</td>
                      <td className="py-2.5 font-medium text-slate-700 dark:text-zinc-300">
                        {a.direction === 'ABOVE' ? '突破目標價 (≥)' : '跌破支撐價 (≤)'}
                      </td>
                      <td className="py-2.5 text-right font-bold text-slate-900 dark:text-zinc-100">
                        ${a.threshold}
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={cn(
                            'inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold',
                            a.isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
                          )}
                        >
                          {a.isActive ? '巡檢中' : '已觸發 (暫停)'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteAlert(a.id, a.symbol)}
                          className="rounded-lg p-1 text-slate-400 hover:text-rose-500"
                          title="刪除警示"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400 dark:text-zinc-500 py-3">
              目前尚未設定任何價格警示
            </p>
          )}
        </div>
      </section>

      {/* 推播項目偏好開關 */}
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">訊息推播偏好設定</h2>
            <p className="section-hint">勾選想接收的即時推播通知項目</p>
          </div>
          <span className="chip">雲端同步</span>
        </div>
        <div className="card-body divide-y divide-black/5 dark:divide-white/10">
          <Toggle
            label="價格波動警示"
            hint="自選股單日漲跌幅或設定之目標價格被觸發時即刻推播"
            checked={linePrefs.priceAlert}
            onChange={(v) => handlePrefChange({ priceAlert: v })}
            disabled={!hasAnyChannel}
          />
          <Toggle
            label="每日收盤資產摘要 (Daily Summary)"
            hint="每日收盤後自動彙整個人持股部位總市值、當日變動與累計損益"
            checked={linePrefs.dailySummary}
            onChange={(v) => handlePrefChange({ dailySummary: v })}
            disabled={!hasAnyChannel}
          />
          <Toggle
            label="交易成功確認"
            hint="新增買進或賣出記帳時發送即時推播通知"
            checked={linePrefs.tradeConfirm}
            onChange={(v) => handlePrefChange({ tradeConfirm: v })}
            disabled={!hasAnyChannel}
          />
        </div>
      </section>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/60 p-4 dark:border-white/10 dark:bg-zinc-800/40">
      <p className="label-caps">{label}</p>
      <p
        className={cn(
          'mt-2 text-[15px] font-semibold text-ink dark:text-zinc-100',
          mono && 'font-mono',
        )}
      >
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
        <p className="text-[15px] font-semibold text-ink dark:text-zinc-100">
          {label}
        </p>
        {hint && (
          <p className="mt-0.5 text-xs text-ink-mute dark:text-zinc-400">
            {hint}
          </p>
        )}
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
