# Preset 資料庫化中期改造設計書

## 文件定位

- 文件等級：完整開發設計書。
- 理由：本次變更會新增 PostgreSQL 持久化、migration、資料匯入、local / Supabase 部署邊界，並改變現有 JSON preset 的讀寫路徑。
- 狀態：已確認資料邊界與分階段方向；本機 PostgreSQL 端點是已知前提，尚未切換應用程式儲存層。
- 主要規範：[AGENTS.md](../../AGENTS.md)。

## 目標

1. 將目前 `data/deposit`、`data/payout`、`data/subscription` 的 preset 儲存逐步移至 PostgreSQL。
2. 讓本機 PostgreSQL 與線上 Supabase 使用同一套 SQL schema 與 migration。
3. 保留現有 API route path 與上游 domain payload key；defaults response 不返回 runtime-only merchant reference，merchant reference 由 domain/service 在第三方請求前決定最終值。
4. 讓 JSON 在過渡期可作為匯入來源、備份與測試 fixture，但不再作為最終 runtime source of truth。
5. 以可回復、可驗證、可分批上線的方式完成切換。

## 非目標

- 本階段不新增支付交易紀錄、付款嘗試紀錄或 webhook event schema。
- 不讓 React 前端直接連 PostgreSQL 或 Supabase。
- 不把 API key、sign key、merchant token 或其他 secret 寫入資料庫。
- 不把三項服務的動態 `merchantRef`／`merchantReference` 值寫入資料庫；這些值由 runtime 產生。
- 不在本機前置條件中處理 Supabase 專案現有資料與 schema 狀態。
- JCB JSON 修復延後至最終驗收階段。
- 不重寫既有 API route path 或上游 payload key；僅調整 merchant reference 的輸入／defaults response 語意，並可增加不含業務資料的 `presetMeta.updatedAt` concurrency metadata；不在 route handler 內加入資料庫業務邏輯。

## 現況與已知資料風險

目前三個功能各自實作 preset loader、normalizer 與 writer，再由共用的 preset-backed service 提供 defaults、save、preview、create 流程：

- `src/deposit/presets.ts`
- `src/payout/presets.ts`
- `src/subscription/presets.ts`
- `src/core/createPresetBackedService.ts`
- `src/server/routes/_shared.ts`

目前共有 45 個 channel JSON 與 3 個 common JSON。資料層存在三種語意層次：feature-level common values、channel-level common values，以及 channel-specific payload values。

現有 JSON common 檔案與既有 preset writer 會保存 `merchantRef` 或 `merchantReference`；這是本次要移除的 legacy persistence 行為。它們不是 preset，而是 request、preview 與 API payload 產生流程中的 runtime-only 值。既有 JSON 可讀取 legacy 值作為相容輸入，但 Phase 1 起所有 persistence adapter 都不得再寫入此欄位；前端只可作為目前操作的暫存值。

已知無效 JSON：

- `data/deposit/channels/JCB-JPY.json`
- `data/deposit/channels/JCB-USD.json`

這兩個檔案目前列為「已知、延後處理」：

- 在 JCB 修復或移除決策完成前只記錄問題，不修改、不刪除、不補資料。
- audit 與 migration 設計必須能列出這兩個檔案的狀態，不能把它們默默當成成功匯入。
- 最終驗收前必須完成修復或由資料 owner 明確確認移除，並重新執行完整資料 parity。
- 在上述完成前，不宣稱三個功能的資料已達到完整 parity。

## 設計結論

採用「關聯資料識別與生命週期 + `jsonb` 動態內容」的混合格式。

### 邏輯資料模型

`preset_sets`：每個 feature 一筆資料，保存可持久化的 feature-level common values。`feature` 是單一全域 preset scope 的唯一識別；本次不加入 tenant、user 或其他 scope 欄位。動態 merchant reference 不得出現在 `common_values`。

`preset_channels`：每個 `(feature, channel)` 一筆資料，保存 channel-level common values 與 channel payload values。

兩者只保存 `created_at` 與 `updated_at`；不建立 version / revision 欄位。`created_at` 只用於建立時間記錄，`updated_at` 作為 optimistic concurrency token。save 必須帶入讀取時的 expected timestamp，若資料已被其他 writer 更新則回傳 conflict，不能靜默覆蓋。`preset_channels` 使用 `(feature, channel)` 複合主鍵，並以 foreign key 關聯 `preset_sets`。

欄位 schema、欄位 label、required／readonly 規則、channel registry 與 validation 均為 code-owned。讀取 DB values 後，由既有 feature preset 程式組裝 defaults schema；資料庫不保存 schema，避免持久化資料與程式規則漂移。

資料表放在 server-only 的 `preset_store` schema；Supabase 不提供給前端 Data API 直接存取。正式環境需以 private schema 或等效的 RLS／privilege policy 阻止 anon／authenticated 角色讀寫。

JSONB 欄位必須限制為 JSON object：

- `common_values`
- `channel_common_values`
- `channel_values`

各 JSONB 欄位必須加上 top-level JSON object constraint。初期不建立深層 JSONB index，因目前查詢只需要依 feature 與 channel 定位資料。

