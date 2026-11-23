# Code Review：pending-dev

## Review 基準

- Review 模式：PR Reviewer 全域審核。
- Review 深度：Deep；目前 base-to-head diff 為 7 個檔案，`+195 / -420`，涉及 Deposit/payment family catalog guard、catalog tests 與 obsolete verification cleanup。
- Base：`d1d89a2ab191ef222099a4d86a176c354cc39aaa`（`merge-base(origin/dev, dev)`）。
- Head：`b7c559f7c3db85845ad076610d65f361c4baea0a`（`fix: enhance family catalog completness guard`）。
- Phase 1 candidate `48cc6f2` 的產品行為仍以歷史 review 範圍判定；`a1334bb` 的 cleanup 保留，`b7c559f` 另外補上 generic family catalog 的 runtime completeness guard。
- Worktree 在本輪 review 前為 clean；`d1d89a2`、`be50f99` 及其他產品變更仍不納入 Phase 1 product verdict。
- Specialist ledger：本輪沒有新增 Security／Architecture specialist；這次是單檔 internal guard 修正，由主 reviewer 完成呼叫鏈與 Deep adversarial pass。
- 歷史 parity record 只作為 `1ddc22b → 48cc6f2` 的一次性證據，不是目前 branch HEAD 的驗證，也不是 repository gate。

## Gate 1：分支實作目標、完整性與範圍

### 目標清單

1. 在 `src/deposit/presets.ts` 以 Loki intercard、Google Pay 與 Apple Pay 的 family base 加 variant override 重組 seed config，保留既有 channel ID、JSON mapping、normalization、API request 與 UI label contract。
2. 補回 Apple Pay Japan 的三個 `telephone_number=+819012345678` boundary assertions，新增 catalog invariant、JSON precedence 與 sibling nested-value isolation coverage。
3. 對每個 family catalog 與 manifest family subset 執行 completeness 檢查，設定錯誤需列出 family、missing channels 與 unexpected channels。

### 完整性與範圍結果

實作、測試與歷史 evidence 均存在，`src/core/env.ts`、domain、route、JSON data、UI route 與 label 沒有被 Phase 1 candidate 修改。Family composer、Apple Pay nested composition、generic family completeness guard、JSON whole-field precedence 與 API defaults contract 均符合目標。

範圍備註：`devlope_guides/ai_design_doc_writing.md` 的一般性表格與 Mermaid 寫作規則依目前要求保留，不在本次 cleanup 範圍內。

## Gate 2：原有業務邏輯變更

- `getSeedChannelConfigs` 從逐 channel literal 改為 family composer；輸出型別與 channel key 保留，預期降低重複 schema／values 維護成本。
- Loki 與 Google Pay 使用共用 base 加 variant common values；Google Pay Japan 保留獨立 schema／values override，Google Pay USD 仍為空 schema 與空 values。
- Apple Pay 新增明確的 top-level、`payment_order` 與 `collect` composition，variant 只覆寫 product name 與 telephone number 等指定欄位，且每個輸出使用 clone。
- `src/deposit/web.test.ts` 保留 catalog set、Loki／Google Pay／Apple Pay representative、Apple Pay Japan exact contract 與 sibling nested-value isolation；三個 Apple Pay Japan case 補回 exact telephone assertion。
- 後續 cleanup 移除 obsolete verification scripts 與 issue tracking，不修改 production API route、domain payload、signature、database 或 JSON source。
- `assertFamilyCatalogComplete` 以 `DEPOSIT_CHANNELS` 的 family subset 比對實際 variant keys；Loki intercard、Google Pay 與 Apple Pay 共用 missing／unexpected channel guard。

## Gate 3：原有 Runtime 潛在錯誤風險

既有 active route 仍經由 `createDepositService`、`loadDepositPresets`、`normalizeDepositPresets`、`buildDepositRequestFromForm` 與 structured request path。Completeness guard 只在 seed catalog 建立時檢查設定，完整 catalog 的既有輸出與 route wiring 不變；未發現既有成功／失敗路徑中斷。

## Gate 4：新增錯誤風險

新增的 catalog 設定錯誤分支會在 seed config 建立時以 `TypeError` 明確列出 family、missing channels 與 unexpected channels；正常 catalog 不新增外部副作用或 API 契約變更。未發現未處理的新增錯誤風險。

## Gate 5：架構、封裝與依賴

### PASS：Family catalog completeness guard 已補正

`src/deposit/presets.ts:547-562` 新增共用 `assertFamilyCatalogComplete`，以 manifest-derived family subset 對照實際 variant keys，並在 `createFamilyChannelConfigs` 回傳前拒絕 missing／unexpected channels。Apple Pay 也改用同一 guard；錯誤訊息包含 family 與 channel identifiers。原先的 MEDIUM advisory 已由 `b7c559f` 修正。

既有 `src/deposit/web.test.ts:335` 仍驗證最終 seed channel set 與 manifest 完全一致；本次沒有新增測試案例，guard 的新增分支由靜態呼叫鏈、型別檢查、API test 與 API build 驗證。

## Gate 6：重要資料持久化靜態安全性

Phase 1 candidate 沒有修改 `data/*.json`、JSON save path、database、migration 或重要業務狀態寫入決策。Production persistence scope 無新增 issue。

## Gate 7：本機單元測試

- 目前 `HEAD=b7c559f` 執行 `bun run test:api`：182 pass、0 fail、754 `expect()` calls，21 files。
- 目前 `HEAD=b7c559f` 執行 `tsc --noEmit`：pass。
- 目前 `HEAD=b7c559f` 執行 `bun run build:api`：pass，Bundled 36 modules。
- `git diff --check`：pass。
- `bun run test:web`：未執行。Phase 1 candidate 沒有 frontend source、route 或 UI behavior change。
- `bun run test:db`：未由 AI 執行。Phase 1 沒有 database／migration change，且依 `AGENTS.md` 由使用者或 CI 負責。

## Review 結論

- `APPROVE`。`b7c559f` 已補上 generic family catalog completeness guard，並完成 Phase 1 family refactor、Apple Pay nested composition、Apple Pay Japan contract assertions、JSON precedence test 與 API build/test evidence；obsolete verification artifacts 與永久 parity gate 已移除。
- 歷史 parity evidence 只保留為一次性 baseline-to-candidate 紀錄，不驗證目前 branch HEAD，也不形成 repository gate。
- `48cc6f2` 之後的 `d1d89a2`、`be50f99` 及其他產品變更不在 Phase 1 product verdict 範圍。
- `bun run test:db` 未由 AI 執行；本階段沒有 database／migration change，依 `AGENTS.md` 由使用者或 CI 負責。

status:           APPROVE for HEAD b7c559f; historical parity evidence is non-gating
files changed:    7 (+195 -420) in base-to-head review scope
scope:            on target; Phase 1 family catalog plus focused cleanup
user-visible delta: none
review depth:     deep
risk tier:        deposit/payment; human review pending
hard stops:       0 found, 1 fixed, 0 deferred; no blocking findings remain
sibling sweep:    generic family helper and Apple Pay shared guard checked; no unreviewed same-shape builder
specialists:      none activated this round; primary reviewer adversarial pass completed
new tests:        0; existing catalog set invariant retained
public actions:   none
doc debt:         none
verification:     `bun run test:api`, `tsc --noEmit`, `bun run build:api`, and `git diff --check` at HEAD b7c559f -> pass
