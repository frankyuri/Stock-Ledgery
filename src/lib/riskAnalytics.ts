import type { Candle } from '@/types/stock';

export interface AssetCandleMap {
  [symbol: string]: Candle[];
}

export interface ReturnPoint {
  time: string;
  portfolio: number; // % cumulative return
  benchmark: number; // % cumulative return
  drawdown: number; // % drawdown (e.g. -5.2%)
}

export interface RiskMetrics {
  cumulativeReturn: number; // %
  annualizedReturn: number; // % (CAGR)
  annualizedVolatility: number; // %
  maxDrawdown: number; // % (e.g. -12.4%)
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number;
  dataPointsCount: number;
  timeSeries: ReturnPoint[];
}

/**
 * 計算投資組合量化風險與報酬指標
 * @param holdingsWeights Map: symbol -> weight (0 ~ 1, sum = 1)
 * @param candleMap Map: symbol -> Candle[]
 * @param benchmarkCandles Candle[] (例如 S&P 500 或 0050)
 * @param riskFreeRate 年化無風險利率 (預設 2.0%)
 */
export function calculateRiskMetrics(
  holdingsWeights: Map<string, number>,
  candleMap: Map<string, Candle[]>,
  benchmarkCandles: Candle[] = [],
  riskFreeRate = 0.02,
): RiskMetrics {
  if (holdingsWeights.size === 0) {
    return getEmptyMetrics();
  }

  // 1. 找出所有持有標的與基準的時間交集
  const dateMap = new Map<string, { [symbol: string]: number }>();

  for (const [symbol, candles] of candleMap.entries()) {
    for (const c of candles) {
      if (!c.close) continue;
      const cur = dateMap.get(c.time) || {};
      cur[symbol] = c.close;
      dateMap.set(c.time, cur);
    }
  }

  const benchMap = new Map<string, number>();
  for (const b of benchmarkCandles) {
    if (b.close) {
      benchMap.set(b.time, b.close);
    }
  }

  // 按日期由舊到新排序
  const sortedDates = Array.from(dateMap.keys()).sort();
  if (sortedDates.length < 5) {
    return getEmptyMetrics();
  }

  // 2. 計算每日報酬率
  const portfolioReturns: { date: string; ret: number }[] = [];
  const benchmarkReturns: { date: string; ret: number }[] = [];

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = sortedDates[i - 1];
    const currDate = sortedDates[i];

    const prevPrices = dateMap.get(prevDate)!;
    const currPrices = dateMap.get(currDate)!;

    let dailyPortReturn = 0;
    let totalActiveWeight = 0;

    for (const [sym, w] of holdingsWeights.entries()) {
      const p0 = prevPrices[sym];
      const p1 = currPrices[sym];
      if (p0 != null && p1 != null && p0 > 0) {
        const assetRet = (p1 - p0) / p0;
        dailyPortReturn += w * assetRet;
        totalActiveWeight += w;
      }
    }

    // 若當天有標的停牌或缺值，按現有權重標準化
    if (totalActiveWeight > 0) {
      dailyPortReturn = dailyPortReturn / totalActiveWeight;
      portfolioReturns.push({ date: currDate, ret: dailyPortReturn });

      // 計算同日基準報酬
      const bp0 = benchMap.get(prevDate);
      const bp1 = benchMap.get(currDate);
      if (bp0 != null && bp1 != null && bp0 > 0) {
        benchmarkReturns.push({ date: currDate, ret: (bp1 - bp0) / bp0 });
      } else {
        benchmarkReturns.push({ date: currDate, ret: 0 });
      }
    }
  }

  const n = portfolioReturns.length;
  if (n < 3) return getEmptyMetrics();

  // 3. 累積走勢與最大回撤 (MDD)
  let portVal = 1.0;
  let benchVal = 1.0;
  let peak = 1.0;
  let maxDD = 0;

  const timeSeries: ReturnPoint[] = [];

  for (let i = 0; i < n; i++) {
    const { date, ret } = portfolioReturns[i];
    const benchRet = benchmarkReturns[i]?.ret ?? 0;

    portVal *= 1 + ret;
    benchVal *= 1 + benchRet;

    if (portVal > peak) {
      peak = portVal;
    }

    const dd = peak > 0 ? (portVal - peak) / peak : 0;
    if (dd < maxDD) {
      maxDD = dd;
    }

    timeSeries.push({
      time: date,
      portfolio: round((portVal - 1) * 100),
      benchmark: round((benchVal - 1) * 100),
      drawdown: round(dd * 100),
    });
  }

  // 4. 統計年化數據 (以 252 交易日計)
  const cumulativeReturn = (portVal - 1) * 100;
  const years = n / 252;
  const annualizedReturn =
    years > 0 ? (Math.pow(portVal, 1 / years) - 1) * 100 : cumulativeReturn;

  const retValues = portfolioReturns.map((r) => r.ret);
  const meanRet = retValues.reduce((s, v) => s + v, 0) / n;

  // 年化標準差 (波動度)
  const variance =
    retValues.reduce((s, v) => s + Math.pow(v - meanRet, 2), 0) / (n - 1);
  const dailyVol = Math.sqrt(variance);
  const annualizedVolatility = dailyVol * Math.sqrt(252) * 100;

  // 下行標準差 (Downside deviation)
  const downsideSqSum = retValues.reduce(
    (s, v) => s + (v < 0 ? Math.pow(v, 2) : 0),
    0,
  );
  const downsideVol = Math.sqrt(downsideSqSum / n) * Math.sqrt(252) * 100;

  // 夏普值 (Sharpe Ratio)
  const annRetDecimal = annualizedReturn / 100;
  const annVolDecimal = annualizedVolatility / 100;
  const sharpeRatio =
    annVolDecimal > 0 ? (annRetDecimal - riskFreeRate) / annVolDecimal : 0;

  // 索提諾比率 (Sortino Ratio)
  const downsideDecimal = downsideVol / 100;
  const sortinoRatio =
    downsideDecimal > 0 ? (annRetDecimal - riskFreeRate) / downsideDecimal : 0;

  // 5. 貝他值 (Beta)
  let beta = 1.0;
  if (benchmarkReturns.length === n) {
    const bValues = benchmarkReturns.map((r) => r.ret);
    const bMean = bValues.reduce((s, v) => s + v, 0) / n;
    const bVar =
      bValues.reduce((s, v) => s + Math.pow(v - bMean, 2), 0) / (n - 1);

    if (bVar > 0) {
      let cov = 0;
      for (let i = 0; i < n; i++) {
        cov += (retValues[i] - meanRet) * (bValues[i] - bMean);
      }
      cov = cov / (n - 1);
      beta = cov / bVar;
    }
  }

  return {
    cumulativeReturn: round(cumulativeReturn),
    annualizedReturn: round(annualizedReturn),
    annualizedVolatility: round(annualizedVolatility),
    maxDrawdown: round(maxDD * 100),
    sharpeRatio: round(sharpeRatio, 2),
    sortinoRatio: round(sortinoRatio, 2),
    beta: round(beta, 2),
    dataPointsCount: n,
    timeSeries,
  };
}

function getEmptyMetrics(): RiskMetrics {
  return {
    cumulativeReturn: 0,
    annualizedReturn: 0,
    annualizedVolatility: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    beta: 1,
    dataPointsCount: 0,
    timeSeries: [],
  };
}

function round(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
