# Code Review：pending-dev

## Review 基準

- Review 模式：Gate Review。
- Review 深度：Deep；已完成完整 base-to-head diff 靜態分析、Architecture 與 Security specialist 分析，以及針對主要資料流的 adversarial pass。
- Base：`merge-base(origin/dev, dev)` / `db73fa9af8a2d3b1e0fa935d475be0140888a47c`。
- Head：`dev` / `7ef02d382f13975ca3e9567fd00abb859d723ff3`。
- 比較範圍：51 個 tracked files，`+4130 / -618`；worktree 在本輪分析前為 clean。
- 參考設計：[`2026-11-13-backend-data-flow-decoupling.md`](../todos/2026-11-13-backend-data-flow-decoupling.md)；並核對既有 preset database migration 的 storage conflict、persistent projection 與 no-fallback 不變式。
- Specialist ledger：Architecture 與 Security specialist 均已完成 read-only 分析；其候選問題已由主 reviewer 重新對照 diff、設計與呼叫鏈。

## Gate 1：分支實作目標、完整性與範圍

### 第一階段：目標清單與確認

1. 三個 feature service 改由 composition root 注入 `PresetStorage`，保留既有 API、payload、signature 與 JSON／PostgreSQL storage boundary。
2. defaults、preview、create 共用同一套 preset load、merge、validation 與 server-owned runtime value 的 operation context。
3. 收斂資料所有權、typed storage error、domain／transport 邊界與 channel manifest；損壞或不可用的 preset 不得被 seed fallback 隱藏，並以最低但足夠的 `Risk → Test → Test layer` 驗證。

上述目標已由開發者確認，並依確認範圍進行第二階段檢查。

### 第二階段：PASS

已確認目前 Head 已包含前輪修正：server type errors 已消除，先前不在設計範圍內的 body-limit／deep-JSON 變更已移除；未發現新的 worktree-only scope drift。`git diff --check`、`tsc --noEmit` 與 `bunx tsc -p tsconfig.server.json --noEmit` 均通過靜態檢查。

## Gate 2：原有業務邏輯變更

### PASS

開發者已確認下列變動清單與風險範圍：

- feature service 改接受注入的 storage；composition root 建立三個 JSON adapter，保留既有 route path。
- preview／create 先載入 defaults、merge request values，再以同一 operation context 驗證與建立 request。
- domain 接手 form／payload 型別與 structured request builder，移除對 feature transport type 與 legacy template fallback 的依賴。
- JSON preset load 改為 typed not-found／invalid／unavailable error，並以 manifest 推導 channel file path 與 default channel。
- storage snapshot 增加 persistent projection、timestamps 與 expected timestamp contract；新增 PostgreSQL repository／transaction／conflict adapter，但尚未接入 production runtime。
- merchant reference 維持 runtime-only，JSON／PostgreSQL projection 與 save path 均進行 stripping；JCB JSON 語法修復保留既有資料內容。
- route 新增 storage error mapping，既有 API error envelope、payload key 與 signature 需由後續 Gate 風險分析確認。

## Gate 3：原有 Runtime 潛在錯誤風險

### PASS

靜態追蹤既有 server handler、三個 route、service factory、storage load/save、validation、domain request builder 與 error boundary；未發現本次 service injection 或 operation-context wiring 造成既有成功／失敗路徑中斷、未處理 Promise rejection、資源未釋放或 route 掛載遺失。

## Gate 4：新增錯誤風險

### ISSUE_FOUND

#### Issue 1：PostgreSQL adapter 將空／部分持久化資料列靜默 hydrate 成 seed 成功值

**主要 Gate：Gate 4。優先級：P1（blocking）。**

**問題描述**：新增的 PostgreSQL storage flow 在 feature row 或 code-owned channel row 缺失時，沒有回傳 typed `not_found`／invalid error，而是把空 projection 傳給 `fromPersistentProjection`，由 caller 的 seed 值補出可用的 preset snapshot。

**判斷依據**：

- `src/core/postgresPresetStorage.ts:197-246` 先建立空 projection／空 timestamps，只覆寫實際查到的 rows；缺少 feature row、缺少任一註冊 channel row 或只存在部分 rows 都不會被拒絕。
- `src/core/postgresPresetStorage.ts:482-485` 與 `497-502` 在 load／save flow 取得 seed 後呼叫 `fromPersistentProjection`。目前 integration wiring `src/core/database.integration.test.ts:661-680` 明確以 `...seed.common.values`、`...seed.channels[channel].values` 補上 projection；deposit seed 本身包含 product number、amount、currency 與 channel payload（`src/deposit/presets.ts:1225-1230` 及其 seed definitions）。
- 因此空資料庫或部分匯入的資料庫會回傳看似正常的 defaults／operation values，而不是揭露未初始化或資料遺失狀態；後續 save 還可能把這些 seed business values 寫回持久化 projection。
- 這與設計文件 7.3、錯誤語意及 storage boundary 要求衝突：runtime 不得以 seed 隱藏 PostgreSQL missing／partial data，缺資料只能由明確 bootstrap／importer 處理；PostgreSQL persistent projection 應為唯一資料來源。

