### Instruction Source of Truth
- 根目錄 `AGENTS.md` 是本專案共用規範的唯一來源。`CLAUDE.md` 僅可補充明確的 Claude-specific 行為，不得複製或改寫本檔的共用規範；若兩者衝突，以本檔為準。
- 所有適用於整個專案的強制規範、測試工具與生命週期要求、驗證命令及完成 gate 都只在本檔維護。`devlope_guides/ai_design_doc_writing.md` 與 `devlope_guides/ai_reference.md` 均從屬於本檔；Writing Guide 只在不違反本檔的前提下負責設計書等級分流與要求 AI 選擇適用 gate，Reference 只提供章節與案例參考，不得另立專案級規範或設計書等級門檻。
- `devlope_guides/ai_code_review_guide.md` 是本專案 Code Review 的強制流程指引，從屬於本檔。凡任務涉及 branch、diff、PR 或程式碼審核，AI 必須先讀取並完整遵循該指引，依適用模式完成分析、issue 處理、輸出與紀錄；若與本檔衝突，以本檔為準。

### 🏗️ Technical Stack & Scope
- Backend: Bun + TypeScript (處理 API 邏輯與數據持久化)。
- Frontend: React + Vite + Tailwind CSS + React-Router-dom。

### Project Structure
- see `structure.md`
- CLI 入口： `index.ts`
- API server 入口： `src/server/index.ts`
- Web 前端入口：`web/main.tsx`
- Web 路由入口：`web/App.tsx`
      - 定義前端頁面路由：`/deposit`、`/payout`、`/subscription`

#### Project Structure & Directory Map
雖然詳細結構請參閱 `structure.md`，但在進行開發與修改時，請嚴格遵守以下路徑分界：
* **[Backend] 核心邏輯 (純 TS)**: `src/domains/` (包含 Subscription, Payout, Deposit 業務邏輯)
* **[Backend] API 路由與控制器**: `src/server/routes/` (僅處理 HTTP 傳輸，不含業務邏輯)
* **[Frontend] UI 畫面與元件**: `web/` (React + Tailwind 相關程式碼，嚴禁混入後端 Node/Bun API)
* **[Tests] 後端測試**: 與後端源碼同層或位於 `__tests__` 中，並透過 `tests/server-setup.ts` 初始化環境。
* **[Tests] 前端測試**: 位於 `web/` 內部對應元件旁，並透過 `web-setup.ts` 初始化瀏覽器環境。

### Build, Test, and Verification Commands

以下是本專案的驗證命令目錄。每個任務只需依變更範圍選擇適用的 gate，不代表每次都要執行全部命令：

- 前端測試：`bun run test:web`
- 後端測試：`bun run test:api`
- 全部測試：`bun run test`
- TypeScript 型別檢查：`tsc --noEmit`
- API 建置：`bun run build:api`
- Web 建置：`bun run build:web`
- CLI／完整套件建置：`bun run build`
- 結構快照：`bun run structure`（只有修改資料夾結構時需要，並更新 `structure.md`）
- 特定測試與覆蓋率：`bun test --preload ./tests/setup.ts --coverage`

適用 gate 的基本判斷如下：

- 修改後端 domain、service、validation、API route 或 server 行為：至少執行 `bun run test:api` 與 `tsc --noEmit`；若影響 API 建置輸出，再執行 `bun run build:api`。
- 修改 React page、hook、component、frontend route 或 web 行為：至少執行 `bun run test:web` 與 `tsc --noEmit`；若影響 production bundle、routing 或 frontend build，再執行 `bun run build:web`。
- 跨越前後端或同時影響兩側公開行為：執行兩側相關測試與建置 gate。
- 修改 CLI、入口或完整套件建置流程：執行 `bun run build`，並依受影響層級補充 API 或 Web gate。
- 修改資料夾結構：執行 `bun run structure` 並確認 `structure.md` 已更新。
- 只修改文件且不影響程式行為：檢查文件格式與引用即可，不要求執行與文件無關的程式驗證。


