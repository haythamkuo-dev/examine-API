import { type CliEnv, type SubscriptionChannel, joinUrl } from '../core/env';
import type { SubscriptionChannelValues, SubscriptionCommonValues } from '../subscription/web';
import { generateSign } from '../utils';
import type { CommandRequest } from '../runner';

export type SubscriptionPayload = {
  subs_plan_id: string;
  amount: {
    amount: string;
    currency_code: string;
  };
  interval_unit: string;
  interval_count: number;
  times: number;
  product_detail: string;
  product_name: string;
  merchant_ref: string;
  consumer_id: string;
  consumer_profile: {
    name: string;
    phone: string;
    email: string;
    country_code: string;
  };
  origin: string;
  payment_instrument: {
    os_type: string;
    terminal_type: string;
  };
  return_url?: string;
  sign?: string;
};

export type SubscriptionRequestOverrides = {
  commonValues: SubscriptionCommonValues;
  channelValues: SubscriptionChannelValues;
};

type LegacySubscriptionOverrides = {
  planId?: string;
};

const subscriptionSignFields = ['merchant_no', 'merchant_ref', 'order_id', 'status'];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const createLegacySubscriptionOverrides = (
  env: CliEnv,
  makeId: (prefix: string) => string,
  overrides: LegacySubscriptionOverrides = {},
): SubscriptionRequestOverrides => ({
  commonValues: {
    merchantRef: makeId('TEST_ORDER_'),
    returnUrl: env.callbackUrlSubscription || '',
  },
  channelValues: {
    subs_plan_id: overrides.planId || env.subscriptionPlan,
    amount: {
      amount: '111.00',
      currency_code: 'USD',
    },
    interval_unit: 'month',
    interval_count: 1,
    times: 12,
    product_detail: '測試訂閱商品描述加簽',
    product_name: '測試訂閱方案加簽',
    consumer_id: 'user_999',
    consumer_profile: {
      name: '測試用戶加簽',
      phone: '0912345678',
      email: 'test@example.com',
      country_code: 'ZA',
    },
    origin: 'https://www.amazon.com/',
    payment_instrument: {
      os_type: 'WEB',
      terminal_type: 'WEB',
    },
  },
});

const buildSubscriptionPayload = (
  overrides: SubscriptionRequestOverrides,
): SubscriptionPayload => ({
  ...(clone(overrides.channelValues) as Omit<SubscriptionPayload, 'merchant_ref' | 'return_url' | 'sign'>),
  merchant_ref: overrides.commonValues.merchantRef,
  return_url: overrides.commonValues.returnUrl,
});

/**
 * Builds a subscription payload from either the legacy CLI overrides or the channel-aware web form values.
 *
 * @param env Runtime environment containing endpoint and fallback values.
 * @param arg1 Either the selected subscription channel or the legacy ID factory.
 * @param arg2 Either the form-driven overrides or the legacy overrides object.
 * @param arg3 ID factory used by the channel-aware path.
 * @returns The signed subscription payload.
 * @throws {TypeError} When the selected channel is unsupported.
 */
export function createSubscriptionPayload(
  env: CliEnv,
  makeId: (prefix: string) => string,
  overrides?: LegacySubscriptionOverrides,
): SubscriptionPayload;
export function createSubscriptionPayload(
  env: CliEnv,
  channel: SubscriptionChannel,
  overrides: SubscriptionRequestOverrides,
  makeId: (prefix: string) => string,
): SubscriptionPayload;
export function createSubscriptionPayload(
  env: CliEnv,
  arg1: SubscriptionChannel | ((prefix: string) => string),
  arg2?: SubscriptionRequestOverrides | LegacySubscriptionOverrides,
  arg3?: (prefix: string) => string,
): SubscriptionPayload {
  const [channel, overrides] =
    typeof arg1 === 'function'
      ? (['default', createLegacySubscriptionOverrides(env, arg1, (arg2 as LegacySubscriptionOverrides) || {})] as const)
      : ([arg1, arg2 as SubscriptionRequestOverrides] as const);

  if (channel !== 'default') {
    throw new TypeError(`Unsupported subscription channel: ${channel}`);
  }

  const payload = buildSubscriptionPayload(overrides);

  return {
    ...payload,
    sign: generateSign(payload, subscriptionSignFields, env.signKey),
  };
}

/**
 * Builds a subscription command request from either the legacy CLI overrides or the channel-aware web form values.
 *
 * @param env Runtime environment containing endpoints, signing config, and merchant tokens.
 * @param arg1 Either the selected subscription channel or the legacy ID factory.
 * @param arg2 Either the form-driven overrides or the legacy overrides object.
 * @param arg3 ID factory used by the channel-aware path.
 * @returns A runner-compatible subscription request.
 * @throws {TypeError} When the configured base URL or channel payload cannot be composed into a valid request.
 */
export function createSubscriptionRequest(
  env: CliEnv,
  makeId: (prefix: string) => string,
  overrides?: LegacySubscriptionOverrides,
): CommandRequest;
export function createSubscriptionRequest(
  env: CliEnv,
  channel: SubscriptionChannel,
  overrides: SubscriptionRequestOverrides,
  makeId: (prefix: string) => string,
): CommandRequest;
export function createSubscriptionRequest(
  env: CliEnv,
  arg1: SubscriptionChannel | ((prefix: string) => string),
  arg2?: SubscriptionRequestOverrides | LegacySubscriptionOverrides,
  arg3?: (prefix: string) => string,
): CommandRequest {
  const [channel, payload] =
    typeof arg1 === 'function'
      ? (['default', createSubscriptionPayload(env, arg1, (arg2 as LegacySubscriptionOverrides) || {})] as const)
      : ([arg1, createSubscriptionPayload(env, arg1, arg2 as SubscriptionRequestOverrides, arg3 as (prefix: string) => string)] as const);

  return {
    name: `subscription:create:${channel}`,
    method: 'POST',
    url: joinUrl(env.baseUrl, env.subscriptionUrl),
    headers: {
      Authorization: `ApiKey ${env.tokens.subscription}`,
      'Content-Type': 'application/json',
    },
    payload,
  };
}
