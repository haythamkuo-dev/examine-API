import {
  defaultTargetEnvironment,
  type TargetEnvironment,
} from './targetEnvironment';

export enum MerchantTokenKey {
  Normal = 'normal',
  India = 'india',
  Bangladesh = 'bangladesh',
}

export type BackendFeature = 'deposit' | 'payout' | 'subscription';
export type SubscriptionPlanEnvSuffix = '' | '_LINEPAY' | '_TNG' | '_INTERNATIONAL_CARD';

export type BackendChannelManifestEntry<Channel extends string = string> = {
  feature: BackendFeature;
  channel: Channel;
  presetFile: string;
  auditTarget: string;
  tokenKey?: MerchantTokenKey;
  default?: boolean;
  deferred?: boolean;
  planEnvSuffix?: SubscriptionPlanEnvSuffix;
};

const createChannelManifestEntry = <Channel extends string>(
  feature: BackendFeature,
  channel: Channel,
  metadata: Pick<
    BackendChannelManifestEntry<Channel>,
    'tokenKey' | 'default' | 'deferred' | 'planEnvSuffix'
  >,
): BackendChannelManifestEntry<Channel> => ({
  feature,
  channel,
  presetFile: `${channel}.json`,
  auditTarget: `preset_channels:${feature}:${channel}`,
  ...metadata,
});

/**
 * Resolves the single default channel declared by a backend feature manifest.
 *
 * @param manifest Channel metadata for one backend feature.
 * @returns The channel marked with `default: true`.
 * @throws {TypeError} When the manifest does not contain exactly one default channel.
 */
export const getDefaultChannel = <Channel extends string>(
  manifest: readonly BackendChannelManifestEntry<Channel>[],
): Channel => {
  const defaults = manifest.filter((entry) => entry.default === true);
  if (defaults.length !== 1) {
    const feature = manifest[0]?.feature || 'unknown';
    throw new TypeError(`Expected exactly one default channel in the ${feature} manifest.`);
  }

  return defaults[0]!.channel;
};

