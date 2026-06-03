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

### Build and Test Commands
- 跑前端測試： `bun run test:web`
- 跑後端測試： `bun run test:api`
- 執行特定測試並顯示覆蓋率: `bun test --preload ./tests/setup.ts --coverage`


### When writing Tests (Global 通用規範)
- **DO:** 全面使用 Bun 原生測試框架 (`bun:test`)，嚴禁引入 Jest 或 Vitest 等其他工具。測試檔案需命名為 `*.test.ts` 並放在對應模組的同一層或 `__tests__` 目錄中。
- **DO:** 使用 Bun 原生的 `mock()` 建立 mock 函式，取代 `jest.fn()`。若需要攔截或替換模組行為，必須使用 `mock.module(path, callback)`，並可搭配 `--preload` 使用以防模組引入前的副作用
- **DO:** 測試專屬的環境變數（如 Mock 金鑰、測試用端點）必須統一透過 `.env.test` 載入，並嚴格遵循從 `src/core/env.ts` 讀取的專案標準。
- **DO:** 使用型別安全的 `Mock (Use Type-Safe Mocks)`。絕對不要硬寫 `Timeout` 或 `NodeJS.Timeout` 等環境依賴型別，一律改用 `TypeScript` 內建的 `Utility Types`（如 ReturnType<typeof setTimeout> 或 Parameters<T>）來維持跨環境相容性。
- **DO:** 保持 `Mock` 簡單與最小化 (Keep Mocks Simple)。測試時不需完整模擬整個內建物件的形狀，只需定義會用到的最小介面（例如 `(input: RequestInfo | URL, init?: RequestInit) => Promise<any>`），避免過度斷言型別導致環境差異的報錯。
- **DO NOT:** 嚴禁在測試程式碼中 `Hard-coding` 任何環境變數或配置字串。
- **DO:** 確保非同步邏輯正確使用 `async/await`，並善用 `expect.hasAssertions()` 來確保非同步斷言有被確實執行
- **DO:** 測試生命週期清理：必須在 `afterEach` 等生命週期 Hook 中，使用 `mock.restore()` 統一還原所有的 mock 實作，或使用 `mockFn.mockClear()` 清除呼叫紀錄，確保測試間完全隔離，不互相污染。
- **DO:** 必須針對「必填欄位缺失」與「邊界值」撰寫 Negative Tests。


## Definition of Done
每次任務完成與提交 (Commit) 前，必須滿足以下所有條件：
1. 程式碼中無 Hard-coding（測試參數與環境變數必須從 `src/core/env.ts` 或 `data/*.json` 動態讀取，重複字串需提取）。
2. 所有被修改或新增的 Public API 均已補齊 JSDoc 註釋（包含 `@param`, `@returns`, `@throws`）。
3. 執行 `tsc --noEmit` 且退出碼為 0（確保無任何隱式 any 型別，若型別不可預測，強制使用 unknown 搭配 Type Guard）。
4. 若有修改資料夾結構，執行 `bun run structure`，更新 `structure.md`。


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
- **DO:** 對於 UI 結構測試，使用 `.toMatchSnapshot()` 或 `.toMatchInlineSnapshot()` 將元件結構儲存成快照防範破壞。
- **DO:** 搭配生命週期鉤子（如 `beforeEach`）重置 DOM 狀態，並確實呼叫測試庫提供的清理函式（例如 React Testing Library 的 `cleanup`），確保測試間不會互相污染。
- **DO NOT:** 避免在單一測試中建立過多龐大的 DOM 元素，以維持大型測試的效能與穩定性。
