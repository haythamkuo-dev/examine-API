import { type CliEnv, joinUrl } from '../core/env';
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

export const createSubscriptionPayload = (
  env: CliEnv,
  makeId: (prefix: string) => string,
  overrides: { planId?: string } = {},
): SubscriptionPayload => {
  const payload: SubscriptionPayload = {
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
    merchant_ref: makeId('TEST_ORDER_'),
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
    return_url: env.callbackUrlSubscription,
  };
  const signFields = ['merchant_no', 'merchant_ref', 'order_id', 'status'];

  return {
    ...payload,
    sign: generateSign(payload, signFields, env.signKey),
  };
};

export const createSubscriptionRequest = (
  env: CliEnv,
  makeId: (prefix: string) => string,
  overrides: { planId?: string } = {},
): CommandRequest => ({
  name: 'subscription:create',
  method: 'POST',
  url: joinUrl(env.baseUrl, env.subscriptionUrl),
  headers: {
    Authorization: `ApiKey ${env.tokens.subscription}`,
    'Content-Type': 'application/json',
  },
  payload: createSubscriptionPayload(env, makeId, overrides),
});