export const DEPOSIT_CHANNEL_MANIFEST = [
  createChannelManifestEntry('deposit', 'southafrica_cards', { tokenKey: MerchantTokenKey.Normal, default: true }),
  createChannelManifestEntry('deposit', 'linepay', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'linepay_invoice', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'inr_upi', { tokenKey: MerchantTokenKey.India }),
  createChannelManifestEntry('deposit', 'bdt_worldpay', { tokenKey: MerchantTokenKey.Bangladesh }),
  createChannelManifestEntry('deposit', 'co_bank_transfer', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'co_cash', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'co_nequi', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'co_nequi_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'co_nequi_usd2', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'co_pse', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'co_pse_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'skrill_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'th_rabbit_linepay', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'th_rabbit_linepay_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'th_rabbit_linepay_usd2', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'th_kplus_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'th_tmn_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'my_tng', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'my_tng_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'my_boost_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'my_tng_usd2', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'my_fpx_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'mx_spei_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'international_credit_cards', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'googlepay_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'pix_brl', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'id_dana_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'duitnowqr_usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'JCB-USD', { tokenKey: MerchantTokenKey.Normal, deferred: true }),
  createChannelManifestEntry('deposit', 'JCB-JPY', { tokenKey: MerchantTokenKey.Normal, deferred: true }),
  createChannelManifestEntry('deposit', 'ALIPAY-CNY', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'ALIPAY-HKD', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'WECHAT-HKD', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'ALIPAY-8000', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'ALIPAY-6014', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'ALIPAY-6014-USD', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'WECHAT-6013', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'WECHAT-6038', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'WECHAT-6016', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'WECHAT-6016-USD', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'cmoney-intercard', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-intercard-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-googlepay-my-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-googlepay-sg-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-googlepay-vn-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-googlepay-th-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-googlepay-ph-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-googlepay-id-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-googlepay-hk-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-googlepay-jp-jpy', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-applepay-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-applepay-my-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-applepay-ph-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-applepay-sg-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-applepay-th-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-applepay-vn-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-applepay-hk-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-applepay-id-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-applepay-jp-jpy', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-intercard-sg-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-intercard-vn-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-intercard-th-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-intercard-ph-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-intercard-id-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'loki-intercard-hk-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'ez-intercard-usd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'ez-intercard-hkd', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('deposit', 'ez-intercard-jpy', { tokenKey: MerchantTokenKey.Normal }),
] as const;

export const PAYOUT_CHANNEL_MANIFEST = [
  createChannelManifestEntry('payout', 'co_bank', { tokenKey: MerchantTokenKey.Normal, default: true }),
  createChannelManifestEntry('payout', 'co_wallet', { tokenKey: MerchantTokenKey.Normal }),
  createChannelManifestEntry('payout', 'imps', { tokenKey: MerchantTokenKey.India }),
  createChannelManifestEntry('payout', 'bd_wallet', { tokenKey: MerchantTokenKey.Bangladesh }),
] as const;

export const SUBSCRIPTION_CHANNEL_MANIFEST = [
  createChannelManifestEntry('subscription', 'default', { default: true, planEnvSuffix: '' }),
  createChannelManifestEntry('subscription', 'rabbitLinePay', { planEnvSuffix: '_LINEPAY' }),
  createChannelManifestEntry('subscription', 'touchAndGo', { planEnvSuffix: '_TNG' }),
  createChannelManifestEntry('subscription', 'internationalCreditCard', {
    planEnvSuffix: '_INTERNATIONAL_CARD',
  }),
] as const;

export type DepositChannel = (typeof DEPOSIT_CHANNEL_MANIFEST)[number]['channel'];
export type PayoutChannel = (typeof PAYOUT_CHANNEL_MANIFEST)[number]['channel'];
export type SubscriptionChannel = (typeof SUBSCRIPTION_CHANNEL_MANIFEST)[number]['channel'];

export const DEPOSIT_CHANNELS: readonly DepositChannel[] = DEPOSIT_CHANNEL_MANIFEST.map(
  ({ channel }) => channel,
);
export const PAYOUT_CHANNELS: readonly PayoutChannel[] = PAYOUT_CHANNEL_MANIFEST.map(
  ({ channel }) => channel,
);
export const SUBSCRIPTION_CHANNELS: readonly SubscriptionChannel[] = SUBSCRIPTION_CHANNEL_MANIFEST.map(
  ({ channel }) => channel,
);

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

/**
 * Resolves the merchant token class for a deposit channel.
 *
 * @param channel Deposit channel selected by the caller.
 * @returns The env token key that should authorize this deposit request.
 * @throws {TypeError} When an invalid deposit channel is passed at runtime.
 */
export const resolveDepositMerchantTokenKey = (channel: DepositChannel): MerchantTokenKey => {
  const entry = DEPOSIT_CHANNEL_MANIFEST.find((candidate) => candidate.channel === channel);
  if (!entry?.tokenKey) {
    throw new TypeError(`Unsupported deposit channel: ${channel}`);
  }

  return entry.tokenKey;
};

/**
 * Resolves the merchant token class for a payout channel.
 *
 * @param channel Payout channel selected by the caller.
 * @returns The env token key that should authorize this payout request.
 * @throws {TypeError} When an invalid payout channel is passed at runtime.
 */
export const resolvePayoutMerchantTokenKey = (channel: PayoutChannel): MerchantTokenKey => {
  const entry = PAYOUT_CHANNEL_MANIFEST.find((candidate) => candidate.channel === channel);
  if (!entry?.tokenKey) {
    throw new TypeError(`Unsupported payout channel: ${channel}`);
  }

  return entry.tokenKey;
};

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

  const entry = SUBSCRIPTION_CHANNEL_MANIFEST.find((candidate) => candidate.channel === channel);
  if (!entry || entry.planEnvSuffix === undefined) {
    throw new TypeError(`Unsupported subscription channel: ${channel}`);
  }

  return `${prefix}${entry.planEnvSuffix}`;
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
  subscriptionPlans: Object.fromEntries(
    SUBSCRIPTION_CHANNEL_MANIFEST.map((entry) => [
      entry.channel,
      params.env[getSubscriptionPlanEnvVarName(entry.channel, params.target)] || '',
    ]),
  ) as Record<SubscriptionChannel, string>,
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
