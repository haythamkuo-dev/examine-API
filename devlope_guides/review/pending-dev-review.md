# Code Review：pending-dev

## Review 基準

- Review 模式：PR Reviewer 全域審核。
- Review 深度：Deep；diff 為 7 個檔案，`+1223 / -287`，且涉及 Deposit/payment 與 parity CLI safety surface。
- Base：`1ddc22b529765da1e388ea80fcf3b885ce0fa835`。
- Head：`48cc6f25cf9ede407184a82c6f0f75a9ea4ccde0`，為 Phase 1 candidate commit。
- Head 不是目前 branch HEAD。目前 `dev` HEAD 為 `d1d89a2ab191ef222099a4d86a176c354cc39aaa`，`48cc6f2` 之後的產品與其他變更不納入本次 Phase 1 verdict。
- Worktree 在 review 前為 dirty。`AGENTS.md`、parity record、設計文件、parity harness、`structure.md` 與未追蹤的 harness test／issue 是範圍外後續變更；它們未被當成 `48cc6f2` 的修正證據。
- Specialist ledger：Security、Architecture 均完成 read-only review；HIGH security finding 已由獨立 skeptic 重新讀取候選程式碼並確認成立。四個 Deep adversarial angles 已完成。
- 目前 parity record 已保留 `BASE_REF=1ddc22b...` 與 `HEAD_REF=48cc6f2...`，並明確寫出 `HEAD_REF` 不是目前 branch HEAD。Parity 證據在本輪採用既有 record，不重新比較目前最新 tree。

## Gate 1：分支實作目標、完整性與範圍

### 目標清單

1. 在 `src/deposit/presets.ts` 以 Loki intercard、Google Pay 與 Apple Pay 的 family base 加 variant override 重組 seed config，保留既有 channel ID、JSON mapping、normalization、API request 與 UI label contract。
2. 補回 Apple Pay Japan 的三個 `telephone_number=+819012345678` boundary assertions，新增 catalog invariant、JSON precedence 與 sibling deep-clone coverage，並以 seed／normalized store parity 證明輸出不變。

### 完整性與範圍結果

實作、測試與 parity record 均存在，`src/core/env.ts`、domain、route、JSON data、UI route 與 label 沒有被 Phase 1 candidate 修改。Family composer、Apple Pay nested composition、JSON whole-field precedence、API defaults contract 與固定 makeId parity 均符合目標。

範圍備註：`devlope_guides/ai_design_doc_writing.md` 的一般性表格與 Mermaid 寫作規則不是 family catalog 實作的必要變更，屬可拆出的 removable scope drift；不影響 runtime correctness，但應在合併前決定是否與 Phase 1 一起保留。

## Gate 2：原有業務邏輯變更

- `getSeedChannelConfigs` 從逐 channel literal 改為 family composer；輸出型別與 channel key 保留，預期降低重複 schema／values 維護成本。
- Loki 與 Google Pay 使用共用 base 加 variant common values；Google Pay Japan 保留獨立 schema／values override，Google Pay USD 仍為空 schema 與空 values。
- Apple Pay 新增明確的 top-level、`payment_order` 與 `collect` composition，variant 只覆寫 product name 與 telephone number 等指定欄位，且每個輸出使用 clone。
- `src/deposit/web.test.ts` 新增 catalog set、JSON mapping、特殊變體與 reference isolation assertions；三個 Apple Pay Japan case 補回 exact telephone assertion。
- 新增 parity CLI 與 parity record，並未修改 production API route、domain payload、signature、database 或 JSON source。

## Gate 3：原有 Runtime 潛在錯誤風險

既有 active route 仍經由 `createDepositService`、`loadDepositPresets`、`normalizeDepositPresets`、`buildDepositRequestFromForm` 與 structured request path。候選 diff 沒有改變 route mount、service wiring、normalization precedence、error boundary 或 persistent JSON writer。未發現由 family refactor 造成的既有成功／失敗路徑中斷。

## Gate 4：新增錯誤風險

### Issue 1：Parity harness 會在 trusted process 內執行未驗證的 candidate worktree code

**主要 Gate：Gate 4。原始嚴重度：HIGH。處理結果：不採納。**