預定的實體欄位為：`preset_store.preset_sets(feature, common_values, created_at, updated_at)` 與 `preset_store.preset_channels(feature, channel, channel_common_values, channel_values, created_at, updated_at)`；所有時間欄位由資料庫寫入。`feature` 必須限制為既有三項服務，所有 JSONB 欄位使用 `NOT NULL DEFAULT '{}'::jsonb` 與 top-level object check；foreign key、唯一鍵與 timestamp update 規則由 migration 固定。

### 欄位映射

| Feature | `common_values` | `channel_common_values` | `channel_values` |
| --- | --- | --- | --- |
| Deposit | `returnUrl` | `productNo`、`amount`、`currencyCode` | `payment_order` 等通道 payload |
| Payout | 空 object | 空 object | `product_no`、`amount`、`payout_info` |
| Subscription | `returnUrl` | 空 object | `amount`、`interval_*`、`consumer_*` 等 payload |

`merchantRef`（Deposit／Subscription）與 `merchantReference`（Payout）不寫入任何 PostgreSQL column 或 JSONB key。它們的欄位定義、產生規則與驗證邊界由既有程式碼維護；若 UI schema 仍需要顯示欄位，schema 也應以 code-owned definition 為準，而不是依賴資料庫中的值。

資料庫格式不是上游 API payload 格式。channel payload 的巢狀結構與 snake_case 欄位保留；目前 JSON 中巢狀欄位若含有固定的 `merchant_ref` 範例值，視為 channel template／顯示值，不作為本次 runtime merchant reference 解析，也不需要額外清除。若未來要讓巢狀值動態化，必須另立資料 mapping 設計。

每次需要 merchant reference 的 API operation（包括 preview／create）都由 domain/service 決定是否重用已產生的 transient candidate 或重新生成；server route 不決定商業值。建立第三方請求前，domain/service 必須產生或確認 final value，caller 提供的同名欄位不得覆蓋該值；外部 API payload 仍必須帶有最終的 `merchant_ref` 或 `merchant_reference`。

### 明確行為調整：merchant reference 不再隨 preset 儲存

- `GET /api/{feature}/defaults` 與 save 後的 defaults response 不返回 `merchantRef`／`merchantReference`；欄位缺席，不使用 placeholder 或空字串冒充 preset default。
- `POST /api/deposit/merchant-ref`、`POST /api/payout/merchant-reference`、`POST /api/subscription/merchant-ref` 是明確提供候選值的 API；preview／create 也可在 service/domain 內產生新值。所有產生都必須由 API operation 觸發，不可由 caller 手動指定商業值。
- Web／CLI 可以把產生結果暫存在目前操作的 in-memory state，作為 preview／create 的 transient candidate。它不是 source of truth，不得寫入 DB、JSON 或 sessionStorage draft；重新整理頁面後應視為失效並重新呼叫產生 API。
- preview 可以使用新生成值；create 可以重用 transient candidate 或重新生成；真正送出第三方 request 的值由 domain/service 在送出前決定，該值為 operation 的終態。
- request 中若仍帶有 legacy `commonValues.merchantRef`／`merchantReference`，只作相容解析，不得覆蓋 domain/service 的 final value；caller 端不再以此欄位作為必填輸入。
- 現有「save 後 reload 仍保留 merchant reference」的測試與 JSON writer 行為應改為驗證不持久化；這是刻意的產品行為調整，不是資料遺失。

`amount`、product number、currency code 先保留現有字串語意，不在本次 migration 強制轉成 numeric 或 enum。

`pix_brl` 目前具有「amount 不持久化」的特殊規則，DB adapter 必須維持此行為。

Channel 清單仍由 `src/core/env.ts` 與各 feature 的既有程式碼維護，不新增資料庫 channel registry；資料庫只保存已知 channel 的 preset row。

### 方案比較

| 方案 | 優點 | 風險／不採用原因 |
| --- | --- | --- |
| 每個 feature 保存一份完整 JSONB | migration 初期最簡單，匯入成本低 | common／channel 無法獨立做 optimistic concurrency，單一寫入衝突範圍過大，難以維持既有 merge 邊界 |
| 完全正規化所有 payload 欄位 | 欄位型別與查詢清楚 | 目前三項服務與 channel payload 差異大，會把現有 JSON schema 變成高成本且容易漂移的 migration |
| 關聯 envelope + JSONB 動態內容（採用） | feature／channel identity、timestamps、foreign key 與 transaction 邊界清楚；現有 payload 可原樣保存，適合中期逐步切換 | 深層 payload 仍需 code-owned validation；未來若需要 payload 欄位查詢，再針對實際需求增加 index 或專用欄位 |

### 影響面與變更前後行為

