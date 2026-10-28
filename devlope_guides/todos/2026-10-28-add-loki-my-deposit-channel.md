# 新增 Loki MY Deposit Channel

## 文件定位

- 文件等級：完整開發設計書。
- 判定理由：本次新增 Deposit channel、上游 payload preset、channel mapping 與前端顯示名稱，符合專案對 channel／payload 變更的完整設計書門檻。
- 狀態：需求已確認並進入實作。
- 主要規範：[AGENTS.md](../../AGENTS.md)。

## 目標與非目標

目標：

1. 新增內部 channel key `loki-intercard-usd`。
2. 在前端以 `loki-MY` 顯示，標示馬來西亞面向的通道。
3. 提供以下預設資料：
   - `productNo`: `DEP-LOKI-INTERCARDMY-USD`
   - `amount`: `10.00`
   - `currencyCode`: `USD`
   - `payment_order.collect.shopper_email`: `test@example.com`
4. 沿用現有 `normal` merchant token，不新增 secret 或環境變數。
5. 由既有 domain/service 流程產生 `merchant_ref`，不把使用者提供的範例值持久化。

非目標：

- 不新增 API route、React route、外部 SDK 或新的 token 類型。
- 不改寫既有 deposit channel 的 payload 或驗證規則。
- 不把 `return_url` 改成 channel-specific 設定；目前它由 `data/deposit/common.json` 的 feature-level common preset 管理，本次沿用既有共用值，避免新增單一通道時改變所有 deposit 通道的行為。

## 設計結論

沿用既有新增 channel 的四層 wiring：

1. `src/core/env.ts` 註冊 channel 與 `MerchantTokenKey.Normal` mapping。
2. `src/deposit/presets.ts` 以既有 field helpers 建立 `payment_order.collect.shopper_email` schema 與 seed fallback。
3. `data/deposit/channels/loki-intercard-usd.json` 保存 channel-level common values、schema 與 payload values。
4. `src/domains/deposit.ts` 增加 legacy CLI template，讓 CLI 與 web builder 都能組裝同一組產品預設。
5. `web/pages/helper/depositChannelLabels.ts` 將內部 channel 映射為 `loki-MY`。

資料流沿用既有順序：

```text
data/deposit/common.json
        + data/deposit/channels/loki-intercard-usd.json
        + 操作時的 common/channel values
        -> schema/defaults/validation
        -> createStructuredDepositPayload
        -> merchant_ref 由 makeId 產生並簽名
```

`return_url` 仍由 feature-level common preset／既有環境 fallback 提供；本次輸入中的 URL 視為 request 範例，不新增 channel-level 覆寫能力。

## 公開契約與不變事項

- `GET /api/deposit/defaults?channel=loki-intercard-usd` 回傳新 channel、預設表單與 required `shopper_email` schema。
- `POST /api/deposit/preview` 與既有 create 流程沿用相同 payload builder、簽名欄位與 normal merchant token。
- outbound payload 的 `merchant_ref` 由 domain 產生，不使用 preset 內的固定範例值。
- 既有 channel、route path、error envelope、target environment 行為不變。

## 測試策略與 Risk → Test → Test layer

| Risk | Test | Test layer |
| --- | --- | --- |
| channel 沒有註冊、seed 預設值或 payload mapping 錯誤 | 驗證 Loki channel preset 與 generated request 的 product、amount、currency、shopper email、normal token | domain/preset |
| API defaults 無法讀取新 data fixture 或 required schema 遺失 | `GET /api/deposit/defaults?channel=loki-intercard-usd` 邊界測試 | API route |
| 前端顯示名稱與後端 channel 值混淆 | 在既有 channel label 測試加入 `loki-MY` 映射斷言 | frontend helper/page |
| preset audit 未涵蓋新 JSON | 更新 audit 期待數量並執行 preset audit | preset audit |

## 驗證 gate

依 `AGENTS.md`，本次涉及 backend domain、preset、API route 與 frontend display label，完成後執行：

- `bun run test:api`
- `bun run test:web`
- `tsc --noEmit`
- `bun run build:api`
- `bun run build:web`
- `bun run structure`

未新增環境變數與資料庫 migration；若上游要求 channel-specific `return_url`，需另立設計變更，不能直接把單一 channel 值寫入共用 `common.json`。
