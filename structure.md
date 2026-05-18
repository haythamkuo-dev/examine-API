.
├── .env
├── .env.example
├── .env.test
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── bun.lock
├── bunfig.toml
├── data
│   ├── deposit
│   │   ├── channels
│   │   │   ├── bdt_worldpay.json
│   │   │   ├── co_bank_transfer.json
│   │   │   ├── co_cash.json
│   │   │   ├── co_nequi.json
│   │   │   ├── co_pse.json
│   │   │   ├── inr_upi.json
│   │   │   ├── linepay.json
│   │   │   ├── linepay_invoice.json
│   │   │   ├── my_tng.json
│   │   │   ├── southafrica_cards.json
│   │   │   └── th_rabbit_linepay.json
│   │   └── common.json
│   ├── payout
│   │   ├── channels
│   │   │   ├── bd_wallet.json
│   │   │   ├── co_bank.json
│   │   │   ├── co_wallet.json
│   │   │   └── imps.json
│   │   └── common.json
│   └── subscription
│       ├── channels
│       │   └── default.json
│       └── common.json
├── index.html
├── index.ts
├── package.json
├── src
│   ├── cli
│   │   ├── depositPrompt.ts
│   │   ├── index.test.ts
│   │   └── index.ts
│   ├── core
│   │   ├── createPresetBackedService.test.ts
│   │   ├── createPresetBackedService.ts
│   │   ├── env.ts
│   │   ├── formValidation.ts
│   │   └── output.ts
│   ├── deposit
│   │   ├── failureHint.ts
│   │   ├── presets.ts
│   │   ├── service.test.ts
│   │   ├── service.ts
│   │   ├── validation.test.ts
│   │   ├── validation.ts
│   │   ├── web.test.ts
│   │   └── web.ts
│   ├── domains
│   │   ├── deposit.ts
│   │   ├── payout.ts
│   │   └── subscription.ts
│   ├── payout
│   │   ├── presets.ts
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── web.test.ts
│   │   └── web.ts
│   ├── runner.ts
│   ├── schema
│   ├── server
│   │   ├── http.ts
│   │   ├── index.ts
│   │   └── routes
│   │       ├── deposit.test.ts
│   │       ├── deposit.ts
│   │       ├── payout.test.ts
│   │       ├── payout.ts
│   │       ├── subscription.test.ts
│   │       └── subscription.ts
│   ├── subscription
│   │   ├── presets.ts
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── web.test.ts
│   │   └── web.ts
│   └── utils.ts
├── structure.md
├── tests
│   ├── formValidation.test.ts
│   ├── happydom.ts
│   ├── server-setup.ts
│   ├── setup.ts
│   └── web-setup.ts
├── tsconfig.json
├── tsconfig.server.json
├── tsconfig.web.json
├── vite.config.ts
└── web
    ├── App.test.tsx
    ├── App.tsx
    ├── main.tsx
    ├── pages
    │   ├── DepositPage.test.tsx
    │   ├── DepositPage.tsx
    │   ├── PayoutPage.test.tsx
    │   ├── PayoutPage.tsx
    │   ├── SubscriptionPage.test.tsx
    │   ├── SubscriptionPage.tsx
    │   └── pageChrome.tsx
    └── styles.css

21 directories, 90 files
