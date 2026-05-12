## 🚧 當前開發狀態 (Current Status)
- [/] 改善 `deposit api` 與其欄位 
- [ ] 待辦：重構 `deposit` 相關程式碼

## 🛠️ 開發規範 (Conventions)
- 先執行 GitNexus Skill 檢查環境，再進行 Code 生成。


## ⚠️ 專案特有規則
- 暫時不管跟 CLI 相關的程式碼
- 前端整體架構應該保持業務邏輯與 UI 分離，提升程式碼複用
- 前端遵循單向數據流
- 後端的 `merchantRef`, `merchant_reference` 為unique


<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **examine_api** (347 symbols, 467 relationships, 6 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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

<!-- gitnexus:end -->