| 面向 | 分類 | 目前行為 | 新行為／不變事項 |
| --- | --- | --- | --- |
| Domain、request payload | 更改既有行為 | web／既有 builder 可把 caller 的 merchant 欄位帶入 request | final merchant reference 由 feature service／domain 在第三方 request 前產生或確認；上游 payload key 與簽名所需結構維持不變，caller 不得覆蓋 |
| Feature service、validation | 更改既有行為 | merchant reference 可能被當成 form／preset 值處理 | merchant 欄位非必填 input；service/domain 可重用 transient candidate 或重新生成，並在 final assignment 前驗證 |
| Preset、JSON | 更改既有行為 | common JSON／writer 可能保存 `merchantRef`／`merchantReference` | persistent projection 排除 merchant；舊 JSON 只做相容讀取與 audit，新的 JSON／DB writer 都不寫入；未知 payload 欄位依既有保留策略處理 |
| API route、response | 更改既有行為 | defaults 可返回 merchant placeholder／已保存值；route config 會提供產生 callback | route path 保持不變；defaults／save response omit merchant；route 只 dispatch service/domain operation；preset save 以 `expectedUpdatedAt` 防止 stale write，衝突沿用 error envelope 並回 `409` |
| Preview、create、runner | 更改既有行為 | preview／create 可能使用 caller 傳入的 merchant 值 | preview 可建立新值但不送第三方；create 在送出前由 service/domain 決定 final 值，送出 request 為 operation 終態；runner 邊界與上游錯誤處理沿用 |
| React page／hook | 更改既有行為 | merchant reference 可能被當作可保存的 form field | 可在當前操作的 in-memory state 暫存 candidate；不使用 DB、JSON 或 sessionStorage 恢復 merchant；reload 後重新生成 |
| Runtime wiring、依賴 | 新增能力 | 只有 JSON preset storage | 新增 server-only PostgreSQL adapter、migration、pool 與 feature flag；不引入 PostgreSQL client，不改變前端 bundle |
| 測試、驗證 | 更改既有行為 | 測試可驗證 merchant save/reload 後仍存在 | 改驗證 non-persistence、caller override 防護、final generation、concurrency、transaction 與 disposable DB lifecycle；每個案例映射到具體風險 |

### Preset concurrency token

- DB 的 `created_at` 是 immutable audit timestamp；`updated_at` 是每次成功更新後由資料庫產生的 optimistic concurrency token。兩者不是 merchant reference，也不進上游 payload。
- defaults 與 save response 增加非業務 metadata `presetMeta.updatedAt`；save request 帶入上次讀取到的 `expectedUpdatedAt`。首次建立不存在的 row 時才允許使用 `null` token。
- repository update 以 primary key + expected `updated_at` 條件執行；沒有匹配 row 時回傳 preset conflict（HTTP `409`、既有錯誤 envelope），不得默默以最新資料覆蓋或重新合併。
- 一次 save 若同時影響 `preset_sets` 與多個 `preset_channels`，必須在同一 transaction 檢查所有 expected timestamps；任一 row conflict 就整筆 rollback。`created_at` 不可由 caller 提交或改寫。

## Runtime 邊界

```text
Web / CLI
  -> API route
    -> feature service（合併、operation policy）
      -> preset storage interface（只處理可持久化 projection）
        -> JSON adapter（過渡期）
        -> PostgreSQL adapter（本機 / Supabase）
      -> domain/request builder（產生 final merchant reference、組裝上游 request）
        -> third-party runner
```

### 持久化與 operation data 邊界

| 資料類型 | 內容 | 可存在的位置 | 生命週期與責任 |
| --- | --- | --- | --- |
| Persistent preset projection | feature common、channel common、channel payload、`created_at`、`updated_at` | JSON fixture／PostgreSQL | storage adapter 負責讀寫；切換後 PostgreSQL 為 runtime source of truth |
| Transient operation context | form values、preview context、merchant reference candidate、create 的暫存候選值 | server request／service operation context；前端可放當前頁面的 in-memory state | 不進 persistence；頁面 reload、operation 結束或第三方 request 送出後即失效 |
| Final external value | domain/service 在建立第三方 request 前決定的 `merchant_ref`／`merchant_reference` | 該次 outgoing request 與必要的 API response | 由 domain/service 產生或確認；route 不決定，caller 同名欄位不得覆蓋 |
| Fixed template value | 現有巢狀 JSON 內的固定 `merchant_ref` 範例／顯示值 | 對應 channel payload template | 本次保留原值，不解析成 runtime merchant reference；若要動態化另立 mapping 設計 |

Storage interface 不接收「是否重用 merchant reference」的商業決策，也不把 transient operation context 寫成 preset。API route 只負責 HTTP parsing、基本 validation、呼叫 service 與回傳結果；feature service／domain 負責 operation policy、最終值與第三方 request 前的檢查。

### Merchant reference API contract

| Operation | 對 caller 的契約 | merchant reference 行為 | persistence |
| --- | --- | --- | --- |
| `GET /api/{feature}/defaults` | 回傳 persistent preset 與 code-owned defaults | 不返回 `merchantRef`／`merchantReference`；不恢復舊值 | 不寫入 |
| `POST /api/{feature}/merchant-ref` 或 `merchant-reference` | 只要求系統產生候選值，不接受 caller 指定商業值 | 回傳一次候選值；前端可暫存，但不保證後續 operation 必定重用 | 不寫入 |
| `POST /api/{feature}/preview` | 可帶目前操作的 transient candidate；同名欄位不是權威值 | service/domain 可重用 candidate 或重新生成；preview 不代表已送出第三方 request | 不寫入 merchant reference |
| `POST /api/{feature}/create` | 可帶目前操作的 transient candidate；caller 同名欄位不得覆蓋 final value | service/domain 在送出第三方 request 前決定 final value；create 可重用或重新生成，送出 request 後即為終態 | 不寫入 merchant reference |
| `service.saveDefaults`／CLI preset save（目前沒有對應的 HTTP save route） | merchant 欄位即使存在也只作 legacy compatibility input；另帶 `expectedUpdatedAt` | 忽略其商業值，不納入 preset projection；stale token 回 `409` | 只寫 persistent projection |

