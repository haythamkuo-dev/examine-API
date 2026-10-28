# 新增 Loki SG Deposit Channel

## 文件定位

- 文件等級：完整開發設計書。
- 判定理由：本次新增 Deposit channel、payload preset、token mapping 與前端顯示名稱。
- 狀態：需求已確認並進入實作。
- 主要規範：[AGENTS.md](../../AGENTS.md)。

## 設計結論

新增內部 channel key `loki-intercard-sg-usd`，前端顯示名稱為 `loki-SG`，並沿用 Loki MY 已建立的 email collect schema：

- `productNo`: `DEP-LOKI-INTERCARDSG-USD`
- `amount`: `10.00`
- `currencyCode`: `USD`
- `payment_order.collect.shopper_email`: `test@example.com`，必填
- merchant token：沿用 `MerchantTokenKey.Normal`
- `merchant_ref`：由既有 domain/service 流程產生，不持久化範例值

變更落點：

- `src/core/env.ts`：註冊 channel 與 normal token mapping。
- `src/deposit/presets.ts`：沿用既有 `EMAIL_COLLECT_SCHEMA` 與 seed fallback。
- `data/deposit/channels/loki-intercard-sg-usd.json`：保存 channel preset。
- `src/domains/deposit.ts`：增加 CLI／legacy request template。
- `web/pages/helper/depositChannelLabels.ts`：映射 `loki-SG`。

`return_url` 目前是 feature-level common preset，不新增 channel-specific 覆寫，避免改變所有既有 deposit 通道。

## Risk → Test → Test layer

| Risk | Test | Test layer |
| --- | --- | --- |
| channel、preset 或 normal token mapping 錯誤 | 驗證 SG defaults 與 generated request payload | domain/preset |
| API 無法讀取新 fixture 或 schema 遺失 | `GET /api/deposit/defaults?channel=loki-intercard-sg-usd` | API route |
| 前端 label 不正確 | 既有 deposit channel label 測試加入 `loki-SG` | frontend helper/page |
| preset audit 未涵蓋新 JSON | 更新 audit 期待數量並執行 audit | preset audit |

## 驗證 gate

依 `AGENTS.md` 執行 `bun run test:api`、`bun run test:web`、`tsc --noEmit`、`bun run build:api`、`bun run build:web` 與 `bun run structure`。
