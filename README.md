# examine_api

Internal CLI for exercising deposit, subscription, and payout API flows.

## Install

1. 如果本地環境沒有 [Bun](https://bun.com/docs)，應先下載該 runtime

``` bash
brew install bun
```

2. 下載相關依賴項

```bash
bun install
```

<!-- ## Run locally

```bash
bun run index.ts --help
``` -->

## 開啟後端 port

Start the local API proxy:

> 如果預設的 `port` 已經使用，請到 `.env` 裡的 `API_SERVER_PORT` 新增。

```bash
bun run dev:api
```

## 開啟前端

```bash
bun run dev:web
```

<!-- Open the Vite URL shown in the terminal, then use the Deposit form to preview and send requests through the local proxy.
The server-owned deposit presets live in `data/deposit-presets.json`; the React UI can load and save channel defaults there.

Preview payloads without sending requests:

```bash
bun run index.ts deposit preview --channel linepay
bun run index.ts payout preview --channel co_bank
bun run index.ts subscription preview --plan-id PLAN-001
``` -->

<!-- Send requests:

```bash
bun run index.ts deposit create --channel linepay
bun run index.ts payout create --channel co_wallet
bun run index.ts subscription create --plan-id PLAN-001
``` -->
## Build for publish

```bash
bun run build
```

The published package exposes the `examine-api` bin and runs on a Node-compatible runtime.
