# Code Review：pending-dev

## Review 基準

- Review 模式：PR Reviewer 全域審核。
- Review 深度：Deep；目前 cleanup diff 為 9 個檔案，`+150 / -1722`，涉及 Deposit/payment、catalog tests 與 obsolete verification cleanup。
- Base：`1ddc22b529765da1e388ea80fcf3b885ce0fa835`。
- Head：`f1caba8d588b4604020fe4596775dcd7fa4e91`，包含 Phase 1 candidate 及後續 cleanup。
- Phase 1 candidate `48cc6f2` 的產品行為仍以歷史 review 範圍判定；目前 worktree 的 cleanup 只移除 obsolete verification artifacts，不改變 family catalog 或 API contract。
- Worktree 在本輪 review 前包含使用者的 cleanup 變更。`d1d89a2`、`be50f99` 及其他產品變更仍不納入 Phase 1 product verdict。
- Specialist ledger：Security、Architecture 均完成 read-only review；HIGH security finding 已由獨立 skeptic 重新讀取候選程式碼並確認成立。四個 Deep adversarial angles 已完成。
- 歷史 parity record 只作為 `1ddc22b → 48cc6f2` 的一次性證據，不是目前 branch HEAD 的驗證，也不是 repository gate。

## Gate 1：分支實作目標、完整性與範圍

### 目標清單

1. 在 `src/deposit/presets.ts` 以 Loki intercard、Google Pay 與 Apple Pay 的 family base 加 variant override 重組 seed config，保留既有 channel ID、JSON mapping、normalization、API request 與 UI label contract。
2. 補回 Apple Pay Japan 的三個 `telephone_number=+819012345678` boundary assertions，新增 catalog invariant、JSON precedence 與 sibling nested-value isolation coverage。

### 完整性與範圍結果

實作、測試與歷史 evidence 均存在，`src/core/env.ts`、domain、route、JSON data、UI route 與 label 沒有被 Phase 1 candidate 修改。Family composer、Apple Pay nested composition、JSON whole-field precedence 與 API defaults contract 均符合目標。

範圍備註：`devlope_guides/ai_design_doc_writing.md` 的一般性表格與 Mermaid 寫作規則依目前要求保留，不在本次 cleanup 範圍內。

## Gate 2：原有業務邏輯變更

- `getSeedChannelConfigs` 從逐 channel literal 改為 family composer；輸出型別與 channel key 保留，預期降低重複 schema／values 維護成本。
- Loki 與 Google Pay 使用共用 base 加 variant common values；Google Pay Japan 保留獨立 schema／values override，Google Pay USD 仍為空 schema 與空 values。
- Apple Pay 新增明確的 top-level、`payment_order` 與 `collect` composition，variant 只覆寫 product name 與 telephone number 等指定欄位，且每個輸出使用 clone。
- `src/deposit/web.test.ts` 保留 catalog set、Loki／Google Pay／Apple Pay representative、Apple Pay Japan exact contract 與 sibling nested-value isolation；三個 Apple Pay Japan case 補回 exact telephone assertion。
- 後續 cleanup 移除 obsolete verification scripts 與 issue tracking，不修改 production API route、domain payload、signature、database 或 JSON source。

## Gate 3：原有 Runtime 潛在錯誤風險

既有 active route 仍經由 `createDepositService`、`loadDepositPresets`、`normalizeDepositPresets`、`buildDepositRequestFromForm` 與 structured request path。候選 diff 沒有改變 route mount、service wiring、normalization precedence、error boundary 或 persistent JSON writer。未發現由 family refactor 造成的既有成功／失敗路徑中斷。

## Gate 4：新增錯誤風險

本次 cleanup 只移除 obsolete verification artifacts 與其文件規範，沒有新增 runtime entry point、外部 process、檔案輸出或 API 行為。未發現新增錯誤風險。

## Gate 5：架構、封裝與依賴

