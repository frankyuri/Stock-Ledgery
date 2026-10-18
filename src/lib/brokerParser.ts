import type { Transaction, TransactionType } from '@/types/stock';

export type BrokerFormat =
  | 'STOCKTIFY'
  | 'SINOPAC' // 永豐大戶投
  | 'FUBON' // 富邦證券
  | 'CATHAY' // 國泰證券
  | 'YUANTA' // 元大證券
  | 'IBKR' // Interactive Brokers
  | 'FIRSTRADE' // Firstrade
  | 'SCHWAB' // Charles Schwab
  | 'GENERIC'; // 通用格式

export interface ParsedTransactionCandidate {
  tempId: string;
  tradedAt: string; // YYYY-MM-DD
  symbol: string;
  type: TransactionType;
  shares: number;
  price: number;
  fee: number;
  note?: string;
  rawBroker?: BrokerFormat;
  isDuplicate?: boolean;
  duplicateMatchId?: string;
  isValid: boolean;
  validationError?: string;
}

export interface ParseResult {
  broker: BrokerFormat;
  brokerName: string;
  candidates: ParsedTransactionCandidate[];
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
}

/**
 * 簡易 RFC 4180 規範之 CSV 欄位解析器
 * 處理包含逗號、換行與雙引號字元之儲存格
 */
