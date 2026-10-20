import { X, Share, PlusSquare, Smartphone, ExternalLink, Sparkles, CheckCircle2 } from 'lucide-react';
import { LogoMark } from '@/components/ui/LogoMark';

interface InstallPromptModalProps {
  open: boolean;
  onClose: () => void;
  isIOS: boolean;
  isSafari: boolean;
  isInAppBrowser: boolean;
  canPromptDirectly: boolean;
  onDirectPrompt?: () => void;
}

export function InstallPromptModal({
  open,
  onClose,
  isIOS,
  isInAppBrowser,
  canPromptDirectly,
  onDirectPrompt,
}: InstallPromptModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-10 shrink-0 rounded-xl shadow-xs" />
            <div>
              <h3 id="install-modal-title" className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>安裝 Stocktify 到桌面</span>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                免下載 App Store，秒開全螢幕原生體驗
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:text-zinc-500"
            aria-label="關閉說明"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content based on platform */}
        <div className="mt-4 space-y-3.5">
          {isInAppBrowser ? (
            /* In-app browser (LINE, FB, IG) guide */
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300 text-xs mb-2">
                <ExternalLink className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>請使用手機原生瀏覽器開啟</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed mb-3">
                您目前正處於社群 App 內建瀏覽器，系統限制無法直接建立桌面圖示。
              </p>
              <div className="space-y-2 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 font-bold text-[11px] text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                    1
                  </span>
                  <span>點選右上角或右下角的「三個點 <strong>⋯</strong>」選單</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 font-bold text-[11px] text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                    2
                  </span>
                  <span>選擇「<strong>在預設瀏覽器（Safari / Chrome）中開啟</strong>」</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 font-bold text-[11px] text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                    3
                  </span>
                  <span>開啟後即可直接將 Stocktify 新增至手機桌面！</span>
                </div>
              </div>
            </div>
          ) : isIOS ? (
            /* iOS Safari Step-by-Step Guide */
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <p className="text-xs font-semibold text-blue-950 dark:text-blue-200 mb-2.5">
                  iPhone / iPad Safari 3 步驟安裝：
                </p>
                <div className="space-y-2.5 text-xs text-slate-700 dark:text-zinc-300">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-[11px] text-white">
                      1
                    </span>
                    <span className="flex-1">
                      點擊 Safari 底部的「<strong>分享</strong>」按鈕
                    </span>
                    <span className="inline-flex items-center justify-center rounded-md bg-white px-2 py-1 shadow-xs border border-slate-200 text-blue-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-blue-400">
                      <Share className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-[11px] text-white">
                      2
                    </span>
                    <span className="flex-1">
                      向下稍微滑動，點選「<strong>加入主畫面</strong>」
                    </span>
                    <span className="inline-flex items-center justify-center rounded-md bg-white px-2 py-1 shadow-xs border border-slate-200 text-slate-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                      <PlusSquare className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-[11px] text-white">
                      3
                    </span>
                    <span className="flex-1">
                      點擊右上角「<strong>新增</strong>」即刻完成！
                    </span>
                    <span className="inline-flex items-center justify-center rounded-md bg-emerald-50 px-2 py-1 text-emerald-600 font-bold text-[10px] dark:bg-emerald-950/40 dark:text-emerald-400">
                      完成
                    </span>
                  </div>
                </div>
              </div>

              {/* Benefits highlight */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2 dark:bg-zinc-800/60">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>全螢幕無瀏覽器網址列</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2 dark:bg-zinc-800/60">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>點擊桌面圖示極速秒開</span>
                </div>
              </div>
            </div>
          ) : (
            /* Android / Chrome Guide */
            <div className="space-y-3">
              {canPromptDirectly ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-center dark:border-zinc-800 dark:bg-zinc-800/40">
                  <p className="text-xs text-slate-600 dark:text-zinc-300 mb-3">
                    系統已準備就緒，點擊下方按鈕即可一鍵在手機桌面建立 Stocktify 快捷應用！
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (onDirectPrompt) onDirectPrompt();
                      onClose();
                    }}
                    className="btn btn-primary w-full py-2.5 justify-center text-sm font-semibold shadow-md"
                  >
                    <Smartphone className="h-4 w-4" />
                    <span>立即在桌面上生成快捷</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300 space-y-2">
                  <p className="font-semibold text-slate-900 dark:text-zinc-100">
                    Android / Chrome 安裝方式：
                  </p>
                  <p>1. 點擊瀏覽器右上角的「三個點 <strong>⋮</strong>」選單。</p>
                  <p>2. 點選「<strong>安裝應用程式</strong>」或「<strong>加到主畫面</strong>」。</p>
                  <p>3. 確認後，桌面將自動生成 Stocktify 原生快捷圖示。</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto btn text-xs py-2 px-4 justify-center"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}
