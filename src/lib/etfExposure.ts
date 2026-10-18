/**
 * ETF 底層持股穿透與重疊度分析引擎 (ETF Overlap & Exposure Analyzer)
 * 拆解熱門台美 ETF (0050, 006208, 0056, 00878, 00919, VOO, SPY, QQQ, VTI 等)
 * 揭示底層真實持股曝險，避免投資人「以為分散、實則過度重疊」
 */

export interface EtfConstituent {
  symbol: string;
  name: string;
  weight: number; // 0 ~ 100
  sector: string;
}

export interface EtfProfile {
  symbol: string;
  name: string;
  category: 'TW_MARKET' | 'TW_HIGH_DIVIDEND' | 'US_MARKET' | 'US_TECH' | 'GLOBAL';
  totalHoldingsCount: number;
  topConstituents: EtfConstituent[];
}

/**
 * 熱門台美 ETF 成份股資料字典 (Top 10 Holdings)
 */
export const ETF_CONSTITUENTS_DATABASE: Record<string, EtfProfile> = {
  '0050.TW': {
    symbol: '0050.TW',
    name: '元大台灣50',
    category: 'TW_MARKET',
    totalHoldingsCount: 50,
    topConstituents: [
      { symbol: '2330.TW', name: '台積電', weight: 54.2, sector: '半導體' },
      { symbol: '2454.TW', name: '聯發科', weight: 4.8, sector: 'IC設計' },
      { symbol: '2317.TW', name: '鴻海', weight: 4.2, sector: '電子代工' },
      { symbol: '2308.TW', name: '台達電', weight: 2.1, sector: '電源綠能' },
      { symbol: '2881.TW', name: '富邦金', weight: 1.8, sector: '金融保險' },
      { symbol: '2882.TW', name: '國泰金', weight: 1.5, sector: '金融保險' },
      { symbol: '2382.TW', name: '廣達', weight: 1.4, sector: 'AI伺服器' },
      { symbol: '2412.TW', name: '中華電', weight: 1.3, sector: '電信通信' },
      { symbol: '2891.TW', name: '中信金', weight: 1.2, sector: '金融保險' },
      { symbol: '3711.TW', name: '日月光投控', weight: 1.1, sector: '半導體封測' },
    ],
  },
  '006208.TW': {
    symbol: '006208.TW',
    name: '富邦台灣采吉50',
    category: 'TW_MARKET',
    totalHoldingsCount: 50,
    topConstituents: [
      { symbol: '2330.TW', name: '台積電', weight: 54.0, sector: '半導體' },
      { symbol: '2454.TW', name: '聯發科', weight: 4.8, sector: 'IC設計' },
      { symbol: '2317.TW', name: '鴻海', weight: 4.2, sector: '電子代工' },
      { symbol: '2308.TW', name: '台達電', weight: 2.1, sector: '電源綠能' },
      { symbol: '2881.TW', name: '富邦金', weight: 1.8, sector: '金融保險' },
      { symbol: '2882.TW', name: '國泰金', weight: 1.5, sector: '金融保險' },
      { symbol: '2382.TW', name: '廣達', weight: 1.4, sector: 'AI伺服器' },
      { symbol: '2412.TW', name: '中華電', weight: 1.3, sector: '電信通信' },
      { symbol: '2891.TW', name: '中信金', weight: 1.2, sector: '金融保險' },
      { symbol: '3711.TW', name: '日月光投控', weight: 1.1, sector: '半導體封測' },
    ],
  },
  '0056.TW': {
    symbol: '0056.TW',
    name: '元大高股息',
    category: 'TW_HIGH_DIVIDEND',
    totalHoldingsCount: 50,
    topConstituents: [
      { symbol: '2382.TW', name: '廣達', weight: 3.8, sector: 'AI伺服器' },
      { symbol: '2357.TW', name: '華碩', weight: 3.5, sector: '品牌電腦' },
      { symbol: '2603.TW', name: '長榮', weight: 3.3, sector: '航運物流' },
      { symbol: '2301.TW', name: '光寶科', weight: 3.1, sector: '電子元件' },
      { symbol: '3231.TW', name: '緯創', weight: 3.0, sector: 'AI伺服器' },
      { symbol: '2454.TW', name: '聯發科', weight: 2.8, sector: 'IC設計' },
      { symbol: '2379.TW', name: '瑞昱', weight: 2.6, sector: 'IC設計' },
      { symbol: '2891.TW', name: '中信金', weight: 2.5, sector: '金融保險' },
      { symbol: '2609.TW', name: '陽明', weight: 2.3, sector: '航運物流' },
      { symbol: '3034.TW', name: '聯詠', weight: 2.2, sector: 'IC設計' },
    ],
  },
  '00878.TW': {
    symbol: '00878.TW',
    name: '國泰永續高股息',
    category: 'TW_HIGH_DIVIDEND',
    totalHoldingsCount: 30,
    topConstituents: [
      { symbol: '2454.TW', name: '聯發科', weight: 4.5, sector: 'IC設計' },
      { symbol: '2382.TW', name: '廣達', weight: 4.2, sector: 'AI伺服器' },
      { symbol: '2357.TW', name: '華碩', weight: 3.9, sector: '品牌電腦' },
      { symbol: '3231.TW', name: '緯創', weight: 3.6, sector: 'AI伺服器' },
      { symbol: '2301.TW', name: '光寶科', weight: 3.5, sector: '電子元件' },
      { symbol: '2886.TW', name: '兆豐金', weight: 3.4, sector: '金融保險' },
      { symbol: '2891.TW', name: '中信金', weight: 3.3, sector: '金融保險' },
      { symbol: '2882.TW', name: '國泰金', weight: 3.2, sector: '金融保險' },
      { symbol: '2881.TW', name: '富邦金', weight: 3.1, sector: '金融保險' },
      { symbol: '2412.TW', name: '中華電', weight: 3.0, sector: '電信通信' },
    ],
  },
  '00919.TW': {
    symbol: '00919.TW',
    name: '群益台灣精選高息',
    category: 'TW_HIGH_DIVIDEND',
    totalHoldingsCount: 30,
    topConstituents: [
      { symbol: '2603.TW', name: '長榮', weight: 9.8, sector: '航運物流' },
      { symbol: '2454.TW', name: '聯發科', weight: 8.5, sector: 'IC設計' },
      { symbol: '2609.TW', name: '陽明', weight: 6.2, sector: '航運物流' },
      { symbol: '2615.TW', name: '萬海', weight: 5.5, sector: '航運物流' },
      { symbol: '2891.TW', name: '中信金', weight: 4.8, sector: '金融保險' },
      { symbol: '3034.TW', name: '聯詠', weight: 4.2, sector: 'IC設計' },
      { symbol: '2379.TW', name: '瑞昱', weight: 3.9, sector: 'IC設計' },
      { symbol: '2303.TW', name: '聯電', weight: 3.5, sector: '半導體晶圓' },
      { symbol: '2886.TW', name: '兆豐金', weight: 3.2, sector: '金融保險' },
      { symbol: '5483.TWO', name: '中美晶', weight: 3.0, sector: '半導體矽晶圓' },
    ],
  },
  'VOO': {
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    category: 'US_MARKET',
    totalHoldingsCount: 503,
    topConstituents: [
      { symbol: 'MSFT', name: 'Microsoft', weight: 6.9, sector: '軟體與雲端' },
      { symbol: 'AAPL', name: 'Apple', weight: 6.5, sector: '消費電子' },
      { symbol: 'NVDA', name: 'NVIDIA', weight: 6.2, sector: '半導體與AI' },
      { symbol: 'AMZN', name: 'Amazon', weight: 3.6, sector: '電商與雲端' },
      { symbol: 'META', name: 'Meta Platforms', weight: 2.4, sector: '社群互動' },
      { symbol: 'GOOGL', name: 'Alphabet Class A', weight: 2.1, sector: '數位廣告與AI' },
      { symbol: 'GOOG', name: 'Alphabet Class C', weight: 1.8, sector: '數位廣告與AI' },
      { symbol: 'BRK.B', name: 'Berkshire Hathaway', weight: 1.7, sector: '多元金融' },
      { symbol: 'LLY', name: 'Eli Lilly', weight: 1.6, sector: '生技醫療' },
      { symbol: 'TSLA', name: 'Tesla', weight: 1.4, sector: '電動車與能源' },
    ],
  },
  'SPY': {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    category: 'US_MARKET',
    totalHoldingsCount: 503,
    topConstituents: [
      { symbol: 'MSFT', name: 'Microsoft', weight: 6.9, sector: '軟體與雲端' },
      { symbol: 'AAPL', name: 'Apple', weight: 6.5, sector: '消費電子' },
      { symbol: 'NVDA', name: 'NVIDIA', weight: 6.2, sector: '半導體與AI' },
      { symbol: 'AMZN', name: 'Amazon', weight: 3.6, sector: '電商與雲端' },
      { symbol: 'META', name: 'Meta Platforms', weight: 2.4, sector: '社群互動' },
      { symbol: 'GOOGL', name: 'Alphabet Class A', weight: 2.1, sector: '數位廣告與AI' },
      { symbol: 'GOOG', name: 'Alphabet Class C', weight: 1.8, sector: '數位廣告與AI' },
      { symbol: 'BRK.B', name: 'Berkshire Hathaway', weight: 1.7, sector: '多元金融' },
      { symbol: 'LLY', name: 'Eli Lilly', weight: 1.6, sector: '生技醫療' },
      { symbol: 'TSLA', name: 'Tesla', weight: 1.4, sector: '電動車與能源' },
    ],
  },
  'QQQ': {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust (Nasdaq 100)',
    category: 'US_TECH',
    totalHoldingsCount: 101,
    topConstituents: [
      { symbol: 'AAPL', name: 'Apple', weight: 8.8, sector: '消費電子' },
      { symbol: 'MSFT', name: 'Microsoft', weight: 8.4, sector: '軟體與雲端' },
      { symbol: 'NVDA', name: 'NVIDIA', weight: 7.9, sector: '半導體與AI' },
      { symbol: 'AMZN', name: 'Amazon', weight: 5.2, sector: '電商與雲端' },
      { symbol: 'META', name: 'Meta Platforms', weight: 4.8, sector: '社群互動' },
      { symbol: 'AVGO', name: 'Broadcom', weight: 4.2, sector: '半導體網通' },
      { symbol: 'TSLA', name: 'Tesla', weight: 3.2, sector: '電動車與能源' },
      { symbol: 'GOOGL', name: 'Alphabet Class A', weight: 2.8, sector: '數位廣告與AI' },
      { symbol: 'GOOG', name: 'Alphabet Class C', weight: 2.6, sector: '數位廣告與AI' },
      { symbol: 'COST', name: 'Costco Wholesale', weight: 2.4, sector: '連鎖零售' },
    ],
  },
};

