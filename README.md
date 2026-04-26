# Stock-Ledgery｜個人股票追蹤系統

依循技術規格書打造的 React 股票追蹤系統前端。版本以 [package.json](package.json) 的 `version` 為準（畫面左下角會顯示）。

## 技術棧

- **核心**：React 18 + TypeScript + Vite
- **狀態**：Zustand（持久化至 localStorage）
- **資料**：@tanstack/react-query + Axios
- **路由**：react-router-dom v6
- **樣式**：Tailwind CSS
- **圖表**：TradingView Lightweight Charts（滾輪縮放、拖曳平移、MA20 疊圖）
- **表格**：@tanstack/react-table（排序、過濾、Headless）

## 目錄結構

```
src/
├── components/
│   ├── layout/       Sidebar、Header、AppLayout
│   ├── charts/       StockChart（封裝 Lightweight Charts）
│   ├── tables/       PortfolioTable、WatchlistTable（TanStack Table）
│   └── ui/           StatCard、Skeleton
├── pages/
│   ├── Dashboard.tsx  大盤總覽
│   ├── Portfolio.tsx  個人持股
│   └── StockDetail.tsx 個股研究 /stock/:symbol
├── services/         api.ts、stocks.ts、mockData.ts
├── store/            useStockStore.ts
├── lib/              format.ts、cn.ts
└── types/            stock.ts
```

## 啟動

```bash
npm install
npm run dev
```

**預設直接串 Yahoo Finance**（透過 Vite dev proxy 處理 CORS），不需要任何後端。
若要改回內建 mock 資料，設定環境變數：`VITE_USE_MOCK=true`。

## 資料來源

| 資料類型 | 來源 | 呼叫路徑 |
| :--- | :--- | :--- |
| 歷史 K 線 | Yahoo `/v8/finance/chart/{symbol}` | `yahooChart()` |
| 即時報價 | 同上（使用 meta 區段） | `yahooQuote()` |
| 搜尋自動補齊 | Yahoo `/v1/finance/search` | `yahooSearch()` |
| 個人持股 | Zustand + localStorage（本地） | `useStockStore.holdings` |

台股以 `2330.TW` 格式輸入；美股用標準代號 `AAPL`。

## CORS 與部署注意

Yahoo 沒有官方 CORS 支援，本專案用 [vite.config.ts](vite.config.ts) 的 `server.proxy`
將 `/yahoo/*` 轉發到 `query1.finance.yahoo.com`。這在 `npm run dev` 下可直接運作。

部署到靜態站時改走 Cloudflare Worker proxy——程式碼在 [workers/yahoo-proxy.js](workers/yahoo-proxy.js)。

## 部署到 GitHub Pages

CI/CD 已設定在 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)，每次 push 到 `main` 會自動 build + deploy。

**一次性設定步驟：**

1. **部署 Cloudflare Worker**（免費，無需綁卡）
   ```bash
   cd workers
   npx wrangler deploy
   ```
   登入 Cloudflare 後會印出 Worker URL，例如 `https://stock-ledgery-yahoo-proxy.<account>.workers.dev`。

2. **在 GitHub repo 設兩個東西：**
   - Settings → Pages → Source 選 **GitHub Actions**
   - Settings → Secrets and variables → Actions → New repository secret
     - Name: `YAHOO_PROXY_URL`
     - Value: 上一步的 Worker URL

3. push 到 `main`，Actions 會自動跑。完成後網址是 `https://<user>.github.io/Stock-Ledgery/`。

**原理說明：**
- `VITE_BASE_PATH=/Stock-Ledgery/` 由 workflow 注入，讓 Vite 產出的資源路徑帶 repo 名
- `BrowserRouter basename` 讀同一個值，路由才能正確解析子路徑
- `cp index.html 404.html` 是 GitHub Pages 的 SPA fallback 標準技巧——刷新子路徑時 Pages 會回 404.html，內容仍是 React App，路由即接管

## 之後接自家後端

若有自架後端，新增 `.env.local`：

```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

在 [src/services/stocks.ts](src/services/stocks.ts) 切換改走 `api.get(...)` 即可。

## 接下來可擴充

- shadcn/ui 正式導入（DatePicker、Select、Dialog）
- 更豐富的技術指標（MACD、RSI、布林通道）
- 後端 Proxy 串接 Finnhub / Alpha Vantage
- 新增「交易紀錄」頁，支援 CRUD 與平均成本計算
- 夜間 / 日間主題切換
