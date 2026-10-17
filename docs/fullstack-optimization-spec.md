# Stocktify (Stock-Ledgery) 全端架構升級與功能完善規格書
## Fullstack Architecture & Feature Enhancement Specification (v1.0)

> **版本**：1.0.0  
> **日期**：2026-10-17  
> **適用專案**：`Stocktify` / `stock-ledgery` (前端現況版本：`v0.5.0`)  
> **目標讀者**：全端工程師、架構師、專案負責人  
> **狀態**：規劃中（待用戶 Review 與決策）

---

## 1. 專案現況評估與問題診斷 (Executive Summary & Gap Analysis)

### 1.1 現有系統架構盤點
Stocktify 目前是一個基於 **React 18 + TypeScript + Vite + Tailwind CSS** 的個人股票投資組合追蹤系統，並在 `v0.5.0` 完成了多項強大的前端 UI/UX 優化（包含快捷下單視窗 `QuickTradeModal`、台美股市場動態狀態燈、Header 全域快捷鍵、RSI / 布林通道指標、交易記錄單筆編輯與 CSV 匯出入等）。

```mermaid
flowchart LR
    subgraph Browser ["瀏覽器客戶端 (Frontend v0.5.0)"]
        UI["React SPA (Tailwind + Lucide)"]
        State["Zustand Store + localStorage\n(Transactions, Assets, Watchlist, LinePrefs)"]
        Query["React Query (Search / K線 / 行情)"]
    end

    subgraph Upstream ["外部依賴"]
        ViteProxy["Vite Dev Proxy / Cloudflare Worker"]
        Yahoo["Yahoo Finance API\n(query1.finance.yahoo.com)"]
    end

    UI --> State
    UI --> Query
    Query --> ViteProxy --> Yahoo
```

### 1.2 核心痛點與架構瓶頸分析

| 維度 | 現況痛點 | 風險與影響 | 改善急迫性 |
| :--- | :--- | :--- | :---: |
| **後端與儲存** | 完全無後端伺服器與真實資料庫，資料全部存於 `localStorage`。 | 換設備、清除快取或跨瀏覽器時資料即遺失；無法進行多裝置同步。 | **極高 (P0)** |
| **帳號與安全** | Auth 為 `loginMock` / `registerMock`，密碼未雜湊驗證，無真實 Session / JWT。 | 缺乏身分驗證與存取控制，無法防止未授權操作。 | **極高 (P0)** |
| **行情與穩定性** | 前端直接經由 Proxy 請求 Yahoo Finance，缺乏伺服器端統一快取與降級策略。 | 開盤期間易遭遇 Yahoo 速率限制 (HTTP 429) 或封鎖 IP；前端載入延遲高。 | **高 (P1)** |
| **通知與自動化** | LINE 綁定頁面僅為前端 UI 模擬，推播開關無實際功能。 | 無法實現盤後自動發送「每日資產損益報告」與「即時價格破頂/破底警示」。 | **高 (P1)** |
| **計算與業務邏輯**| 交易對帳、加權成本計算、已實現損益重算完全依賴客戶端運算。 | 資料量大時客戶端重算效能受限；若客戶端腳本異常可能造成計算不一致。 | **中 (P2)** |
| **進階投資功能** | 缺少股息現金流日曆、投資組合夏普值/最大回撤 (MDD) 風險指標、台美股自訂手續費/證交稅設定。 | 無法滿足更深度的長線存股與投資績效量化分析需求。 | **中 (P2)** |

### 1.3 本次升級的核心目標
1. **補齊企業級全端後端架構**：以 Node.js (TypeScript) + Fastify + Prisma + PostgreSQL + Redis + BullMQ 建立高併發、高效能後端 API。
2. **前後端無縫接軌與平滑遷移**：支援「本機 localStorage 歷史資料一鍵無痛遷移至雲端資料庫」，同時具備「離線快取 + 樂觀更新」的流暢體驗。
3. **建立可靠的行情快取與代理中心**：後端統一抓取 Yahoo/台美股行情，配合 Redis 實現毫秒級響應與降級機制。
4. **真實落地 LINE 官方帳號推播**：整合 LINE Login OAuth 2.0 與 Messaging API，實現收盤損益通知、價格警示與交易確認。
5. **完善進階資產與投組分析模組**：新增被動股息預測、投組風險量化 (Sharpe/MDD/Beta)、自訂交易手續費率。

---

## 2. 全端總體架構設計 (System Architecture Design)

### 2.1 系統架構拓撲圖

