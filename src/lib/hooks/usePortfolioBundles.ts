import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchChartBundle } from '@/services/stocks';
import type { ChartBundle } from '@/services/yahoo';
import { symbolsKey } from '@/lib/queryKeys';

export interface UsePortfolioBundlesOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

/**
 * 跨頁面共用的投資組合行情與圖表數據 (ChartBundle) Hook
 * 統一快取命名空間 ['portfolio-bundles', symbolsKey]
 * 避免不同頁面重複發送相同標的的 Yahoo Finance 查詢
 */
export function usePortfolioBundles(
  symbols: string[],
  options: UsePortfolioBundlesOptions = {}
) {
  const {
    enabled = true,
    staleTime = 60_000,
    refetchInterval = false,
  } = options;

  // 過濾空值與去重，排序生成穩定的鍵值
  const sortedSymbols = useMemo(() => {
    const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
    return unique.sort();
  }, [symbols]);

  const stableKey = useMemo(() => symbolsKey(sortedSymbols), [sortedSymbols]);

  const query = useQuery({
    queryKey: ['portfolio-bundles', stableKey],
    queryFn: async (): Promise<Record<string, ChartBundle>> => {
      if (sortedSymbols.length === 0) return {};

      const results = await Promise.allSettled(
        sortedSymbols.map((sym) => fetchChartBundle(sym, '1D'))
      );

      const map: Record<string, ChartBundle> = {};
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          map[sortedSymbols[i]] = res.value;
        }
      });
      return map;
    },
    enabled: enabled && sortedSymbols.length > 0,
    staleTime,
    refetchInterval,
  });

  return {
    ...query,
    bundles: query.data ?? {},
    sortedSymbols,
  };
}
