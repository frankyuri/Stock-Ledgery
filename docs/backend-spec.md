# Stocktify Backend Specification v1

> 文件版本：2026-04-26 ・ 對應前端版本：`stock-ledgery@0.4.0`
> 本規格描述後端從零建置時所需的資料模型、API、安全策略、通知排程與部署規劃，目標是承接目前純前端 + Yahoo Finance proxy 的 Stocktify。

---

## 1. 背景與範圍

目前前端狀態完全存在 `localStorage` + `Zustand`，行情走 Vite dev proxy → `query1.finance.yahoo.com`（[workers/yahoo-proxy.js](../workers/yahoo-proxy.js) 是同樣邏輯的生產替代）。後端要承接：

- 使用者帳號（取代 [src/store/useAuthStore.ts](../src/store/useAuthStore.ts) 的 `loginMock`/`registerMock`）
- 個人持股紀錄（交易與資產快照，目前在 [src/store/useStockStore.ts](../src/store/useStockStore.ts)）
- 關注清單（watchlist）與顯示偏好
- LINE 綁定 + 通知偏好（[src/pages/LineSettings.tsx](../src/pages/LineSettings.tsx)）
- 行情代理（quote / chart / search）與 server-side cache
- 通知排程（每日摘要、價格警示、交易確認）
- 備份匯出 / 匯入（[src/pages/DataSettings.tsx](../src/pages/DataSettings.tsx)）

公開頁面（Dashboard、StockDetail）不需登入也能看，所以 `/market/*` 是匿名可用；其他 `user-owned` 資源都需要 JWT。

### 非目標（v1 不做）
- 跨裝置即時同步（PWA / WebSocket）
- 多帳號子帳戶（家庭共享）
- 自動撈券商對帳單
- 多語系 i18n（沿用前端現況：zh-TW）

---

## 2. 技術棧

| 範疇 | 選型 | 備註 |
|---|---|---|
| Runtime | Node.js 20 + TypeScript | 與前端共用型別 |
| Web framework | Fastify 4 | 輕量、JSON schema 內建 |
| ORM | Prisma 5 | migration、type-safe client |
| DB | PostgreSQL 15 | `citext`、`numeric` 處理金額 |
| Cache / Rate limit | Redis 7 | quote cache、`@fastify/rate-limit` |
| Background jobs | BullMQ | 通知 / 巡檢 |
| Auth | JWT (access 15m) + Refresh token cookie (30d) | argon2id |
| 行情上游 | Yahoo Finance | 沿用，後端統一抓並 cache |
| 部署 | Fly.io / Render / Cloud Run | Postgres + Redis 同 region |
| 觀測 | pino + OpenTelemetry → Grafana / Honeycomb | 後續再接 |

---

## 3. 資料模型

通用慣例：

- 主鍵 `id uuid` 預設 `gen_random_uuid()`（啟用 `pgcrypto`）。
- 時間欄位 `created_at` / `updated_at` 一律 `timestamptz`，由 trigger 自動更新。
- 金額一律 `numeric(20,8)`（股數同），`numeric(20,4)` 用於資產快照（金額單位較大）。
- 所有 user-owned 表帶 `user_id uuid not null` + `(user_id, …)` 複合索引；外鍵 `on delete cascade`。
- `symbol` 規則：大寫、符合 `^[A-Z0-9.\-^]{1,12}$`，以伺服器端 normalize。
- `traded_at` / `date` 使用 `date` 型別（沿用前端 `'YYYY-MM-DD'` 字串格式）。

### 3.1 `users`
```sql
id              uuid PK
email           citext unique not null
password_hash   text not null            -- argon2id
name            text not null
avatar_url      text
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
```

### 3.2 `line_bindings`
1-1 對 `users`，分表方便撤銷與審計。
```sql
user_id              uuid PK FK -> users(id) on delete cascade
line_user_id         text unique not null
line_display_name    text
bound_at             timestamptz not null default now()
```

### 3.3 `line_prefs`
```sql
user_id          uuid PK FK -> users(id) on delete cascade
price_alert      boolean not null default true
daily_summary    boolean not null default true
trade_confirm    boolean not null default true
updated_at       timestamptz not null default now()
```

### 3.4 `watchlist_items`
```sql
id          uuid PK
user_id     uuid FK -> users(id) on delete cascade
symbol      text not null
position    int  not null default 0
created_at  timestamptz not null default now()
unique (user_id, symbol)
index (user_id, position)
```