這裡的「GET defaults 不返回」專指不返回任何上次 operation 產生的 merchant reference；其他 persistent preset 欄位仍依資料庫 projection 與 code-owned defaults 的既有合併規則回傳，不因 merchant non-persistence 而被整體 reset。

因此前端 cache 是允許的，但只能是「目前操作的暫存最佳化」，不能被當成跨 reload、跨 session 或跨 request 的正確性保證；API contract 不保證 merchant reference 在 `merchant-ref`、preview 與 create 之間固定不變。若產品日後要求穩定重用或 idempotency，應另建明確的 operation token／idempotency 設計，而不是把 merchant reference 寫進 preset。

### HTTP contract 與 canonical operation flow

以下列出實際存在且受本設計影響的 HTTP paths；save 目前是 service／CLI operation，不在本次新增 HTTP route。

| Method / path | Input | Output／status | Error／environment | Side effect／compatibility |
| --- | --- | --- | --- | --- |
| `GET /api/deposit/defaults`、`GET /api/payout/defaults`、`GET /api/subscription/defaults` | 既有 `channel` query；target environment 沿用既有受控 header／context | 既有 defaults bundle + 非業務 `presetMeta.updatedAt`，HTTP `200`；merchant 欄位缺席 | 沿用既有 error envelope；DB unavailable 不 fallback；只接受受控 target environment | 只讀 persistent projection；舊 frontend 需忽略新增 metadata，不能依賴 merchant placeholder |
| `POST /api/deposit/merchant-ref`、`POST /api/payout/merchant-reference`、`POST /api/subscription/merchant-ref` | 不接受 caller 指定 merchant 商業值；沿用既有 target context | 既有 generated-reference response，HTTP `200` | 產生失敗沿用既有 route error mapping；只在 server-side 產生 | 只產生 transient candidate，不寫 DB／JSON；frontend 可暫存 |
| `POST /api/deposit/preview`、`POST /api/payout/preview`、`POST /api/subscription/preview` | 既有 request values；merchant 欄位 optional，legacy 同名欄位不得覆蓋 service/domain 決策 | 既有 preview response，HTTP `200` | validation 仍走既有 boundary；preview 不呼叫 third-party runner | 可生成或重用 transient candidate；不寫 persistent merchant reference、不產生第三方 side effect |
| `POST /api/deposit/create`、`POST /api/payout/create`、`POST /api/subscription/create` | 既有 request values；可帶 candidate，但 final merchant value 不由 caller 決定 | 既有 create response，成功 HTTP status 沿用目前 route；上游錯誤保留既有 status／envelope | service/domain 在 runner 前完成 final assignment；DB／上游錯誤分別走既有錯誤邊界 | 送出 third-party request 是 operation 終態；不持久化 merchant reference |

Canonical flow 固定如下：

```text
GET defaults
  -> storage read persistent projection
  -> code-owned schema/default merge
  -> omit runtime-only merchant fields

POST preview
  -> route parse + existing validation
  -> feature service/domain chooses candidate or generates new value
  -> request builder creates preview payload
  -> return preview（不進 third-party runner）

POST create
  -> route parse + existing validation
  -> feature service/domain chooses or generates final merchant value
  -> request builder creates final payload/signature
  -> runner sends third-party request
  -> return result；送出後不再把 merchant value 當作可持久化 preset
```

在本機 runtime 切換 phase 前不切換儲存 runtime，仍以 JSON adapter 提供服務；但 Phase 1 已確認的 merchant non-persistence 與 defaults omission 行為例外適用。PostgreSQL 連線只存在 Bun server / CLI，不能進入 `web/` bundle，也不能使用 `VITE_` 前綴暴露連線資訊。

資料庫故障時不可靜默回退至 JSON，避免兩個 source of truth 分歧；正式 PostgreSQL runtime 應回傳既有錯誤邊界可處理的 server error。

## 已知前提與資料庫執行約束

以下是後續 phase 的前置條件，不單獨算作交付 phase：

- 本機 PostgreSQL 18.6 使用 `127.0.0.1:5432`，2026-10-22 已確認可接受連線。
- 已確認採單一全域 preset scope；migration 以 `feature` 作為 `preset_sets` primary key，不為未確認的多租戶需求預留空白 scope 欄位。
- 專案最低 Bun 版本為 `1.4.3`；目前本機 `bun --version` 為 `1.4.3`。CI 與開發環境必須在執行前檢查 `bun --version >= 1.4.3`。
- 資料庫存取使用 Bun 原生 SQL（`Bun.sql`／`SQL`），不新增 `pg` 或其他 PostgreSQL client dependency。
- Bun 原生 SQL 已提供 pool、prepared statement 與 transaction；transaction 使用 callback 邊界，callback throw 或 reject 時由 Bun 自動 rollback，成功完成才 commit，不手動拼接 transaction SQL。

