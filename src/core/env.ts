export const DEPOSIT_CHANNELS = [
  'southafrica_cards',
  'linepay',
  'linepay_invoice',
  'inr_upi',
  'bdt_worldpay',
  'co_bank_transfer',
  'co_cash',
  'co_nequi',
  'co_pse',
  'th_rabbit_linepay',
  'my_tng',
] as const;

export const PAYOUT_CHANNELS = ['co_bank', 'co_wallet', 'imps', 'bd_wallet'] as const;

export type DepositChannel = (typeof DEPOSIT_CHANNELS)[number];
export type PayoutChannel = (typeof PAYOUT_CHANNELS)[number];

export type CliEnv = {
  baseUrl: string;
  signKey: string;
  depositUrl: string;
  subscriptionUrl: string;
  callbackUrlDeposit?: string;
  callbackUrlSubscription?: string;
  subscriptionPlan: string;
  tokens: {
    deposit: string;
    subscription: string;
    payout: string;
  };
  payoutUrls: Record<PayoutChannel, string>;
  payoutProductNos: Record<PayoutChannel, string>;
  depositSouthAfricaCardsProductNo: string;
};

export const getCliEnv = (env: NodeJS.ProcessEnv = process.env): CliEnv => ({
  baseUrl: env.API_BASE_URL || 'https://stage.sidediff.com',
  signKey: env.MERCHANT_SIGN || '',
  depositUrl: env.DEPOSIT_URL || '/s2s/v1/intents/deposit',
  subscriptionUrl: env.SUBSCRIPTION_URL || '/s2s/v1/subscriptions',
  callbackUrlDeposit: env.CALLBACK_URL_DEPOSIT,
  callbackUrlSubscription: env.CALLBACK_URL_SUBSCRIPTION,
  subscriptionPlan: env.SUBSCRIPTION_PLAN || '01KKTEEJCJ5W12EMC01469Z4ZJ',
  tokens: {
    deposit: env.MERCHANT_API_TOKEN_DEPOSIT || '',
    subscription: env.MERCHANT_API_TOKEN_SUBSCRIPTION || '',
    payout: env.MERCHANT_API_TOKEN_PAYOUT || '',
  },
  payoutUrls: {
    co_bank: env.PAYOUT_URL_BANK || '/s2s/v1/payout/orders/co/bank-transfer',
    co_wallet: env.PAYOUT_URL_CO_WALLET || '/s2s/v1/payout/orders/co/mobile-money',
    imps: env.PAYOUT_URL_IMPS || '/s2s/v1/payout/orders/in/imps',
    bd_wallet: env.PAYOUT_URL_BD_WALLET || '/s2s/v1/payout/orders/bd/msobile-wallet',
  },
  payoutProductNos: {
    co_bank: env.PAYOUT_CO_BANK || 'PAY-FUTUREPAY_COLLECT-BANKTRANSFERCO-COP',
    co_wallet: env.PAYOUT_CO_WALLET || 'PAY-FUTUREPAY_COLLECT-MOBILEMONEY-COP',
    imps: env.PAYOUT_IMPS || 'PAY-EC-IMPS-INR',
    bd_wallet: env.PAYOUT_BD_WALLET || 'PAY-FUTUREPAY_COLLECT-BD-MSOBILE-WALLET-COP',
  },
  depositSouthAfricaCardsProductNo: env.DEPOSIT_SOUTHAFICA_CARDS || 'TEST_PRODUCT_123',
});

export const joinUrl = (baseUrl: string, path: string): string => new URL(path, baseUrl).toString();
