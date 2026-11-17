# PostgreSQL preset missing-row fallback

## Status

延後處理。此問題不是目前 JSON production runtime blocker，但必須在 PostgreSQL DB cutover、啟用正式 runtime 或任何正式 caller 接入前修正並完成 integration gate。

## Issue 來源與歸屬

- 來源：`db73fa9af8a2d3b1e0fa935d475be0140888a47c` → `7ef02d382f13975ca3e9567fd00abb859d723ff3` 的 PostgreSQL preset adapter 實作。
- 歸屬：本分支新增的 storage flow。
- 主要位置：[postgresPresetStorage.ts](../../src/core/postgresPresetStorage.ts:197)、[postgresPresetStorage.ts](../../src/core/postgresPresetStorage.ts:482)。
- 追蹤 Gate：Gate 4；涉及未來 cutover 時也屬 Gate 6 的資料一致性風險。

## 問題描述

`readProjection` 以空 projection 表示缺少 PostgreSQL feature row 或 channel row，沒有回傳 typed `not_found`／invalid error。`createPostgresPresetStorage` 後續再把這個 projection 傳給 `fromPersistentProjection`，caller 可以使用 seed business values hydrate 出成功 snapshot。

目前 integration wiring 在 [database.integration.test.ts](../../src/core/database.integration.test.ts:661) 與 [database.integration.test.ts](../../src/core/database.integration.test.ts:673) 明確將 seed values 合併回 projection；deposit seed 包含 product number、amount、currency 與 channel payload。

## 影響與發生條件

當 PostgreSQL 已啟用但尚未完成 import、只匯入部分 channel、資料庫被清空，或 feature／channel row 遺失時，defaults／preview／create 可能仍使用 code／JSON seed 成功回應。後續 save 也可能把 seed business values 寫回持久化 projection，掩蓋 migration、parity 或 readiness failure。

目前不影響 production runtime，原因如下：

- codebase graph 顯示 `createPostgresPresetStorage` 的唯一 caller 是 `src/core/database.integration.test.ts`。
- 正式 server composition root 目前只建立 JSON adapters，見 [server/index.ts](../../src/server/index.ts:52)。
- 設計文件將 PostgreSQL runtime cutover 列為後續 Phase 5，並非本分支目前的 production scope。

## 延後處理理由

目前維持 JSON adapter 作為正式 runtime source，且沒有 production caller 使用此 PostgreSQL adapter，因此不把該風險判定為現階段 production blocker。延後期間不得啟用 PostgreSQL driver 或以此 adapter 提供正式 request-time preset load。

## 延後期間的防護與殘餘風險

### 既有防護

- 正式 server handler 只注入 JSON storage。
- PostgreSQL adapter 目前只由 integration tests 使用。
- PostgreSQL runtime cutover 需經 migration、import、parity、connectivity 與 readiness gate。

### 殘餘風險

若未來新增 production caller、feature flag 或 cutover 流程沒有引用本文件的完成條件，空／部分資料仍可能被 seed 靜默補值，造成錯誤診斷與 persistent projection 不一致。

## DB cutover 前完成條件

1. repository／adapter 能區分有效 projection、feature row 缺失、channel row 缺失與 partial projection。
2. request-time load 對 missing／partial data 回傳既有 typed storage error，不以 seed business values fallback。
3. seed 僅能用於明確 bootstrap、importer 或測試 fixture；不得由一般 load 隱式初始化持久化資料。
4. 補上 empty set、missing channel、partial projection 與不完整 import 的 negative integration tests。
5. 以 `bun run test:db` 驗證 transaction、error mapping、projection parity 與 no-fallback 行為；此 gate 由使用者或 CI 執行。
6. cutover readiness／preflight 明確阻擋未完成上述條件的 PostgreSQL runtime 啟用。

## Risk → Test → Test layer

| Risk | Test | Test layer |
| --- | --- | --- |
| PostgreSQL feature row 缺失被當成成功 preset | 清空 `preset_sets` 後 load，驗證 typed not-found／invalid error 且不回 seed values | PostgreSQL integration |
| 單一 channel row 缺失被 seed 補齊 | 只建立部分 channel rows，驗證 request-time load fail closed | PostgreSQL integration |
| save 將 seed business values 寫回空資料庫 | 在空／partial projection 上執行 save，驗證未發生隱式 bootstrap 或寫回 | PostgreSQL integration |
| cutover 在資料未 ready 時啟用 adapter | readiness/preflight gate 阻擋 driver 啟用 | migration／cutover gate |

## 相關設計

- [Backend data-flow decoupling design](../todos/2026-11-13-backend-data-flow-decoupling.md:175)
- [Preset database migration design](../todos/2026-10-22-preset-database-migration.md:296)
