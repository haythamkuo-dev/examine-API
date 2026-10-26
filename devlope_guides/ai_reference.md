# AI 開發設計書章節參考

本文件是 devlope_guides/ai_design_doc_writing.md 的詳細章節與案例參考。它不是設計書等級分流規範、另一套架構規範，也不是可直接套用到所有專案的後端模板。文件的目的，是在撰寫設計書時，協助 AI 或開發者判斷：

- 哪些章節與這個變更真的有關。
- 每個章節應該寫到哪一層，才足以讓設計書、實作、測試與設計書審查對齊。
- 如何把既有專案的核心邏輯、資料流與邊界完整保留下來。
- 如何明確區分「沿用」、「包裝」、「擴充」、「改變既有行為」與「新增」。

本文件中的路徑、命名與流程，以目前專案的 Bun、TypeScript、React、Vite、Tailwind CSS 與 React Router 架構為準。若未來專案架構改變，應先更新 AGENTS.md、structure.md 與本文件的專案對照，再使用本文件產生新的設計書。branch、diff、PR 與程式碼審核不屬於本文件的內容範圍，依 [ai_code_review_guide.md](ai_code_review_guide.md) 執行。

## 文件之間的關係與從屬

設計書相關文件的責任如下：

| 文件 | 責任 | 使用時機 |
| --- | --- | --- |
| AGENTS.md | 專案共用規範、目錄邊界、測試規則與完成定義 | 所有開發、設計書與 Code Review 的最高優先來源 |
| devlope_guides/ai_code_review_guide.md | branch、diff、PR 與程式碼審核的 Review 模式、Gate、issue 處理與輸出 | 審核程式碼變更時使用，不負責設計書內容 |
| structure.md | 實際檔案與資料夾結構快照 | 確認檔案位置與架構現況 |
| devlope_guides/ai_design_doc_writing.md | 設計書等級分流、寫作流程、內容深度與產出格式 | 開始撰寫或審查設計書；等級判定以此為準 |
| devlope_guides/ai_reference.md | 各類章節的詳細寫法、案例與本專案對照 | 依已選定的等級判斷章節是否適用、補足實作細節 |
| example.md | 設計書的示範內容與核心推理方式 | 理解完整設計書應如何描述決策與影響 |

本文件不能覆寫 `AGENTS.md` 的規範，也不能取代 `ai_design_doc_writing.md` 的設計書等級判定。本文件只提供設計書章節、案例與自查參考，不定義 branch／PR 的 Code Review Gate。若本文件的說法與 `AGENTS.md`、設計書撰寫指引、專案現況或可驗證的程式碼不一致，應依文件權責處理衝突，並回頭修正本文件的過時內容。

## 目前專案架構對照

### 執行環境與主要入口

| 領域 | 目前專案對應 | 設計書應說明的重點 |
| --- | --- | --- |
| 後端執行環境 | Bun + TypeScript | 使用 Bun 的測試、啟動與建置方式，不假設 Node-only API |
| API 入口 | src/server/index.ts | server 的建立、依賴注入、路由註冊與關閉方式 |
| CLI 入口 | index.ts | 若變更影響 CLI，說明 CLI 與 API 共用哪些 domain 或 service |
| 業務邏輯 | src/domains/ | 純 TypeScript 的 payload、簽名、channel 對應與業務型別 |
| 功能服務 | src/deposit/、src/payout/、src/subscription/ | defaults、preset、validation、preview、create 或 execute 的功能流程 |
| API 路由 | src/server/routes/ | HTTP parsing、狀態碼、錯誤 envelope 與服務呼叫，不放核心業務邏輯 |
| 共享錯誤處理 | src/server/errors.ts、src/server/routes/_shared.ts | AppError、錯誤碼、HTTP 狀態碼、錯誤訊息清理與共用 route pipeline |
| 前端入口 | web/main.tsx | React、BrowserRouter、basename、全域樣式與根層 providers |
| 前端路由 | web/App.tsx | /deposit、/payout、/subscription 與 AppShell |
| 前端畫面 | web/pages/ | 使用者可觀察的表單、結果、錯誤與操作狀態 |
| 前端狀態與操作 | web/hooks/ | API 呼叫、表單狀態、session draft 與頁面操作流程 |
| 前端 API transport | web/pages/helper/operatorApi.ts | fetch、request/response 型別與 API 邊界 |
| 表單組裝 | web/pages/requestBuilder.tsx | schema-driven nested form 的欄位呈現與值轉換 |
| 設定與資料 | src/core/env.ts、data/ | channel、環境、token、API key、preset JSON 與資料來源 |
| 外部請求 | src/runner.ts | 對上游服務發送 HTTP request 的實際邊界 |