```mermaid
flowchart TB
    subgraph ClientLayer ["用戶端 (Client Layer)"]
        WebDesktop["電腦版 Web 應用 (React 18 + TS)"]
        WebMobile["手機行動版 Web / PWA"]
        LineApp["LINE 通訊軟體 (接收推播/互動)"]
    end

    subgraph GatewayLayer ["接入與安全性層"]
        Nginx["Nginx / Cloudflare CDN\n(SSL、靜態資源、反向代理)"]
        RateLimiter["Fastify Rate Limiter\n(IP / User-based)"]
    end

    subgraph ServiceLayer ["後端核心服務 (Fastify 4/5 + TypeScript)"]
        AuthSvc["認證與帳戶模組 (JWT + Argon2id)"]
        TradeSvc["交易與持股記帳引擎 (加權平均成本)"]
        MarketSvc["行情代理與聚合服務"]
        AssetSvc["多幣別淨值與匯率模組"]
        LineSvc["LINE Bot & OAuth 服務"]
    end

    subgraph AsyncLayer ["非同步與背景排程 (BullMQ + Redis)"]
        DailySummaryJob["收盤資產損益報告 (每日定時)"]
        PriceAlertJob["盤中價格警示巡檢 (每分鐘)"]
        FxSyncJob["央行/全球匯率更新 (每小時)"]
        CacheWarmJob["熱門標的報價預熱"]
    end

    subgraph StorageLayer ["資料與快取層"]
        Postgres[("PostgreSQL 15+\n(交易、資產、用戶、自選)")]
        RedisDB[("Redis 7\n(行情快取、Session/Token、佇列)")]
    end

    subgraph ExternalServices ["外部第三方服務"]
        YahooAPI["Yahoo Finance API"]
        LineAPI["LINE Messaging & OAuth API"]
        FxAPI["匯率資料源 (Yahoo / 央行公開資料)"]
    end

    WebDesktop & WebMobile --> Nginx --> RateLimiter
    RateLimiter --> AuthSvc & TradeSvc & MarketSvc & AssetSvc & LineSvc

    AuthSvc & TradeSvc & AssetSvc --> Postgres
    MarketSvc <--> RedisDB
    AsyncLayer <--> RedisDB
    AsyncLayer --> Postgres

    MarketSvc --> YahooAPI
    AsyncLayer --> YahooAPI & FxAPI
    LineSvc & AsyncLayer --> LineAPI
    LineApp <--> LineAPI
```

### 2.2 專案組織形式 (Repository Structure)

建議採行 **分層結構**（可直接相容現有 Git 倉庫，無需破壞現有部署，未來亦可平滑切換至 pnpm workspaces / Turborepo）：

```
Stocktify/
├── src/                     # 現有前端 React SPA (持續迭代)
│   ├── components/          # UI 元件 (Charts, Tables, Modals, Layout)
│   ├── pages/               # 各功能頁面
│   ├── services/            # 前端 API 客戶端 (對接後端 /api/v1)
│   ├── store/               # Zustand 狀態 (支援樂觀更新與 API 雙向同步)
│   └── types/               # 前端型別
├── server/                  # 【新增】後端 Fastify 服務模組
│   ├── src/
│   │   ├── config/          # 環境變數與驗證 (env.ts)
│   │   ├── controllers/     # API 路由控制器 (auth, portfolio, market, etc.)
│   │   ├── services/        # 業務核心邏輯 (計算引擎、LINE 串接、行情抓取)
│   │   ├── models/          # 資料存取層 (Prisma Repository)
│   │   ├── jobs/            # BullMQ 背景排程與 Worker
│   │   ├── middlewares/     # JWT 鑑權、Rate-Limit、錯誤處理中介層
│   │   ├── utils/           # 計算公式 (加權平均、已實現損益、稅費)
│   │   └── index.ts         # Fastify App 啟動進入點
│   ├── prisma/
│   │   ├── schema.prisma    # PostgreSQL 實體模型
│   │   └── migrations/      # 資料庫遷移腳本
│   ├── package.json         # 後端獨立相依套件
│   ├── tsconfig.json        # 後端 TypeScript 設定
│   └── Dockerfile           # 後端容器構建檔
├── packages/shared/         # 【可選】前後端共用型別 (DTOs, Enums, Interfaces)
├── docker-compose.yml       # 【新增】本機/正式環境一鍵部署 (API, Postgres, Redis)
└── docs/                    # 專案技術規格書與文件
```

---

## 3. 後端核心架構與資料模型設計 (Backend Core & Database Schema)

### 3.1 技術選型評估

| 角色 | 技術選型 | 選擇理由與優勢 |
| :--- | :--- | :--- |
| **Runtime & Language** | **Node.js 20 LTS + TypeScript** | 前後端型別無縫共用；生態系成熟且具豐富金融數據解析庫。 |
| **Web Framework** | **Fastify 4 / 5** | 效能優於 Express 2~3 倍，內建高效 JSON Schema 序列化與驗證，外掛生態健全。 |
| **ORM / Query Builder**| **Prisma 5** | 型別安全、自動生成 Migration、Schema 可讀性極佳，適合個人投資組合複雜關聯。 |
| **關聯式資料庫** | **PostgreSQL 15+** | 支援精確數值型別 `numeric(20, 8)`、`citext`（大小寫不敏感信箱）、JSONB 與豐富複合索引。 |
| **快取與記憶體資料** | **Redis 7** | 儲存開盤高頻報價快取、Rate Limiter 計數、OAuth State 與 Refresh Token 雜湊。 |
| **非同步任務佇列** | **BullMQ** | 基於 Redis，支援分散式排程、重試機制 (Exponential Backoff)、延遲任務與失敗日誌。 |
| **安全加密** | **Argon2id + JWT** | 密碼儲存符合 OWASP 最高安全標準；JWT HS256/RS256 具備短效與黑名單撤回機制。 |

