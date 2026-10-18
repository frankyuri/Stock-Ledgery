# Stocktify｜專業美股台股全端投資管理系統

[![Build & Test](https://img.shields.io/badge/tests-72%20passed-emerald)](package.json)
[![Fullstack](https://img.shields.io/badge/Architecture-Fullstack%20Fastify%20%2B%20React-blue)](docs/fullstack-optimization-spec.md)
[![License](https://img.shields.io/badge/license-MIT-slate)](LICENSE)

Stocktify 是一套專為美股與台股長期投資者打造的**全端個人資產管理系統**。具備券商等級的加權平均成本會計引擎、股息現金流預測、量化風險評估（夏普值、最大回撤 MDD）、多裝置即時雲端雙寫與 BullMQ 背景自動推播（支援 LINE 官方帳號及 Discord / Telegram Webhook）。

---

## 🚀 核心功能亮點

```mermaid
flowchart LR
    subgraph Client ["前端應用 (React 18 + TS + PWA)"]
        UI["Modern UI (Tailwind + Lucide)"]
        Div["股息與現金流中心\n(未來12個月現金流預測)"]
        Risk["績效與量化風險面板\n(夏普值 / MDD 水底圖)"]
        Store["Zustand Store\n(離線快取 + 雲端即時雙寫)"]
    end

    subgraph Backend ["全端後端 (Fastify + BullMQ)"]
        API["RESTful API (JWT Argon2id)"]
        Queue["BullMQ 任務排程"]
        Worker["收盤日報 & 每分鐘價格警示"]
    end

    subgraph DB ["資料與快取層"]
        PG[("PostgreSQL 15 (交易/資產/警示)")]
        RD[("Redis 7 (行情快取/佇列)")]
    end

    UI --> Store <--> API
    API --> PG & RD
    Queue --> Worker --> RD
```

### 1. 💼 投資組合與加權成本記帳引擎
* **先進加權平均成本算法**：每次買進自動更新平均成本，賣出精確結算已實現損益（Realized PnL）。
* **即時雲端雙寫（Online-first with local fallback）**：已登入時自動同步至 PostgreSQL 資料庫；斷網時無縫降級至本地 localStorage，並在登入或重連後自動雙向同步。
* **快捷記帳視窗 (`QuickTradeModal`)**：全域快速呼叫下單彈窗，即時試算賣出損益與手續費折讓。

### 2. 💰 股息與被動現金流中心 (`/dividends`)
* **未來 12 個月現金流預測長條圖**：視覺化預估 1～12 月每月預期進帳之股息被動收入。
* **持股殖利率矩陣**：即時對比「現價殖利率」與「持有成本殖利率 (Yield on Cost, YoC)」。
* **除息歷程與對帳清單**：自動回測歷史持股在除息日的實際入帳紀錄。

### 3. 📈 績效與量化風險面板 (`/analytics`)
* **專業量化風險指標**：夏普值 (Sharpe Ratio)、最大回撤 (MDD, Maximum Drawdown)、年化波動度 (Volatility)、貝他係數 (Beta) 及索提諾比率 (Sortino Ratio)。
* **大盤基準對比走勢圖**：以 0.00% 為基準起點，與 S&P 500 (`^GSPC`)、元大台灣50 (`0050.TW`)、那斯達克等大盤累積報酬率對標。
* **歷史回撤水底圖 (Underwater Chart)**：清楚洞察波段回調深度與修復歷程。

### 4. 🔔 背景自動排程與多管道推播中心 (`/settings/line`)
* **多管道推播**：支援 LINE 官方帳號 Flex Message 卡片，並整合 **Discord / Telegram / Slack Webhook（100% 免費無每月則數上限）**。
* **每日收盤日報**：BullMQ 排程每日 16:30 自動彙整持股市值、當日變動與累計損益推播。
* **盤中價格警示巡檢**：每 60 秒自動掃描價格突破與跌破條件，即時提醒投資人。

### 5. 🎯 FIRE 財務自由倒數與被動收入生活覆蓋儀表板 (`/fire`)
* **4% 安全提領法則與達標倒數**：動態依目前總淨值、每月定期定額投入額與實質年化報酬率，精算預估退休年份與倒數計時器。
* **四大 FIRE 生活型態即時切換**：標準自由 (Standard 100%)、極簡自由 (Lean 75%)、富裕自由 (Fat 135%)、兼職自由 (Barista 50%)。
* **被動股息生活開銷覆蓋階梯 (Crossover Ladder)**：追蹤目前被動股息現金流已逐步解鎖基礎水電、日常伙食、居住房貸或完全自由等人生里程碑。
* **30 年長期財富積累曲線**：清楚呈現本金投入 vs 複利滾存收益 vs FIRE 門檻交叉點。
* **蒙地卡羅情境壓力測試 (Monte Carlo 2,000次)**：以幾何布朗運動 (GBM) 隨機過程模擬市場極端回撤、計算 30 年不破產成功率、扇形走勢圖 (Fan Chart) 與報酬順序風險 (SRR) 診斷；支援 Guyton-Klinger 護欄法則動態提領。
* **智慧加速策略建議**：自動試算每月加碼投資或開銷精省 10% 能提前幾年退休。

### 6. ⚖️ 目標資產配置與一鍵自動再平衡計算器 (`/rebalance`)
* **五大經典資產配置模板**：積極成長 80/20、穩健平衡 60/40、達利歐全天候、台美核心衛星、高股息現金流一鍵套用與自訂標的。
* **即時偏離度監控 (Drift Analysis)**：以雙層對比長條圖精準標記超配 (Overweight)、平衡 (Balanced) 與低配 (Underweight) 部位。
* **新資金加碼最佳化 (Cash-in Only)**：水填充算法分配新資金，優先補強低配部位，零賣出、零證交稅、零摩擦成本。
* **全盤直接再平衡 (Full Rebalance)**：試算 100% 歸位之買賣股數，並扣除預估 0.3% 證券交易稅與券商折扣手續費。
* **一鍵快速下單記帳**：算單右側直接喚起 `QuickTradeModal` 彈窗，預填代號與股數迅速完成交易記錄。

### 7. 📥 券商對帳單智慧匯入引擎 (`Smart Broker Importer`)
* **台美主流券商自適應解析**：原生支援永豐大戶投 (Sinopac)、富邦證券、國泰證券、元大證券、Interactive Brokers (IBKR)、Firstrade (第一證券)、Charles Schwab 及標準 CSV。
* **智慧去重與校驗**：自動比對現有交易（日期、代號、方向、股數、價格），支援一鍵排除重複，即時試算批次匯入後之持股加權平均成本。
* **民國年/代號正規化**：自動將台股民國年份（如 113/03/15）轉為西元年，純數字代號自動對齊 `.TW` 規範。

### 8. 🛡️ 台美雙市場稅務與二代健保試算中心 (`/tax`)
* **二代健保補充保費 (2.11%) 警戒雷達**：單筆股利達 20,000 元防呆預警，自動計算被扣金額與建議持有上限股數，精準提示避稅拆單策略。
* **台股綜合所得稅股利申報最佳化**：合併計稅 (享 8.5% 抵減，上限 8 萬) vs 28% 分開計稅即時試算，推薦最省稅/享退稅之申報方案。
* **美股 30% 預扣稅拖累與 UCITS 效益**：追蹤美股 30% IRS 稅務拖累，並試算改持愛爾蘭 UCITS ETF (15% 預扣) 之 10 年與 20 年複利省稅成長額。
* **海外所得最低稅負制 (750 萬) 監控**：累計已實現海外利得與美元股息，動態監控 100 萬申報門檻與 750 萬基本免稅額進度條。

### 9. 📱 PWA 行動端原生體驗
* 支援 iOS / Android / Desktop Chrome 一鍵「安裝至主畫面」，享受全螢幕原生 App 流暢體驗。

---

## 🛠️ 技術棧

* **前端架構**：React 18、TypeScript、Vite、Tailwind CSS、TradingView Lightweight Charts、TanStack Query v5、TanStack Table v8、Zustand、Lucide Icons
* **後端架構**：Node.js 20、Fastify 4、Prisma ORM 5、PostgreSQL 15、Redis 7、BullMQ
* **安全與驗證**：JWT (Access Token + Refresh Token)、Argon2id / bcrypt 密碼雜湊、嚴格 CORS、Rate Limiting

---

## ⚡ 快速啟動

### 1. 啟動資料庫與快取 (Docker Desktop)
```bash
docker compose up -d
```
將會啟動：
* **PostgreSQL 15**（連接埠 `5432`）
* **Redis 7**（連接埠 `6379`）

### 2. 啟動後端伺服器
```bash
# 安裝後端相依套件並同步資料庫結構
npm --prefix server install
npm --prefix server run prisma:push

# 啟動後端 API 開發伺服器（預設監聽 http://localhost:8080）
npm run server:dev
```

### 3. 啟動前端開發環境
```bash
# 安裝前端相依套件
npm install

# 啟動前端開發伺服器（預設監聽 http://localhost:5173）
npm run dev
```

---

## 🧪 執行測試

本專案具備完整的前後端單元測試與會計邊界驗證：

```bash
# 執行所有前後端測試（共 36 項測試）
npm run test:all

# 僅測試前端
npm test

# 僅測試後端
npm run server:test
```

---

## 📂 專案架構目錄

```
Stocktify/
├── docs/                      # 規格書與維運成本評估報告
│   ├── fullstack-optimization-spec.md
│   └── infrastructure-cost-assessment.md
├── server/                    # Fastify 後端服務
│   ├── prisma/schema.prisma  # PostgreSQL 資料模型
│   ├── src/
│   │   ├── jobs/              # BullMQ 背景排程與推播 Worker
│   │   ├── routes/            # RESTful API 端點 (auth, trades, quotes...)
│   │   ├── services/          # 加權會計引擎 (accounting.ts) 與行情服務
│   │   └── index.ts           # 後端伺服器入口
│   └── Dockerfile             # 後端生產環境多階段映像檔
├── src/                       # React 前端應用
│   ├── components/
│   │   ├── charts/            # 技術線圖、對比圖 (ComparisonChart)、水底圖
│   │   ├── modals/            # 快捷記帳下單彈窗 (QuickTradeModal)
│   │   └── tables/            # 持股與交易表格
│   ├── pages/
│   │   ├── Dashboard.tsx      # 大盤與自選清單
│   │   ├── Portfolio.tsx      # 個人持股明細
│   │   ├── Dividends.tsx      # 股息與現金流中心
│   │   ├── Analytics.tsx      # 績效與量化風險面板
│   │   ├── Transactions.tsx   # 交易紀錄管理
│   │   ├── Assets.tsx         # 多幣別淨值快照
│   │   └── LineSettings.tsx   # 自動化推播與通知中心
│   ├── lib/                   # 股息預測、量化風險、匯率與格式化演算法
│   └── store/                 # Zustand 狀態管理 (即時雲端雙寫)
├── docker-compose.yml         # 本機與生產環境容器編排
└── package.json
```

---

## 📄 授權條款

MIT License.