- 原始問題位置：`scripts/deposit-presets-parity.ts:60-61, 111-118`。
- 原始觸發條件：執行 `bun run scripts/deposit-presets-parity.ts --worktree <candidate> --output-dir <output>`，且將任意外部 PR、fork 或不受信任 worktree 傳入 `--worktree`。
- 原始依據仍成立：`resolve()` 只正規化路徑，`loadModule()` 以 dynamic `import()` 載入 candidate 的 `src/core/env.ts` 與 `src/deposit/presets.ts`。Candidate top-level code 與 transitive imports 會在同一個 Bun process 執行；`48cc6f2` 本身沒有 OS sandbox。
- 不採納依據：開發者已明確界定目前 parity harness 僅執行開發者本人建立且信任的 worktree，不處理外部 PR、fork 或不受信任來源。現行設計文件也將「已核准且已驗證的 clean checkout」列為暫時操作限制，並明確禁止把任意 PR worktree 傳給 `--worktree`。因此，原 finding 的惡意候選程式碼觸發條件不在目前支援範圍，不能作為本次 Phase 1 的 blocking issue。
- 範圍前提：這個判定不表示 `48cc6f2` 具備 sandbox，也不表示可以安全執行任意 worktree。若未來開放外部 PR、fork 或其他不受信任來源，必須重新開啟此 finding，並在低權限、清除 secrets、禁網路、唯讀 mount 的 disposable sandbox 中執行 candidate。

### Issue 2：Parity harness 只輸出 env/data checksum，沒有 fail-closed 綁定兩個輸入來源

**主要 Gate：Gate 4。嚴重度：MEDIUM。狀態：未處理。**

- 位置：`scripts/deposit-presets-parity.ts:109-138`。
- 觸發條件：base 與 candidate 分別使用不同 `.env.test`、不同 `data/deposit`、錯誤 commit 或 dirty worktree，再各自執行 single-worktree harness。
- 依據：harness 只在單次執行後列印 `ENV_SHA256` 與 `DATA_SHA256`，沒有 expected ref、clean-state、expected input checksum 或雙 worktree comparison。輸出 artifact 也不由 harness 自動執行四份 byte comparison。
- 影響：Parity 結果依賴操作者手動比對輸入與輸出。操作錯誤時可能把不同 source 的結果記為 `1ddc22b → 48cc6f2` parity，降低驗收證據的可靠性。
- 解決方向：建立集中 verifier，先驗證兩個 worktree 的 exact ref、clean state、`.env.test`／`data/deposit` checksum，再比較 seed 與 normalized 四份 artifact；任一 identity 或 byte diff 不符時以非零狀態失敗。
- 後續現況核對：目前 dirty harness 已在 `scripts/deposit-presets-parity.ts:322-375, 441-456, 678-864` 實作上述 fail-closed 驗證，包括執行前後 snapshot、expected ref、clean state、兩組 input checksum、不同 commit、metadata 與 seed／normalized artifact byte comparison。這些變更都在 `48cc6f2` 之後且尚未提交，因此只代表 post-48 follow-up 已補上防護，不改變本次 Phase 1 candidate 的原始 finding。

### Issue 3：Parity artifact output path 可覆寫既有檔案或跨越 symlink

**主要 Gate：Gate 4。嚴重度：MEDIUM。狀態：未處理。**

- 位置：`scripts/deposit-presets-parity.ts:93-95, 111-133`。
- 觸發條件：將 `--output-dir` 指向已存在的 directory、candidate worktree 內的 path、directory symlink，或預先建立的 `seed-store.json`／`normalized-store.json` symlink。
- 依據：`mkdir(..., { recursive: true })` 接受既有目錄，`writeFile()` 無 `O_EXCL`、`O_NOFOLLOW` 或 existing-file guard；`resolve()` 也不檢查 realpath containment。工具可以覆寫既有 artifact，或將 output 寫到 symlink target。
- 影響：Parity command 可能破壞既有 output、污染 candidate clean-state，或把驗證輸出寫入操作者未預期的檔案位置。
- 解決方向：只接受新建且位於信任 output root 的 temporary directory，拒絕 output 位於 worktree 內或任何 symlink，使用 exclusive／atomic write，並在寫入前後驗證 path identity。

## Gate 5：架構、封裝與依賴

### Issue 4：Generic family builder 將不完整 variants 強制 cast 成完整 Record

**主要 Gate：Gate 5。嚴重度：MEDIUM。狀態：未處理。**