### 3.2 完整資料庫模型設計 (Prisma Schema)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// 1. 使用者主表
model User {
  id            String          @id @default(uuid()) @db.Uuid
  email         String          @unique
  passwordHash  String          @map("password_hash")
  name          String
  avatarUrl     String?         @map("avatar_url")
  currency      String          @default("TWD") // 偏好基準貨幣 (TWD / USD)
  taxRate       Decimal         @default(0.003) @map("tax_rate") @db.Decimal(6, 4) // 證交稅率
  feeDiscount   Decimal         @default(0.6)   @map("fee_discount") @db.Decimal(4, 2) // 券商手續費折讓 (如6折=0.6)
  createdAt     DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime        @updatedAt @map("updated_at") @db.Timestamptz(6)

  // 關聯
  transactions  Transaction[]
  assets        AssetSnapshot[]
  watchlist     WatchlistItem[]
  priceAlerts   PriceAlert[]
  refreshTokens RefreshToken[]
  lineBinding   LineBinding?
  linePrefs     LinePreference?
  logs          NotificationLog[]

  @@map("users")
}

// 2. Refresh Token 權杖管理表 (支援 Rotation 與安全作廢)
model RefreshToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash") // sha256(token)
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz(6)
  revokedAt  DateTime? @map("revoked_at") @db.Timestamptz(6)
  userAgent  String?   @map("user_agent")
  ip         String?   @db.VarChar(45)
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, expiresAt])
  @@map("refresh_tokens")
}

// 3. 交易紀錄表 (核心表：所有持股與成本以此推導)
model Transaction {
  id               String          @id @default(uuid()) @db.Uuid
  userId           String          @map("user_id") @db.Uuid
  symbol           String          @db.VarChar(16) // e.g. 2330.TW, AAPL
  type             TransactionType // BUY or SELL
  shares           Decimal         @db.Decimal(20, 8)
  price            Decimal         @db.Decimal(20, 8)
  fee              Decimal         @default(0) @db.Decimal(20, 8) // 手續費
  tax              Decimal         @default(0) @db.Decimal(20, 8) // 交易稅 (僅賣出)
  tradedAt         String          @map("traded_at") @db.VarChar(10) // YYYY-MM-DD
  note             String?         @db.Text
  realizedGainLoss Decimal?        @map("realized_gain_loss") @db.Decimal(20, 4) // 僅 SELL，伺服器計算
  clientId         String?         @map("client_id") // 冪等鍵 (避免重送)
  createdAt        DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime        @updatedAt @map("updated_at") @db.Timestamptz(6)

  user             User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, clientId])
  @@index([userId, tradedAt(sort: Desc)])
  @@index([userId, symbol, tradedAt])
  @@map("transactions")
}

enum TransactionType {
  BUY
  SELL
}

// 4. 資產淨值快照表 (多幣別與總資產趨勢)
model AssetSnapshot {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  date       String   @db.VarChar(10) // YYYY-MM-DD
  currency   String   @default("TWD") @db.VarChar(8) // TWD, USD, HKD, JPY, EUR
  cash       Decimal  @default(0) @db.Decimal(20, 4)
  securities Decimal  @default(0) @db.Decimal(20, 4)
  other      Decimal  @default(0) @db.Decimal(20, 4)
  note       String?  @db.Text
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date, currency])
  @@index([userId, date(sort: Desc)])
  @@map("asset_snapshots")
}

// 5. 自選追蹤清單表
model WatchlistItem {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  symbol    String   @db.VarChar(16)
  position  Int      @default(0) // 排序序號
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, symbol])
  @@index([userId, position])
  @@map("watchlist_items")
}

// 6. 價格警示條件表
model PriceAlert {
  id          String         @id @default(uuid()) @db.Uuid
  userId      String         @map("user_id") @db.Uuid
  symbol      String         @db.VarChar(16)
  direction   AlertDirection // ABOVE, BELOW, PCT_UP, PCT_DOWN
  threshold   Decimal        @db.Decimal(20, 4) // 目標價或百分比
  isActive    Boolean        @default(true) @map("is_active")
  lastFiredAt DateTime?      @map("last_fired_at") @db.Timestamptz(6)
  createdAt   DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)

  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([isActive, symbol])
  @@map("price_alerts")
}

enum AlertDirection {
  ABOVE
  BELOW
  PCT_UP
  PCT_DOWN
}

