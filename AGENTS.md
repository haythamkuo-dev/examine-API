### 🏗️ Technical Stack & Scope
- Backend: Bun + TypeScript (處理 API 邏輯與數據持久化)。
- Frontend: React + Vite + Tailwind CSS + React-Router-dom。

### Project Structure
- see `structure.md`

## Build and Test Commands
- TypeScript 檢查: `tsc --noEmit`
- 執行全域測試: `bun test`
- 執行特定測試並顯示覆蓋率: `bun test --coverage`
- GitNexus 索引更新: `npx gitnexus analyze`
- GitNexus 影響分析: `gitnexus_impact({target: "symbolName", direction: "upstream"})`
- GitNexus 變更偵測: `gitnexus_detect_changes()`


## Definition of Done
每次任務完成與提交 (Commit) 前，必須滿足以下所有條件：
1. 程式碼中無 Hard-coding（測試參數與環境變數必須從 `src/core/env.ts` 或 `data/*.json` 動態讀取，重複字串需提取）。
2. 所有被修改或新增的 Public API 均已補齊 JSDoc 註釋（包含 `@param`, `@returns`, `@throws`）。
3. 執行 `tsc --noEmit` 且退出碼為 0（確保無任何隱式 any 型別，若型別不可預測，強制使用 unknown 搭配 Type Guard）。
4. 執行 `bun test` 且退出碼為 0（確保負責修改或新增的 API 具備對應的測試案例，且測試全數通過）。
5. 執行 `gitnexus_detect_changes()` 且確認影響範圍僅限於預期的 Symbol 與執行流。
6. 若有修改資料夾結構，已同步更新 `structure.md`。


## When writing Backend API logic
- 專案職責分離：三大核心業務（Subscription, Payout, Deposit）的純邏輯與 TypeScript 介面定義放在 `src/domains/`；`src/server/routes/` 僅負責處理 HTTP 傳輸與 Payload 轉發，不包含核心邏輯。
- 嚴禁 Hard-coding：測試參數、API 端點、環境變數必須從 `src/core/env.ts` 或配置檔讀取。
- 錯誤處理：必須使用 `try-catch` 搭配自定義的 `AppError` 類別捕捉異常，確保錯誤碼與 HTTP 狀態碼符合 API 規格，**嚴禁**使用 Error-first callbacks。
- 重構限制：除非是修復導致系統崩潰的 Bug，否則進行架構調整或大型邏輯重寫前，必須先向用戶說明動機並取得同意。

## When modifying Frontend/UI
- 目錄規範：React 元件存放於 `web/`，確保不含後端 Node/Bun 特有的 API。
- 路由導向：所有新功能頁面必須透過 `React-Router-dom` 進行配置，並維持 `web/App.tsx` 整潔。
- UI 規範：使用 Tailwind CSS 進行響應式設計。


## When writing Tests
- 測試規範：全面使用 `bun test`，嚴禁引入 Jest 或 Vitest 等其他工具。測試檔案需命名為 `*.test.ts` 並放在對應模組的同一層或 `__tests__` 目錄中。
- 前置探索：在撰寫特定渠道測試前，必須先執行 `gitnexus_query({query: "channel config payload"})` 了解結構，並從 Source of Truth（如 `src/deposit/presets.ts`）解析介面定義，了解必/選填欄位。
- 資料隔離：本專案無資料庫，嚴禁在測試期間真實寫入或覆蓋原始的 JSON 檔案。API 狀態變更必須在 `beforeEach` 中處理或透過記憶體 Mock 替換。
- Factory 模式：因不同渠道欄位差異大，禁止 Hard-coded Payload。必須實作並使用 Factory 模式（如 `createChannelPayload(channelType, overrides)`）動態生成請求資料，且生成的假資料必須加上型別斷言（如 `Partial<DepositChannelConfig>`）。
- 負面測試：必須針對「必填欄位缺失」與「邊界值」撰寫 Negative Tests。

## When Using GitNexus
- 維護索引：若工具警告索引已過期 (stale)，優先在終端機執行 `npx gitnexus analyze`。
- 探索程式碼：禁止使用單純字串搜尋 (Grepping)。探索未知程式碼必須使用 `gitnexus_query({query: "concept"})`；查看特定 Symbol 的完整呼叫者與上下文必須使用 `gitnexus_context({name: "symbolName"})`。
- 影響分析與風險阻擋：修改任何函式或類別前，**必須**先執行 `gitnexus_impact` 並向用戶回報影響半徑。若風險評估為 HIGH 或 CRITICAL，**立刻停止操作並警告用戶**，取得指示後再繼續。
- NEVER DO (絕對不可做)：
  - 嚴禁未執行 `gitnexus_impact` 就修改程式碼。
  - 嚴禁忽視 HIGH / CRITICAL 警告。
  - 嚴禁使用「尋找與取代 (find-and-replace)」來重新命名，必須使用 `gitnexus_rename`。
  - 嚴禁未執行 `gitnexus_detect_changes()` 就逕自提交 (Commit) 程式碼。



<!-- gitnexus:start -->
<!-- # GitNexus — Code Intelligence

This project is indexed by GitNexus as **examine_api** (482 symbols, 693 relationships, 15 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/examine_api/context` | Codebase overview, check index freshness |
| `gitnexus://repo/examine_api/clusters` | All functional areas |
| `gitnexus://repo/examine_api/processes` | All execution flows |
| `gitnexus://repo/examine_api/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` | -->

<!-- gitnexus:end -->
