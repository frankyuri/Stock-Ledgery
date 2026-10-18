import { Link } from 'react-router-dom';
import { Sparkles, Trash2, UserPlus } from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/lib/toast';

export function DemoNoticeBanner() {
  const isDemo = useStockStore((s) => s.isDemo);
  const clearAllData = useStockStore((s) => s.clearAllData);
  const user = useAuthStore((s) => s.user);
  const toast = useToast();

  if (!isDemo) return null;

  function handleReset() {
    if (window.confirm('確定要清空示範數據並重置為全新空白帳本？')) {
      clearAllData();
      toast.info('已成功重置！您現在可以開始記錄自己的第一筆資產。');
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 p-4 text-xs shadow-xs dark:border-blue-500/30 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="font-bold text-blue-950 dark:text-blue-100">
            您正在體驗「示範資產帳本 (Demo Portfolio)」
          </p>
          <p className="text-blue-700 dark:text-blue-300">
            包含台股 (2330 / 0050)、美股 (AAPL / NVDA / MSFT)
            多元持倉、淨值歷史與退休模擬。您可以自由試算各項功能！
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!user && (
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white shadow-xs transition hover:bg-blue-700"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>免費註冊雲端保存</span>
          </Link>
        )}
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
          <span>清空示範數據</span>
        </button>
      </div>
    </div>
  );
}