// 7. LINE 帳號綁定表
model LineBinding {
  userId          String   @id @map("user_id") @db.Uuid
  lineUserId      String   @unique @map("line_user_id")
  lineDisplayName String?  @map("line_display_name")
  boundAt         DateTime @default(now()) @map("bound_at") @db.Timestamptz(6)

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("line_bindings")
}

// 8. LINE 推播通知偏好設定表
model LinePreference {
  userId       String   @id @map("user_id") @db.Uuid
  priceAlert   Boolean  @default(true) @map("price_alert")
  dailySummary Boolean  @default(true) @map("daily_summary")
  tradeConfirm Boolean  @default(true) @map("trade_confirm")
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("line_preferences")
}

// 9. 推播紀錄審計表
model NotificationLog {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  channel   String   @default("LINE") @db.VarChar(16)
  kind      String   @db.VarChar(32) // daily_summary, price_alert, trade_confirm
  payload   Json     // 推播內容摘要
  status    String   @db.VarChar(16) // SENT, FAILED
  error     String?  @db.Text
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@map("notification_logs")
}
```

### 3.3 交易引擎結算與已實現損益演算法 (Accounting Engine)

#### 加權平均成本結算法則 (Weighted Average Cost Method)
1. **買進 (BUY)**：
   $$\text{新持有總股數} = S_{\text{prev}} + S_{\text{new}}$$
   $$\text{新加權平均單位成本} = \frac{(S_{\text{prev}} \times C_{\text{prev}}) + (S_{\text{new}} \times P_{\text{new}}) + \text{Fee}_{\text{new}}}{S_{\text{prev}} + S_{\text{new}}}$$
2. **賣出 (SELL)**：
   - 檢查 $S_{\text{prev}} \ge S_{\text{sell}}$，若不足則拋出 `422 SELL_EXCEEDS_HOLDING` 異常，拒絕寫入。
   - 賣出不改變單位平均成本：$C_{\text{after}} = C_{\text{prev}}$。
   - 計算此筆已實現損益：
     $$\text{RealizedGainLoss} = (P_{\text{sell}} - C_{\text{prev}}) \times S_{\text{sell}} - \text{Fee} - \text{Tax}$$
3. **歷史交易插單/修改重算鏈 (Re-calculation Chain)**：
   - 若使用者編輯或補記過去某日期的交易，系統啟動交易流水重算機制：按照 `tradedAt ASC, id ASC` 重新滾動計算該標的後續所有賣出交易之已實現損益與最新持股，保證帳務絕對精確。

---

## 4. RESTful API 規格設計 (API Specification)

- **Base URL**：`/api/v1`
- **資料格式**：全面採用 UTF-8 JSON 格式。
- **身分驗證**：請求 Header 攜帶 `Authorization: Bearer <accessToken>`；Refresh Token 透過安全 `HttpOnly Cookie` 傳遞。
- **統一錯誤響應結構**：
  ```json
  {
    "success": false,
    "error": {
      "code": "SELL_EXCEEDS_HOLDING",
      "message": "賣出股數（1,000）超過目前持股餘額（500）",
      "details": { "symbol": "2330.TW", "available": 500, "requested": 1000 }
    }
  }
  ```

### 4.1 認證與帳戶模組 (`/api/v1/auth`)

| HTTP | 路徑 | 說明 | 鑑權 | 請求 Payload / 說明 |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/auth/register` | 使用者註冊 | 否 | `{ email, password, name, currency? }` |
| `POST` | `/auth/login` | 使用者登入 | 否 | `{ email, password }`，回傳 `{ user, accessToken }` 並設定 `rt` Cookie |
| `POST` | `/auth/refresh` | 刷新 Access Token | 否 | 讀取 Cookie 驗證並實施 Token 輪換 |
| `POST` | `/auth/logout` | 登出帳號 | 是 | 作廢當前 Refresh Token 並清除 Cookie |
| `GET` | `/auth/me` | 取得當前 Session 資料 | 是 | 回傳用戶資訊、LINE 綁定狀態與推播偏好 |
| `PATCH`| `/auth/me` | 更新個人設定 | 是 | `{ name?, currency?, taxRate?, feeDiscount? }` |

### 4.2 交易與持股模組 (`/api/v1/transactions`)