**主要影響**：未完成 migration、部分 channel 遺失或資料庫被清空時，defaults／preview／create 可能繼續成功，造成錯誤診斷、資料 parity 與業務 preset 不一致；未來 cutover 會把 import/readiness failure 隱藏成正常服務。

**解決方向**：讓 repository／adapter 區分空資料、partial rows 與有效 projection，對 request-time load 回傳既有 typed storage error；seed 只能在明確 bootstrap 或測試 fixture 注入，不能作為一般 load 的 business-value fallback。補上 empty set、missing channel 與 partial projection 的 negative tests，確認不會產生成功 snapshot 或寫回 seed 值。

**開發者論證**：`createPostgresPresetStorage` 的 inbound caller 目前只有 `src/core/database.integration.test.ts`；正式 server composition root（`src/server/index.ts:52-65`）只建立 JSON adapters，且設計文件將 PostgreSQL runtime cutover 列為後續 Phase 5。因此這項風險目前不會影響 JSON production runtime，可標記為 DB cutover 前必須修正的 follow-up，而非現階段 production blocker。

**論證判定**：此範圍與發生條件的論證成立；殘餘風險限縮在未來 PostgreSQL adapter 啟用、import readiness 或 bootstrap 邊界。延後期間的必要防護是維持 JSON runtime，並禁止在完成 missing／partial projection handling、typed error 與 negative integration tests 前啟用 PostgreSQL driver。

**處理結果：延後處理**：開發者已確認目前 production runtime 仍使用 JSON，且 PostgreSQL adapter 尚無正式 runtime caller；[`postgres-preset-missing-row-fallback.md`](../issue/postgres-preset-missing-row-fallback.md) 已建立，記錄延後理由、殘餘風險與 DB cutover 前完成條件。此 issue 不阻塞目前 JSON production，但在 PostgreSQL driver 啟用前必須完成修正與 integration gate。

## Gate 5：架構、封裝與依賴

### PASS

`test:api` 現在以 Bun 支援的 `--path-ignore-patterns '**/*.integration.test.ts'` 排除 integration test；目前唯一的 `src/**/*.integration.test.ts` 不會由一般 API gate discovery 執行。`test:db` 仍明確指定 integration test file，並由 `tests/integration-setup.ts` 在缺少 `INTEGRATION_DATABASE_URL` 時 hard fail。

## Gate 6：重要資料持久化靜態安全性

### PASS

JSON adapter 現在以 content-based revision token 搭配跨 adapter instance／process 可見的 lock，在 lock 內重新讀取 projection、檢查 expected token，再執行 feature writer；`finally` 也會釋放 lock。新增測試覆蓋同一 adapter 與兩個獨立 adapter instance 的 stale save，並驗證不會 last-write-wins。`tsc --noEmit`、server typecheck 與 `git diff --check` 均通過。

**Pre-existing、未計入本分支 verdict**：JSON common／channel 多檔直接寫入仍缺少 atomic replacement；base 已有相同 direct-write sequence，本輪未將它作為本分支新增 issue，但若 JSON save 仍是正式持久化路徑，應另行追蹤其 partial-write 風險。

## Gate 7：本機單元測試

### PASS

- `bun run test:api`：192 pass、0 fail，執行 21 個 API／unit test files；integration suite 未由此命令執行。
- `bun run build:api`：通過，Bundled 36 modules。
- `bun run test:web`：未執行，本分支沒有前端程式或 web 行為變更。
- `bun run test:db`：未由 AI 執行；依 `AGENTS.md` 由使用者或 CI 使用 disposable integration database 執行。

## Review 結論

- PostgreSQL missing／partial row fallback 已接受為 DB cutover 前 follow-up，不是現階段 JSON production blocker；Gate 4 以延後處理通過。
- Gate 5 的 integration test discovery issue 已修正並通過重新靜態分析。
- Gate 6 的 JSON concurrency issue 已修正並通過重新靜態分析。
- Review 通過：Gate 1 至 Gate 7 均已通過，未發現本分支尚未處理的 blocking issue。
- `tsc --noEmit`、server typecheck、`bun run test:api` 與 `bun run build:api` 均通過；`bun run test:db` 尚未由 AI 驗證，需由使用者或 CI 執行。
- Pre-existing JSON multi-file non-atomic write risk 未計入本分支 verdict；若 JSON save 將長期承擔多 writer／partial failure 需求，仍應另行追蹤。
- Reviewer 本輪更新 Review 文件與開發者要求的 PostgreSQL follow-up tracking file，未修改 production code 或 tests。