### `DATABASE_URL` 環境驗證與連線生命週期

- `DATABASE_URL` 是 server-only 設定，只有 PostgreSQL adapter 啟用時才必填；JSON adapter 與既有 API 測試不得因缺少它而失敗。
- 啟動時必須由後端 env/config boundary 驗證 `DATABASE_URL`：不可為空、必須是 `postgres://` 或 `postgresql://` URL，並以 `SELECT 1` 完成連線探測；錯誤訊息不得輸出密碼。
- `INTEGRATION_DATABASE_URL` 使用相同 URL 格式驗證，且必須明確與 runtime `DATABASE_URL` 分離；test setup 不得以 runtime URL 作為 fallback。
- 連線失敗、URL 無效或環境缺漏時要明確失敗，不可靜默回退到 JSON，避免產生兩個 source of truth。
- 每個 Bun server／CLI process 建立一個可重用 SQL pool；不得每個 request 建立新連線。
- server／CLI 的 `stop()`、測試 `afterAll` 與 process teardown 必須先停止使用 repository，再 `await sql.close()`，確保 pool 與所有連線釋放完成。

### 可丟棄的 integration-test PostgreSQL database／schema

- integration test 只能連專用的 disposable database，不得使用開發資料庫、Supabase production 或使用者指定的 runtime `DATABASE_URL`。測試設定透過 `.env.test` 提供 `INTEGRATION_DATABASE_URL`；runtime 與 integration test URL 分開命名、分開驗證。
- CI 每次 run 建立一個新的 integration-test PostgreSQL database，run 結束且所有連線關閉後刪除整個 database。本機可保留專用的 `examine_api_integration_test` database，但每次 run 必須重置其測試 schema；不能把它當作 development 或 application runtime database。
- database 內使用固定的 `preset_store` schema，套用與 local／Supabase 相同的 canonical migration；不採用 run-scoped schema。隔離由 disposable database 提供，避免動態 `search_path`、migration history 與 SQL identifier 組裝造成測試和正式環境行為分歧；不得使用 `public` 作為 preset table 寫入範圍。
- database provisioner（CI 或具管理權限的本機 setup）負責建立／刪除 database；測試 process 的 role 不需要 `CREATEDB`，也不負責自行刪除 database。若本機使用固定 database，測試前由明確的 reset 流程刪除／重建 `preset_store` schema，不能使用 runtime URL。
- `beforeAll`：驗證 Bun 版本與 `INTEGRATION_DATABASE_URL`，建立 SQL pool，執行 `SELECT 1`，套用目前 migration 並確認 migration history 完整，再啟動測試 server／repository。migration runner 必須使用固定 schema，且只在此 disposable database 執行。
- `beforeEach`：在 `preset_store` 內以 transaction-safe 方式清空 preset tables 並載入 fixture；不得寫入、覆蓋或刪除原始 `data/*.json`。需要並行 worker 時，改用每個 worker 一個 disposable database，不以共用 database + 隨機 schema 取代隔離。
- `afterAll`：先停止測試 server／repository，再 `await sql.close()`；測試 process 結束後由 provisioner 在所有 pool 關閉後刪除 CI database，或在本機 reset 流程中清理固定 database 的 `preset_store` schema。任何清理失敗都必須讓測試工作明確報錯。
- integration boundary 必須驗證 callback 失敗 rollback、DB unavailable、migration 套用、`updated_at` stale-write conflict、pool close 與 disposable database cleanup；不可只以 mock 取代 repository integration boundary。

## 分階段執行

每個 phase 都要有自己的產物與 gate；未通過當前 phase 時，不進入下一個需要它的 runtime 或 deployment phase。Phase 1–4 不切換 production 的 storage driver；Phase 5 才開始本機切換。前述本機 PostgreSQL 端點已可連線是已知前提，不另列為 phase。

### Phase 1：Storage boundary、JSON adapter 與資料 audit

- 定義 feature-independent storage interface，明確區分 persistent preset projection 與 transient operation context。
- 將現有 JSON loader／writer 包裝為 JSON adapter；從這一 phase 起 writer 不得寫入 `merchantRef`／`merchantReference`。
- 舊 JSON 中的 merchant 欄位可讀取作為 migration compatibility input，但不可成為 defaults、save response 或新的 JSON persistence。
- `GET defaults` 不返回 runtime-only merchant 欄位；缺少的可持久化欄位仍依現行 code-owned defaults／preset contract 補齊。
- validator 接受沒有 merchant 欄位的 request；legacy 同名欄位不可作為 final value。前端只建立目前操作的 in-memory candidate，不使用 `sessionStorage` 或其他持久化 draft。
- 將現有 route 的 `generateMerchantRef` callback 與 request builder 內的 merchant sanitize／fallback 降為轉送或相容處理；route、web form builder 不決定商業值，值產生、重用／重生與 final assignment 統一由 feature service／domain request builder 負責。
- 建立全量 data audit，對無效 JSON（包含 JCB）輸出可追蹤的 `invalid`／`deferred` 狀態，不修改、不刪除、不默默跳過。