| HTTP | 路徑 | 說明 | 鑑權 | 請求 Payload / 響應 |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/transactions` | 查詢交易清單 | 是 | Query: `?symbol=&type=&from=&to=&page=1&limit=50` |
| `POST` | `/transactions` | 新增單筆交易 | 是 | `{ symbol, type, shares, price, fee, tax?, tradedAt, note?, clientId? }`，回傳 `{ transaction, currentHolding }` |
| `PUT` | `/transactions/:id` | 修改既有交易 | 是 | 支援修改單價、股數、日期等，伺服器自動重新結算受影響之歷史持股損益 |
| `DELETE`| `/transactions/:id`| 刪除單筆交易 | 是 | 刪除並自動重算最新持股 |
| `POST` | `/transactions/batch` | 批次匯入交易 (CSV) | 是 | `{ items: TransactionInput[] }`，以單一資料庫 Transaction 交易保證原子性 |
| `GET` | `/transactions/holdings`| 取得即時試算持股 | 是 | 聚合全體持股 + 即時市價 + 損益試算，回傳 `PortfolioHolding[]` |

### 4.3 淨值資產模組 (`/api/v1/assets`)

| HTTP | 路徑 | 說明 | 鑑權 | 說明 |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/assets` | 淨值快照清單 | 是 | Query: `?from=&to=&currency=` |
| `POST` | `/assets` | 新增/覆寫淨值快照 | 是 | `{ date, currency, cash, securities, other, note? }` |
| `DELETE`| `/assets/:id` | 刪除淨值快照 | 是 | 依 ID 刪除 |
| `GET` | `/assets/timeseries` | 多幣別聚合淨值走勢 | 是 | Query: `?baseCurrency=TWD`，伺服器以即時匯率折算總淨值曲線 |

### 4.4 自選清單模組 (`/api/v1/watchlist`)

| HTTP | 路徑 | 說明 | 鑑權 | 說明 |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/watchlist` | 取得個人自選清單 | 是 | 自動由後端聚合最新即時報價，回傳清單 |
| `POST` | `/watchlist` | 加入自選股 | 是 | `{ symbol }` |
| `DELETE`| `/watchlist/:symbol` | 移除自選股 | 是 | 移除指定代碼 |
| `PUT` | `/watchlist/reorder` | 自選股批次重新排序 | 是 | `{ symbols: string[] }`，一次更新 position 順序 |

### 4.5 市場行情與代理模組 (`/api/v1/market`)

| HTTP | 路徑 | 說明 | 鑑權 | 快取策略 (Redis TTL) |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/market/quote` | 批次即時報價 | 否 | Query: `?symbols=AAPL,2330.TW`。開盤期間 20 秒，盤後 5 分鐘。 |
| `GET` | `/market/chart/:symbol`| K線圖與歷史走勢 | 否 | Query: `?resolution=1D`。日K快取 2 小時，盤中分K快取 1 分鐘。 |
| `GET` | `/market/search` | 股票代號模糊搜尋 | 否 | Query: `?q=2330`。快取 24 小時。 |
| `GET` | `/market/status` | 台股/美股即時開休市 | 否 | 即時計算目前交易時段、倒數收盤時間。 |

> **行情降級機制 (Stale-While-Revalidate)**：若 Yahoo Finance 遇到 HTTP 429 或網路超時，後端自動回傳 Redis 中最後一次成功報價，並標記 `stale: true`，確保前端介面永不中斷崩潰。

### 4.6 LINE 機器人與推播模組 (`/api/v1/line`)

| HTTP | 路徑 | 說明 | 鑑權 | 說明 |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/line/oauth/start` | 發起 LINE 綁定 | 是 | 產生防偽 `state` 寫入 Redis，回傳 LINE 官方授權導向網址 |
| `GET` | `/line/oauth/callback`| OAuth 授權回呼 | 否 | 交換 access_token、取得 LINE User ID 並綁定至帳戶，重導回前端 |
| `DELETE`| `/line/binding` | 解除 LINE 綁定 | 是 | 移除關聯並停止推播 |
| `GET` | `/line/prefs` | 取得推播偏好 | 是 | 查詢 `priceAlert`, `dailySummary`, `tradeConfirm` |
| `PUT` | `/line/prefs` | 更新推播偏好 | 是 | 更新設定 |
| `POST` | `/line/webhook` | LINE Webhook 接收點 | 否 | 驗證 `x-line-signature`，處理加入好友、使用者文字互動查價 |
| `POST` | `/line/test` | 發送測試推播 | 是 | 即時向已綁定之 LINE 發送一則測試訊息卡片 |

### 4.7 備份與資料遷移模組 (`/api/v1/backup`)

| HTTP | 路徑 | 說明 | 鑑權 | 說明 |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/backup/export` | 雲端全站資料匯出 | 是 | 產生標準 JSON 備份檔，包含交易、資產、自選與偏好 |
| `POST` | `/backup/import` | 備份檔匯入/雲端同步 | 是 | 支援從前端現有 `localStorage` JSON 備份檔一鍵導入資料庫 |

---

## 5. 背景排程與自動化推播系統 (Background Jobs & Automation)

基於 **BullMQ + Redis** 實現強健的排程佇列，具備自動重試與失敗日誌記錄：

```mermaid
sequenceDiagram
    autonumber
    participant Cron as 排程定時器 (Cron)
    participant Queue as BullMQ 佇列 (Redis)
    participant Worker as 背景 Worker
    participant DB as PostgreSQL
    participant Market as Yahoo / 匯率快取
    participant Line as LINE Messaging API

    Note over Cron,Queue: 每日 14:30 (台股) / 06:00 (美股)
    Cron->>Queue: 派發 daily-summary-job
    Queue->>Worker: 提取任務執行
    Worker->>DB: 撈取開啟 dailySummary 的綁定用戶
    Worker->>DB: 計算用戶持股部位與今日損益
    Worker->>Market: 取得即時最新收盤價
    Worker->>Line: 發送 Flex Message 圖文摘要卡片
    Worker->>DB: 寫入 notification_logs
```

