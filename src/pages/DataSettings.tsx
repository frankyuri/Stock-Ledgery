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
} from 'lucide-react';
import { useStockStore, buildBackupSnapshot, type BackupSnapshot } from '@/store/useStockStore';
import { useToast } from '@/lib/toast';
import { formatNumber } from '@/lib/format';

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
  const transactions = useStockStore((s) => s.transactions);
  const assets = useStockStore((s) => s.assets);
  const watchlist = useStockStore((s) => s.watchlist);
  const importBackup = useStockStore((s) => s.importBackup);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [previewError, setPreviewError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-ink dark:text-zinc-100 flex items-center gap-2.5">
          <Database className="h-7 w-7 text-brand" />
          資料備份與還原
        </h1>
        <p className="mt-1 text-[15px] text-ink-mute dark:text-zinc-400">
          所有持股、交易紀錄與淨值快照均持久化保存在瀏覽器本機儲存空間中。
          更換設備或清理快取前，請隨時匯出 JSON 備份檔。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="交易歷史紀錄" value={stats.transactions} icon={History} />
        <Stat label="淨值快照存檔" value={stats.assets} icon={Layers} />
        <Stat label="自選追蹤標的" value={stats.watchlist} icon={Bookmark} />
      </div>

      <section className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Download className="h-4 w-4 text-brand" />
              匯出全站備份檔
            </h2>
            <p className="section-hint">下載單一完整 JSON 檔案，妥善存於本機或雲端硬碟</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="btn btn-primary text-xs font-semibold py-2 px-4 flex items-center gap-1.5 shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>下載備份 JSON</span>
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Upload className="h-4 w-4 text-brand" />
              從備份檔案還原
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

      <section className="card card-body text-xs text-ink-mute dark:text-zinc-400 space-y-2">
        <p className="font-semibold text-ink dark:text-zinc-200 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          資料安全與隱私注意事項
        </p>
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          <li>備份檔內含未加密的完整交易紀錄與持股數據，請妥善保管避免外洩。</li>
          <li>還原動作將會「完整覆寫」目前的本機資料，執行前建議先匯出目前的備份。</li>
          <li>支援無縫導入後續自架後端 API 系統作為初始資料集。</li>
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
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="label-caps">{label}</p>
        <Icon className="h-4 w-4 text-ink-faint" />
      </div>
      <p className="mt-2.5 font-mono text-[28px] font-bold text-ink dark:text-zinc-100 num">
        {formatNumber(value, 0)}
      </p>
    </div>
  );
}