### 3.5 `transactions`（核心表）
持股 (`holdings`) 不另建表 — 它是 `transactions` 的純函數，避免雙寫不一致。伺服器以 view 或記憶體計算（搬 [src/store/useStockStore.ts:84](../src/store/useStockStore.ts#L84) `reconcileHoldings` 的邏輯）。

```sql
id                    uuid PK
user_id               uuid FK -> users(id) on delete cascade
symbol                text not null
type                  text not null check (type in ('BUY','SELL'))
shares                numeric(20,8) not null check (shares > 0)
price                 numeric(20,8) not null check (price > 0)
fee                   numeric(20,8) not null default 0 check (fee >= 0)
traded_at             date not null
note                  text
realized_gain_loss    numeric(20,4)              -- 僅 SELL，伺服器端計算
client_id             text                       -- idempotency key
created_at            timestamptz not null default now()
unique (user_id, client_id) where client_id is not null
index (user_id, traded_at desc)
index (user_id, symbol, traded_at)
```

**對帳邏輯（伺服器端必走）**

1. 接到 `POST /transactions` 後，按 `traded_at` 排序所有歷史 + 當前一筆計算 holdings。
2. SELL：若 `prev.shares < pending.shares` → `422 SELL_EXCEEDS_HOLDING`。
3. SELL 的 `realized_gain_loss = (price - avgCostBeforeThisSell) * shares - fee`，四捨五入至小數第 4 位。
4. 寫入後回傳 `{ transaction, holdings }`，holdings 為最新陣列。

### 3.6 `asset_snapshots`
```sql
id              uuid PK
user_id         uuid FK -> users(id) on delete cascade
date            date not null
currency        text not null            -- 'TWD','USD','HKD','JPY','EUR'
cash            numeric(20,4) not null default 0
securities      numeric(20,4) not null default 0
other           numeric(20,4) not null default 0
note            text
created_at      timestamptz not null default now()
unique (user_id, date, currency)
index (user_id, date desc)
```

### 3.7 `price_alerts`（v1.1 之後可分階段上線）
```sql
id            uuid PK
user_id       uuid FK -> users(id) on delete cascade
symbol        text not null
direction     text not null check (direction in ('ABOVE','BELOW'))
threshold     numeric(20,4) not null
active        boolean not null default true
last_fired_at timestamptz
created_at    timestamptz not null default now()
index (active, symbol)
```

### 3.8 `notification_logs`
```sql
id          uuid PK
user_id     uuid FK -> users(id) on delete cascade
channel     text not null              -- 'line'
kind        text not null              -- 'price_alert' | 'daily_summary' | 'trade_confirm'
payload     jsonb not null
status      text not null              -- 'sent' | 'failed'
error       text
created_at  timestamptz not null default now()
index (user_id, created_at desc)
```

### 3.9 `refresh_tokens`
```sql
id          uuid PK
user_id     uuid FK -> users(id) on delete cascade
token_hash  text unique not null       -- sha256(token)
expires_at  timestamptz not null
revoked_at  timestamptz
user_agent  text
ip          inet
created_at  timestamptz not null default now()
```

### 3.10 Redis keys（不入 DB）
| Key | 內容 | TTL |
|---|---|---|
| `quote:{symbol}` | 序列化 `Quote` JSON | 開盤 30s / 收盤 5m |
| `chart:{symbol}:{resolution}` | 序列化 `ChartBundle` | 開盤 60s / 收盤 5m |
| `rate:auth:login:{ip}` | 計數 | 60s |
| `rate:market:{ip}` | 計數 | 60s |
| `oauth:line:state:{state}` | `{ userId }` | 5m |

---

## 4. API 規格

- Base URL：`/api/v1`
- 全部 JSON in/out（除 LINE webhook）。
- 統一錯誤格式：
  ```json
  { "error": { "code": "SELL_EXCEEDS_HOLDING", "message": "賣出股數超過持有", "details": {} } }
  ```
- 認證：`Authorization: Bearer <accessToken>`；refresh token 走 httpOnly cookie。
- 寫入支援 `Idempotency-Key` header → 寫入 `transactions.client_id`。

### 4.1 Auth — `/auth`

| Method | Path | Body | 200 / 201 回應 | 錯誤 |
|---|---|---|---|---|
| POST | `/auth/register` | `{ email, password, name }` | `{ user, accessToken }` + Set-Cookie `rt` | `409 EMAIL_TAKEN`, `422` |
| POST | `/auth/login` | `{ email, password }` | 同上 | `401 INVALID_CREDENTIALS` |
| POST | `/auth/refresh` | (cookie `rt`) | `{ accessToken }` | `401 REFRESH_REVOKED` |
| POST | `/auth/logout` | — | `204` | — |
| GET  | `/auth/me` | — | `{ user, lineBinding?, linePrefs }` | `401` |
| PATCH | `/auth/me` | `{ name?, avatarUrl? }` | `{ user }` | `422` |

`user` 形狀對齊前端 `AuthUser`（[src/store/useAuthStore.ts:4](../src/store/useAuthStore.ts#L4)）：
```ts
{ id, email, name, avatarUrl?, lineUserId?, lineDisplayName?, lineBoundAt? }
```

### 4.2 LINE — `/line`

| Method | Path | 用途 |
|---|---|---|
| GET  | `/line/oauth/start` | 產生 `state` 寫入 Redis、回 `{ authorizeUrl }` 供前端導頁 |
| GET  | `/line/oauth/callback?code&state` | 後端換 token、寫 `line_bindings`，redirect 回 `/settings/line?bound=1` |
| DELETE | `/line/binding` | 解除綁定 |
| GET  | `/line/prefs` | 取得 `LinePrefs` |
| PUT  | `/line/prefs` | `{ priceAlert, dailySummary, tradeConfirm }` |
| POST | `/line/webhook` | LINE Messaging API webhook（驗 `x-line-signature`） |
| POST | `/line/test` | 對自己寄一則測試訊息（debug 用） |

### 4.3 Watchlist — `/watchlist`

| Method | Path | Body | 回應 |
|---|---|---|---|
| GET  | `/watchlist` | — | `{ items: [{ id, symbol, position, quote }] }`，`quote` 已 server-side join 自 `/market/quote` |
| POST | `/watchlist` | `{ symbol }` | `{ item }`，`409 SYMBOL_EXISTS` |
| DELETE | `/watchlist/:symbol` | — | `204` |
| PUT  | `/watchlist/order` | `{ symbols: string[] }` | 一次重排，回 `{ items }` |

### 4.4 Transactions — `/transactions`

| Method | Path | Body / Query | 回應 |
|---|---|---|---|
| GET  | `/transactions` | `?symbol=&from=&to=&page=1&pageSize=50` | `{ items, page, pageSize, total }` |
| POST | `/transactions` | `{ symbol, type, shares, price, fee, tradedAt, note?, clientId? }` | `{ transaction, holdings }` |
| DELETE | `/transactions/:id` | — | `{ holdings }` |
| GET  | `/transactions/holdings` | — | `{ holdings: PortfolioHolding[], failed: string[], stale: bool }` — 對應前端 `fetchPortfolio` 結果（[src/services/stocks.ts:82](../src/services/stocks.ts#L82)） |

**錯誤碼**：`422 INVALID_AMOUNT`、`422 SELL_EXCEEDS_HOLDING`、`404 TRANSACTION_NOT_FOUND`、`409 IDEMPOTENT_REPLAY`（同 client_id 已存在則回原資源）。

### 4.5 Asset Snapshots — `/assets`

| Method | Path | Body / Query |
|---|---|---|
| GET  | `/assets?from=&to=` | — |
| POST | `/assets` | `{ date, currency, cash, securities, other, note? }`，`409` 同 `(date, currency)` |
| DELETE | `/assets/:id` | — |
| GET  | `/assets/timeseries?baseCurrency=TWD` | 後端做 FX 轉換並聚合，回 `{ points: [{ date, total, cash, securities, other }] }` |

> FX 來源：後端定期抓中央銀行/Yahoo 匯率、寫入 Redis；轉換邏輯比照前端 [src/lib/fx.ts](../src/lib/fx.ts)。

### 4.6 Market data（公開）— `/market`

| Method | Path | 用途 |
|---|---|---|
| GET | `/market/quote?symbols=AAPL,MSFT,2330.TW` | batch 抓 quote，回 `{ quotes: Quote[], failed: string[] }`（沿用前端 `Quote` 形狀） |
| GET | `/market/chart/:symbol?resolution=1D` | 回 `ChartBundle = { candles, quote, dividends, splits }` |
| GET | `/market/search?q=2330` | 回 `SearchResult[]`（過濾 `EQUITY`/`ETF`/`INDEX`） |

實作：對應 [src/services/yahoo.ts](../src/services/yahoo.ts) 的三個 function 搬到後端，外面包 Redis cache + 失敗 fallback（最後一次成功的 payload，標 `stale: true`）。

### 4.7 Backup — `/backup`

| Method | Path | 用途 |
|---|---|---|
| GET  | `/backup/export` | 回傳 `BackupSnapshot`（與 [src/store/useStockStore.ts:60](../src/store/useStockStore.ts#L60) 形狀一致） |
| POST | `/backup/import` | body 為 `BackupSnapshot`，伺服器 transactional 覆寫該 user 的 `watchlist / transactions / assets / line_prefs`；前回回傳新 holdings |

---

## 5. 通知 / 背景 Job

| Job | 觸發 | 說明 |
|---|---|---|
| `daily-summary` | 每日 21:00 (Asia/Taipei) cron | 對 `linePrefs.daily_summary = true` 的用戶計算當日 P&L 後推 LINE |
| `price-alert-scan` | 開盤期間每 60s | 拉 `price_alerts.active = true`，跨閾值觸發推播 + 寫 `last_fired_at`（最少間隔 30 分鐘防抖） |
| `trade-confirm` | `POST /transactions` 成功後入隊 | `linePrefs.trade_confirm = true` 才推 |
| `quote-warm` | 開盤每 30s | 對「全體 watchlist + 持股」symbol set 預熱 cache |
| `fx-refresh` | 每小時 | 抓主要貨幣對 TWD 匯率寫 Redis |

所有推播完成後寫 `notification_logs`，方便排查與重送。

---

## 6. 安全策略

- 密碼：argon2id（`memoryCost ≥ 19 MiB`、`timeCost ≥ 2`）。
- Refresh token：產生時即 hash 入庫，rotate-on-use（每次刷新作廢舊的）。
- Access token：JWT HS256，secret 從環境變數注入，15 分鐘。
- In-row authorization：所有 user-owned query 強制 `where user_id = req.user.id`，由 repository 統一夾帶。
- LINE webhook：驗 `x-line-signature = base64(HmacSHA256(channelSecret, rawBody))`，否則 `403`。
- Symbol 白名單：寫入前 `/^[A-Z0-9.\-^]{1,12}$/`，否則 `422 INVALID_SYMBOL`。
- Rate limit（`@fastify/rate-limit` + Redis）：
  - `/auth/login`、`/auth/register`：10 rpm / IP
  - `/market/*`：60 rpm / IP（匿名）、300 rpm / user（已登入）
- CORS：白名單 `https://app.stocktify.*` 與 dev origin。
- 機密設定：DB URL、JWT secret、LINE channel secret/access token、Yahoo proxy 金鑰，全部走 env / secret manager。

---

## 7. 環境變數

```
NODE_ENV=production
PORT=8080
DATABASE_URL=postgres://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=2592000
COOKIE_DOMAIN=.stocktify.app
LINE_CHANNEL_ID=...
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_OAUTH_REDIRECT_URI=https://api.stocktify.app/api/v1/line/oauth/callback
YAHOO_BASE_URL=https://query1.finance.yahoo.com
YAHOO_USER_AGENT=Mozilla/5.0 ...
CORS_ORIGINS=https://app.stocktify.app,http://localhost:5173
```

---

## 8. 對前端的搬遷計畫

> 以下順序確保任何時點 app 都能跑：先做行情、再做 auth、最後切持股寫入。

1. **Stage 1 — Market proxy**
   實作 `/market/*` 並佈署。前端 `VITE_YAHOO_PROXY_URL` 改指向後端，[src/services/yahoo.ts](../src/services/yahoo.ts) 完全不改。
2. **Stage 2 — Auth**
   實作 `/auth/*`。前端 [useAuthStore.ts](../src/store/useAuthStore.ts) 把 `loginMock` / `registerMock` 換成真 API call（介面已是相容形狀），多一個 `bootstrap()` 走 `GET /auth/me` 還原 session。
3. **Stage 3 — User data**
   實作 `/transactions /assets /watchlist`。`useStockStore` 改成「後端為 source of truth + localStorage 為離線快取」：
   - 啟動時 `GET /transactions /assets /watchlist` → hydrate
   - 寫入時樂觀更新 + `POST`，失敗回滾並 toast
   - reconcile 改在 server 側做，client 端改吃 `holdings` from response
4. **Stage 4 — LINE**
   實作 `/line/*` + webhook，把 [LineSettings.tsx](../src/pages/LineSettings.tsx) 的 mock 拿掉，按鈕走 `GET /line/oauth/start` redirect。
5. **Stage 5 — Backup + Jobs**
   `/backup/*` 上線後，前端 [DataSettings.tsx](../src/pages/DataSettings.tsx) 多一個「上傳到雲端 / 從雲端還原」按鈕；同時上線 daily-summary / price-alert / trade-confirm。

---

## 9. 開放議題（待決策）

- 行情上游是否要從 Yahoo 換成付費 API（FinMind / Alpha Vantage / IEX）？商用條款 + 速率是現況最大風險。
- `holdings` 是否要 materialized view + trigger 維護？資料量 < 1k/user 時不需要，先跑純 query。
- 是否提供「分享只讀 portfolio 連結」？v1 不做，但 schema 可預留 `share_tokens`。
- LINE 之外是否要 Email / Web Push？v1 只做 LINE。
