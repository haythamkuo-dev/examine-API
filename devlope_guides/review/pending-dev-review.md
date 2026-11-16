# Code Review：pending-dev

## Review 基準

- Review 模式：Gate Review。
- Review 深度：Deep；`origin/dev...HEAD` 為 46 個 tracked files、3679 insertions / 582 deletions，且涉及 preset storage、database adapter 與 API 行為。
- Base：`origin/dev` / `1eda7cec74a88c13830a0f7151a27938dd93a629`。
- Head：`dev` / `a5cc404999e9cd5f7ce0d823585d6a110fbbcf1f`。
- Worktree 額外變更：兩份 migration／解耦設計文件、`src/core/createPresetBackedService.ts`、其測試、`src/server/http.ts`、`src/server/routes/_shared.ts`、兩個 route JSDoc、`src/server/index.test.ts`，以及未追蹤的 `src/server/http.test.ts`。
- 參考設計：`devlope_guides/todos/2026-11-13-backend-data-flow-decoupling.md`；同時核對既有 migration 設計中的 JCB early-repair 與 readiness gate。

## Gate 1：分支實作目標、完整性與範圍

### 第一階段：目標清單與確認

1. 三個 feature service 改由 composition root 注入 `PresetStorage`，保留既有 API、payload、signature 與 JSON／PostgreSQL storage boundary。
2. defaults、preview、create 共用同一套 preset load、merge、validation 與 server-owned runtime value 的 operation context。
3. 收斂資料所有權、typed storage error、domain／transport 邊界與 channel manifest；損壞或不可用的 preset 不得被 seed fallback 隱藏，並以最低但足夠的 `Risk → Test → Test layer` 驗證。

開發者在確認目標清單後回覆「請 review」，本階段視為已確認。

### 第二階段：`ISSUE_FOUND`

分析與排序已完成。JCB 語法修復已依開發者決策納入本階段，兩份設計文件已同步記錄提前修復與後續 parity／readiness gate；該範圍差異在重跑 Gate 1 後解除。以下剩餘 issue 依影響實作目標、相容性與合併風險排序。

#### Issue 1：Worktree 混入未納入設計與 branch diff 的第二組公開 API 變更

**原始問題**：目前 worktree 另有未提交的 iterative deep merge 與 HTTP JSON body limit 變更；其中 `src/server/http.ts:55-80,217-232` 新增預設 1 MiB、64 層、10,000 nodes 限制與兩個 413 error code，`src/server/routes/_shared.ts:110-112,209-228` 改變 POST body parsing／error mapping，且 `src/server/http.test.ts` 尚未追蹤。

**判斷依據**：

- `git status --short --branch -uall` 顯示上述檔案是目前 worktree 的 dirty／untracked changes，不在 `origin/dev...HEAD` 的 branch diff。
- 目前確認的設計目標、API contract 與驗證 gate 沒有 body size、JSON complexity 或新的 413 error contract；這些限制會套用到所有 preset-backed POST routes。

**分支歸屬**：目前屬於 worktree-only scope drift，不是 branch commit 引入；不能在沒有意圖確認的情況下視為本 branch 的完成內容。

**主要影響**：把未經本次 data-flow 設計、API 相容性檢查與完整驗證的公開行為混入 review surface，會使 branch review 與 worktree WIP 的結果無法區分；既有可接受的大型或深層 request 也可能改回 413。

**解決方向**：將這組 body-limit／deep-merge 變更拆出另行 review；若確實要納入本分支，先補充設計與 API contract，明確列出 client 相容性、錯誤 envelope 與 `Risk → Test → Test layer`，再重新執行 Gate 1。

**下一步**：請開發者決定拆分 worktree WIP 或正式納入本分支；在決定前 Gate 1 維持 `ISSUE_FOUND`。

#### Issue 2：Server type check fails after database refactor

**追蹤文件**：[`server-typecheck-errors.md`](../issue/server-typecheck-errors.md)

**原始問題**：`bunx tsc -p tsconfig.server.json --noEmit` 報告 7 個檔案中的 13 個 TypeScript errors，其中 6 個位於測試檔案，7 個位於 source files。

**分支歸屬**：這組錯誤與目前 branch 的 database adapter、integration test 與 preset/domain 變更相關，不是三個 feature service import boundary 修正造成的單一錯誤。

**主要影響**：server TypeScript check 失敗，branch 目前不能通過 TypeScript verification gate。測試範圍只能解釋其中 6 個錯誤，不能解釋 source files 的 7 個錯誤。

**解決方向**：依追蹤文件修正 source 與 test errors，檢查 Bun runtime 與 locked `@types/bun` 的相容性，再重新執行 server TypeScript check。不得只排除 tests 來降低錯誤數量。

**目前狀態**：已建立追蹤文件，但 issue 尚未修正；Gate 1 維持 `ISSUE_FOUND`。

## Gate 2：原有業務邏輯變更

未執行。Gate 1 有未處理 issue，依序停止。

## Gate 3：原有 Runtime 潛在錯誤風險

未執行。Gate 1 有未處理 issue，依序停止。

## Gate 4：新增錯誤風險

未執行。Gate 1 有未處理 issue，依序停止。

## Gate 5：架構、封裝與依賴

未執行。Gate 1 有未處理 issue，依序停止。

## Gate 6：重要資料持久化靜態安全性

未執行。Gate 1 有未處理 issue，依序停止。

## Gate 7：本機單元測試

未執行。Gate 1 尚未通過，因此沒有執行 `bun run test:api`、`bun run test:web`、`tsc --noEmit` 或 build gate。依 `AGENTS.md` 規範，`bun run test:db` 也不由 AI 執行。

## Review 結論

- Review 未通過；目前阻塞於 Gate 1 的未處理 issue。
- 本輪新增 `devlope_guides/issue/server-typecheck-errors.md` 並更新 Review 文件，未修改程式碼或測試。
- 開發者完成既有 worktree scope 決策與 server type check issue 處理後，需重新從 Gate 1 分析；Gate 1 通過後才可繼續 Gate 2 到 Gate 7。
- 若後續變更仍涉及 database adapter／integration flow，完成其他 gate 後仍需提醒使用者或 CI 執行 `bun run test:db`。
