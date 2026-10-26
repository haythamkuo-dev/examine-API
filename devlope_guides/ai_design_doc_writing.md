# AI 設計書撰寫與專案架構對照指引

本文件負責本專案的設計書分流、撰寫流程與交付格式。專案共用規範以 [AGENTS.md](../AGENTS.md) 為最高標準；本文件不重複維護實作、測試、建置或清理規範。技術章節與設計書自查細項集中於 [ai_reference.md](ai_reference.md)。branch、diff、PR 與程式碼審核則依 [ai_code_review_guide.md](ai_code_review_guide.md) 執行，不在本文件定義 Code Review Gate。

## 文件權責分工

下列文件負責不同面向。只有 `AGENTS.md` 是專案級規範的最高來源，其餘文件只在各自職責內補充，不互相取代：

| 文件 | 責任範圍 | 不負責的內容 |
| --- | --- | --- |
| `AGENTS.md` | 專案級強制規範、架構邊界、測試工具、生命週期、驗證命令與完成 gate | 不負責代替各專題文件撰寫完整流程或章節內容 |
| `ai_code_review_guide.md` | branch、diff、PR 與程式碼審核的 Review 模式、Gate 分析、issue 處理、輸出與紀錄 | 不負責設計書等級、設計書撰寫流程或設計書章節內容 |
| 本文件 | 設計書等級分流、撰寫流程、內容深度與交付格式 | 不負責 branch／PR Code Review Gate，也不另立專案級測試或建置規範 |
| `ai_reference.md` | 設計書章節、專案對照、案例、測試層級與設計書自查問題 | 不負責設計書等級判定、專案級規範或 branch／PR Code Review Gate |

文件之間若涉及同一專案級規範，以 `AGENTS.md` 為準。設計書等級與撰寫方式由本文件判定，Reference 只補充本文件選用的章節與案例；branch、diff、PR 與程式碼審核則依 Code Review Guide 執行。若同一任務同時需要設計書與 Code Review，兩者各自依適用文件執行，不將其中一套 Gate 或審查要求套用到另一套流程。需求、專屬規格、實際程式與測試若對業務行為存在差異，必須列出來源、差異、影響與待決策事項，不得自行選一方當成真相。

## 本專案架構概覽

以下只提供設計書分流所需的簡短定位；責任邊界與技術細節請依適用面向閱讀 [ai_reference.md](ai_reference.md)。

| 面向 | 主要落點 | 設計書需固定的問題 |
| --- | --- | --- |
| Domain 與功能服務 | `src/domains/`、`src/deposit/`、`src/payout/`、`src/subscription/` | 業務型別、payload、validation、preset 與操作流程由哪一層負責 |
| API 與錯誤邊界 | `src/server/`、`src/server/routes/` | HTTP contract、錯誤映射與 service 邊界是否清楚 |
| Preset 與資料 | `data/`、各功能 `presets.ts`、session draft | 資料來源、合併、讀寫與相容性如何處理 |
| Web 與路由 | `web/main.tsx`、`web/App.tsx`、`web/pages/`、`web/hooks/` | 使用者操作、路由、表單狀態與結果如何呈現 |
| Runtime wiring | `src/server/index.ts`、`src/core/`、`vite.config.ts` | 設定、依賴注入、環境與部署邊界如何組裝 |
| 測試與驗證 | `src/**/*.test.ts`、`tests/`、`web/**/*.test.tsx` | 風險應由哪個最低測試層級與 `AGENTS.md` gate 證明 |

## 撰寫前輸入

開始起草前，應提供足以讓 AI 盤點與分類的上下文：

1. 需求目標、觸發背景、使用情境與預期使用者。
2. 明確非目標，例如本次不處理的 CLI、API、頁面、preset、環境、外部 gateway 或測試範圍。
3. 完成定義，也就是完成後設計書審查者能觀察或驗證的行為。
4. 已知受影響的入口、domain、service、validation、preset、route、page、hook、helper、config、測試或文件。
5. 相關專屬規格、issue、既有設計書、討論結論、data JSON 與上游 API 文件。
6. 已知限制，例如 TypeScript 契約、環境、API key、簽名、資料、部署路徑或外部服務可用性。
7. 預期驗證方式：依 `AGENTS.md` 的 `Build, Test, and Verification Commands` 選擇適用 gate，並說明每個 gate 要證明的風險。