- 位置：`src/deposit/presets.ts:522-542`，呼叫位置 `799-803`。
- 觸發條件：從 `LOKI_INTERCARD_VARIANTS` 或 `GOOGLEPAY_VARIANTS` 移除／拼錯一個 channel。`satisfies readonly DepositFamilyVariant<...>[]` 只驗證陣列元素型別，不要求涵蓋完整 union。
- 依據：composer 只檢查 duplicate，最後以 `configs as Record<FamilyChannel, DepositChannelConfig>` 回傳；沒有與 `DEPOSIT_CHANNELS` 的 family subset 做 missing／unexpected set comparison。後續 `normalizeDepositPresets` 在 `src/deposit/presets.ts:1491` 取 `seed.channels[channel]` 時才會遇到 undefined，錯誤不會指出遺失的 channel。
- 影響：catalog 維護錯誤可在 runtime 變成無法定位的 TypeError，且不符合設計要求的 server configuration error identifier。現有 invariant test 可在一般 test gate 擋住部分情況，但不能取代 runtime guard。
- 解決方向：讓 generic family composer 接受並驗證 manifest family set，或以完整 `Record<FamilyChannel, Variant>` 定義 variant catalog；missing／unexpected 時以包含 channel identifier 的 TypeError fail fast。

## Gate 6：重要資料持久化靜態安全性

Phase 1 candidate 沒有修改 `data/*.json`、JSON save path、database、migration 或重要業務狀態寫入決策。Production persistence scope 無新增 issue。Parity artifact 的檔案寫入風險已在 Gate 4 Issue 3 記錄。

## Gate 7：本機單元測試

- 隔離 `48cc6f2` checkout 執行 `bun run test:api`：181 pass、0 fail、906 `expect()` calls，21 files。
- 隔離 `48cc6f2` checkout 執行 `tsc --noEmit`：pass。
- 隔離 `48cc6f2` checkout 執行 `bun run build:api`：pass，Bundled 36 modules。
- `git diff --check 1ddc22b..48cc6f2`：pass。
- `bun run test:web`：未執行。Phase 1 candidate 沒有 frontend source、route 或 UI behavior change。
- `bun run test:db`：未由 AI 執行。Phase 1 沒有 database／migration change，且依 `AGENTS.md` 由使用者或 CI 負責。
- `bun test --isolate ./scripts/deposit-presets-parity.test.ts`：未由 AI 執行。這是目前 `AGENTS.md` 定義的人工／CI parity harness gate；本 review 只重用既有 parity record，不重新比較目前最新 tree。

## Review 結論

- `REQUEST_CHANGES`。Phase 1 implementation diff 的 family refactor、Apple Pay nested composition、Apple Pay Japan contract assertions、JSON precedence test 與 API build/test evidence 均已完成；原本針對任意不可信 worktree 的 HIGH finding 已依支援範圍不採納，仍有 3 個 MEDIUM verification／catalog safety issues。
- 本次不宣稱 `48cc6f2` 可安全支援任意 untrusted worktree；目前結論只適用於開發者本人建立且信任、已核准且已驗證的 clean checkout。也不得將 current `dev` branch 的 `d1d89a2` 或其後變更納入 Phase 1 parity conclusion。
- Phase 1 parity evidence 的範圍固定為 `1ddc22b → 48cc6f2`。Current parity record 的描述已明確指出 `HEAD_REF` 是 Phase 1 candidate commit，不是目前 branch HEAD。
- `48cc6f2` 之後的 `d1d89a2` 及其他變更不在本次 Phase 1 範圍。Current dirty hardening changes 仍需另行 commit、review 與驗證，不能回溯清除 candidate findings。
- `bun run test:db` 與 parity harness test gate 尚未由 AI 驗證，需由使用者或 CI 依 `AGENTS.md` 執行；本輪沒有執行 parity comparison。

status:           REQUEST_CHANGES on `48cc6f2`; Phase 1 parity scope is `1ddc22b → 48cc6f2`; current branch HEAD `d1d89a2` is out of scope
files changed:    1 review file updated; production files unchanged by reviewer
scope:            on target with removable drift in `devlope_guides/ai_design_doc_writing.md`
user-visible delta: none
review depth:     deep
risk tier:        deposit/payment and parity command safety; human maintainer review pending
hard stops:       0 found, 0 fixed, 0 deferred; 3 medium findings remain
sibling sweep:    family catalog variants and parity CLI surfaces checked; no unreviewed sibling in the fixed Phase 1 diff
specialists:      security, architecture, independent HIGH-finding skeptic
new tests:        0
public actions:   none
doc debt:         arbitrary untrusted worktree execution remains outside the supported scope; future external PR support requires sandbox hardening; 3 medium findings remain
verification:     isolated `48cc6f2` `bun run test:api`, `tsc --noEmit`, `bun run build:api`, and range `git diff --check` -> pass; parity harness gate -> not run
