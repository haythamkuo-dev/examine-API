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

## Deploy backend to Render

This repo includes `render.yaml` for backend deployment.

1. Push this repo to GitHub.
2. In Render, create a new Blueprint and select this repository.
3. Render will use:
   - `buildCommand`: install Bun + dependencies + build backend
   - `startCommand`: run `dist/server/index.js`
   - `healthCheckPath`: `/health`
4. Set runtime env vars in Render Dashboard (from your `.env`):
   - `API_BASE_URL`
   - `MERCHANT_SIGN`
   - `NORMAL_MERCHANT_API_TOKEN`
   - `INDIA_BANGLADESH_MERCHANT_API_TOKEN`
   - and other required payout/deposit/subscription vars if your flow depends on them.

## Deploy frontend to GitHub Pages

1. Ensure your default branch is `master`.
2. Push code with `.github/workflows/deploy-pages.yml`.
3. In GitHub repository settings:
   - Go to `Settings` → `Pages`.
   - Set Source to `GitHub Actions`.
4. Push to `master` (or manually run the workflow). The workflow builds with Vite and deploys `dist` to Pages.

Notes:
- `vite.config.ts` auto-detects GitHub Actions and sets the correct `base` path from `GITHUB_REPOSITORY`.
- The workflow copies `dist/index.html` to `dist/404.html` for SPA route fallback.
- GitHub Pages build injects `VITE_API_BASE_URL=https://examine-api.onrender.com`, so production frontend requests are sent to Render instead of relative `/api`.
