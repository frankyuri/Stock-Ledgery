import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Check,
  Building2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  parseBrokerCSV,
  type ParseResult,
} from '@/lib/brokerParser';
import { useStockStore } from '@/store/useStockStore';
import { useToast } from '@/lib/toast';
import { formatNumber, formatShares } from '@/lib/format';
import { cn } from '@/lib/cn';

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SmartImportModal({ isOpen, onClose }: SmartImportModalProps) {
  const transactions = useStockStore((s) => s.transactions);
  const addTransactionsBatch = useStockStore((s) => s.addTransactionsBatch);
  const toast = useToast();

  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error('目前僅支援 .csv 或 .txt 格式之對帳單');
      return;
    }
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const result = parseBrokerCSV(content, transactions);
        setParseResult(result);
        if (result.totalRows === 0) {
          toast.warning('此檔案未解析出有效交易資料，請確認檔案格式');
        } else {
          toast.success(`成功識別為【${result.brokerName}】，共解析 ${result.totalRows} 筆資料`);
        }
      } catch (err) {
        toast.error('檔案解析失敗，請確認檔案編碼與格式');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleReset() {
    setParseResult(null);
    setFileName(null);
  }

  async function handleConfirmImport() {
    if (!parseResult) return;

    const toImport = parseResult.candidates.filter((c) => {
      if (!c.isValid) return false;
      if (skipDuplicates && c.isDuplicate) return false;
      return true;
    });

    if (toImport.length === 0) {
      toast.warning('沒有可供匯入的有效交易紀錄');
      return;
    }

    setIsImporting(true);
    try {
      const res = await addTransactionsBatch(
        toImport.map((c) => ({
          symbol: c.symbol,
          type: c.type,
          shares: c.shares,
          price: c.price,
          fee: c.fee,
          tradedAt: c.tradedAt,
          note: c.note,
        })),
      );

      toast.success(
        `🎉 成功匯入 ${res.importedCount} 筆交易紀錄！已自動為您重新結算加權成本與持股。`,
      );
      if (res.failedCount > 0) {
        toast.warning(`有 ${res.failedCount} 筆紀錄因格式問題未匯入`);
      }
      onClose();
      handleReset();
    } catch (err) {
      toast.error('匯入過程中發生錯誤，請稍後再試');
    } finally {
      setIsImporting(false);
    }
  }

  const effectiveImportCount = parseResult
    ? parseResult.candidates.filter((c) => c.isValid && (!skipDuplicates || !c.isDuplicate)).length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 text-sky-400 ring-1 ring-sky-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                券商對帳單智慧匯入
                <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 ring-1 ring-inset ring-sky-500/30">
                  AI 格式自適應
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                自動識別台灣與海外主流券商對帳單，自動去重並重新試算加權平均成本
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {!parseResult ? (
            <>
              {/* Drop Area */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all duration-200',
                  dragOver
                    ? 'border-sky-500 bg-sky-500/10 scale-[1.01]'
                    : 'border-slate-700/80 bg-slate-800/40 hover:border-sky-500/50 hover:bg-slate-800/70',
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={onFileInputChange}
                />
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20 transition-transform group-hover:scale-110">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-200">
                  點擊或拖曳對帳單 CSV 至此處
                </h3>
                <p className="mt-1 text-xs text-slate-400">支援 UTF-8、BOM 編碼之 CSV / TXT 報表</p>
              </div>

              {/* Supported Brokers List */}
              <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  <Building2 className="h-4 w-4 text-sky-400" />
                  已內建原生適配之券商
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    '永豐大戶投 (Sinopac)',
                    '富邦證券',
                    '國泰綜合證券',
                    '元大證券',
                    'Interactive Brokers (IBKR)',
                    'Firstrade (第一證券)',
                    'Charles Schwab (嘉信)',
                    'Stocktify 標準 CSV',
                  ].map((broker) => (
                    <span
                      key={broker}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 ring-1 ring-slate-700/60"
                    >
                      <Check className="h-3 w-3 text-emerald-400" />
                      {broker}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Parse Summary Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{fileName}</span>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        {parseResult.brokerName}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>總筆數：{parseResult.totalRows}</span>
                      <span className="text-emerald-400 font-medium">
                        ✓ 待匯入：{effectiveImportCount}
                      </span>
                      {parseResult.duplicateCount > 0 && (
                        <span className="text-amber-400 font-medium">
                          ⚠ 疑似重複：{parseResult.duplicateCount}
                        </span>
                      )}
                      {parseResult.errorCount > 0 && (
                        <span className="text-rose-400 font-medium">
                          ✕ 格式異常：{parseResult.errorCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  更換檔案
                </button>
              </div>

              {/* Deduplication option */}
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-2.5">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/20"
                  />
                  <span>
                    自動略過與現有紀錄重複的項目（依日期、標的、方向、股數與價格比對）
                  </span>
                </label>
                {parseResult.duplicateCount > 0 && skipDuplicates && (
                  <span className="text-xs text-amber-400">已自動排除 {parseResult.duplicateCount} 筆重複</span>
                )}
              </div>

              {/* Preview Table */}
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 border-b border-slate-800 bg-slate-900/90 text-slate-400 backdrop-blur">
                      <tr>
                        <th className="py-2.5 pl-4 pr-2">日期</th>
                        <th className="px-2 py-2.5">標的</th>
                        <th className="px-2 py-2.5">類別</th>
                        <th className="px-2 py-2.5 text-right">股數</th>
                        <th className="px-2 py-2.5 text-right">成交價</th>
                        <th className="px-2 py-2.5 text-right">手續費</th>
                        <th className="px-2 py-2.5">備註 / 說明</th>
                        <th className="py-2.5 pl-2 pr-4 text-center">狀態</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {parseResult.candidates.map((c) => {
                        const isWillSkip = skipDuplicates && c.isDuplicate;
                        return (
                          <tr
                            key={c.tempId}
                            className={cn(
                              'transition-colors',
                              !c.isValid
                                ? 'bg-rose-950/20 text-rose-300'
                                : isWillSkip
                                ? 'bg-slate-900/30 text-slate-500 opacity-60'
                                : 'hover:bg-slate-800/30 text-slate-300',
                            )}
                          >
                            <td className="py-2 pl-4 pr-2 whitespace-nowrap">{c.tradedAt}</td>
                            <td className="px-2 py-2 font-bold text-slate-200">{c.symbol}</td>
                            <td className="px-2 py-2">
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-[10px] font-bold',
                                  c.type === 'BUY'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-400',
                                )}
                              >
                                {c.type === 'BUY' ? '買進' : '賣出'}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right">{formatShares(c.shares)}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(c.price)}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(c.fee)}</td>
                            <td className="max-w-[140px] truncate px-2 py-2 text-slate-400 font-sans">
                              {c.note || '-'}
                            </td>
                            <td className="py-2 pl-2 pr-4 text-center">
                              {!c.isValid ? (
                                <span className="inline-flex items-center gap-1 text-rose-400">
                                  <XCircle className="h-3.5 w-3.5" />
                                  {c.validationError}
                                </span>
                              ) : c.isDuplicate ? (
                                <span className="inline-flex items-center gap-1 text-amber-400">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  {isWillSkip ? '略過重複' : '重複'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  就緒
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-900/80">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
          >
            取消
          </button>

          {parseResult && (
            <button
              onClick={handleConfirmImport}
              disabled={isImporting || effectiveImportCount === 0}
              className={cn(
                'flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-lg transition',
                effectiveImportCount > 0
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-sky-500/25 active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed',
              )}
            >
              {isImporting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  匯入並結算中...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  確認匯入 {effectiveImportCount} 筆交易
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