### 5.1 核心 Job 規格

1. **`daily-summary` (每日收盤資產損益彙整)**
   - **觸發頻率**：台股 14:30 (Asia/Taipei)、美股 05:30/06:30 (冬/夏令)。
   - **邏輯**：篩選 `line_preferences.daily_summary = true` 的使用者，計算當日投組總市值、當日變動金額、各持股漲跌幅度，透過 LINE Flex Message 發送精美的收盤圖文日報。
2. **`price-alert-scanner` (盤中極端價格/停損停利巡檢)**
   - **觸發頻率**：開盤期間每 60 秒執行一次。
   - **邏輯**：巡檢所有啟用的 `price_alerts`，若目前股價觸發條件（突破壓力價、跌破支撐價或單日漲跌幅異常），即刻發送推播警示，並設有 30 分鐘冷卻期避免疲勞轟炸。
3. **`trade-confirm` (記帳成功即時推播)**
   - **觸發頻率**：當使用者呼叫 `POST /transactions` 成功後立即入隊。
   - **邏輯**：若用戶開啟 `tradeConfirm`，立即發送 LINE 記帳成功小卡（包含買賣別、標的、股數、成交均價與手續費）。
4. **`fx-refresh` (全球匯率定時同步)**
   - **觸發頻率**：每小時一次。
   - **邏輯**：同步 USD/TWD, HKD/TWD, JPY/TWD, EUR/TWD 等最新匯率至 Redis，提供資產多幣別即時換算。

---

## 6. 前端深度優化與對接規劃 (Frontend Optimization & Integration)

### 6.1 前端 API 客戶端架構 (`src/services/api.ts`)
建立統一的 Axios 執行個體，包含：
- **Base URL 自動切換**：開發環境走 Vite Proxy 或本機 `http://localhost:8080/api/v1`，生產環境走正式 API 網址。
- **JWT 攔截器**：主動於 Header 夾帶 Access Token。
- **無感自動刷新權杖 (Silent Refresh Interceptor)**：當後端回傳 401 Unauthorized 時，自動暫存請求隊列，向 `/api/v1/auth/refresh` 換發新 Token 後自動重放原有請求，使用者完全無感。

### 6.2 雙軌狀態儲存與本機遷移精靈 (Data Migration Wizard)
為確保平滑升級，不丟失使用者目前儲存在 `localStorage` 中的寶貴交易紀錄：
1. **未登入狀態**：持續相容純本機體驗（Guest 模式），資料照常讀寫 `localStorage`。
2. **首次登入/註冊偵測**：當用戶註冊或登入後，前端偵測本機若有尚未上傳的交易與淨值紀錄，主動彈出「**資料同步引導對話框**」：
   - 「偵測到您在本機有 25 筆交易記錄與 5 筆自選股，是否立即同步至您的雲端帳號？」
   - 點擊「立即同步」，一鍵呼叫 `POST /api/v1/backup/import` 將資料安全無失真遷移至 PostgreSQL 資料庫。
3. **雙向離線快取 (Optimistic UI)**：在網路斷線或弱網環境下，仍能透過 Zustand 快速呈現快取資料，連線恢復後自動重新對齊伺服器。

### 6.3 前端四大新功能擴充規劃

#### 功能 A：股息與被動收入管理模組 (Dividend Tracker)
- **現狀基礎**：前端已有 `src/lib/dividends.ts` 計算單一股票除息日實領金額。
- **完善規劃**：
  - 新增「**股息中心 (Dividends)**」專屬頁面或分頁。
  - **現金流日曆 (Dividend Calendar)**：以時間軸列出未來已公告除息日的預計入帳日期與預估金額。
  - **歷史累計被動收入 KPI**：統計自投資以來總領取股息、各年度現金股利長條圖。
  - **個人持股預估年化殖利率**：結合即時市值與近 12 個月每股配息，計算個人投組的真實持股殖利率 (Yield on Cost) 與當前市場殖利率。

#### 功能 B：進階投資組合風險與量化指標面板 (Risk & Performance Metrics)
在現有 `Overview.tsx` 基礎上進一步擴充專業量化指標：
- **夏普比率 (Sharpe Ratio)**：衡量承受每單位風險所得的超額回報。
- **最大回撤 (Maximum Drawdown, MDD)**：歷史淨值從高點回落之最大幅度與發生週期。
- **大盤相關係數 (Beta vs TAIEX / S&P500)**：計算個人投資組合相對於台股加權指數或標普500的波動敏感度。
- **勝率與盈虧比 (Win Rate & Profit Factor)**：已實現賣出交易的盈利比重與平均獲利/虧損比率。

