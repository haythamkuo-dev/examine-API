import {
  defaultTargetEnvironment,
  type TargetEnvironment,
} from './targetEnvironment';

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
  'international_credit_cards',
  'JCB-USD',
  'JCB-JPY',
  'ALIPAY-CNY',
  'ALIPAY-HKD',
  'WECHAT-HKD',
  'ALIPAY-8000',
  'ALIPAY-6014',
  'WECHAT-6016',
  'cmoney-intercard',
] as const;

export const PAYOUT_CHANNELS = ['co_bank', 'co_wallet', 'imps', 'bd_wallet'] as const;
export const SUBSCRIPTION_CHANNELS = [
  'default',
  'rabbitLinePay',
  'touchAndGo',
  'internationalCreditCard',
] as const;

export type DepositChannel = (typeof DEPOSIT_CHANNELS)[number];
export type PayoutChannel = (typeof PAYOUT_CHANNELS)[number];
export type SubscriptionChannel = (typeof SUBSCRIPTION_CHANNELS)[number];

export enum MerchantTokenKey {
  Normal = 'normal',
  India = 'india',
  Bangladesh = 'bangladesh',
}

export type CliEnv = {
  baseUrl: string;
  signKey: string;
  depositUrl: string;
  subscriptionUrl: string;
  callbackUrlDeposit?: string;
  callbackUrlSubscription?: string;
  subscriptionPlans: Record<SubscriptionChannel, string>;
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

export type CliEnvRegistry = Record<TargetEnvironment, CliEnv>;

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
  international_credit_cards: MerchantTokenKey.Normal,
  'JCB-USD': MerchantTokenKey.Normal,
  'JCB-JPY': MerchantTokenKey.Normal,
  'ALIPAY-CNY': MerchantTokenKey.Normal,
  'ALIPAY-HKD': MerchantTokenKey.Normal,
  'WECHAT-HKD': MerchantTokenKey.Normal,
  'ALIPAY-8000': MerchantTokenKey.Normal,
  'ALIPAY-6014': MerchantTokenKey.Normal,
  'WECHAT-6016': MerchantTokenKey.Normal,
  'cmoney-intercard': MerchantTokenKey.Normal,
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
 * Resolves the default deposit API key for the selected channel.
 *
 * @param env Runtime environment containing all region-scoped merchant tokens.
 * @param channel Deposit channel selected by the caller.
 * @returns The API key that should authorize deposit requests for the channel.
 * @throws {TypeError} When an invalid deposit channel is passed at runtime.
 */
export const resolveDepositApiKey = (env: CliEnv, channel: DepositChannel): string =>
  getMerchantToken(env, resolveDepositMerchantTokenKey(channel));

/**
 * Resolves the default payout API key for the selected channel.
 *
 * @param env Runtime environment containing all region-scoped merchant tokens.
 * @param channel Payout channel selected by the caller.
 * @returns The API key that should authorize payout requests for the channel.
 * @throws {TypeError} When an invalid payout channel is passed at runtime.
 */
export const resolvePayoutApiKey = (env: CliEnv, channel: PayoutChannel): string =>
  getMerchantToken(env, resolvePayoutMerchantTokenKey(channel));

/**
 * Resolves the default subscription API key for the selected environment.
 *
 * @param env Runtime environment containing subscription credentials.
 * @returns The API key that should authorize subscription requests.
 * @throws {TypeError} When the runtime environment cannot be read.
 */
export const resolveSubscriptionApiKey = (env: CliEnv): string => env.tokens.subscription;

export class SubscriptionPlanConfigError extends TypeError {
  /**
   * Builds an error describing a missing subscription plan mapping for a channel/environment pair.
   *
   * @param channel Subscription channel being resolved.
   * @param baseEnvVar Base environment variable name for the target environment.
   * @returns An error with an actionable configuration message.
   */
  constructor(channel: SubscriptionChannel, baseEnvVar: string) {
    super(`Missing subscription plan configuration for "${channel}". Expected env var: ${baseEnvVar}`);
    this.name = 'SubscriptionPlanConfigError';
  }
}

const getSubscriptionPlanEnvVarName = (
  channel: SubscriptionChannel,
  target: TargetEnvironment,
): string => {
  const prefix = target === 'product' ? 'SUBSCRIPTION_PLAN_PROD' : 'SUBSCRIPTION_PLAN';

  if (channel === 'default') {
    return prefix;
  }

  if (channel === 'rabbitLinePay') {
    return `${prefix}_LINEPAY`;
  }

  if (channel === 'internationalCreditCard') {
    return `${prefix}_INTERNATIONAL_CARD`;
  }

  return `${prefix}_TNG`;
};

/**
 * Resolves the configured subscription plan for a specific channel.
 *
 * @param env Runtime environment containing channel-scoped subscription plans.
 * @param channel Subscription channel being requested.
 * @param target Target operator environment for error reporting.
 * @returns The configured subscription plan id.
 * @throws {SubscriptionPlanConfigError} When the selected channel has no configured plan id.
 */
export const resolveSubscriptionPlan = (
  env: CliEnv,
  channel: SubscriptionChannel,
  target: TargetEnvironment = defaultTargetEnvironment,
): string => {
  const planId = env.subscriptionPlans[channel]?.trim();
  if (!planId) {
    throw new SubscriptionPlanConfigError(channel, getSubscriptionPlanEnvVarName(channel, target));
  }

  return planId;
};

const buildCliEnv = (params: {
  baseUrl: string;
  defaultMerchantApiToken: string;
  indiaBangladeshMerchantApiToken: string;
  target: TargetEnvironment;
  env: NodeJS.ProcessEnv;
}): CliEnv => ({
  baseUrl: params.baseUrl,
  signKey: params.env.MERCHANT_SIGN || '',
  depositUrl: params.env.DEPOSIT_URL || '/s2s/v1/intents/deposit',
  subscriptionUrl: params.env.SUBSCRIPTION_URL || '/s2s/v1/subscriptions',
  callbackUrlDeposit: params.env.CALLBACK_URL_DEPOSIT,
  callbackUrlSubscription: params.env.CALLBACK_URL_SUBSCRIPTION,
  subscriptionPlans: {
    default: params.env[params.target === 'product' ? 'SUBSCRIPTION_PLAN_PROD' : 'SUBSCRIPTION_PLAN'] || '',
    rabbitLinePay:
      params.env[params.target === 'product' ? 'SUBSCRIPTION_PLAN_PROD_LINEPAY' : 'SUBSCRIPTION_PLAN_LINEPAY'] || '',
    touchAndGo:
      params.env[params.target === 'product' ? 'SUBSCRIPTION_PLAN_PROD_TNG' : 'SUBSCRIPTION_PLAN_TNG'] || '',
    internationalCreditCard:
      params.env[
        params.target === 'product'
          ? 'SUBSCRIPTION_PLAN_PROD_INTERNATIONAL_CARD'
          : 'SUBSCRIPTION_PLAN_INTERNATIONAL_CARD'
      ] || '',
  },
  tokens: {
    deposit: params.defaultMerchantApiToken,
    subscription: params.defaultMerchantApiToken,
    payout: params.defaultMerchantApiToken,
  },
  merchantTokens: {
    [MerchantTokenKey.Normal]: params.defaultMerchantApiToken,
    [MerchantTokenKey.India]: params.indiaBangladeshMerchantApiToken,
    [MerchantTokenKey.Bangladesh]: params.indiaBangladeshMerchantApiToken,
  },
  payoutUrls: {
    co_bank: params.env.PAYOUT_URL_BANK || '/s2s/v1/payout/orders/co/bank-transfer',
    co_wallet: params.env.PAYOUT_URL_CO_WALLET || '/s2s/v1/payout/orders/co/mobile-money',
    imps: params.env.PAYOUT_URL_IMPS || '/s2s/v1/payout/orders/in/imps',
    bd_wallet: params.env.PAYOUT_URL_BD_WALLET || '/s2s/v1/payout/orders/bd/mobile-wallet',
  },
  payoutProductNos: {
    co_bank: params.env.PAYOUT_CO_BANK || 'PAY-FUTUREPAY_COLLECT-BANKTRANSFERCO-COP',
    co_wallet: params.env.PAYOUT_CO_WALLET || 'PAY-FUTUREPAY_COLLECT-MOBILEMONEY-COP',
    imps: params.env.PAYOUT_IMPS || 'PAY-EC-IMPS-INR',
    bd_wallet: params.env.PAYOUT_BD_WALLET || 'PAY-FUTUREPAY_COLLECT-BD-MOBILE-WALLET-COP',
  },
  depositSouthAfricaCardsProductNo: params.env.DEPOSIT_SOUTHAFICA_CARDS || 'TEST_PRODUCT_123',
});

/**
 * Builds the normalized local runtime environment used by CLI, API routes, and request builders.
 *
 * @param env Raw process environment variables.
 * @returns The parsed local CLI environment with endpoint, token, and product configuration.
 * @throws {TypeError} When the provided environment object cannot be read.
 */
export const getCliEnv = (env: NodeJS.ProcessEnv = process.env): CliEnv =>
  buildCliEnv({
    baseUrl: env.API_BASE_URL || 'https://stage.sidediff.com',
    defaultMerchantApiToken: env.NORMAL_MERCHANT_API_TOKEN || '',
    indiaBangladeshMerchantApiToken: env.INDIA_BANGLADESH_MERCHANT_API_TOKEN || '',
    target: 'local',
    env,
  });

/**
 * Builds the normalized product runtime environment used by the internal operator API.
 *
 * @param env Raw process environment variables.
 * @returns The parsed product CLI environment with product endpoint and credentials.
 * @throws {TypeError} When the provided environment object cannot be read.
 */
export const getProductCliEnv = (env: NodeJS.ProcessEnv = process.env): CliEnv =>
  buildCliEnv({
    baseUrl: env.API_PROD_BASE_URL || '',
    defaultMerchantApiToken: env.PROD_MERCHANT_API_TOKEN || '',
    indiaBangladeshMerchantApiToken: env.PROD_MERCHANT_API_TOKEN_INDIA_BANGLADESH || '',
    target: 'product',
    env,
  });

/**
 * Builds the complete runtime environment registry keyed by operator target environment.
 *
 * @param env Raw process environment variables.
 * @returns Both local and product CLI environments.
 * @throws {TypeError} When the provided environment object cannot be read.
 */
export const getCliEnvRegistry = (env: NodeJS.ProcessEnv = process.env): CliEnvRegistry => ({
  local: getCliEnv(env),
  product: getProductCliEnv(env),
});

/**
 * Selects the CLI environment for the requested target environment.
 *
 * @param registry Runtime environment registry keyed by target environment.
 * @param target Requested operator target environment.
 * @returns The CLI environment backing that target.
 * @throws {TypeError} When the target environment is not available in the registry.
 */
export const getCliEnvForTarget = (
  registry: CliEnvRegistry,
  target: TargetEnvironment = defaultTargetEnvironment,
): CliEnv => registry[target];

export const joinUrl = (baseUrl: string, path: string): string => new URL(path, baseUrl).toString();