**Phase 1 gate：** JSON adapter round-trip、defaults merchant omission、save 不持久化 merchant、audit report 與既有 API boundary 測試完成；尚未接 PostgreSQL，也不切換 runtime。

### Phase 2：Schema、canonical migrations 與 DB lifecycle

- 建立 `supabase/migrations` 版本化 canonical SQL；migration 只描述 schema 與 constraint，preset data import 由獨立 importer 負責。
- 建立 `preset_store` private schema、`preset_sets`、`preset_channels`、foreign key、feature/channel uniqueness、JSONB object constraints 與 database-managed timestamps。
- 在 migration 中建立 migration history；local／integration 由 Bun migration runner 套用，Supabase 由 Supabase CLI 套用相同 canonical SQL。單一環境只允許一個 migration owner，不混用兩套 history。
- 補上 `DATABASE_URL`／`INTEGRATION_DATABASE_URL` 的環境驗證、`SELECT 1` 探測、可重用 Bun SQL pool 與 `await sql.close()` 生命週期；不引入 PostgreSQL client。
- 明確固定 Bun `>=1.4.3`，並在 CI／啟動與 integration setup 入口檢查版本。
- 完成 disposable integration database／固定 `preset_store` schema 的 provision、reset、teardown 流程；測試 role 不具備 `CREATEDB`。

**Phase 2 gate：** fresh database 可套用 migration、重複套用為 no-op、migration history 正確、constraint／timestamp 行為可驗證，且 integration database 在連線關閉後可清理；尚未匯入 preset data，也不切換 runtime。

### Phase 3：PostgreSQL adapter 與 repository integration tests

- 實作 PostgreSQL adapter 的 canonical read／save；只讀寫 persistent projection，不接受 merchant reference 作為可持久化欄位。
- save 必須在單一 Bun SQL transaction 中完成 feature common 與所有受影響 channel row 的寫入；callback throw／reject 時由 Bun rollback，成功才 commit。
- 讀取 snapshot 時帶回 `created_at`／`updated_at`；寫入使用每個受影響 row 的 expected `updated_at` 做 optimistic concurrency check。任一 row stale 時整筆 save 回傳 conflict 並 rollback，不可 last-write-wins 靜默覆蓋。
- 使用 prepared statement／參數化 SQL；資料庫故障明確回傳 server error，不 fallback 到 JSON。
- 新增必要的 repository integration tests，使用 disposable integration database；測試 server／repository 的 stop 與 pool close 必須由 lifecycle hook 驗證。
- adapter 先保持 disabled，避免未完成 import 前誤切換 runtime。

**Phase 3 gate：** read／save round-trip、common/channel atomicity、stale-write conflict、transaction rollback、DB unavailable、pool close 與 merchant non-persistence 均有對應測試；尚未切換本機 runtime。

### Phase 4：Importer、parity 與 readiness report

- 以 canonical projection 將已通過 audit 的 JSON 匯入 PostgreSQL；common 與 channel row 的 mapping 必須可重複執行，且保留 `created_at`／更新 `updated_at` 的明確規則。
- importer 明確排除 `merchantRef`／`merchantReference` 及其 legacy top-level 值；巢狀 JSON 的固定 `merchant_ref` template 值依現況保留，不把它誤判成 runtime merchant reference。
- 每次匯入產出 manifest：source file、target row、row count、checksum、`ready`／`deferred`／`invalid` 狀態與錯誤原因。checksum 只比較 persistent projection，merchant reference 另由 API boundary 驗證。
- 匯入具 transaction boundary 與 idempotency；匯入前保存 JSON snapshot，匯入後保存 PostgreSQL dump／export。
- JCB 檔案維持 `deferred`，在修復或移除決策完成前不得報告「完整 parity」；其餘資料可先完成 local readiness。

**Phase 4 gate：** importer 可重跑、manifest 可審計、可持久化資料 parity 通過、JCB deferred 明確可見，且沒有任何 merchant reference 寫入 DB；尚未進行 production 或 Supabase runtime switch。

### Phase 5：本機 runtime cutover

- 以 `PRESET_STORAGE_DRIVER=json|postgres` 控制 adapter；預設仍為 `json`，切換需顯式設定。
- local preflight 必須確認 migration、import manifest、DB connectivity 與 parity report。JCB `deferred` 只能在明確的 non-production local gate 下允許切換，且報告仍標記為 incomplete；staging／production 不接受 deferred readiness。
- 本機切換後 PostgreSQL 是唯一 runtime source of truth；不得 per-channel 靜默 fallback 到 JSON。JSON 保留為 read-only export／fixture 與明確 rollback source。
- 驗證 `GET defaults`、save、preview、create、merchant-ref generation、前端 transient candidate、final upstream payload 與 DB 不保存 merchant reference。

**Phase 5 gate：** local API／domain／repository integration gates 通過，切換與復原演練完成，且無雙寫或 silent fallback；未通過時維持 JSON runtime。

### Phase 6：Supabase staging