### 資料與狀態模型

本專案不是資料庫應用程式。設計書不得預設加入 Repository、table、migration、SQL transaction、ORM 或資料庫 schema。

目前的持久化與暫存來源是：

- data/deposit/、data/payout/、data/subscription/ 下的 common.json 與 channels/*.json，用來保存可重用的 preset。
- 後端功能服務負責讀取、合併、驗證與寫回 preset；實際讀寫邏輯以各功能的 presets.ts 與共享 preset service 為準。
- 前端 draft 使用 sessionStorage 暫存，版本與還原行為由 web/hooks/sessionDraft.ts 管理。
- 若設計書涉及 API 測試資料，應說明隔離 fixture 與資料來源；具體 setup、重置與原始 data 保護規範依 `AGENTS.md`。

如果未來真的要導入資料庫，這會是獨立的架構變更，必須另外說明資料遷移、回復、並行寫入與部署風險，不應在一般功能設計書中直接套用資料庫章節。

## 內容深度與章節選用

### 簡式設計說明

當 `ai_design_doc_writing.md` 判定本次採用簡式設計說明時，以下內容可作為章節深度參考。這段說明不會新增獨立的文件等級條件。

至少要包含：

1. 目的與範圍。
2. 受影響的實際檔案或模組。
3. 使用者或 API 可觀察到的行為。
4. 必要的驗證方式。
5. 若有新增或修改測試，列出 Risk → Test → Test layer。

### 完整設計書的章節參考

文件等級必須先依 `ai_design_doc_writing.md` 的「文件等級分流」判定。本節不是另一份完整設計書門檻，以下只列出常見影響面，供已判定為完整設計書時選擇章節，或協助回到撰寫指引檢查影響：

- API contract、domain payload、簽名欄位、channel mapping、merchant reference 或 target environment。
- preset 的 JSON shape、預設值、讀寫規則或 session draft 還原規則。
- 同時涉及後端 route、前端 page/hook 與外部上游請求。
- 共用 `_shared.ts`、`createPresetBackedService`、`AppError` 或共用表單組裝邏輯。
- 既有成功、失敗、重試、loading、disabled 或結果呈現行為。
- 相容性、部署、回復、資料 fixture 或多層測試策略。

這些項目不可單獨取代撰寫指引的分流判定。完整設計書的重點不是增加章節數，而是讓「需求、架構、資料流、公開邊界、失敗情境、測試與回復」彼此一致。無關章節應明確標示「不適用」並說明原因，不要以通用模板填入不存在的元件。

## 基本章節

### 文件定位、目標與非目標

先用一小段話說清楚這份設計書要解決的問題，再列出目標與非目標。

目標應描述可驗證的結果，例如：

- 新增某個 preset 欄位，並讓 defaults、preview 與 execute 使用同一個型別與驗證規則。
- 將某個 API 的錯誤回應統一為既有的 AppError envelope。
- 讓 React 頁面能保留表單 draft，重新整理後仍能恢復同一版本的輸入。

非目標應主動排除容易被誤解的範圍，例如：

- 不新增資料庫或 Repository 層。
- 不改變上游 API 的簽名演算法。
- 不重寫所有功能頁面，只調整共用 request builder。
- 不把頁面層的顯示狀態搬進 domain。

### 設計結論

在設計書前段先給出足夠明確的結論，讓讀者不用讀完整份文件才能知道方案：

1. 會修改哪些層。
2. 每一層的責任是什麼。
3. 哪些既有能力會被沿用。
4. 哪些公開行為會改變。
5. 用什麼測試證明風險已被覆蓋。

結論不應只寫「新增一個 service」或「修改前端畫面」。應寫出實際邊界，例如：

> 由 src/domains/ 保持 request payload 與簽名規則不變，讓功能 service 在 preset 驗證後產生 request，再由 route handler 轉換 HTTP 結果；前端只透過既有 API transport 呼叫 preview/create，並在 hook 中管理 loading、錯誤與 session draft。

### 完成定義

完成定義應能對應到本專案的風險與公開行為。專案級的型別、測試、建置、結構、JSDoc、測試工具與清理 gate 統一依 `AGENTS.md` 判定；本節只需說明本章節受影響的行為、測試邊界與所需證據，不重複維護命令或全域規範。

- 受影響的 API、service、page 或 hook 行為，應有對應的最低測試層級或明確的不可測試原因。
- 設計書應指出選用的 `AGENTS.md` 驗證 gate 會證明哪個風險，以及仍未涵蓋的部分。
- 架構假設仍須符合本專案現況；若涉及新增工具、執行環境或能力，應依 `AGENTS.md` 與實際專案支援狀態列為設計決策，不得當成既有能力。

## 設計矩陣：先判斷變更種類

每個受影響區域都應放入矩陣，避免設計書把所有章節都當成必填。矩陣中的分類要描述實際影響，而不是只描述檔案名稱。

| 區域 | 無關 | 完全引用 | 擴充：外封裝 | 擴充：增加既有能力 | 更改既有行為 | 新增 |
| --- | --- | --- | --- | --- | --- | --- |
| Domain、型別、payload | 不影響業務資料或 request | 直接沿用既有型別與 payload | 只增加 adapter 或展示轉換 | 保留舊欄位並增加新欄位或新 mapping | 欄位、簽名、預設值或結果語意改變 | 新增 domain payload 或明確業務型別 |
| Feature service 與 validation | 不影響功能服務 | 直接呼叫既有 service 與 validator | 在服務外增加 orchestration | 增加新的 preset、操作或可選流程 | 既有操作的驗證、預設值或結果改變 | 新增 deposit、payout 或 subscription 能力 |
| Preset 與 JSON 資料 | 不保存任何設定 | 只讀既有 preset | 在既有 JSON 外加轉換層 | 增加可向後相容的欄位或 channel | 改變 JSON shape、預設值或讀寫語意 | 新增一組 data namespace 或 preset 類型 |
| API route 與錯誤邊界 | 不新增 HTTP 行為 | 沿用既有 route、envelope 與狀態碼 | 加入 HTTP adapter | 增加選用欄位、operation 或錯誤映射 | 變更 route input、output、狀態碼或錯誤行為 | 新增 route 或資源 |
| 業務流程與上游請求 | 不影響流程順序 | 沿用既有 preview/create/execute 流程 | 在既有流程外加一層包裝 | 增加分支但不改舊分支 | 改變請求順序、簽名、重試或成功判定 | 新增上游操作或流程 |
| React page、hook、表單 | 不影響畫面與互動 | 沿用既有元件與 hook | 只包裝顯示或事件 | 增加欄位、狀態或操作但保留既有流程 | 既有使用者操作、顯示或 draft 語意改變 | 新增 page、route、hook 或互動 |
| Runtime wiring、環境與依賴 | 不影響啟動與依賴 | 沿用既有注入與 providers | 加入薄型 adapter | 增加可選依賴或設定 | 改變 env、proxy、basename 或注入契約 | 新增 runtime capability |
| 測試與驗證 | 沒有新的可觀察風險 | 沿用既有測試即可證明 | 只調整 setup 或 fixture adapter | 增加對應新風險的案例 | 既有案例必須改寫以反映新 contract | 新增一個公開行為或邊界的測試 |

### 分類規則

- 「完全引用」表示既有能力的契約與語意都不變，設計書應指向原有實作與測試，而不是重寫一份替代規則。
- 「擴充：外封裝」表示新增 adapter、UI wrapper 或 route translation，但不改變內部核心語意。
- 「擴充：增加既有能力」表示在原流程上增加能力，同時保留原本輸入、輸出與失敗行為。
- 「更改既有行為」表示既有使用者、呼叫端、測試或上游可能觀察到不同結果，必須提供變更前後對照。
- 「新增」表示原本沒有該 public route、操作、資料類型或畫面，必須定義完整的 contract。

## 橫向影響檢查

設計書不能只描述修改檔案，還要檢查下列橫向面向是否受到影響：

| 面向 | 本專案要檢查的內容 | 需要寫出的問題 |
| --- | --- | --- |
| API 與 TypeScript contract | route payload、response、domain 型別、前端 transport | 哪些呼叫端需要同步？輸入缺失與型別錯誤怎麼回覆？ |
| 上游 gateway 與簽名 | src/domains/ request builder、channel、merchant reference、簽名欄位 | request 是否仍符合上游契約？哪些欄位不能由 UI 重新定義？ |
| Preset 與 JSON 相容性 | data/*/common.json、channels/*.json、preset merge | 舊 preset 能否讀取？新欄位預設值在哪裡產生？寫回是否會破壞舊資料？ |
| Secret 與安全性 | src/core/env.ts、token、API key、錯誤訊息 | secret 是否只在必要邊界使用？是否可能出現在 response、log 或畫面？ |
| React 狀態與互動 | page、hook、request builder、session draft | loading、錯誤、disabled、重試、重新整理後的 draft 是否一致？ |
| Runtime 與部署 | src/server/index.ts、vite.config.ts、API proxy、basename、target environment | 本地與部署環境的 base path、proxy、環境選擇是否仍正確？ |
| 錯誤與可觀察性 | AppError、error envelope、logger、錯誤清理 | 使用者看到什麼？server 記錄什麼？哪些細節不能外洩？ |
| 測試與驗證 | API、domain、service、page 的最小測試層級 | 每個新風險由哪一層證明？是否不必要地重複測試內部實作？ |

如果某一列不受影響，寫「不適用」並給原因。不要省略整個面向，因為省略會讓設計書審查無法區分「已判斷無影響」與「漏寫」。

## 更改既有行為的描述要求

只要分類為「更改既有行為」，就必須使用變更前後對照，不能只寫新設計：

| 行為 | 目前行為 | 新行為 | 受影響者 | 相容策略 |
| --- | --- | --- | --- | --- |
| API input | 目前接受哪些欄位、預設值與缺失行為 | 新增、移除或改變哪些欄位 | operatorApi、route caller、測試 | optional、版本化、拒絕舊 input 或 migration |
| API output/error | 現有 response shape、狀態碼與 envelope | 新的 response、錯誤碼或訊息 | React hook、外部整合、測試 | 保留欄位、轉換層或同步修改 caller |
| Preset | 舊 JSON 欄位與讀寫規則 | 新 JSON shape 或 default | 已存在的 data/ 檔案、測試 fixture | backward-compatible read、寫回策略、版本欄位 |
| Domain request | 現有 payload、channel、簽名與 merchant ref | 新的 request 或規則 | 上游 gateway、runner、domain 測試 | 明確列出可接受的破壞性變更 |
| UI operation | 現有表單、按鈕、loading、結果 | 新的互動與畫面狀態 | 使用者、page 測試、session draft | 保留舊操作、遷移 draft 或提示重設 |

若無法填出「目前行為」，先讀程式碼與測試，不要直接假設新設計是原本的延伸。

## 業務不變式與依據來源

這個專案是用來組裝並操作不同通道的支付請求。設計書應先列出不變式，再描述哪一層負責保護它們。

常見不變式包括：

1. channel 必須對應有效的 Channel 與其設定來源。
2. merchant reference、amount、currency 與必要欄位必須通過既有 validation。
3. domain 產生的 request payload 與簽名欄位不能由 React UI 自行重建。
4. target environment 必須從受控的環境設定或 route context 取得，不應由任意表單字串決定。
5. defaults、preset、preview 與 execute 必須使用一致的資料合併與驗證規則。
6. API route 只能負責 HTTP 邊界，不能把 payment domain 規則散落在 handler。
7. 外部請求的結果、錯誤與 timeout 必須經過既有錯誤邊界，再暴露給 API 或 UI。
8. 測試資料應與產品原始 data 隔離；具體 fixture、重置與清理要求依 `AGENTS.md`，設計書只需說明本次風險所需的資料邊界。

### 依據來源表

| 不變式 | 主要保護位置 | 允許的變更位置 | 不應放置的位置 |
| --- | --- | --- | --- |
| channel 與環境映射 | src/core/env.ts、功能 presets.ts | env registry 或 preset schema | React page、route handler |
| payload 與簽名 | src/domains/*.ts | domain function 與其型別 | UI form、HTTP route |
| preset 合併與預設值 | src/*/presets.ts、createPresetBackedService.ts | preset service 與 fixture | 每個 page 各自複製 |
| 請求驗證 | src/*/validation.ts、共用 schema | validator 與 service boundary | 只依靠 disabled button |
| HTTP 狀態與 error envelope | src/server/errors.ts、src/server/routes/_shared.ts | route error mapping | domain 直接回傳 HTTP response |
| loading、表單、draft | web/hooks/、web/pages/ | hook、page、request builder | src/domains/ |

設計書若提出跨層資料轉換，必須寫出來源、目的與責任邊界。例如「前端把表單欄位轉成 API payload」仍應說明哪些欄位由 operatorApi 傳遞、哪些欄位由後端 service 或 domain 產生。

## Domain、型別與 payload 章節

### 應說明的內容

當變更涉及 src/domains/ 或 domain 型別時，至少說明：

- 新增或修改的型別與欄位語意。
- payload 是由哪個 domain function 產生。
- channel、merchant reference、amount、currency、metadata 或簽名欄位的來源。
- 哪些欄位是使用者輸入，哪些欄位由 env、preset 或 server 產生。
- preview 與 execute 是否共用同一套 request 建構邏輯。
- 上游回應如何被轉成 service 或 route 可處理的結果。
- 對應的 domain 或 service test 會保護哪個風險。

### 不應直接套用的內容

不要在沒有實際程式碼支持時加入：

- 泛用 Entity、Repository 或 UseCase 階層。
- ORM model、資料庫 table 或 SQL schema。
- 由 OpenAPI 產生的 SDK。
- 與本專案無關的 job、consumer、outbox 或 message broker。

若未來需要這些元件，應先在設計結論中說明它們是新的架構能力，而不是把它們寫成目前專案已存在的層。

## Feature service 與 validation 章節

Deposit、Payout 與 Subscription 的功能服務通常由下列責任組成：

- service.ts：對外提供 defaults、preset、preview、create 或 execute 等功能操作。
- validation.ts：驗證輸入與跨欄位規則。
- presets.ts：讀取 channel/common preset、建立 schema/defaults，以及處理寫回。
- web.ts：供前端 transport 共用的公開 request/response 型別。
- src/core/createPresetBackedService.ts：抽出共用的 preset-backed 服務流程。

設計書應釐清：

1. 新行為是新增 service operation，還是既有 operation 的新分支。
2. 哪些 validation 在共用層完成，哪些是該功能特有規則。
3. defaults、preview、create、execute 是否都會走同一個 canonical validation。
4. service 是否會讀寫 preset，若會，讀取與寫回的時間點為何。
5. 錯誤是如何轉為 AppError 或既有 route error。
6. service 的輸入與輸出是否要由 web.ts 同步給前端。

不要為了讓一個頁面通過測試而新增只服務該頁面的 production prop、route 或 endpoint。若規則是跨功能共用，應在共用 validator 或 service boundary 保護一次。

## Preset 與 JSON 資料章節

### 資料來源與合併順序

需要說明實際使用的來源，例如：

~~~text
data/{feature}/common.json
        +
data/{feature}/channels/{channel}.json
        +
本次操作輸入
        ↓
schema/defaults/validation
        ↓
preview 或 execute request
~~~

設計書應明確寫出：

- common preset 與 channel preset 的責任差異。
- 同名欄位的覆寫優先順序。
- 缺少欄位時由哪一層提供 default。
- 新欄位如何讓舊 preset 仍能被讀取。
- 寫回時是否保留未知欄位。
- 何時需要更新 data/ fixture、測試資料或文件。

### session draft 與伺服器 preset 的差異

不要把兩種資料混成同一種儲存模型：

- server preset 是 API 操作使用的可重用設定，位於 data/ 並由後端 service 管理。
- session draft 是瀏覽器暫存的未完成表單狀態，由 web/hooks/sessionDraft.ts 管理。

若修改表單欄位，需同時檢查 draft 版本、欄位遷移、無效值清除與重新整理後的 UI 行為。

### 測試資料規則

若本章節涉及 API 測試，設計書應指出需要隔離的 server context、暫存資料夾、reset hook 與 fixture 生命週期；具體 server setup、原始 JSON 保護與清理規範依 `AGENTS.md`，本文件不重複定義。

## API 與 route handler 章節

### Route 的責任

src/server/routes/ 的設計描述應集中在 HTTP 邊界：

1. 解析 method、path、query、header 與 JSON body。
2. 驗證必要的 request 形狀，或呼叫既有 validation boundary。
3. 取得 target environment 與受控的依賴。
4. 呼叫 feature service。
5. 將成功結果轉為既有 response shape。
6. 將錯誤交給 AppError、normalizeRouteError 或既有共用錯誤流程。
7. 設定正確的 HTTP status、header 與必要的 checkout URL policy。

Route 不應自行實作簽名、preset merge、channel mapping 或 payment business rule。

### API contract 表

每個新增或修改的 endpoint 至少列出：

| 項目 | 要寫的內容 |
| --- | --- |
| Method/path | 實際 method 與 path，不能使用不存在的泛稱 |
| Input | 欄位、型別、必填性、default、格式與來源 |
| Output | 成功 response、狀態碼與前端會使用的欄位 |
| Error | AppError code、HTTP status、可公開訊息與內部 log |
| Environment | target environment 從哪裡來、誰能設定 |
| Side effect | 是否讀寫 preset、發送上游 request 或產生 ID |
| Compatibility | 舊 caller、前端型別與測試如何維持或遷移 |

### 前後端型別同步

若 route contract 改變，需同步檢查：

- src/{feature}/web.ts 的公開型別。
- web/pages/helper/operatorApi.ts 的 request/response transport。
- 對應 page 或 hook 的欄位讀取。
- API route 測試與 frontend boundary test。

不要因為 TypeScript 編譯通過，就假設 runtime JSON contract 已經相容。

## 業務流程與外部請求章節

### 預設的既有流程

目前功能通常可用下列抽象描述，但設計書仍需以實際 service 與 route 為準：

~~~text
取得 defaults
    ↓
讀取並合併 preset
    ↓
驗證輸入
    ↓
儲存或更新 preset
    ↓
建立 preview 或 execute request
    ↓
domain 產生 payload 與簽名
    ↓
runner 發送上游 HTTP request
    ↓
轉換結果與錯誤
    ↓
API response / React UI
~~~

如果變更改動流程順序，必須說明：

- 哪一步原本先發生，現在改成什麼。
- 哪些資料在步驟之間傳遞。
- 哪些步驟可以重複、重試或取消。
- 上游 timeout、非 2xx、格式錯誤與本地 validation 如何區分。
- 失敗後 preset 或 session draft 是否已經被寫入。

### Preview 與 Execute

若系統同時提供 preview 與 execute，設計書必須說明兩者的差異：

- preview 是否真的呼叫上游。
- preview 是否只建立 payload、顯示 request 或執行非破壞性操作。
- execute 是否重用 preview 的 payload builder。
- 兩者是否有不同的權限、secret、timeout 或錯誤處理。

不要在 UI 中重複建立一份與 domain 不一致的 request 預覽。

### Runner 邊界

src/runner.ts 是外部 HTTP 請求邊界。若修改 runner 或其呼叫方式，設計書應列出：

- URL、method、headers、body 的來源。
- timeout 與取消策略。
- 上游 response 的解析方式。
- 網路錯誤、非 2xx 與無法解析的內容如何轉換。
- secret、token 與 request body 是否會被記錄。

除非專案真的新增背景工作系統，否則不要將此流程描述成 generic job、consumer、queue 或 outbox。

## React UI 操作設計章節

### UI 分層

目前前端的設計書應使用以下對照：

| 層 | 主要位置 | 責任 |
| --- | --- | --- |
| Root bootstrap | web/main.tsx | React root、StrictMode、BrowserRouter、basename、樣式 |
| App routing | web/App.tsx | AppShell、providers 與頁面 route |
| Page | web/pages/ | 顯示公開畫面與組合功能區塊 |
| Hook | web/hooks/ | API 操作、表單狀態、loading、錯誤與 draft |
| API helper | web/pages/helper/operatorApi.ts | HTTP transport 與公開資料型別 |
| Request builder | web/pages/requestBuilder.tsx | 依 schema 呈現與收集 nested fields |
| Styling | web/styles.css、Tailwind class | layout、tokens、responsive 與狀態樣式 |

設計書應避免把後端 src/ 模組直接引入瀏覽器。若共用型別目前由 src/{feature}/web.ts 提供，應確認該檔案不包含 Bun、檔案系統、secret 或 server-only 依賴。

### 使用者可觀察狀態

對每個非同步操作至少描述：

- 初始狀態與可操作的控制項。
- loading 時哪些按鈕、欄位或重複提交被停用。
- validation error 顯示在哪裡。
- API error 與上游 error 是否有不同提示。
- 成功後顯示什麼結果，是否清除或保留表單。
- 失敗後能否重試，是否保留 draft。
- 重新整理頁面後 session draft 是否恢復。
- empty state、disabled state 與無效 preset 如何呈現。

### React Router 與路由新增

新增功能頁面必須透過 web/App.tsx 的 React Router 配置，並說明：

- path 與頁面的公開名稱。
- basename 或部署子路徑下是否仍可進入。
- 直接重新整理該 route 的行為。
- 導覽列、返回與錯誤邊界是否需要更新。
- page test 如何證明該 route 的公開行為。

不要把路由判斷散落在多個 page 或以字串條件取代既有 router。

## Runtime wiring 與依賴注入章節

本專案使用明確的函式依賴注入與 runtime 組裝，不應假設存在大型 DI container。

### 後端 wiring

src/server/index.ts 會組裝 server handler 與功能路由，並提供或注入類似下列依賴：

- environment registry。
- preset 目錄或資料路徑。
- logger。
- ID 產生器。
- server context 與關閉方法。

若新增依賴，設計書要說明：

1. production 使用什麼實作。
2. API test 如何注入隔離實作。
3. 依賴的生命週期與清理方式。
4. 是否會改變 route 的既有 contract。

### 前端 wiring

前端 wiring 主要位於 web/main.tsx、web/App.tsx、vite.config.ts 與各頁面 hook。若新增 provider、context、API client 或 proxy 設定，需說明：

- 為何不能使用既有 hook 或 helper。
- provider 的 scope 與 rerender 影響。
- 本地開發 proxy、部署 base path 與 API path 是否一致。
- frontend test 是否需要更新 tests/web-setup.ts。

## 錯誤處理與可觀察性章節

### 錯誤邊界

設計書應把錯誤分成可處理的類型，而不是只寫「catch error」：

| 類型 | 例子 | 對使用者 | 對 server/log |
| --- | --- | --- | --- |
| Input / validation | 缺欄位、格式錯誤、跨欄位不合法 | 顯示可修正的欄位或操作錯誤 | 記錄必要 context，不記錄 secret |
| Preset / local data | preset 不存在、JSON 無法解析、寫入失敗 | 說明設定無法使用或保存 | 記錄來源與 operation |
| Upstream HTTP | timeout、非 2xx、回應格式不符 | 顯示可重試或需聯絡管理者的訊息 | 記錄 endpoint、status、request id，清理敏感資訊 |
| Internal unexpected | 未預期例外、程式錯誤 | 統一的安全錯誤訊息 | 記錄 stack 與診斷資訊 |

AppError 的 code、HTTP status 與公開訊息要保持一致。錯誤訊息清理應遵循 sanitizeErrorMessage 或現有共用流程，不要讓 route 各自暴露原始 exception。

### 可觀察性

目前專案的預設可觀察性是 logger、request/operation context 與安全的錯誤回應，不應預設加入 GCloud Logging、distributed trace、Prometheus 或其他服務。

如果需求確實要加入 telemetry，設計書必須寫明：

- producer 在哪一層。
- event 或 log schema。
- viewer 或查詢方式。
- correlation/request ID 從哪裡來。
- secret、token、完整 payload 如何遮罩。
- telemetry 失敗是否會影響主流程。

## 相容性、部署與回復章節

### 必查的相容性面向

- API route 的 method、path、request、response、status 與 error envelope。
- src/{feature}/web.ts 與 operatorApi 的前後端型別。
- data/ preset 的讀取、預設值、寫回與未知欄位處理。
- sessionStorage draft 的版本與欄位遷移。
- channel、merchant reference、簽名與上游 gateway contract。
- X-Target-Environment 或其他 target environment 的選擇與驗證。
- Vite base path、/api proxy 與 production server path。
- 舊測試 fixture、reset hook 與測試伺服器關閉。

### 部署與回復問題

設計書應回答：

1. 是否需要新增環境變數、token 或 API key？
2. 本地、測試、正式 target environment 是否會有不同設定？
3. 舊 preset、舊瀏覽器 draft 與舊 API caller 能否繼續運作？
4. 若新功能失敗，能否只關閉新 route 或恢復舊分支？
5. 是否需要先部署後端再部署前端，或反過來？
6. 上游 API 改變時，哪一層可以隔離差異？

若沒有資料庫 migration、feature flag 或正式 rollout 機制，應明確寫出目前沒有，而不是虛構一個部署流程。

## 測試與驗證章節

### 測試工具與環境的從屬規則

本專案的測試工具、setup、DOM type reference、mock、server、fixture 與清理規範均由 `AGENTS.md` 統一維護。本節不複製這些全域要求；設計書只需說明本章節使用哪個測試邊界、需要哪些隔離資料，以及哪些使用者或 API 行為要被證明。

### 測試層級選擇

| 風險 | 最低合適層級 | 應證明的內容 |
| --- | --- | --- |
| 純 payload、簽名或 mapping 變錯 | domain test | 輸入到 payload 的 deterministic contract |
| 欄位驗證或 preset merge 變錯 | service / validation test | 必填欄位、邊界值、default 與合併規則 |
| HTTP status、route input/output 或 error envelope 變錯 | API route test | 公開 API contract |
| page 操作、loading、error、draft 或 route 變錯 | frontend page/hook test | 使用者可觀察的互動與結果 |
| 多層整合造成的公開回歸 | 最小必要的 integration boundary test | 跨邊界的實際資料流 |

同一個內部邏輯預設只在一層驗證。只有在 page、route 或完整流程各自有獨立公開 contract 或失敗模式時，才保留多層 boundary test。

### Risk → Test → Test layer

每個新增、刪除或合併的測試，都要在設計書或變更說明中列出：

| Risk | Test | Test layer |
| --- | --- | --- |
| 例如新欄位缺失時仍送出無效 request | 缺少欄位的 validation case | validation/service |
| 例如 route 將 upstream error 暴露成 500 | 模擬上游非 2xx 並檢查 error envelope | API route |
| 例如重新整理後 draft 造成過期欄位送出 | 儲存舊版本 draft，再載入頁面並檢查遷移 | frontend hook/page |

不要只為了 coverage 百分比、每個 branch 或測試數量增加案例。測試必須對應具體產品行為、API contract、資料轉換、錯誤邊界或已知回歸風險。

### 專案驗證 gate 的引用

本節的 gate 是 `AGENTS.md` 定義的專案測試、型別檢查與建置驗證 gate，不是 `ai_code_review_guide.md` 的 Code Review Gate。驗證命令與適用條件必須引用 `AGENTS.md` 的「Build, Test, and Verification Commands」。本文件只負責把章節風險映射到測試層級：

- Domain、payload、簽名或 mapping：說明需要的 domain-level evidence。
- Service、validation 或 preset：說明需要的 service/validation evidence。
- API route 與 error envelope：說明需要的 API boundary evidence。
- React page、hook、loading、error、draft 或 route：說明需要的 frontend boundary evidence。
- 跨層流程：說明為何需要額外的最小 integration boundary evidence。

設計書應列出從 `AGENTS.md` 選出的命令、每個命令要證明的風險、未執行的驗證與剩餘風險；本文件不維護另一份命令清單。

## 待決策事項

只有確實會阻塞實作或會改變方案的問題才放在這裡。每個問題應列出：

| 問題 | 為什麼需要決策 | 選項 | 預設建議 | 影響範圍 |
| --- | --- | --- | --- | --- |
| 是否讓新 preset 欄位可選 | 影響舊 JSON 相容性與 validation | 可選並提供 default／強制 migration | 依既有 preset 讀取策略決定 | preset、service、測試 |
| preview 是否呼叫上游 | 影響費用、side effect 與 timeout | 純本地組裝／非破壞性上游請求 | 沿用目前 operation 語意 | domain、runner、UI |
| 新錯誤是否沿用既有 code | 影響 caller 與 UI mapping | 重用／新增 code | 能表達相同語意時重用 | route、operatorApi、測試 |
| 是否需要新增 page route | 影響導覽與部署 path | 沿用既有頁面／新增 route | 依使用者可觀察能力決定 | App、page、page test |

不要把「之後再看看」當成待決策事項。若沒有阻塞，直接記錄假設與理由。

## 設計書 Review 使用方式

本節只處理設計書完成後的自我檢查與內容審查。branch、diff、PR 與程式碼審核的流程、Gate 狀態、issue 處理與輸出，依 [ai_code_review_guide.md](ai_code_review_guide.md) 執行，本節不重複定義。

### 設計書自我檢查

完成設計書後，依序檢查：

1. 文件是否引用了實際存在的路徑、route、型別與 command。
2. 是否明確區分 domain、service、route、React page/hook 與 runtime wiring。
3. 是否把所有變更放進設計矩陣，並標示變更種類。
4. 是否列出變更前後行為，尤其是 API、preset、payload 與 UI 狀態。
5. 是否說明資料來源、合併順序、錯誤邊界與外部請求邊界。
6. 是否有把資料庫、Repository、OpenAPI SDK、UseCase、job 或雲端服務誤當成現有架構。
7. 是否說明每個測試要保護的風險與最低測試層級。
8. 是否符合 AGENTS.md 的測試、型別、JSDoc、資料 fixture 與結構規範。
9. 是否有可執行的完成定義與驗證命令。
10. 是否仍有待決策事項會改變實作方向。

### checklist.md 的處理原則

目前專案的最高規範來源是根目錄 `AGENTS.md`；設計書等級與撰寫流程依 `ai_design_doc_writing.md`，本文件只提供章節與案例參考。專案並沒有把不存在的 checklist.md 當成必然檔案。

若未來新增 checklist.md，它應該只負責可勾選的設計書自查或 release checklist，不能複製這份文件的架構解釋。若 checklist 需要支援 branch／PR Code Review，只能引用 [ai_code_review_guide.md](ai_code_review_guide.md)，不得複製或重新定義其中的 Gate、狀態與 issue 處理流程。設計書引用 checklist 時，必須確認檔案實際存在，並說明它與 `AGENTS.md` 的從屬關係。

### 設計書 Review 問題

設計書 Review 時優先問：

- 這個變更改的是哪一個公開行為，而不只是哪些檔案？
- 既有 domain、service、route、page 或 preset 的核心邏輯是否被完整沿用？
- 是否把同一條規則重複放在 UI、route 與 domain，造成未來漂移？
- 舊資料、舊 caller、舊 draft 與舊測試會發生什麼事？
- 失敗時使用者、API caller、server log 與上游各自看到什麼？
- 測試是否在正確的邊界證明風險，而不是驗證實作細節？
- 設計書是否描述了目前專案真的存在的架構？

好的設計書不是把所有可能的章節都填滿，而是保留既有核心邏輯，清楚標示真正改變的邊界，並讓另一位開發者能依照文件在這個專案中完成實作、測試與回復。
