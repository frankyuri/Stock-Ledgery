import { useMemo, useRef, useState } from 'react';
import {
  Database,
  Download,
  Upload,
  History,
  Layers,
  Bookmark,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Sparkles,
  Trash2,
  Coins,
} from 'lucide-react';
import { useStockStore, buildBackupSnapshot, type BackupSnapshot } from '@/store/useStockStore';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/services/api';
import { useToast } from '@/lib/toast';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useCurrency } from '@/lib/hooks/useCurrency';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function isValidSnapshot(x: unknown): x is BackupSnapshot {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.transactions) &&
    Array.isArray(o.assets) &&
    Array.isArray(o.watchlist)
  );
}

export function DataSettings() {
  const user = useAuthStore((s) => s.user);
  const transactions = useStockStore((s) => s.transactions);
  const assets = useStockStore((s) => s.assets);
  const watchlist = useStockStore((s) => s.watchlist);
  const importBackup = useStockStore((s) => s.importBackup);
  const loadDemoData = useStockStore((s) => s.loadDemoData);
  const clearAllData = useStockStore((s) => s.clearAllData);
  const { baseCurrency, setBaseCurrency, fxRate, setFxRate } = useCurrency();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const stats = useMemo(
    () => ({
      transactions: transactions.length,
      assets: assets.length,
      watchlist: watchlist.length,
    }),
    [transactions, assets, watchlist],
  );

  function handleExport() {
    const snapshot = buildBackupSnapshot();
    downloadJson(`stock-ledgery-backup-${todayStamp()}.json`, snapshot);
    toast.success(`已匯出備份（${snapshot.transactions.length} 筆交易）`);
  }

  async function handleImport(file: File) {
    setPreviewError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isValidSnapshot(parsed)) {
        throw new Error('檔案格式不符（缺少 transactions / assets / watchlist 欄位）');
      }
      const ok = window.confirm(
        `將以這份備份覆寫現有資料：\n` +
          `  · 交易：${parsed.transactions.length} 筆\n` +
          `  · 淨值快照：${parsed.assets.length} 筆\n` +
          `  · 自選：${parsed.watchlist.length} 檔\n\n` +
          `現有資料會被取代，建議先匯出一份目前的備份。確定繼續？`,
      );
      if (!ok) return;
      importBackup(parsed);
      toast.success('匯入完成，持股已重新計算');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '無法解析檔案';
      setPreviewError(msg);
      toast.error(`匯入失敗：${msg}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // 雲端備份上傳 (將本機 localStorage 資料同步覆寫至雲端資料庫)
  async function handleCloudUpload() {
    if (!user) {
      toast.error('請先登入帳號方可同步至雲端');
      return;
    }
    const ok = window.confirm(
      `確定將本機 ${transactions.length} 筆交易與 ${assets.length} 筆淨值快照同步上傳至雲端 PostgreSQL 資料庫？`
    );
    if (!ok) return;

    setIsCloudSyncing(true);
    try {
      const snapshot = buildBackupSnapshot();
      const res = await apiClient.post('/backup/import', snapshot);
      if (res.data?.success) {
        toast.success(`☁️ 雲端備份成功！已同步 ${snapshot.transactions.length} 筆交易`);
      }
    } catch (err: any) {
      toast.error(`同步失敗：${err?.response?.data?.error?.message || err.message}`);
    } finally {
      setIsCloudSyncing(false);
    }
  }

  // 雲端備份下載 (從雲端 PostgreSQL 資料庫拉取最新資料並覆寫本機)
  async function handleCloudDownload() {
    if (!user) {
      toast.error('請先登入帳號方可從雲端下載');
      return;
    }
    const ok = window.confirm(
      '確定從雲端資料庫還原最新交易與持股資料？這將以雲端資料覆寫本機當前內容。'
    );
    if (!ok) return;

    setIsCloudSyncing(true);
    try {
      const res = await apiClient.get('/backup/export');
      const cloudData = res.data?.data;
      if (isValidSnapshot(cloudData)) {
        importBackup(cloudData);
        toast.success(`☁️ 已成功從雲端還原 ${cloudData.transactions.length} 筆交易！`);
      }
    } catch (err: any) {
      toast.error(`下載失敗：${err?.response?.data?.error?.message || err.message}`);
    } finally {
      setIsCloudSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2.5">
          <Database className="h-6 w-6 text-brand" />
          資料備份與雲端同步
        </h1>
        <p className="mt-1 text-sm text-ink-mute dark:text-zinc-400">
          支援本機 JSON 檔案離線備份，亦可一鍵同步儲存至雲端 PostgreSQL 資料庫，實現多裝置跨端同步。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="交易歷史紀錄" value={stats.transactions} icon={History} />
        <Stat label="淨值快照存檔" value={stats.assets} icon={Layers} />
        <Stat label="自選追蹤標的" value={stats.watchlist} icon={Bookmark} />
      </div>

      {/* 偏好設定：基礎計價幣別與匯率設定 */}
      <section className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Coins className="h-5 w-5 text-brand" />
              全域顯示幣別與匯率偏好
            </h2>
            <p className="section-hint">
              設定全系統預設顯示之基準貨幣（支援新台幣與美元隨時切換），並可調整美台匯率折算基準。
            </p>
          </div>
          <CurrencyToggle />
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-2">
              當前預設顯示幣別
            </label>
            <div className="flex gap-3">
              {(['TWD', 'USD'] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setBaseCurrency(curr)}
                  className={cn(
                    'flex-1 rounded-lg border py-2 px-3 text-xs font-bold transition text-center',
                    baseCurrency === curr
                      ? 'border-brand bg-brand text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
                  )}
                >
                  {curr === 'TWD' ? '🇹🇼 新台幣 (TWD / NT$)' : '🇺🇸 美元 (USD / $)'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                USD / TWD 換算參考匯率
              </label>
              <span className="text-xs font-mono font-bold text-brand">1 USD = {fxRate} TWD</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="20"
                max="45"
                value={fxRate}
                onChange={(e) => setFxRate(Number(e.target.value) || 32.5)}
                className="input py-1.5 text-xs font-mono font-bold"
              />
              <button
                type="button"
                onClick={() => setFxRate(32.5)}
                className="btn py-1.5 px-3 text-xs whitespace-nowrap"
              >
                還原 32.5
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 雲端資料庫雙向同步卡片 */}
      <section className="card border-brand/20 bg-brand/[0.02]">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Cloud className="h-5 w-5 text-brand" />
              雲端資料庫即時同步
            </h2>
            <p className="section-hint">
              {user
                ? `已登入帳號：${user.email}，可自由雙向備份或還原`
                : '登入帳號後即可一鍵將本機資料遷移或同步至 PostgreSQL 雲端資料庫'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={isCloudSyncing || !user}
              onClick={handleCloudUpload}
              className="btn btn-primary text-xs font-semibold py-2 px-3.5 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isCloudSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
              <span>本機上傳至雲端</span>
            </button>
            <button
              type="button"
              disabled={isCloudSyncing || !user}
              onClick={handleCloudDownload}
              className="btn text-xs font-semibold py-2 px-3.5 flex items-center gap-1.5 disabled:opacity-50"
            >
              <CloudDownload className="h-4 w-4 text-brand" />
              <span>從雲端拉取至本機</span>
            </button>
          </div>
        </div>
      </section>

      {/* 本機 JSON 檔案匯出 */}
      <section className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Download className="h-4 w-4 text-brand" />
              匯出本機 JSON 備份檔
            </h2>
            <p className="section-hint">下載單一完整 JSON 檔案，妥善存於本機硬碟作為離線冷備份</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="btn text-xs font-semibold py-2 px-4 flex items-center gap-1.5 shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>下載備份 JSON</span>
          </button>
        </div>
      </section>

      {/* 從本機 JSON 檔案還原 */}
      <section className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Upload className="h-4 w-4 text-brand" />
              從本機 JSON 檔案還原
            </h2>
            <p className="section-hint">
              選擇先前匯出的 JSON 檔；持股與損益將依據交易歷程自動完整重建
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
            }}
            className="hidden"
            id="backup-import"
          />
          <label htmlFor="backup-import" className="btn cursor-pointer text-xs font-semibold py-2 px-4 flex items-center gap-1.5">
            <FileCheck2 className="h-4 w-4" />
            <span>選擇 JSON 檔案…</span>
          </label>
        </div>
        {previewError && (
          <div className="card-body border-t border-rose-300/40 bg-rose-50/60 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-950/20 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{previewError}</span>
          </div>
        )}
      </section>

      {/* 示範數據與重置 */}
      <section className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand" />
              示範帳本與本機資料重置
            </h2>
            <p className="section-hint">
              提供完整的範例投資組合以體驗各項圖表與分析，亦可隨時清空所有本機暫存資料
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadDemoData();
                toast.success('已成功載入示範帳本數據！包含台美股多元投資組合與歷史快照。');
              }}
              className="btn text-xs font-semibold py-2 px-4 flex items-center gap-1.5 border border-brand/40 text-brand bg-brand/5 hover:bg-brand/10 dark:bg-brand/10"
            >
              <Sparkles className="h-4 w-4" />
              <span>一鍵載入示範數據 (Demo)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('確定要清空所有本機交易、持股與快照資料？此動作無法復原！')) {
                  clearAllData();
                  toast.info('已成功清空所有本機資料。');
                }
              }}
              className="btn text-xs font-semibold py-2 px-4 flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="h-4 w-4" />
              <span>清空所有資料</span>
            </button>
          </div>
        </div>
      </section>

      <section className="card card-body text-xs text-ink-mute dark:text-zinc-400 space-y-2">
        <p className="font-semibold text-ink dark:text-zinc-200 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          資料安全與隱私注意事項
        </p>
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          <li>備份檔內含未加密的完整交易紀錄與持股數據，請妥善保管避免外洩。</li>
          <li>還原動作將會「完整覆寫」目前的本機資料，執行前建議先匯出一份目前的備份。</li>
          <li>雲端同步會將您的交易紀錄安全保存於專屬 PostgreSQL 資料庫，支援無縫多裝置同步。</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="card p-5 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <p className="label-caps truncate">{label}</p>
        <Icon className="h-4 w-4 text-ink-faint shrink-0" />
      </div>
      <p
        className="mt-2 font-mono text-2xl font-bold truncate tracking-tight text-ink dark:text-zinc-100 num"
        title={formatNumber(value, 0)}
      >
        {formatNumber(value, 0)}
      </p>
    </div>
  );
}