export interface UnderlyingExposure {
  symbol: string;
  name: string;
  sector: string;
  directWeight: number; // 個股直接持有佔比 %
  etfIndirectWeight: number; // 透過 ETF 間接持有佔比 %
  totalEffectiveWeight: number; // 總穿透曝險 %
  heldViaEtfs: Array<{ etfSymbol: string; etfWeight: number; contribution: number }>;
}

export interface EtfOverlapAnalysis {
  etf1: string;
  etf2: string;
  overlapPercentage: number; // 重疊率 % (0~100)
  commonConstituents: Array<{
    symbol: string;
    name: string;
    weightInEtf1: number;
    weightInEtf2: number;
    overlapWeight: number; // min(weight1, weight2)
  }>;
}

/**
 * 計算兩檔 ETF 之間的成份股重疊權重比例 (Overlap Ratio)
 */
export function calculateEtfOverlap(etfSymbol1: string, etfSymbol2: string): EtfOverlapAnalysis | null {
  const e1 = ETF_CONSTITUENTS_DATABASE[etfSymbol1.toUpperCase().trim()];
  const e2 = ETF_CONSTITUENTS_DATABASE[etfSymbol2.toUpperCase().trim()];

  if (!e1 || !e2) return null;

  const map2 = new Map(e2.topConstituents.map((c) => [c.symbol, c]));
  const commonConstituents: EtfOverlapAnalysis['commonConstituents'] = [];
  let totalOverlap = 0;

  for (const c1 of e1.topConstituents) {
    const c2 = map2.get(c1.symbol);
    if (c2) {
      const overlapWeight = Math.min(c1.weight, c2.weight);
      totalOverlap += overlapWeight;
      commonConstituents.push({
        symbol: c1.symbol,
        name: c1.name,
        weightInEtf1: c1.weight,
        weightInEtf2: c2.weight,
        overlapWeight: Math.round(overlapWeight * 10) / 10,
      });
    }
  }

  // 0050 與 006208 追蹤相同指數，全成分重疊高達 99%
  if (
    (e1.symbol === '0050.TW' && e2.symbol === '006208.TW') ||
    (e1.symbol === '006208.TW' && e2.symbol === '0050.TW') ||
    (e1.symbol === 'VOO' && e2.symbol === 'SPY') ||
    (e1.symbol === 'SPY' && e2.symbol === 'VOO')
  ) {
    totalOverlap = 99.5;
  }

  return {
    etf1: e1.symbol,
    etf2: e2.symbol,
    overlapPercentage: Math.min(100, Math.round(totalOverlap * 10) / 10),
    commonConstituents: commonConstituents.sort((a, b) => b.overlapWeight - a.overlapWeight),
  };
}

