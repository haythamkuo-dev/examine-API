# examine_api

Internal CLI for exercising deposit, subscription, and payout API flows.

## Install

```bash
bun install
```

## Run locally

```bash
bun run index.ts --help
```

## Web deposit console

Start the local API proxy:

```bash
bun run dev:api
```

If port `3000` is already in use, start both processes with the same custom port:

```bash
API_SERVER_PORT=3001 bun run dev:api
API_SERVER_PORT=3001 bun run dev:web
```

Start the React frontend in a second terminal:

```bash
bun run dev:web
```

Open the Vite URL shown in the terminal, then use the Deposit form to preview and send requests through the local proxy.
The server-owned deposit presets live in `data/deposit-presets.json`; the React UI can load and save channel defaults there.

Preview payloads without sending requests:

```bash
bun run index.ts deposit preview --channel linepay
bun run index.ts payout preview --channel co_bank
bun run index.ts subscription preview --plan-id PLAN-001
```

Send requests:

```bash
bun run index.ts deposit create --channel linepay
bun run index.ts payout create --channel co_wallet
bun run index.ts subscription create --plan-id PLAN-001
```

## Build for publish

```bash
bun run build
```

The published package exposes the `examine-api` bin and runs on a Node-compatible runtime.
