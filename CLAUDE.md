### 🏗️ Technical Stack & Scope
- Backend: Bun + TypeScript (處理 API 邏輯與數據持久化)。
- Frontend: React + Vite + Tailwind CSS + React-Router-dom。

## Build and Test Commands
- TypeScript 檢查: `tsc --noEmit`
- 執行全域測試: `bun test`
- 執行特定測試並顯示覆蓋率: `bun test --coverage`
- GitNexus 索引更新: `npx gitnexus analyze`
- GitNexus 影響分析: `gitnexus_impact({target: "symbolName", direction: "upstream"})`
- GitNexus 變更偵測: `gitnexus_detect_changes()`


## Definition of Done
每次任務完成與提交 (Commit) 前，必須滿足以下所有條件：
1. `tsc --noEmit` 執行退出碼為 0（確保無任何隱式 `any` 型別，若不確定需使用 `unknown` + Type Guard）
2. 執行 `gitnexus_detect_changes()` 檢查，確認影響範圍僅限於預期的 Symbol 與執行流
3. 所有被修改的 Public API 均已補齊 JSDoc 註釋（包含 `@param`, `@returns`, `@throws`）
4. 程式碼中無 Hard-coding（測試參數與環境變數必須從 `src/core/env.ts` 或 `data/*.json` 讀取，常數字串需提取）
5. 若有修改資料夾結構，已同步更新 `structure.md`
6. 負責修改或新增的 API 必須具備對應的 `bun test` 測試案例，且測試必須全數通過。
7. 測試檔案的命名必須符合 `*.test.ts` 規範，並放在對應模組的同一層或專屬的 `__tests__` 資料夾中。



## When Exploring Code
- 當探索不熟悉的程式碼時：禁止使用單純的字串搜尋 (grepping)，必須使用 `gitnexus_query({query: "concept"})` 來尋找依流程分組的執行流。
- 當需要了解特定 Symbol 的完整上下文時：使用 `gitnexus_context({name: "symbolName"})` 查看呼叫者與被呼叫者。
- 若 GitNexus 工具警告索引已過期 (stale)，必須優先在終端機執行 `npx gitnexus analyze`。

## When Modifying Code & Architecture
- 修改任何函式、類別或方法前：**必須**先執行 `gitnexus_impact` 並向用戶回報影響半徑（包含呼叫者、受影響的流程與風險等級）。
- 架構調整限制：除非是修復導致系統崩潰的 Bug，否則在進行架構調整或大型邏輯重寫前，必須先向用戶說明動機並取得同意。
- 錯誤處理規範：必須使用 `try-catch` 搭配自定義的 `AppError` 類別，嚴禁使用 Error-first callbacks。
- 前端路由規範：所有新功能頁面必須透過 `React-Router-dom` 進行配置，並確保 `web/App.tsx` 保持整潔。
- 保持小步快跑：每次修改維持單一功能點，以利 `GitNexus` 追蹤視覺化異動。

## When Blocked & Escalation Rules
- 風險阻擋：如果 `gitnexus_impact` 分析回傳 HIGH 或 CRITICAL 風險，**立刻停止操作並警告用戶**，取得指示後再繼續。
- 絕對不可做 (NEVER DO)：
  - 嚴禁在未執行 `gitnexus_impact` 的情況下修改任何函式或類別。
  - 嚴禁忽視 HIGH 或 CRITICAL 的風險警告。
  - 嚴禁使用「尋找與取代 (find-and-replace)」來重新命名變數或函式，必須使用 `gitnexus_rename`。
  - 嚴禁在未執行 `gitnexus_detect_changes()` 的情況下提交 (Commit) 程式碼。

## API Testing Guidelines
- 測試框架：全面使用 `bun test`，嚴禁引入 Jest 或 Vitest 等其他測試工具。
- 資料隔離原則：
  - 本專案無資料庫，所有初始測試資料由 `data/*.json` 提供。
  - 嚴禁在測試執行期間「真實寫入或覆蓋」原始的 JSON 檔案（除非是專門測試寫入檔案的 Helper Function）。
  - API 狀態變更（例如入金成功後的餘額增加），必須在 `bun test` 的 `beforeEach` 或透過 Mock/記憶體替換的方式處理，確保測試案例之間的獨立性。
- 渠道客製化與 Payload 生成：
  - 由於 Deposit/Payout/Subscription 在不同渠道有不同的欄位需求，禁止在測試檔中撰寫大量 Hard-coded 的 JSON payload。
  - 必須實作並使用 Factory 模式（例如 `createChannelPayload(channelType, overrides)`）來動態生成請求資料。
  - 必須針對各渠道的「必填欄位缺失」與「邊界值」撰寫負面測試 (Negative Tests)。
- 錯誤斷言 (Error Assertions)：必須捕捉並驗證自定義的 `AppError`，確保錯誤碼與 HTTP 狀態碼符合 API 規格。

## When Writing Tests
- 執行 `gitnexus_query({query: "channel config payload"})` 來了解現有渠道的結構，然後才開始撰寫針對該渠道的測試。
- 若測試需要新增特定渠道的 Mock 參數，請更新至 `data/mock_channels.json`，並確保 JSDoc 型別定義同步更新。


<!-- ### Operational Rules (Strictly Follow)
1. 🛑 重構與異動協議 (Refactoring Protocol)
    - 禁止擅自重構：除非是修復導致系統崩潰的 Bug，否則在針對現有功能進行「架構調整」或「大型邏輯重寫」前，必須先描述重構動機並徵得用戶同意。
    - 小步快跑：每次修改儘量維持在單一功能點，方便 GitNexus 追蹤視覺化異動。
    - 若修改了資料夾結構，必須同步更新 structure.md

2. 🚫 嚴禁 Hard-coding
    - 配置驅動：所有測試參數、API 端點、環境變數必須從 src/core/env.ts 或 data/*.json 讀取（如：deposit-presets.json）。
    - i18n 與常量：重複出現的字串或錯誤訊息應提取至 failureHint.ts 或對應的 constants。

3. 🎨 前端開發規範
    - UI/UX 提升：使用 Tailwind CSS 進行響應式設計，優先考慮易用性。
    - 路由導向：所有新功能頁面必須透過 React-Router-dom 進行配置，並維持 web/App.tsx 的整潔。

4. 🧩 視覺化同步 (GitNexus)
    - 在每次完成重大的架構調整後，主動建議用戶執行 GitNexus 掃描，以確保 structure.md 與視覺化圖譜是最新的。 -->

<!-- ### Project Structure Guide
    - src/domains/: 存放三大業務（Subscription, Payout, Deposit）的純邏輯與 Type 定義。
    - src/server/routes/: 僅處理 HTTP 傳輸與 Payload 轉發。
    - web/: 存放 React 元件，確保不含後端 Node/Bun 特有的 API。 -->



<!-- gitnexus:start -->
# GitNexus — Code Intelligence

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
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