export function parseCSVToRows(csvContent: string): string[][] {
  const clean = csvContent.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * 清理數值字串：去除貨幣符號、千分位逗號、處理括號負數
 */
export function sanitizeNumber(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val || typeof val !== 'string') return 0;
  let s = val.trim().replace(/[$NT¥,\s]/gi, '');
  if (s.startsWith('(') && s.endsWith(')')) {
    s = '-' + s.slice(1, -1);
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 正規化日期字串為 YYYY-MM-DD
 * 支援: 2024-03-15, 2024/03/15, 20240315, 113/03/15 (民國年), 03/15/2024
 */
export function normalizeDate(rawDate: string): string {
  if (!rawDate) return new Date().toISOString().slice(0, 10);
  const s = rawDate.trim().replace(/^"|"$/g, '');

  // 1. 處理 MM/DD/YYYY (美式常見，最後為 4 位西元年)
  const mdyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
  }

  // 2. 處理 YYYY/MM/DD 或 YYYY-MM-DD (開頭為 4 位西元年)
  const ymdMatch = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  // 3. 處理純數字 YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  // 4. 處理民國年 e.g. 113/03/15, 113-3-15 (結尾不可為 4 位西元年)
  const rocMatch = s.match(/^(\d{2,3})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (rocMatch) {
    const year = parseInt(rocMatch[1], 10);
    if (year < 200) {
      const gregorianYear = year + 1911;
      const m = rocMatch[2].padStart(2, '0');
      const d = rocMatch[3].padStart(2, '0');
      return `${gregorianYear}-${m}-${d}`;
    }
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * 辨識股票代號：台股如果是 4~6 碼純數字，正規化補上 .TW
 */
export function normalizeSymbol(rawSym: string): string {
  if (!rawSym) return '';
  let sym = rawSym.trim().toUpperCase().replace(/["\s]/g, '');

  // 移除常見括號與中文名稱，如 "2330 台積電" -> "2330"
  const m = sym.match(/^([A-Z0-9.]+)/);
  if (m) sym = m[1];

  // 純 4~6 位數字為台股
  if (/^\d{4,6}$/.test(sym)) {
    return `${sym}.TW`;
  }
  return sym;
}

/**
 * 辨識交易方向 BUY / SELL
 */
export function normalizeAction(rawType: string): TransactionType {
  const s = (rawType || '').trim().toUpperCase();
  if (
    s.includes('SELL') ||
    s.includes('賣') ||
    s.includes('現賣') ||
    s.includes('定額賣') ||
    s.includes('沖賣')
  ) {
    return 'SELL';
  }
  return 'BUY';
}

/**
 * 券商名稱標籤對照
 */
export const BROKER_LABELS: Record<BrokerFormat, string> = {
  STOCKTIFY: 'Stocktify 標準格式',
  SINOPAC: '永豐金證券（大戶投 / Shioaji）',
  FUBON: '富邦證券',
  CATHAY: '國泰綜合證券',
  YUANTA: '元大證券',
  IBKR: 'Interactive Brokers (盈透證券)',
  FIRSTRADE: 'Firstrade (第一證券)',
  SCHWAB: 'Charles Schwab (嘉信理財)',
  GENERIC: '通用 CSV 格式',
};

/**
 * 根據 Header 關鍵字自動偵測券商格式
 */
export function detectBrokerFormat(headers: string[]): BrokerFormat {
  const h = headers.map((x) => x.toLowerCase().replace(/["\s_]/g, ''));
  const headerStr = h.join(' ');

  if (headerStr.includes('tradedat') && headerStr.includes('realizedgainloss')) {
    return 'STOCKTIFY';
  }
  if (headerStr.includes('委託書號') || (headerStr.includes('成交單價') && headerStr.includes('淨收付'))) {
    return 'SINOPAC';
  }
  if (headerStr.includes('委託序號') || (headerStr.includes('成交單價') && headerStr.includes('富邦'))) {
    return 'FUBON';
  }
  if (headerStr.includes('商品代碼') && headerStr.includes('商品名稱') && headerStr.includes('成交價金')) {
    return 'CATHAY';
  }
  if (headerStr.includes('委託買賣') || (headerStr.includes('證交稅') && headerStr.includes('單價'))) {
    return 'YUANTA';
  }
  if (headerStr.includes('ibkr') || (headerStr.includes('symbol') && headerStr.includes('comm/fee'))) {
    return 'IBKR';
  }
  if (headerStr.includes('firstrade') || (headerStr.includes('action') && headerStr.includes('quantity') && headerStr.includes('commission'))) {
    return 'FIRSTRADE';
  }
  if (headerStr.includes('schwab') || (headerStr.includes('fees&comm'))) {
    return 'SCHWAB';
  }

  // 嘗試判斷是否為永豐 (含有 買賣, 成交股數, 成交單價, 手續費)
  if (h.some((x) => x.includes('成交單價')) && h.some((x) => x.includes('手續費'))) {
    return 'SINOPAC';
  }

  return 'GENERIC';
}

/**
 * 智慧解析 CSV 為交易紀錄候選人清單
 */
export function parseBrokerCSV(
  csvContent: string,
  existingTransactions: Transaction[] = [],
): ParseResult {
  const rows = parseCSVToRows(csvContent);
  if (rows.length < 2) {
    return {
      broker: 'GENERIC',
      brokerName: BROKER_LABELS.GENERIC,
      candidates: [],
      totalRows: 0,
      validCount: 0,
      duplicateCount: 0,
      errorCount: 0,
    };
  }

  const headerRow = rows[0].map((c) => c.trim());
  const broker = detectBrokerFormat(headerRow);
  const brokerName = BROKER_LABELS[broker];

  // 建立欄位索引尋找工具
  const findCol = (predicate: (colName: string) => boolean): number => {
    return headerRow.findIndex((col) => predicate(col.toLowerCase().replace(/["\s_]/g, '')));
  };

  const dateIdx = findCol((c) =>
    ['date', 'tradedat', '成交日期', '交易日期', '日期'].some((k) => c.includes(k)),
  );
  const symIdx = findCol((c) =>
    ['symbol', 'ticker', '股票代碼', '股票代號', '商品代碼', '商品代號', '代號', '標的'].some((k) =>
      c.includes(k),
    ),
  );
  const nameIdx = findCol((c) =>
    ['股票名稱', '商品名稱', '名稱', 'description'].some((k) => c.includes(k)),
  );
  const typeIdx = findCol((c) =>
    ['type', 'action', '買賣', '買賣別', '委託買賣', '方向', '類別'].some((k) => c.includes(k)),
  );
  const sharesIdx = findCol((c) =>
    ['share', 'shares', 'quantity', 'qty', '成交股數', '股數', '數量'].some((k) => c.includes(k)),
  );
  const priceIdx = findCol((c) =>
    ['price', 't.price', 'tradeprice', '成交單價', '成交價格', '單價', '價格'].some((k) =>
      c.includes(k),
    ),
  );
  const feeIdx = findCol((c) =>
    ['fee', 'fees', 'comm', 'commission', 'comm/fee', 'fees&comm', '手續費'].some((k) =>
      c.includes(k),
    ),
  );
  const noteIdx = findCol((c) =>
    ['note', 'memo', '備註', '說明'].some((k) => c.includes(k)),
  );

  const candidates: ParsedTransactionCandidate[] = [];
  let duplicateCount = 0;
  let validCount = 0;
  let errorCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    const rawDate = dateIdx !== -1 ? row[dateIdx] : '';
    const rawSym = symIdx !== -1 ? row[symIdx] : '';
    const rawName = nameIdx !== -1 ? row[nameIdx] : '';
    const rawType = typeIdx !== -1 ? row[typeIdx] : 'BUY';
    const rawShares = sharesIdx !== -1 ? row[sharesIdx] : '';
    const rawPrice = priceIdx !== -1 ? row[priceIdx] : '';
    const rawFee = feeIdx !== -1 ? row[feeIdx] : '0';
    const rawNote = noteIdx !== -1 ? row[noteIdx] : '';

    let symbol = normalizeSymbol(rawSym);
    // 如果代號為空，但名稱包含代號
    if (!symbol && rawName) {
      symbol = normalizeSymbol(rawName);
    }

    const tradedAt = normalizeDate(rawDate);
    const type = normalizeAction(rawType);
    const shares = Math.abs(sanitizeNumber(rawShares));
    const price = Math.abs(sanitizeNumber(rawPrice));
    const fee = Math.abs(sanitizeNumber(rawFee));

    const note = [rawName ? rawName.trim() : '', rawNote ? rawNote.trim() : '']
      .filter(Boolean)
      .join(' - ');

    let isValid = true;
    let validationError: string | undefined;

    if (!symbol) {
      isValid = false;
      validationError = '缺少股票代號';
    } else if (shares <= 0) {
      isValid = false;
      validationError = '股數必須大於 0';
    } else if (price <= 0) {
      isValid = false;
      validationError = '成交價必須大於 0';
    }

    // 重複檢驗 (相同標的、日期、方向、股數、價格)
    let isDuplicate = false;
    let duplicateMatchId: string | undefined;

    if (isValid) {
      const match = existingTransactions.find(
        (ex) =>
          ex.symbol === symbol &&
          ex.tradedAt === tradedAt &&
          ex.type === type &&
          Math.abs(ex.shares - shares) < 1e-4 &&
          Math.abs(ex.price - price) < 1e-3,
      );
      if (match) {
        isDuplicate = true;
        duplicateMatchId = match.id;
        duplicateCount++;
      } else {
        validCount++;
      }
    } else {
      errorCount++;
    }

    candidates.push({
      tempId: `import-row-${i}-${Date.now()}`,
      tradedAt,
      symbol,
      type,
      shares,
      price,
      fee,
      note: note || undefined,
      rawBroker: broker,
      isDuplicate,
      duplicateMatchId,
      isValid,
      validationError,
    });
  }

  return {
    broker,
    brokerName,
    candidates,
    totalRows: candidates.length,
    validCount,
    duplicateCount,
    errorCount,
  };
}