#### 功能 C：台美股自訂手續費與稅務規則 (Tax & Fee Customization)
在 `DataSettings` 或使用者設定頁中新增交易費用自訂：
- **台股設定**：
  - 券商手續費折讓率（如預設 6 折、2.8 折等，基本費率 0.1425%）。
  - 單筆最低手續費（例如 20 元台幣或 1 元美股）。
  - 證券交易稅（股票 0.3%，現股當沖 0.15%，ETF 0.1%）。
- **美股設定**：
  - 每筆固定手續費（如 0 美元或手動設定）。
  - 股息預扣稅率（外籍人士預設 30%）。
- 快速記帳時，系統自動帶入精準預估手續費與稅金，免去手動計算麻煩。

#### 功能 D：PWA (Progressive Web App) 與行動端體驗升級
- 配置 `manifest.json` 與 Service Worker，支援 iOS「加入主畫面」與 Android 獨立應用程式模式。
- 專為手機瀏覽設計的底部固定導覽列 (Bottom Navigation Bar)，在小螢幕上提供如原生 App 般順暢的切換體驗。

---

## 7. 部署規劃與 DevOps (Deployment & Infrastructure)

### 7.1 本機開發與測試環境 (Docker Compose)
提供開箱即用的 `docker-compose.yml`，一鍵啟動資料庫與快取：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: stocktify-postgres
    restart: always
    environment:
      POSTGRES_USER: stocktify
      POSTGRES_PASSWORD: stocktify_password
      POSTGRES_DB: stocktify_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: stocktify-redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: stocktify-backend
    restart: always
    environment:
      PORT: 8080
      DATABASE_URL: postgres://stocktify:stocktify_password@postgres:5432/stocktify_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: super_secret_jwt_key_change_in_production
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis

volumes:
  pgdata:
  redisdata:
```

### 7.2 CI/CD 自動化流程 (GitHub Actions)
擴充現有 `.github/workflows/deploy.yml`：
1. **前後端單元測試與型別檢查**：每次 PR / Push 時自動執行 `npm test`、`tsc --noEmit`。
2. **前端持續部署**：持續部署靜態資源至 GitHub Pages 或 Cloudflare Pages。
3. **後端容器建置**：自動打包 Docker 映像檔至 GitHub Container Registry (GHCR) 或部署至 Render / Fly.io / GCP Cloud Run。

---

## 8. 實施階段與交付進度 (Implementation Milestones & Delivery Status)

```mermaid
gantt
    title Stocktify 全端優化與完善落地時程 (已全面交付 v1.0.0)
    dateFormat  YYYY-MM-DD
    section Phase 1: 基礎設施 (已完成)
    後端專案初始化與 Fastify 骨架       :done, a1, 2026-10-17, 1d
    PostgreSQL + Prisma 實體模型建立   :done, a2, 2026-10-17, 1d
    Docker Compose 與本機環境整備      :done, a3, 2026-10-17, 1d

    section Phase 2: 核心 API 與行情 (已完成)
    JWT 認證系統 (Argon2id + Refresh)   :done, b1, 2026-10-17, 1d
    行情代理與 Redis 多層快取服務       :done, b2, 2026-10-17, 1d
    前端 Axios API Client 與攔截器對接  :done, b3, 2026-10-17, 1d

    section Phase 3: 交易與資料雲端化 (已完成)
    交易記帳引擎與加權成本演算法       :done, c1, 2026-10-17, 1d
    淨值快照與多幣別折算 API           :done, c2, 2026-10-17, 1d
    前端 Zustand 與雲端雙向同步/遷移   :done, c3, 2026-10-17, 1d

    section Phase 4: LINE 與背景排程 (已完成)
    BullMQ 排程服務器架構              :done, d1, 2026-10-17, 1d
    LINE OAuth 2.0 綁定與 Webhook       :done, d2, 2026-10-17, 1d
    每日收盤日報與價格警示推播         :done, d3, 2026-10-17, 1d

    section Phase 5: 前端進階模組 (已完成)
    股息中心與現金流預測模組           :done, e1, 2026-10-17, 1d
    投組夏普值/MDD量化風險面板         :done, e2, 2026-10-17, 1d
    PWA 與行動端導覽優化               :done, e3, 2026-10-17, 1d

    section Phase 6: 驗收與發布 (已完成)
    全端整合測試與端對端驗證 (36/36 通過) :done, f1, 2026-10-17, 1d
    正式發布 v1.0.0                    :done, f2, 2026-10-17, 1d