- 先確認 Supabase 專案是否已有 schema／data；若非空，先以 remote baseline（例如 `db pull`）納入 migration review，不直接覆蓋。
- 以 Supabase CLI 套用同一組 canonical migrations，確認 `preset_store` private schema、role privilege／RLS policy 與 server-only `DATABASE_URL` 邊界。
- 執行 staging import、manifest、parity、API smoke test 與 rollback rehearsal；只連 server-side credential，不把 service credential 或 DB URL 放入前端。
- staging 僅驗證部署與行為，不視為 production cutover 授權。

**Phase 6 gate：** remote migration history、schema security、data parity、merchant boundary、DB lifecycle 與 staging rollback rehearsal 通過；JCB 仍 deferred 時不得進入 production acceptance。

### Phase 7：最終驗收與切換決策

- 修復兩個 JCB JSON，或由資料 owner 明確確認正式移除；重新執行全量 audit、import、parity 與 manifest review。
- 驗證三項服務的 defaults、save、preview、create、merchant-ref generation 與第三方 request final value；確認 caller 同名欄位不能覆蓋 domain/service 決定的值。
- 驗證 `created_at` immutable、`updated_at` optimistic conflict、transaction rollback、DB unavailable、pool close、disposable test DB cleanup 與 no-fallback 行為。
- 完成 JSON→PostgreSQL 與 PostgreSQL→JSON 的 rollback rehearsal；確認切換後寫入不會因直接切回舊 JSON 而遺失。
- 產出 go／no-go checklist；未通過不得進入 production。

**Phase 7 gate：** JCB 已處理、全量 parity 通過、security／lifecycle／rollback 證據完整，並取得 production cutover 核准。

### Phase 8：Production cutover 與 JSON runtime 退場

- cutover 前保存 JSON snapshot、PostgreSQL backup、migration history 與 import manifest。
- 套用 remote migration、執行 verified import、確認 connectivity 與 parity，再將 runtime flag 切為 PostgreSQL。
- 切換後停止 JSON runtime write；保留 JSON export／fixture 與一段保留期內的 read-only recovery material，不直接刪除原始資料。
- 監控 defaults、save、preview、create、upstream request、DB error 與 conflict；若出現問題，依 rollback 規則處理，不用靜默 fallback。

**Phase 8 gate：** production smoke test、監控與 rollback window 通過後，才可宣告 PostgreSQL 為唯一 runtime source of truth。

## 完成定義

- 三項服務的 persistent preset projection 已由同一套 canonical schema／migration 表達，local PostgreSQL 與 Supabase migration history 可追蹤且無 drift。
- `GET defaults`、preview、create 與 preset save 的公開行為符合本設計：merchant reference 不進 defaults／persistence，final value 由 service/domain 在 runner 前決定，caller 不能覆蓋。
- JSON audit、import manifest 與 parity 證明所有可持久化資料已匯入；JCB invalid files 已修復或由資料 owner 明確移除，沒有未揭露的 deferred exception。
- `created_at`／`updated_at`、optimistic conflict、Bun transaction rollback、DB unavailable、pool close、integration database cleanup 與 no-fallback 行為都有對應證據。
- local、staging、production 的 cutover 都可由 feature flag 控制；若 PostgreSQL 已有新寫入，rollback 會先 export／backfill 或 forward-fix，不會直接切回過期 JSON。
- 驗證命令與結果、未執行部分及剩餘風險均記錄在實作交付說明；文件完成本身不代表上述 runtime 已部署。

## Rollback

- Phase 5 前：adapter 尚未啟用，保持 JSON runtime 即可回復；不需要資料回灌。
- Phase 5 或 Phase 8 切換後若 PostgreSQL 已有新寫入，不可直接把 flag 切回 JSON，因為 JSON snapshot 可能已過時。優先在 PostgreSQL forward-fix；若必須回到 JSON，先停止寫入、以 PostgreSQL export／backfill 更新 canonical JSON、重新執行 parity 並取得核准，才可切回 JSON。
- rollback export 必須遵守相同的 persistent projection 邊界，不得把 merchant reference 寫回 JSON；transient merchant reference 不屬於可回復資料。
- Supabase schema 變更以 forward migration 為主；`db reset --linked` 僅可用於明確的 disposable staging，不可用於 production。production 依 backup、forward fix 或受控 data restore 處理。
- 每次 remote cutover 前必須保留 schema／data backup、migration history、import manifest 與可重建的 JSON fixture；rollback window 內保留原 runtime artifact。

## Risk → Test → Test layer