### Advisory：Generic family builder 將不完整 variants 強制 cast 成完整 Record

**主要 Gate：Gate 5。原始嚴重度：MEDIUM。處理結果：ADVISORY，不阻塞。**

- 位置：`src/deposit/presets.ts:522-542`，呼叫位置 `799-803`。
- 觸發條件：從 `LOKI_INTERCARD_VARIANTS` 或 `GOOGLEPAY_VARIANTS` 移除／拼錯一個 channel。`satisfies readonly DepositFamilyVariant<...>[]` 只驗證陣列元素型別，不要求涵蓋完整 union。
- 依據：composer 只檢查 duplicate，最後以 `configs as Record<FamilyChannel, DepositChannelConfig>` 回傳；沒有與 `DEPOSIT_CHANNELS` 的 family subset 做 missing／unexpected set comparison。後續 `normalizeDepositPresets` 在 `src/deposit/presets.ts:1491` 取 `seed.channels[channel]` 時才會遇到 undefined，錯誤不會指出遺失的 channel。
- 影響：若未來只修改 family variant array，型別本身不會要求完整 union coverage。
- 重新判定：`src/deposit/web.test.ts:332-415` 在 `test:api` 中驗證 seed output 的 channel key set、三個 family representative、Apple Pay Japan contract 與 sibling nested-value isolation。這保留產品行為風險的最低必要 coverage；generic family array completeness 仍是非阻塞 advisory。

## Gate 6：重要資料持久化靜態安全性

Phase 1 candidate 沒有修改 `data/*.json`、JSON save path、database、migration 或重要業務狀態寫入決策。Production persistence scope 無新增 issue。

## Gate 7：本機單元測試

- 目前 worktree 執行 `bun run test:api`：182 pass、0 fail、754 `expect()` calls，21 files。
- 目前 worktree 執行 `tsc --noEmit`：pass。
- 目前 worktree 執行 `bun run build:api`：pass，Bundled 36 modules。
- `git diff --check`：pass。
- `bun run test:web`：未執行。Phase 1 candidate 沒有 frontend source、route 或 UI behavior change。
- `bun run test:db`：未由 AI 執行。Phase 1 沒有 database／migration change，且依 `AGENTS.md` 由使用者或 CI 負責。

## Review 結論

- `APPROVE`。Phase 1 family refactor、Apple Pay nested composition、Apple Pay Japan contract assertions、JSON precedence test 與 API build/test evidence 均已完成；obsolete verification artifacts、issue tracking 與永久 gate 已移除，family builder 缺口維持不阻塞 advisory。
- 歷史 parity evidence 只保留為一次性 baseline-to-candidate 紀錄，不驗證目前 branch HEAD，也不形成 repository gate。
- `48cc6f2` 之後的 `d1d89a2`、`be50f99` 及其他產品變更不在 Phase 1 product verdict 範圍。
- `bun run test:db` 未由 AI 執行；本階段沒有 database／migration change，依 `AGENTS.md` 由使用者或 CI 負責。

status:           APPROVE for Phase 1 product scope; historical parity evidence is non-gating
files changed:    catalog test and obsolete verification/docs cleanup; production runtime unchanged
scope:            on target; Phase 1 family catalog plus focused cleanup
user-visible delta: none
review depth:     deep
risk tier:        deposit/payment; no executable verification CLI remains
hard stops:       0 found, 0 fixed, 0 deferred; 0 blocking findings, 1 advisory remains
sibling sweep:    family catalog variants checked; no unreviewed sibling in the fixed Phase 1 diff
specialists:      security, architecture, independent HIGH-finding skeptic
new tests:        0; existing catalog test narrowed to representative contracts and nested-value isolation
public actions:   none
doc debt:         none from the removed verification surface; the generic design-guide addition remains intentionally unchanged
verification:     current worktree `bun run test:api`, `tsc --noEmit`, `bun run build:api`, and `git diff --check` -> pass