### When writing Tests (Global 通用規範)
- **DO:** 全面使用 Bun 原生測試框架 (`bun:test`)，嚴禁引入 Jest 或 Vitest 等其他工具。測試檔案需命名為 `*.test.ts` 並放在對應模組的同一層或 `__tests__` 目錄中。
- **DO:** 使用 Bun 原生的 `mock()` 建立 mock 函式，取代 `jest.fn()`。若需要攔截或替換模組行為，必須使用 `mock.module(path, callback)`，並可搭配 `--preload` 使用以防模組引入前的副作用
- **DO:** 測試專屬的環境變數（如 Mock 金鑰、測試用端點）必須統一透過 `.env.test` 載入，並嚴格遵循從 `src/core/env.ts` 讀取的專案標準。
- **DO:** 使用型別安全的 `Mock (Use Type-Safe Mocks)`。絕對不要硬寫 `Timeout` 或 `NodeJS.Timeout` 等環境依賴型別，一律改用 `TypeScript` 內建的 `Utility Types`（如 ReturnType<typeof setTimeout> 或 Parameters<T>）來維持跨環境相容性。
- **DO:** 保持 `Mock` 簡單與最小化 (Keep Mocks Simple)。測試時不需完整模擬整個內建物件的形狀，只需定義會用到的最小介面（例如 `(input: RequestInfo | URL, init?: RequestInit) => Promise<any>`），避免過度斷言型別導致環境差異的報錯。
- **DO NOT:** 嚴禁在測試程式碼中 `Hard-coding` 任何環境變數或配置字串。
- **DO:** 確保非同步邏輯正確使用 `async/await`，並善用 `expect.hasAssertions()` 來確保非同步斷言有被確實執行
- **DO:** 測試生命週期清理：必須在 `afterEach` 等生命週期 Hook 中，使用 `mock.restore()` 統一還原所有的 mock 實作，或使用 `mockFn.mockClear()` 清除呼叫紀錄，確保測試間完全隔離，不互相污染。
- **DO:** 對產品可達且會改變使用者或 API 結果的「必填欄位缺失」與「邊界值」撰寫代表性 Negative Tests；若相同驗證規則已在共用 validator 覆蓋，不得在每個頁面重複測試。

### Test Necessity & Scope (必須遵守)
- **MUST:** 每個新增或修改的測試都必須對應一個具體的產品行為、API contract、資料轉換、錯誤邊界或已知回歸風險；若無法說明它要防止哪個回歸，不得新增。
- **MUST NOT:** 不得僅為提高 coverage 百分比、覆蓋每個 branch、增加測試數量或滿足形式上的測試要求而新增測試。Coverage 是診斷訊號，不是測試目標。
- **MUST:** 選擇能證明該風險的最低測試層級（純函式／domain／service／API route／page／完整流程）；同一內部邏輯預設只在一層驗證。若 page、API route 或完整流程各自有獨立的公開 contract 或故障風險，應各自保留最小必要的 boundary test。
- **MUST:** 新增、刪除或合併測試時，必須在任務／PR 變更說明中記錄 `Risk → Test → Test layer`；刪除或合併時另列出仍保留的風險與替代測試。若只是機械性格式或共用 setup 變更，可簡短說明不涉及行為覆蓋。
- **MUST:** 測試重構可以合併、刪除或改寫重複案例；測試數量或 coverage 下降本身不是問題，前提是關鍵風險仍由清楚且不重複的測試保護。
- **MUST:** 測試 helper、wrapper 或 fixture factory 只有在重複造成實際維護成本，且抽出後能更清楚表達測試意圖時才建立；若抽象只減少少數幾行或隱藏測試行為，應保留在案例中。使用次數只是判斷訊號，不是硬性門檻。
- **MUST NOT:** 不得為了讓測試通過而修改生產行為、暴露內部實作，或增加沒有產品用途的 prop、route、endpoint；優先在邊界注入最小 mock 或使用既有 fixture。
- **MUST:** 跨頁面或跨層的共用內部行為只在共用元件／共用邏輯測一次；各頁面或 API route 若有獨立輸入、輸出、環境或失敗模式，保留一個最小 boundary test。頁面測試不得複製下層已覆蓋的逐欄位、簽名或資料轉換斷言。

