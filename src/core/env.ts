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
export const SUBSCRIPTION_CHANNELS = ['default'] as const;

export type DepositChannel = (typeof DEPOSIT_CHANNELS)[number];
export type PayoutChannel = (typeof PAYOUT_CHANNELS)[number];
export type SubscriptionChannel = (typeof SUBSCRIPTION_CHANNELS)[number];

export enum MerchantTokenKey {
  Normal = 'NORMAL_MERCHANT_API_TOKEN',
  India = 'INDIA_MERCHANT_API_TOKEN',
  Bangladesh = 'BANGLADESH_MERCHANT_API_TOKEN',
}

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
  merchantTokens: Record<MerchantTokenKey, string>;
  payoutUrls: Record<PayoutChannel, string>;
  payoutProductNos: Record<PayoutChannel, string>;
  depositSouthAfricaCardsProductNo: string;
};

const DEPOSIT_CHANNEL_TOKEN_KEYS: Record<DepositChannel, MerchantTokenKey> = {
  southafrica_cards: MerchantTokenKey.Normal,
  linepay: MerchantTokenKey.Normal,
  linepay_invoice: MerchantTokenKey.Normal,
  inr_upi: MerchantTokenKey.India,
  bdt_worldpay: MerchantTokenKey.Bangladesh,
  co_bank_transfer: MerchantTokenKey.Normal,
  co_cash: MerchantTokenKey.Normal,
  co_nequi: MerchantTokenKey.Normal,
  co_pse: MerchantTokenKey.Normal,
  th_rabbit_linepay: MerchantTokenKey.Normal,
  my_tng: MerchantTokenKey.Normal,
};

const PAYOUT_CHANNEL_TOKEN_KEYS: Record<PayoutChannel, MerchantTokenKey> = {
  co_bank: MerchantTokenKey.Normal,
  co_wallet: MerchantTokenKey.Normal,
  imps: MerchantTokenKey.India,
  bd_wallet: MerchantTokenKey.Bangladesh,
};

/**
 * Resolves the merchant token class for a deposit channel.
 *
 * @param channel Deposit channel selected by the caller.
 * @returns The env token key that should authorize this deposit request.
 * @throws {TypeError} When an invalid deposit channel is passed at runtime.
 */
export const resolveDepositMerchantTokenKey = (channel: DepositChannel): MerchantTokenKey =>
  DEPOSIT_CHANNEL_TOKEN_KEYS[channel];

/**
 * Resolves the merchant token class for a payout channel.
 *
 * @param channel Payout channel selected by the caller.
 * @returns The env token key that should authorize this payout request.
 * @throws {TypeError} When an invalid payout channel is passed at runtime.
 */
export const resolvePayoutMerchantTokenKey = (channel: PayoutChannel): MerchantTokenKey =>
  PAYOUT_CHANNEL_TOKEN_KEYS[channel];

/**
 * Resolves the merchant API token value from the configured environment.
 *
 * @param env Runtime environment containing all region-scoped merchant tokens.
 * @param tokenKey The token key to read.
 * @returns The configured API token string, or an empty string when unset.
 * @throws {TypeError} When an invalid token key is passed at runtime.
 */
export const getMerchantToken = (env: CliEnv, tokenKey: MerchantTokenKey): string =>
  env.merchantTokens[tokenKey];

/**
 * Builds the normalized runtime environment used by CLI, API routes, and request builders.
 *
 * @param env Raw process environment variables.
 * @returns The parsed CLI environment with endpoint, token, and product configuration.
 * @throws {TypeError} When the provided environment object cannot be read.
 */
export const getCliEnv = (env: NodeJS.ProcessEnv = process.env): CliEnv => ({
  baseUrl: env.API_BASE_URL || 'https://stage.sidediff.com',
  signKey: env.MERCHANT_SIGN || '',
  depositUrl: env.DEPOSIT_URL || '/s2s/v1/intents/deposit',
  subscriptionUrl: env.SUBSCRIPTION_URL || '/s2s/v1/subscriptions',
  callbackUrlDeposit: env.CALLBACK_URL_DEPOSIT,
  callbackUrlSubscription: env.CALLBACK_URL_SUBSCRIPTION,
  subscriptionPlan: env.SUBSCRIPTION_PLAN || '01KKTEEJCJ5W12EMC01469Z4ZJ',
  tokens: {
    deposit: env.NORMAL_MERCHANT_API_TOKEN || '',
    subscription: env.NORMAL_MERCHANT_API_TOKEN || '',
    payout: env.NORMAL_MERCHANT_API_TOKEN || '',
  },
  merchantTokens: {
    [MerchantTokenKey.Normal]: env.NORMAL_MERCHANT_API_TOKEN || '',
    [MerchantTokenKey.India]: env.INDIA_MERCHANT_API_TOKEN || '',
    [MerchantTokenKey.Bangladesh]: env.BANGLADESH_MERCHANT_API_TOKEN || '',
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
