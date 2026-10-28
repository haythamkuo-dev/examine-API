.
├── .codebase-memory
│   ├── .gitattributes
│   ├── artifact.json
│   └── graph.db.zst
├── .env
├── .env.example
├── .env.production
├── .env.test
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── bun.lock
├── bunfig.toml
├── data
│   ├── deposit
│   │   ├── channels
│   │   │   ├── ALIPAY-6014-USD.json
│   │   │   ├── ALIPAY-6014.json
│   │   │   ├── ALIPAY-8000.json
│   │   │   ├── ALIPAY-CNY.json
│   │   │   ├── ALIPAY-HKD.json
│   │   │   ├── JCB-JPY.json
│   │   │   ├── JCB-USD.json
│   │   │   ├── WECHAT-6016-USD.json
│   │   │   ├── WECHAT-6016.json
│   │   │   ├── WECHAT-HKD.json
│   │   │   ├── bdt_worldpay.json
│   │   │   ├── cmoney-intercard.json
│   │   │   ├── co_bank_transfer.json
│   │   │   ├── co_cash.json
│   │   │   ├── co_nequi.json
│   │   │   ├── co_pse.json
│   │   │   ├── duitnowqr_usd.json
│   │   │   ├── ez-intercard-hkd.json
│   │   │   ├── ez-intercard-jpy.json
│   │   │   ├── ez-intercard-usd.json
│   │   │   ├── id_dana_usd.json
│   │   │   ├── inr_upi.json
│   │   │   ├── international_credit_cards.json
│   │   │   ├── linepay.json
│   │   │   ├── linepay_invoice.json
│   │   │   ├── loki-intercard-usd.json
│   │   │   ├── mx_spei_usd.json
│   │   │   ├── my_boost_usd.json
│   │   │   ├── my_fpx_usd.json
│   │   │   ├── my_tng.json
│   │   │   ├── my_tng_usd.json
│   │   │   ├── my_tng_usd2.json
│   │   │   ├── pix_brl.json
│   │   │   ├── southafrica_cards.json
│   │   │   ├── th_kplus_usd.json
│   │   │   ├── th_rabbit_linepay.json
│   │   │   ├── th_rabbit_linepay_usd.json
│   │   │   └── th_rabbit_linepay_usd2.json
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
│       │   ├── default.json
│       │   ├── internationalCreditCard.json
│       │   ├── rabbitLinePay.json
│       │   └── touchAndGo.json
│       └── common.json
├── devlope_guides
│   ├── ai_code_review_guide.md
│   ├── ai_design_doc_writing.md
│   ├── ai_reference.md
│   ├── issue
│   ├── review
│   ├── scripts
│   │   └── query_merchant_turnover.sh
│   └── todos
│       ├── 2026-10-22-preset-database-migration.md
│       └── 2026-10-28-add-loki-my-deposit-channel.md
├── example.md
├── index.html
├── index.ts
├── package.json
├── src
│   ├── cli
│   │   ├── depositPrompt.ts
│   │   ├── index.test.ts
│   │   ├── index.ts
│   │   └── presetAudit.ts
│   ├── core
│   │   ├── codeFormatValidation.ts
│   │   ├── createPresetBackedService.test.ts
│   │   ├── createPresetBackedService.ts
│   │   ├── env.ts
│   │   ├── formValidation.ts
│   │   ├── output.ts
│   │   ├── presetAudit.test.ts
│   │   ├── presetAudit.ts
│   │   ├── presetStorage.test.ts
│   │   ├── presetStorage.ts
│   │   └── targetEnvironment.ts
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
│   │   ├── validation.test.ts
│   │   ├── validation.ts
│   │   ├── web.test.ts
│   │   └── web.ts
│   ├── runner.ts
│   ├── schema
│   ├── server
│   │   ├── errors.test.ts
│   │   ├── errors.ts
│   │   ├── http.ts
│   │   ├── index.test.ts
│   │   ├── index.ts
│   │   └── routes
│   │       ├── _shared.ts
│   │       ├── deposit.test.ts
│   │       ├── deposit.ts
│   │       ├── payout.test.ts
│   │       ├── payout.ts
│   │       ├── subscription.test.ts
│   │       └── subscription.ts
│   ├── subscription
│   │   ├── presets.ts
│   │   ├── service.ts
│   │   ├── validation.test.ts
│   │   ├── validation.ts
│   │   ├── web.test.ts
│   │   └── web.ts
│   ├── utils.test.ts
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
    ├── hooks
    │   ├── useDepositOperator.test.ts
    │   ├── useDepositOperator.ts
    │   ├── usePayoutOperator.ts
    │   ├── usePersistentApiKey.test.tsx
    │   ├── usePersistentApiKey.ts
    │   └── useSubscriptionOperator.ts
    ├── main.tsx
    ├── pages
    │   ├── ApiKeyEditorTrigger.tsx
    │   ├── DepositPage.test.tsx
    │   ├── DepositPage.tsx
    │   ├── JsonCopyButton.test.tsx
    │   ├── JsonCopyButton.tsx
    │   ├── PayoutPage.test.tsx
    │   ├── PayoutPage.tsx
    │   ├── ScrollToTopButton.tsx
    │   ├── SubscriptionPage.test.tsx
    │   ├── SubscriptionPage.tsx
    │   ├── helper
    │   │   ├── depositChannelLabels.ts
    │   │   ├── operatorApi.ts
    │   │   ├── operatorError.test.ts
    │   │   ├── operatorError.ts
    │   │   ├── operatorRequest.test.ts
    │   │   ├── operatorRequest.ts
    │   │   ├── operatorShared.test.ts
    │   │   ├── operatorShared.ts
    │   │   ├── operatorTransport.ts
    │   │   ├── payoutChannelLabels.ts
    │   │   └── subscriptionChannelLabels.ts
    │   ├── pageChrome.tsx
    │   ├── requestBuilder.test.tsx
    │   ├── requestBuilder.tsx
    │   ├── testUtils.tsx
    │   └── utils
    │       ├── modal.test.tsx
    │       └── modal.tsx
    └── styles.css

30 directories, 171 files
