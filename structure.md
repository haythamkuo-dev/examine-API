.
├── AGENTS.md
├── CLAUDE.md
├── .env.test
├── README.md
├── bun.lock
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
│   └── payout
│       ├── channels
│       │   ├── bd_wallet.json
│       │   ├── co_bank.json
│       │   ├── co_wallet.json
│       │   └── imps.json
│       └── common.json
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
│   │   ├── env.ts
│   │   ├── formValidation.ts
│   │   └── output.ts
│   ├── deposit
│   │   ├── failureHint.ts
│   │   ├── presets.ts
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── web.test.ts
│   │   └── web.ts
│   ├── payout
│   │   ├── presets.ts
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── web.test.ts
│   │   └── web.ts
│   ├── subscription
│   │   ├── presets.ts
│   │   ├── service.ts
│   │   ├── validation.ts
│   │   ├── web.test.ts
│   │   └── web.ts
│   ├── domains
│   │   ├── deposit.ts
│   │   ├── payout.ts
│   │   └── subscription.ts
│   ├── runner.ts
│   ├── server
│   │   ├── http.ts
│   │   ├── index.ts
│   │   └── routes
│   │       ├── deposit.ts
│   │       ├── payout.test.ts
│   │       ├── payout.ts
│   │       ├── subscription.test.ts
│   │       └── subscription.ts
│   └── utils.ts
├── structure.md
├── tests
│   ├── formValidation.test.ts
│   ├── server-setup.ts
│   └── setup.ts
├── tsconfig.json
├── tsconfig.server.json
├── tsconfig.web.json
├── vite.config.ts
└── web
    ├── App.test.tsx
    ├── App.tsx
    ├── main.tsx
    ├── pages
    │   ├── DepositPage.tsx
    │   ├── PayoutPage.test.tsx
    │   ├── PayoutPage.tsx
    │   ├── SubscriptionPage.test.tsx
    │   └── SubscriptionPage.tsx
    └── styles.css

16 directories, 69 files
