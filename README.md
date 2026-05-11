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
