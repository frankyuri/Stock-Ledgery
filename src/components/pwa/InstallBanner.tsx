import { useState, useEffect } from 'react';
import { Smartphone, X, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '@/lib/hooks/usePWAInstall';
import { InstallPromptModal } from './InstallPromptModal';

export function InstallBanner() {
  const {
    isInstalled,
    isIOS,
    isSafari,
    isInAppBrowser,
    canPromptDirectly,
    modalOpen,
    setModalOpen,
    triggerInstall,
  } = usePWAInstall();

  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Only show if not installed and not dismissed previously in this session/device
    if (!isInstalled) {
      const isDismissed = localStorage.getItem('stocktify_pwa_banner_dismissed');
      if (!isDismissed) {
        setDismissed(false);
      }
    }
  }, [isInstalled]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('stocktify_pwa_banner_dismissed', 'true');
  };

  return (
    <>
      {!dismissed && !isInstalled && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 p-3 sm:px-4 shadow-xs dark:border-blue-900/50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>加到手機桌面</span>
                <span className="hidden sm:inline-block rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  全螢幕體驗
                </span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                在主畫面生成快捷圖示，秒開如原生 App！
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={triggerInstall}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-500 active:scale-95 transition"
            >
              <span>加入桌面</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-zinc-800 dark:text-zinc-500"
              aria-label="關閉提示"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* When installed, show subtle confirmation if needed or nothing */}
      {isInstalled && (
        <div className="sr-only">
          <CheckCircle2 /> 已安裝至主畫面
        </div>
      )}

      <InstallPromptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        isIOS={isIOS}
        isSafari={isSafari}
        isInAppBrowser={isInAppBrowser}
        canPromptDirectly={canPromptDirectly}
        onDirectPrompt={triggerInstall}
      />
    </>
  );
}