```

### 8.1 當前版本 (v1.0.0) 交付項目總覽

| 階段 | 交付模組 | 實作成果 |
| :--- | :--- | :--- |
| **Phase 1** | 後端基礎設施 | Node.js 20 + Fastify 4 骨架、PostgreSQL 15 容器、Redis 7 容器、Prisma 5 ORM 實體模型 |
| **Phase 2** | 核心 API 與行情 | JWT (Access + Refresh Token)、Yahoo Finance 行情聚合 + Redis 分級快取、前端 API Client 攔截器 |
| **Phase 3** | 交易與雲端雙寫 | 加權平均成本與已實現損益計算引擎、已登入即時雙寫、斷網自動降級至 localStorage、登入雙向同步 |
| **Phase 4** | 自動排程與推播 | BullMQ 排程 Worker、LINE 官方帳號 Flex 推播、Discord/Telegram Webhook 免費推播、盤中價格警示巡檢 |
| **Phase 5** | 前端進階投資模組 | 股息與現金流中心 (`/dividends`)、績效與量化風險面板 (`/analytics`)、PWA 原生安裝體驗 |
| **Phase 6** | 驗收與正式發布 | 36 項前後端單元測試 100% 綠燈、前後端零錯誤建置、`docker-compose.yml` 全棧編排、釋出 `v1.0.0` |

---

## 9. 決策議題與待確認事項 (Key Discussion Points & Open Questions)

1. **專案程式碼組織**：採根目錄前端 + `server/` 資料夾全端架構（已實作完成）。
2. **後端框架**：Fastify 4 + TypeScript + Prisma + Redis + BullMQ（已實作完成）。
3. **雲端後端部署**：已提供 `server/Dockerfile` 多階段映像檔與 `docker-compose.yml`，可一鍵部署至 VPS (Hetzner / DigitalOcean) 或 PaaS (Render / Fly.io / GCP Cloud Run)。

---

## 10. 維運基礎建設與營運成本評估摘要 (Cost & Infrastructure Summary)

完整深入之成本試算報告已獨立成篇：[docs/infrastructure-cost-assessment.md](infrastructure-cost-assessment.md)。

---

## 11. 進階高價值功能擴充規劃 (Phase 7: Advanced Expansion Roadmap)

為了進一步將 Stocktify 打造成個人投資者不可或缺的終極武器，規劃以下五大高價值進階模組，列入後續迭代發展計畫：

### 11.1 🎯 FIRE 財務自由倒數與被動收入生活覆蓋儀表板 (FIRE Calculator & Goal Tracker)
* **目標生活開銷設定**：輸入年支出（例如 60 萬元/年）或目標月被動收入（5 萬元/月）。
* **被動收入開銷覆蓋率**：依據目前投資組合預估年化股息，實時計算生活支出覆蓋百分比（如 `46.8%`）。
* **4% 提領法則複利模擬**：依目前資產規模、年化報酬率與定期定額投入額，動態推算預計達成 FIRE 退休年份與倒數計時器。

### 11.2 ⚖️ 目標資產配置與一鍵自動再平衡計算器 (Portfolio Rebalancer)
* **目標資產配置模型**：自訂各標的目標權重（如 VTI 40%、QQQ 20%、0050 20%、BND 10%、現金 10%）。
* **偏離度監控**：自動標記超配（Overweight）與低配（Underweight）標的。
* **新資金加碼最優化算單**：輸入新資金（例如 $50,000 元），系統自動算出「各檔股票分別應買入幾股」，最有效率使投組回歸平衡。

### 11.3 🏦 主流券商對帳單一鍵智慧匯入 (Broker Format Presets)
* **台灣本土券商轉接**：
  * 元大證券 (投資先生 / YesWin 匯出 CSV)
  * 國泰世華證券 (樹精靈成交對帳單)
  * 富邦證券 (e 點通)
  * 永豐金證券 (大戶投 / 豐存股)
* **海外美股券商轉接**：
  * Firstrade (第一證券活動報告)
  * Interactive Brokers (盈透證券 IBKR Activity Statement)
  * Charles Schwab (嘉信對帳單)
* 系統自動識別檔案標頭、轉譯幣別與日期格式，一鍵導入交易歷史。

### 11.4 📑 專業投資績效月報 / 對帳單 PDF 一鍵匯出 (Executive Monthly Report PDF Export)
* **月度/年度投資總結報告**：一鍵產生高質感排版之 A4 PDF 報告。
* **內容涵蓋**：
  * 當月資產淨值成長曲線與總損益。
  * 持股明細與資產類別圓餅圖。
  * 當月股息現金流進帳與入帳日曆。
  * 夏普值、最大回撤等量化風險指標摘要。
* 提供淺色/深色紙本友善列印格式，便於個人記帳存檔或家庭財務討論。

### 11.5 🤖 投資組合體質健檢與資產相關性熱力矩陣 (Correlation Heatmap & Portfolio Health Diagnostics)
* **資產相關係數熱力圖 (Correlation Heatmap)**：
  * 計算所有持股過去一年每日收益率之相關係數（-1.0 ~ +1.0）。
  * 識別持股間是否過度高度正相關（缺乏實質風險分散效果）。
* **體質警示與健康評分 (Health Score)**：
  * 單一持股過度曝險警示（> 25%）。
  * 殖利率陷阱警示（殖利率高但股價破底、資本虧損侵蝕本金）。
  * 綜合投資組合健康度評分（0 ~ 100 分）。

---
> 規格書修訂完畢。版本已推進至 `v1.0.0` 正式版。


