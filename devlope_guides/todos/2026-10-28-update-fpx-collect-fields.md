# 調整 FuturePay FPX USD Collect 欄位

## 文件定位

- 文件等級：完整開發設計書。
- 判定理由：本次改變既有 Deposit channel 的 payload、JSON preset schema 與表單欄位，並影響 domain/CLI、API defaults/preview 及前端表單資料流。
- 狀態：需求已由使用者確認並進入實作。
- 主要規範：[AGENTS.md](../../AGENTS.md)。

## 已知事實、目標與非目標

既有 channel `my_fpx_usd` 對應產品 `DEP-FUTUREPAY_COLLECT-FPX-USD`，目前錯誤地沿用 DuitNow 的 `collect` 三欄 schema。本次要讓 FPX 的 `payment_order.collect` 帶有以下完整資料：

```json
{
  "product_name": "Test",
  "origin": "https://tangchaoshop.com/fail",
  "shopper_reference": "1",
  "shopper_email": "test@example.com",
  "telephone_number": "+60123456789"
}
```

目標：

1. FPX 表單 schema 顯示並要求上述五個欄位。
2. defaults、preview、CLI request 與持久化 preset 使用相同的 FPX 預設值。
3. FPX 維持既有 `my_fpx_usd` channel、產品編號、USD 金額、merchant reference 產生流程與 normal merchant token。

非目標：

- 不修改 `duitnowqr_usd` 或其他 channel 的 schema/值。
- 不新增 API route、React route、token、環境變數或資料庫結構。
- 不把使用者提供的 return URL 寫入 feature-level `data/deposit/common.json`；該欄位目前由共用 deposit preset 管理，本次沿用既有共用值。
- 不把固定 merchant reference 寫入 preset；仍由既有 request builder 產生。

## 設計結論與架構落點

1. 在 `src/deposit/presets.ts` 新增 FPX 專屬 `FPX_SCHEMA`，不再讓 `my_fpx_usd` clone `DUITNOW_QR_SCHEMA`。
2. 更新 `my_fpx_usd` 的 seed values 與 `data/deposit/channels/my_fpx_usd.json` 的 schema/values，讓檔案來源與 fallback 一致。
3. 更新 `src/domains/deposit.ts` 的 FPX legacy template，確保 CLI 與既有 domain builder 送出同一組欄位。
4. 更新 API defaults/preview、preset seed 與 CLI 測試，保護 schema 可見性與 outbound payload。

資料流：

```text
FPX seed schema/value + data/deposit/channels/my_fpx_usd.json
        -> defaults form/schema
        -> validation
        -> preview/CLI request builder
        -> payment_order.collect
```

## 公開契約與不變事項

- `GET /api/deposit/defaults?channel=my_fpx_usd` 的 `channelSchema` 與 `form.channelValues` 會新增/更新上述五欄。
- `POST /api/deposit/preview` 的 outbound payload 會包含五欄；其他 payload 欄位、merchant reference、簽名與 token 行為不變。
- DuitNow 仍維持原本的 `shopper_email`、`telephone_number`、`product_name` 三欄。
- 所有新增欄位均為 required，空值沿用既有遞迴表單驗證錯誤語意。

## Risk → Test → Test layer

| Risk | Test | Test layer |
| --- | --- | --- |
| FPX seed/data schema 沒有提供新欄位，前端無法編輯或送出 | 驗證 FPX defaults 的五欄值與五欄 required schema | API route |
| preview 只更新表單而未把新欄位放入 outbound payload | 更新 FPX preview payload 斷言 | API route |
| CLI legacy template 與 web preset 不一致 | 更新 FPX CLI request payload 斷言 | domain/CLI |
| 共用 schema 被誤改，DuitNow 受到回歸 | 保留 DuitNow preset/preview 測試並執行 API suite | API/domain |
| 持久化 JSON 格式或來源檔案無法解析 | 執行 preset audit 與既有 data-backed preset tests | preset audit/data |

## 驗證 gate

依 `AGENTS.md`，本次涉及 backend domain、preset、API defaults/preview 與 web 表單資料，因此完成後執行：

- `bun run test:api`
- `bun run test:web`
- `tsc --noEmit`
- `bun run build:api`
- `bun run build:web`
- `bun run structure`
- `bun run audit:presets`

回復方式為還原 FPX schema/value 變更及其對應測試；不涉及 migration、token 或共用 API contract 的不可逆操作。

