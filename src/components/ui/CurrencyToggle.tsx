import { useCurrency, type CurrencyType } from '@/lib/hooks/useCurrency';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { DollarSign } from 'lucide-react';

interface CurrencyToggleProps {
  className?: string;
  variant?: 'pill' | 'button';
}

export function CurrencyToggle({ className, variant = 'pill' }: CurrencyToggleProps) {
  const { baseCurrency, setBaseCurrency, fxRate } = useCurrency();
  const toast = useToast();

  const handleSelect = (c: CurrencyType) => {
    if (c === baseCurrency) return;
    setBaseCurrency(c);
    toast.info(
      `已切換金額顯示為：${c === 'TWD' ? '新台幣 (NT$)' : '美元 ($)'} · 參考匯率 1 USD ≈ ${fxRate} TWD`,
    );
  };

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={() => handleSelect(baseCurrency === 'TWD' ? 'USD' : 'TWD')}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
          className,
        )}
        title={`點擊切換顯示幣別（目前：${baseCurrency}）`}
        aria-label="切換顯示幣別"
      >
        <DollarSign className="h-3.5 w-3.5 text-brand" />
        <span className="font-mono font-bold">
          {baseCurrency === 'TWD' ? 'NT$ 台幣' : '$ 美元'}
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 text-xs dark:border-zinc-700/80 dark:bg-zinc-800/90 shadow-xs',
        className,
      )}
      title={`全域顯示幣別切換（目前：${baseCurrency}，1 USD ≈ ${fxRate} TWD）`}
    >
      <button
        type="button"
        onClick={() => handleSelect('TWD')}
        className={cn(
          'rounded-md px-2 py-1 text-xs font-bold transition-all',
          baseCurrency === 'TWD'
            ? 'bg-white text-brand shadow-xs dark:bg-zinc-700 dark:text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200',
        )}
      >
        NT$ 台幣
      </button>
      <button
        type="button"
        onClick={() => handleSelect('USD')}
        className={cn(
          'rounded-md px-2 py-1 text-xs font-bold transition-all',
          baseCurrency === 'USD'
            ? 'bg-white text-brand shadow-xs dark:bg-zinc-700 dark:text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200',
        )}
      >
        $ 美元
      </button>
    </div>
  );
}
