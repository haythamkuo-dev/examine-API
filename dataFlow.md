# Backend Data Flow (`/src` ↔ `/data`)

```mermaid
flowchart TD
  Client[HTTP Client]

  subgraph Routes[src/server/routes]
    DR[handleDepositRoute\n/api/deposit/*]
    PR[handlePayoutRoute\n/api/payout/*]
  end

  subgraph Services[src/deposit|payout/service.ts]
    DS[Deposit Service\ngetDefaults/saveDefaults/execute]
    PS[Payout Service\ngetDefaults/saveDefaults/execute]
  end

  subgraph Presets[src/deposit|payout/presets.ts]
    LDP[loadDepositPresets]
    UDP[updateDepositPreset]
    LPP[loadPayoutPresets]
    UPP[updatePayoutPreset]
  end

  subgraph Runner[src/runner.ts]
    RUN[run + parseResponse]
  end

  subgraph DataDir[data]
    DC[data/deposit/common.json]
    DCH[data/deposit/channels/*.json]
    PC[data/payout/common.json]
    PCH[data/payout/channels/*.json]
  end

  Client --> DR
  Client --> PR

  DR --> DS
  PR --> PS

  DS -->|GET defaults| LDP
  DS -->|PUT defaults| UDP
  PS -->|GET defaults| LPP
  PS -->|PUT defaults| UPP

  LDP -->|read| DC
  LDP -->|read| DCH
  UDP -->|write| DC
  UDP -->|write| DCH

  LPP -->|read common + seed channel payload| PC
  LPP -->|seed read| PCH
  UPP -->|write| PC
  UPP -->|write| PCH

  DS -->|POST create| RUN
  PS -->|POST create| RUN
```

## Notes
- `GET /api/*/defaults` 會從 `/data` 讀取並正規化預設值。
- `PUT /api/*/defaults` 會更新 in-memory preset 後回寫對應 JSON。
- `POST /api/*/create` 不寫入 `/data`，只走 `runner` 對外執行並回傳結果。
