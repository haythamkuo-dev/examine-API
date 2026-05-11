import { describe, expect, test } from 'bun:test';
import { buildProgram } from './index';
import { getCliEnv } from '../core/env';
import { createDepositRequest } from '../domains/deposit';
import { createPayoutRequest } from '../domains/payout';
import { createSubscriptionRequest } from '../domains/subscription';

const env = getCliEnv({
  API_BASE_URL: 'https://example.test',
  MERCHANT_SIGN: 'sign-key',
  MERCHANT_API_TOKEN_DEPOSIT: 'deposit-token',
  MERCHANT_API_TOKEN_SUBSCRIPTION: 'subscription-token',
  MERCHANT_API_TOKEN_PAYOUT: 'payout-token',
  CALLBACK_URL_DEPOSIT: 'https://merchant.example.com/deposit',
  CALLBACK_URL_SUBSCRIPTION: 'https://merchant.example.com/subscription',
  SUBSCRIPTION_PLAN: 'PLAN-001',
});

const makeId = (prefix: string) => `${prefix}fixed-id`;

describe('CLI program', () => {
  test('registers top-level domains', () => {
    const commandNames = buildProgram().commands.map((command) => command.name());
    expect(commandNames).toEqual(['deposit', 'payout', 'subscription']);
  });
});

describe('request builders', () => {
  test('builds deposit request with selected channel', () => {
    const request = createDepositRequest(env, 'linepay', makeId);

    expect(request.url).toBe('https://example.test/s2s/v1/intents/deposit');
    expect(request.headers?.Authorization).toBe('ApiKey deposit-token');
    expect(request.payload).toMatchObject({
      product_no: 'DEP-LINEPAY_ONLINE-ONLINE-TWD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '100', currency_code: 'TWD' },
    });
  });

  test('builds payout request with channel-specific endpoint', () => {
    const request = createPayoutRequest(env, 'co_wallet', makeId);

    expect(request.url).toBe('https://example.test/s2s/v1/payout/orders/co/mobile-money');
    expect(request.headers?.Authorization).toBe('ApiKey payout-token');
    expect(request.payload).toMatchObject({
      product_no: 'PAY-FUTUREPAY_COLLECT-MOBILEMONEY-COP',
      merchant_reference: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'COP' },
    });
  });

  test('builds subscription request with plan override', () => {
    const request = createSubscriptionRequest(env, makeId, { planId: 'PLAN-OVERRIDE' });

    expect(request.url).toBe('https://example.test/s2s/v1/subscriptions');
    expect(request.headers?.Authorization).toBe('ApiKey subscription-token');
    expect(request.payload).toMatchObject({
      subs_plan_id: 'PLAN-OVERRIDE',
      merchant_ref: 'TEST_ORDER_fixed-id',
      return_url: 'https://merchant.example.com/subscription',
    });
  });
});