| Risk | Test | Test layer |
| --- | --- | --- |
| common/channel 合併錯誤 | defaults load/save round-trip | preset / domain |
| 動態 merchant reference 被誤寫入資料庫 | import、save、round-trip 與 export 斷言不含 merchant reference；final API payload 仍含 domain/service 產生值 | importer / repository + API boundary |
| caller 同名欄位覆蓋 final merchant reference | 帶入 legacy `merchantRef`／`merchantReference` 的 preview／create request，確認 final upstream payload 由 service/domain 決定 | service + API boundary |
| merchant candidate cache 被誤當成 source of truth | candidate 可遺失或改變時，preview／create 仍能由 service 產生 final value；reload 不恢復舊值 | frontend boundary + service |
| 缺少 merchant input 導致 API 失敗或手動注入 | 不帶 merchant 欄位仍可進入 service；只有產生 API／domain generator 能建立商業值 | validation + service |
| 動態巢狀 payload 遺失或固定 template 被誤清除 | representative channel JSONB round-trip；固定巢狀 `merchant_ref` 維持原值且不被當作 runtime 值 | importer / repository integration |
| transaction 部分寫入 | Bun SQL transaction callback throw／reject 後 common 與 channel 都未提交的 rollback test | repository integration |
| concurrent save 靜默覆蓋 | 以舊 `updated_at` 寫入，確認回傳 conflict 且所有受影響 row rollback；成功更新只改 `updated_at`、保留 `created_at` | repository integration |
| DB 故障被靜默 fallback | DB unavailable response test | API route |
| JCB 或其他 JSON 解析錯誤被吞掉 | data audit／importer manifest 保留 `invalid`／`deferred` 原因，readiness 不可誤報 complete | import boundary |
| `pix_brl` amount 持久化語意改變 | special channel persistence test | preset |
| migration owner／remote history drift | local fresh DB、integration migration history、Supabase dry-run／staging push | deployment |
| disposable test DB 或 pool 未清理 | afterAll stop、`sql.close()`、CI database teardown failure test | test infrastructure |

## 驗證 Gate

- 後端 storage / API 變更：`bun run test:api`、`tsc --noEmit`、必要時 `bun run build:api`。
- DB integration gate：檢查 `bun --version >= 1.4.3`、`INTEGRATION_DATABASE_URL` 與 runtime `DATABASE_URL` 分離、migration history、`SELECT 1`、transaction rollback、`updated_at` conflict、`sql.close()`、固定 `preset_store` schema reset 與 disposable database cleanup。
- 若新增資料夾或 migration 目錄：`bun run structure` 並確認 `structure.md`。
- Supabase migration：local fresh database、migration history、dry-run、staging parity；production push 需人工核准。
- Phase 7 最終驗收：JCB 修復／移除、全量 JSON audit、可持久化資料 parity、runtime merchant reference 產生結果、DB export／rollback 演練。
- Phase 8 production：backup、verified import、cutover smoke test、監控與 rollback window；不得以未執行的測試宣稱完成。

## 適用的設計參考章節

- Domain、型別與 payload：merchant reference 的來源、final assignment、上游 payload key 與 caller override 邊界。
- Feature service 與 validation：defaults、preview、create、save 的共用流程與缺少 merchant 欄位的驗證語意。
- Preset 與 JSON 資料：common／channel merge、persistent projection、legacy read、audit、import 與前端 transient state 的區分。
- API 與 route handler：實際 HTTP paths、input／output／error／environment／side effect，以及 route 只做 HTTP boundary。
- 業務流程與外部請求：preview 不送上游、create 在 runner 前決定 final value、第三方 request 為 operation 終態。
- React UI 操作設計：merchant candidate 只存當前頁面的 in-memory state，不使用 session draft 恢復。
- Runtime wiring 與依賴注入：Bun SQL pool、`DATABASE_URL`、server／test lifecycle 與 feature flag。
- 相容性、部署與回復：JSON→PostgreSQL migration、Supabase rollout、backup、rollback 與 JSON 退場。
- 測試與驗證：integration database／schema lifecycle、Risk → Test → Test layer 與 `AGENTS.md` gates。
- 不適用：本次不新增 React route、交易歷史、webhook、background job、ORM 或通用 queue。

## 依據與來源

| 來源 | 用途 |
| --- | --- |
| [AGENTS.md](../../AGENTS.md) | 專案唯一共用規範、測試／建置／完成 gate、資料 fixture 與 lifecycle 要求 |
| `src/core/createPresetBackedService.ts`、`src/server/routes/_shared.ts` | 既有 defaults／save／preview／create service flow 與 HTTP dispatch 邊界 |
| `src/deposit/`、`src/payout/`、`src/subscription/` 的 `presets.ts`、`service.ts`、`web.ts` | 現有 preset mapping、merchant generator、request builder 與 writer 行為 |
| `data/{deposit,payout,subscription}` | JSON common／channel shape、shared fields、fixed nested `merchant_ref` 與 JCB invalid files |
| [Bun SQL official documentation](https://bun.sh/docs/runtime/sql) | Bun native SQL pool、prepared statement、transaction callback rollback、`sql.close()` 行為 |
| [Supabase database migration documentation](https://supabase.com/docs/guides/local-development/database-migrations) | versioned migration、remote baseline、staging 與 deploy workflow |

## 待確認事項

| 事項 | Owner | 影響 | 處理時機 |
| --- | --- | --- | --- |
| JCB-JPY / JCB-USD 真實資料或移除決策 | 資料 owner | 完整 import parity 與 production readiness | Phase 7 |
| Supabase 專案是否已有 schema / data | 部署 owner | remote baseline 與 migration 策略 | Phase 6 前 |
| local／integration migration runner 的維護 owner | Backend owner | migration history、fresh DB 與 CI 可重現性 | Phase 2 |