若資訊不足，AI 應先列出需要確認的問題，說明每個問題影響的章節、契約、資料、測試或實作範圍。候選方案必須標示為候選，不得寫成已確認行為。

## 設計書產出位置

所有正式生成的簡式設計說明與完整開發設計書，都必須以 Markdown 檔案放置於 `devlope_guides/todos/`，檔名格式為 `{yyyy-mm-dd-檔名}.md`。

- `yyyy-mm-dd` 使用設計書生成日期；`檔名` 應能識別對應的功能、新增需求或修復事項。
- 設計書草稿、待確認版本與確認後版本，均應留在該目錄中；若只是尚未形成文件的臨時對話討論，則不需另存檔案。
- `AGENTS.md`、本 Writing Guide 與 `ai_reference.md` 是規範或參考文件，不是設計書產出物，不應移入該目錄。
- 交付設計書時，必須在回報中列出實際檔案路徑。

## 文件等級分流

文件等級決定調查深度與設計書審查深度。這裡的審查深度只指設計書需要呈現的內容、證據與決策要求，不是 branch／PR 的 Code Review Gate。設計書必須說明採用該等級的理由。若判斷不確定，應列出不確定性與影響；只要可能涉及公開契約、跨層行為、持久化資料或不可逆風險，就應採用較高等級或先取得確認。

### 不需要設計書

適用於不改變產品或工具行為、TypeScript 契約、route、preset 資料語意、前端操作、部署方式與風險邊界的純文字或機械性調整。仍要確認引用點、產出物與文件連結沒有受到影響。

### 簡式設計說明

適用於單一業務、單一層級且行為邊界清楚的局部變更。至少包含：

- 背景與問題。
- 設計結論、目標與非目標。
- 變更面向與不變事項。
- 完成定義、適用驗證 gate 與風險。

若涉及 request/response 型別、validation、簽名或 payload、JSON preset schema、API route、React route、hook 狀態、外部 gateway 或 target environment，仍須補充主要資料流、錯誤語意與相容性；詳細章節依 Reference 選用。

### 完整開發設計書

符合下列任一情況時，必須先取得完整設計確認：

- 同時跨越 domain、service、server route 與 web page。
- 新增或改變 API route、request/response type、錯誤 code 或 target environment 行為。
- 新增或改變 Deposit、Payout、Subscription 的 channel、payload、簽名、merchant reference 或外部 gateway 行為。
- 新增或改變 data JSON 結構、preset 讀寫、sessionStorage draft 或資料相容性。
- 新增 React route、頁面操作流程、表單 schema、共用 hook 或 shared component。
- 改變 server/web 入口、Vite 設定或設定注入路徑。
- 存在兩種以上合理解法，且取捨會影響產品行為、外部契約、測試隔離、效能或維護成本。
- 需求要引入目前專案沒有的資料庫、migration、OpenAPI、SDK、背景任務或可觀察性系統。

完整設計書應固定目標與非目標、設計結論、影響面、已確認行為、方案比較、契約與資料流、部署或回復、測試策略及不能開始實作的阻塞點；章節細節使用 Reference，不在本文件重複。

## 來源與權威性

以下閱讀順序只適用於設計書撰寫，不會啟動 branch／PR Code Review。若任務另要求審核程式碼變更，再依 `ai_code_review_guide.md` 的適用模式執行。

AI 起草前依序閱讀：

1. `AGENTS.md`：確認共用規範、路徑分界、測試工具、驗證命令與完成條件。
2. `structure.md`：確認實際目錄與測試分布。
3. 本文件：判定文件等級與撰寫流程。
4. `ai_reference.md`：依影響面選擇技術章節與設計書自查項目。
5. 本次適用的專屬規格、issue、既有設計書、API 文件、程式碼、data JSON 與測試。

設計書正文只描述已確認的行為、落點、依賴與流程。假設、替代方案、衝突與未確認問題必須放在方案比較或待決策事項。