## Implementation Judgment and Verification

### When implementation differs from confirmed design
- 實作前應先對照已確認的設計、需求與現有程式碼，辨識行為、公開契約、資料格式、錯誤處理與核准範圍的差異。
- 若差異僅屬不影響業務語意或公開契約的實作細節，AI 應採取最小修改完成實作，並在交付說明中記錄判斷。
- 若實際程式碼與已確認設計存在實質衝突，AI 不得自行改變業務語意、公開契約、資料格式、資安邊界或核准範圍。必須先回報現況、設計差異、影響與可選方案，等待必要的決策或確認。
- 實質衝突只阻塞受影響的實作路徑；不受影響且不依賴該決策的工作可以繼續進行。
- 直接修改既有函式或建立新函式，應以最小變更、維持既有契約與符合專案分層為原則。若新增函式或調整設計會改變行為、契約或範圍，必須依前項規則回報，不得以實作選擇掩蓋設計變更。

### When implementation errors occur
- AI 可以自行修正局部且可合理判定的實作錯誤，例如型別不符、錯誤 import、null handling、非同步流程或測試 fixture 使用錯誤；修正後必須重新執行受影響的驗證。
- 不得為了讓型別檢查或測試通過而刪除、弱化或跳過測試，修改共用型別或公開 API 契約，停用檢查，濫用 `any`、`@ts-ignore` 或未說明的型別斷言，或改寫設計中的完成條件。
- 若修正錯誤需要改變共用契約、業務語意、測試所保護的產品行為，或同一問題經合理修正後仍無法解決，應停止受影響部分並回報證據、影響與需要決策的事項；其他獨立工作可以繼續。

### Completion requires verification evidence
- 任務完成不得僅以程式碼已產生或修改結束作為依據。AI 必須將設計或需求中的完成條件，逐項對應至實際執行的測試、型別檢查、建置、手動驗證或其他適當證據。
- 驗證層級應依風險與公開契約選擇最低但足夠的層級，並遵守本文件的 `Risk → Test → Test layer` 規範；不要求為了 coverage 而增加無產品風險對應的測試。
- 相關驗證失敗時，不得宣稱任務已完成。若受環境、工具或外部依賴限制而無法執行，必須列出未執行的命令、原因、替代驗證、未涵蓋部分與剩餘風險。
- 交付說明至少應包含：已完成的行為、實際執行的驗證及結果、未能驗證的部分，以及仍需使用者決策或後續處理的風險。


## Definition of Done
每次任務完成與提交 (Commit) 前，必須依變更範圍滿足所有適用條件：
1. 涉及程式碼或測試時，程式碼中不得有 Hard-coding（測試參數與環境變數必須從 `src/core/env.ts` 或 `data/*.json` 動態讀取，重複字串需提取）。
2. 修改或新增 Public API 時，必須補齊 JSDoc 註釋（包含 `@param`, `@returns`, `@throws`）。
3. 涉及 TypeScript 程式碼或測試時，執行 `tsc --noEmit` 且退出碼為 0（確保無任何隱式 any 型別，若型別不可預測，強制使用 unknown 搭配 Type Guard）。
4. 修改資料夾結構時，執行 `bun run structure`，更新 `structure.md`。

## Code Review

