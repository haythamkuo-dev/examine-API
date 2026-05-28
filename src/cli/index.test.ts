import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough, Readable } from 'stream';
import { buildProgram, getRequestFailureHint } from './index';
import { promptDepositFlow, upsertEnvValue } from './depositPrompt';
import { getCliEnv } from '../core/env';
import { createDepositRequest } from '../domains/deposit';
import { createPayoutRequest } from '../domains/payout';
import { createSubscriptionRequest } from '../domains/subscription';
import { createRunner } from '../runner';
import { generateSign } from '../utils';
import type { CommandRequest } from '../runner';

const env = getCliEnv({
  API_BASE_URL: 'https://example.test',
  MERCHANT_SIGN: 'sign-key',
  NORMAL_MERCHANT_API_TOKEN: 'default-token',
  INDIA_BANGLADESH_MERCHANT_API_TOKEN: 'india-bangladesh-token',
  CALLBACK_URL_DEPOSIT: 'https://merchant.example.com/deposit',
  CALLBACK_URL_SUBSCRIPTION: 'https://merchant.example.com/subscription',
  SUBSCRIPTION_PLAN: 'PLAN-001',
  SUBSCRIPTION_PLAN_LINEPAY: 'PLAN-LINEPAY-001',
  SUBSCRIPTION_PLAN_TNG: 'PLAN-TNG-001',
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
    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(request.payload).toMatchObject({
      product_no: 'DEP-LINEPAY_ONLINE-ONLINE-TWD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '100', currency_code: 'TWD' },
    });
  });

  test('builds deposit request from manual CLI-style overrides', () => {
    const request = createDepositRequest(env, 'linepay', makeId, {
      apiKey: 'manual-deposit-token',
      baseUrl: 'https://stage.sidediff.com',
      signKey: 'manual-sign-key',
      productNo: 'DEP-LEONPAY-CREDITCARD-USD',
      merchantRef: 'TEST_ORDER_217',
      amount: '99.00',
      currencyCode: 'USD',
      returnUrl: 'https://webhook.site/8760c026-c3c4-4ee8-8194-192321a7676b',
      collect: {
        country_code: 'US',
        product_detail: 'Collect order for %s',
        product_name: 'Hugo industry',
        shopper_reference: 'CUSTOMER_001',
        origin: 'https://www.fellowproducts.com.tw/products/ekgpro',
      },
    });

    expect(request.url).toBe('https://stage.sidediff.com/s2s/v1/intents/deposit');
    expect(request.headers?.Authorization).toBe('ApiKey manual-deposit-token');
    expect(request.payload).toMatchObject({
      product_no: 'DEP-LEONPAY-CREDITCARD-USD',
      merchant_ref: 'TEST_ORDER_217',
      amount: { amount: '99.00', currency_code: 'USD' },
      return_url: 'https://webhook.site/8760c026-c3c4-4ee8-8194-192321a7676b',
      payment_order: {
        collect: {
          country_code: 'US',
          product_detail: 'Collect order for %s',
          product_name: 'Hugo industry',
          shopper_reference: 'CUSTOMER_001',
          origin: 'https://www.fellowproducts.com.tw/products/ekgpro',
        },
      },
    });

    expect((request.payload as Record<string, unknown>).sign).toBe(
      generateSign(
        {
          product_no: 'DEP-LEONPAY-CREDITCARD-USD',
          merchant_ref: 'TEST_ORDER_217',
          amount: { amount: '99.00', currency_code: 'USD' },
          return_url: 'https://webhook.site/8760c026-c3c4-4ee8-8194-192321a7676b',
          payment_order: {
            collect: {
              country_code: 'US',
              product_detail: 'Collect order for %s',
              product_name: 'Hugo industry',
              shopper_reference: 'CUSTOMER_001',
              origin: 'https://www.fellowproducts.com.tw/products/ekgpro',
            },
          },
        },
        ['amount.amount', 'amount.currency_code', 'merchant_ref', 'product_no'],
        'manual-sign-key',
      ),
    );
  });

  test('builds payout request with channel-specific endpoint', () => {
    const request = createPayoutRequest(env, 'co_wallet', makeId);

    expect(request.url).toBe('https://example.test/s2s/v1/payout/orders/co/mobile-money');
    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(request.payload).toMatchObject({
      product_no: 'PAY-FUTUREPAY_COLLECT-MOBILEMONEY-COP',
      merchant_reference: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'COP' },
    });
  });

  test('uses India token for inr_upi deposit requests', () => {
    const request = createDepositRequest(env, 'inr_upi', makeId);

    expect(request.headers?.Authorization).toBe('ApiKey india-bangladesh-token');
  });

  test('uses Bangladesh token for bd_wallet payout requests', () => {
    const request = createPayoutRequest(env, 'bd_wallet', makeId);

    expect(request.headers?.Authorization).toBe('ApiKey india-bangladesh-token');
  });

  test('builds subscription request with plan override', () => {
    const request = createSubscriptionRequest(env, makeId, { planId: 'PLAN-OVERRIDE' });

    expect(request.url).toBe('https://example.test/s2s/v1/subscriptions');
    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(request.payload).toMatchObject({
      subs_plan_id: 'PLAN-OVERRIDE',
      merchant_ref: 'TEST_ORDER_fixed-id',
      return_url: 'https://merchant.example.com/subscription',
    });
  });

  test('deposit preview uses interactive prompt result to build request', async () => {
    const output: string[] = [];
    const originalLog = console.log;
    console.log = (value?: unknown) => {
      output.push(String(value));
    };

    try {
      await buildProgram({
        env,
        makeId,
        promptDeposit: async () => ({
          channel: 'southafrica_cards',
          overrides: {
            apiKey: 'manual-deposit-token',
            baseUrl: 'https://stage.sidediff.com',
            signKey: 'manual-sign-key',
            productNo: 'DEP-LEONPAY-CREDITCARD-USD',
            merchantRef: 'TEST_ORDER_217',
            amount: '99.00',
            currencyCode: 'USD',
            returnUrl: 'https://webhook.site/8760c026-c3c4-4ee8-8194-192321a7676b',
            collect: {
              country_code: 'US',
              product_detail: 'Collect order for %s',
              product_name: 'Hugo industry',
              shopper_reference: 'CUSTOMER_001',
              origin: 'https://www.fellowproducts.com.tw/products/ekgpro',
            },
          },
        }),
      }).parseAsync([
        'node',
        'examine-api',
        'deposit',
        'preview',
      ]);
    } finally {
      console.log = originalLog;
    }

    const preview = JSON.parse(output[0] || '{}');
    expect(preview.url).toBe('https://stage.sidediff.com/s2s/v1/intents/deposit');
    expect(preview.headers.Authorization).toBe('ApiKey manual-deposit-token');
    expect(preview.payload.payment_order.collect).toMatchObject({
      country_code: 'US',
      product_detail: 'Collect order for %s',
      product_name: 'Hugo industry',
      shopper_reference: 'CUSTOMER_001',
      origin: 'https://www.fellowproducts.com.tw/products/ekgpro',
    });
  });

  test('deposit create previews, confirms, and executes request', async () => {
    const output: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const executedRequests: CommandRequest[] = [];
    const promptCalls: string[] = [];

    console.log = (value?: unknown) => {
      output.push(String(value));
    };
    console.warn = () => {};
    console.error = () => {};

    try {
      await buildProgram({
        env,
        makeId,
        promptDeposit: async () => {
          promptCalls.push('prompt');
          return {
            channel: 'southafrica_cards',
            overrides: {
              apiKey: 'manual-deposit-token',
              baseUrl: 'https://stage.sidediff.com',
              signKey: 'manual-sign-key',
              productNo: 'DEP-LEONPAY-CREDITCARD-USD',
              merchantRef: 'TEST_ORDER_217',
              amount: '99.00',
              currencyCode: 'USD',
              returnUrl: 'https://webhook.site/8760c026-c3c4-4ee8-8194-192321a7676b',
            },
          };
        },
        confirmSend: async () => {
          promptCalls.push('confirm');
          return true;
        },
        executeRequest: async (request) => {
          executedRequests.push(request);
        },
      }).parseAsync(['node', 'examine-api', 'deposit', 'create']);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }

    expect(promptCalls).toEqual(['prompt', 'confirm']);
    expect(executedRequests).toHaveLength(1);
    expect(executedRequests[0]?.headers?.Authorization).toBe('ApiKey manual-deposit-token');
    expect(JSON.parse(output[0] || '{}').payload.merchant_ref).toBe('TEST_ORDER_217');
  });

  test('deposit create with --yes skips confirmation prompt', async () => {
    const executedRequests: CommandRequest[] = [];
    let confirmCalled = false;

    await buildProgram({
      env,
      makeId,
      promptDeposit: async () => ({
        channel: 'southafrica_cards',
        overrides: {
          apiKey: 'manual-deposit-token',
          baseUrl: 'https://stage.sidediff.com',
          signKey: 'manual-sign-key',
          productNo: 'DEP-LEONPAY-CREDITCARD-USD',
          merchantRef: 'TEST_ORDER_217',
          amount: '99.00',
          currencyCode: 'USD',
          returnUrl: 'https://webhook.site/8760c026-c3c4-4ee8-8194-192321a7676b',
        },
      }),
      confirmSend: async () => {
        confirmCalled = true;
        return false;
      },
      executeRequest: async (request) => {
        executedRequests.push(request);
      },
    }).parseAsync(['node', 'examine-api', 'deposit', 'create', '--yes']);

    expect(confirmCalled).toBe(false);
    expect(executedRequests).toHaveLength(1);
  });

  test('deposit prompt skips credential questions when env already has values', async () => {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (chunk) => chunks.push(String(chunk)));

    const result = await promptDepositFlow({
      env,
      input: Readable.from([]),
      output,
      makeId,
    });

    expect(result.overrides.apiKey).toBe('default-token');
    expect(result.overrides.signKey).toBe('sign-key');
    expect(result.overrides.returnUrl).toBe('https://merchant.example.com/deposit');
    expect(chunks.join('')).toContain('Deposit setup');
    expect(chunks.join('')).not.toContain('Deposit API key');
    expect(chunks.join('')).not.toContain('Sign key');
    expect(chunks.join('')).not.toContain('Return URL');
  });

  test('deposit env persistence updates env file values', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'examine-api-'));
    const envFilePath = join(tempDir, '.env');
    await upsertEnvValue(envFilePath, 'NORMAL_MERCHANT_API_TOKEN', 'manual-deposit-token');
    await upsertEnvValue(envFilePath, 'MERCHANT_SIGN', 'manual-sign-key');
    await upsertEnvValue(
      envFilePath,
      'CALLBACK_URL_DEPOSIT',
      'https://webhook.site/8760c026-c3c4-4ee8-8194-192321a7676b',
    );

    const savedEnv = await readFile(envFilePath, 'utf8');
    expect(savedEnv).toContain('NORMAL_MERCHANT_API_TOKEN=manual-deposit-token');
    expect(savedEnv).toContain('MERCHANT_SIGN=manual-sign-key');
    expect(savedEnv).toContain('CALLBACK_URL_DEPOSIT=https://webhook.site/8760c026-c3c4-4ee8-8194-192321a7676b');
  });

  test('runner exposes api error code and message', async () => {
    const logs: string[] = [];
    const runner = createRunner({
      httpClient: async () =>
        new Response(JSON.stringify({ code: 'binding_missing', message: 'merchant product not bound' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      logger: {
        info: (...args) => logs.push(args.join(' ')),
        warn: (...args) => logs.push(args.join(' ')),
        error: (...args) => logs.push(args.join(' ')),
      },
      now: () => new Date(0),
      makeId,
      timeoutMs: 1000,
    });

    const result = await runner.run({
      name: 'deposit:create:test',
      method: 'POST',
      url: 'https://example.test',
      payload: {},
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.code).toBe('binding_missing');
    expect(result.message).toBe('merchant product not bound');
    expect(logs.some((entry) => entry.includes('Running request deposit:create:test POST https://example.test'))).toBe(
      true,
    );
    expect(logs.some((entry) => entry.includes('code=binding_missing'))).toBe(true);
  });

  test('runner returns timeout error when request exceeds timeout', async () => {
    const runner = createRunner({
      httpClient: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('This operation was aborted', 'AbortError')));
        }),
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      now: () => new Date(),
      makeId,
      timeoutMs: 5,
    });

    const result = await runner.run({
      name: 'deposit:create:timeout',
      method: 'POST',
      url: 'https://example.test',
      payload: {},
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Timeout after 5ms');
  });

  test('binding_missing error returns product guidance hint', () => {
    const hint = getRequestFailureHint({
      requestName: 'deposit:create:test',
      ok: false,
      status: 400,
      request: { method: 'POST', url: 'https://example.test', payload: {} },
      code: 'binding_missing',
      message: 'merchant product not bound',
      durationMs: 10,
    });

    expect(hint).toContain('not bound to this product_no');
    expect(hint).toContain('bound product number');
  });
});