## AI 設計書撰寫流程

1. 判斷本次不需要設計書、簡式設計說明或完整開發設計書，並寫出理由。
2. 讀取 `AGENTS.md`、`structure.md`、本文件與適用的 Reference 章節。
3. 盤點受影響的 domain、service、validation、preset、route、page、hook、config、data、測試與文件。
4. 讀取現況實作與測試，記錄入口、資料流、錯誤邊界、使用者可觀察結果、不變事項與衝突。
5. 依下方章節選用表選擇 Reference 內容；只納入本次真正適用的章節。
6. 建立影響面與變更前後行為，標示引用、擴充、改變或新增。
7. 固定業務語意、資料來源、狀態、結果情境與不變式，再描述各層如何協作。
8. 若存在多個方案，比較契約影響、資料相容性、前端狀態、外部依賴、測試成本、回復方式與維護成本。
9. 依 `AGENTS.md` 選擇適用驗證 gate，建立 `Risk → Test → Test layer`。
10. 完稿前完成自查，列出仍不能進入實作的阻塞點。

## Reference 章節選用

以下是章節導航，不重複 Reference 的技術內容：

| 變更面向 | 閱讀 Reference 的章節 | 設計書應固定的重點 |
| --- | --- | --- |
| Domain、payload、簽名、channel | Domain、型別與 payload 章節 | 業務型別、payload、簽名與純邏輯邊界 |
| Service、validation、preset | Feature service、Preset 與 JSON 資料章節 | 操作流程、驗證、資料來源、合併與寫回 |
| API、route、錯誤 envelope | API 與 route handler、錯誤處理章節 | HTTP contract、狀態碼、錯誤與敏感資訊邊界 |
| Runner、preview、execute、上游請求 | 業務流程與外部請求章節 | 流程順序、timeout、重試、side effect 與結果轉換 |
| React page、hook、表單、route | React UI 操作設計章節 | 使用者操作、loading、error、disabled、draft 與 route |
| 設定、依賴、環境、部署 | Runtime wiring、相容性與部署章節 | 注入、env、proxy、base path、相容性與回復 |
| 測試與驗證 | 測試與驗證章節 | 最低測試層級、Risk → Test → Test layer 與 AGENTS gate |
| 待決策與設計書自查 | 待決策事項、設計書 Review 使用方式 | 阻塞點、自查與設計書審查者可驗證的證據 |

Reference 的章節不是每次都必填。無關章節應標示「不適用」並簡述原因，不要以通用模板填入不存在的元件或流程。

## 設計書交付格式

每次交付設計書時，至少包含：

1. 文件等級與判定理由。
2. 已知事實、來源、目標與非目標。
3. 設計結論與架構落點。
4. 影響面、變更前後行為與不變事項。
5. 已確認內容、假設、待決策事項與阻塞點。
6. 適用的 Reference 章節與 `Risk → Test → Test layer`。
7. 依 `AGENTS.md` 選出的驗證 gate、預期證據與剩餘風險。
8. 位於 `devlope_guides/todos/` 的設計書實際檔案路徑。

## 設計確認後的 AI 協作

設計書經人類確認後，AI 才能依設計書進入實作。實作前先說明計畫、變更範圍與仍待確認事項；實作中若發現實際程式與已確認設計有實質衝突，依 `AGENTS.md` 的 Implementation Judgment and Verification 規則處理；實作後回報實際改動、未處理項目與驗證證據。

未完成關鍵決策、測試未執行或驗證不足時，必須明確標示狀態，不能宣稱變更已完成。

## 設計書自查

- 文件等級是否符合本文件的分流條件，且理由可被設計書審查者檢查？
- 是否遵守 `AGENTS.md` 的最高規範，沒有把 Reference 或 AI 推論當成專案級規則？
- 是否只引用真正適用的 Reference 章節，避免把無關內容寫成必填？
- 目標、非目標、已確認行為、變更前後差異與阻塞點是否清楚？
- 每個新增、刪除或合併的測試是否有 `Risk → Test → Test layer`？
- 驗證 gate 是否來自 `AGENTS.md`，且已列出未涵蓋部分與剩餘風險？
