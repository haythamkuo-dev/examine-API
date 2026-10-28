# 新增 Loki PH Deposit Channel

## 文件定位

- 文件等級：完整開發設計書。
- 判定理由：本次新增 Deposit channel、payload preset、token mapping 與前端顯示名稱。
- 狀態：沿用已確認的 Loki email collect channel 設計並進入實作。
- 主要規範：[AGENTS.md](../../AGENTS.md)。

## 設計結論

新增內部 channel key `loki-intercard-ph-usd`，前端顯示名稱為 `loki-PH`：

- `productNo`: `DEP-LOKI-INTERCARDPH-USD`
- `amount`: `10.00`
- `currencyCode`: `USD`
- `payment_order.collect.shopper_email`: `test@example.com`，必填
- merchant token：沿用 `MerchantTokenKey.Normal`
- `merchant_ref`：由既有 domain/service 流程產生，不持久化範例值

沿用 `src/deposit/presets.ts` 的 `EMAIL_COLLECT_SCHEMA`、既有 preset merge、domain request builder 與前端 label mapping 流程；不新增 route、環境變數或外部依賴。`return_url` 仍由 feature-level common preset 提供，不新增 channel-specific 覆寫。

## Risk → Test → Test layer

| Risk | Test | Test layer |
| --- | --- | --- |
| channel、preset 或 normal token mapping 錯誤 | 驗證 PH defaults 與 generated request payload | domain/preset |
| API 無法讀取新 fixture 或 schema 遺失 | `GET /api/deposit/defaults?channel=loki-intercard-ph-usd` | API route |
| 前端 label 不正確 | 既有 deposit channel label 測試加入 `loki-PH` | frontend helper/page |
| preset audit 未涵蓋新 JSON | 更新 audit 期待數量並執行 audit | preset audit |

## 驗證 gate

依 `AGENTS.md` 執行 `bun run test:api`、`bun run test:web`、`tsc --noEmit`、`bun run build:api`、`bun run build:web` 與 `bun run structure`。