- 強制流程：[Code Review 指引](devlope_guides/ai_code_review_guide.md)。
- 適用時機：凡 AI 需要審核 branch、diff、PR 或程式碼變更時，必須先讀取並遵循該指引。指南負責 Review 流程與輸出；`AGENTS.md` 負責專案架構、測試工具、驗證命令與完成 gate；兩者衝突時以 `AGENTS.md` 為準。
- `Gate Review`：依序完成七個 Gate；Gate 1 至 Gate 6 進行靜態分析，前六個 Gate 通過後才執行 Gate 7 的本機單元測試，並依 Gate 狀態處理 issue。
- `PR Reviewer` 全域審核：先完成 Gate 1 至 Gate 6 的完整靜態分析與 issue 處理，再執行 Gate 7；此模式不使用 Gate 狀態逐 Gate 輸出，但每項 issue 都必須標記主要 Gate。


## When writing Backend API logic
- 專案職責分離：三大核心業務（Subscription, Payout, Deposit）的純邏輯與 TypeScript 介面定義放在 `src/domains/`；`src/server/routes/` 僅負責處理 HTTP 傳輸與 Payload 轉發，不包含核心邏輯。
- 錯誤處理：必須使用 `try-catch` 搭配自定義的 `AppError` 類別捕捉異常，確保錯誤碼與 HTTP 狀態碼符合 API 規格，**嚴禁**使用 Error-first callbacks。
- 重構限制：除非是修復導致系統崩潰的 Bug，否則進行架構調整或大型邏輯重寫前，必須先向用戶說明動機並取得同意。

## When modifying Frontend/UI
- 目錄規範：React 元件存放於 `web/`，確保不含後端 Node/Bun 特有的 API。
- 路由導向：所有新功能頁面必須透過 `React-Router-dom` 進行配置，並維持 `web/App.tsx` 整潔。
- UI 規範：使用 Tailwind CSS 進行響應式設計。


## When writing Backend Tests
- **DO:** 必須在測試檔案中引入伺服器配置（例如 `startApiTestServer`），並使用非同步的 `beforeAll` 啟動獨立的測試伺服器實例與隔離的 fixture。
- **DO:** 強制在 `afterAll` 中呼叫伺服器回傳的 `stop()` 函式以優雅關閉伺服器、刪除暫存資料夾並釋放記憶體。確保測試環境中絕對不包含 `window` 或 `document` 等前端物件。
- **DO:** 本專案無資料庫，**嚴禁** 在測試期間真實寫入或覆蓋原始的 JSON 檔案。API 狀態變更與資料重置，必須在 `beforeEach` 中呼叫伺服器 context 提供的重置鉤子（如 `resetDepositFixtures()`）處理，以確保測試案例絕對獨立。


## When writing Frontend Tests (Bun + Happy DOM)
- **DO:** 必須透過 `test:web` 腳本（含 `--preload ./tests/web-setup.ts` 或是依官方建議設定 `bunfig.toml`）來統一註冊 `@happy-dom/global-registrator`。**嚴禁**將此設定用於後端測試以避免環境污染。
- **DO:** 必須在前端測試檔案的頂部加上 `/// <reference lib="dom" />`，確保 TypeScript 能正確識別瀏覽器 API 的型別
- **DO:** 使用 `@testing-library/react` 來渲染及驗證 React 元件。
- **DO:** 僅在 DOM 結構本身是穩定且需要保護的公開 contract 時，使用 `.toMatchSnapshot()` 或 `.toMatchInlineSnapshot()`；一般頁面測試優先驗證使用者可觀察的角色、文字、互動與結果。
- **DO NOT:** 不得為了提高覆蓋率或替代行為斷言而新增整頁 snapshot，也不得以 className、DOM 排列或實作細節作為頁面測試的主要目的。
- **DO:** 搭配生命週期鉤子（如 `beforeEach`）重置 DOM 狀態，並確實呼叫測試庫提供的清理函式（例如 React Testing Library 的 `cleanup`），確保測試間不會互相污染。
- **DO NOT:** 避免在單一測試中建立過多龐大的 DOM 元素，以維持大型測試的效能與穩定性。
