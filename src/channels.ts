// 各種 API 路徑，未來還會新增
export const CHANNELS = {
  DEPOSIT: Bun.env.DEPOSIT_URL || '/s2s/v1/intents/deposit',
  SUBSCRIPTION: Bun.env.SUBSCRIPTION_URL || '/s2s/v1/subscriptions',
  PAYOUT_CO_BANK: Bun.env.PAYOUT_URL_BANK || '/s2s/v1/payout/orders/co/bank-transfer',
  PAYOUT_CO_WALLET: Bun.env.PAYOUT_URL_CO_WALLET || '/s2s/v1/payout/orders/co/mobile-money',
  PAYOUT_IMPS_BANK: Bun.env.PAYOUT_URL_IMPS || '/s2s/v1/payout/orders/in/imps',
  PAYOUT_BD_WALLET: Bun.env.PAYOUT_URL_BD_WALLET || '/s2s/v1/payout/orders/bd/msobile-wallet',
};