/**
 * 穿透計算使用者投組對各底層企業的真實總曝險 (Look-Through Exposure)
 */
export function calculatePortfolioUnderlyingExposures(
  holdings: Array<{ symbol: string; name?: string; marketValue: number }>,
): UnderlyingExposure[] {
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  if (totalValue <= 0 || holdings.length === 0) return [];

  const exposureMap = new Map<string, UnderlyingExposure>();

  // 1. 記錄直接持股
  for (const h of holdings) {
    const s = h.symbol.toUpperCase().trim();
    const isKnownEtf = Boolean(ETF_CONSTITUENTS_DATABASE[s]);
    const weight = (h.marketValue / totalValue) * 100;

    if (!isKnownEtf) {
      const existing = exposureMap.get(s) || {
        symbol: s,
        name: h.name || s,
        sector: '個股部位',
        directWeight: 0,
        etfIndirectWeight: 0,
        totalEffectiveWeight: 0,
        heldViaEtfs: [],
      };
      existing.directWeight += weight;
      existing.totalEffectiveWeight += weight;
      exposureMap.set(s, existing);
    }
  }

  // 2. 穿透拆解 ETF 持股
  for (const h of holdings) {
    const s = h.symbol.toUpperCase().trim();
    const etf = ETF_CONSTITUENTS_DATABASE[s];
    if (etf) {
      const etfWeightInPortfolio = (h.marketValue / totalValue) * 100;

      for (const constituent of etf.topConstituents) {
        // 該成分股在此 ETF 的權重 × ETF 在整體投組的權重
        const indirectContribution = (constituent.weight / 100) * etfWeightInPortfolio;

        const existing = exposureMap.get(constituent.symbol) || {
          symbol: constituent.symbol,
          name: constituent.name,
          sector: constituent.sector,
          directWeight: 0,
          etfIndirectWeight: 0,
          totalEffectiveWeight: 0,
          heldViaEtfs: [],
        };

        existing.etfIndirectWeight += indirectContribution;
        existing.totalEffectiveWeight += indirectContribution;
        existing.heldViaEtfs.push({
          etfSymbol: etf.symbol,
          etfWeight: Math.round(etfWeightInPortfolio * 10) / 10,
          contribution: Math.round(indirectContribution * 100) / 100,
        });

        exposureMap.set(constituent.symbol, existing);
      }
    }
  }

  return Array.from(exposureMap.values())
    .map((e) => ({
      ...e,
      directWeight: Math.round(e.directWeight * 10) / 10,
      etfIndirectWeight: Math.round(e.etfIndirectWeight * 10) / 10,
      totalEffectiveWeight: Math.round(e.totalEffectiveWeight * 10) / 10,
    }))
    .sort((a, b) => b.totalEffectiveWeight - a.totalEffectiveWeight);
}
