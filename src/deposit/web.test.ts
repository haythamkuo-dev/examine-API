import { describe, expect, test } from 'bun:test';
import { getCliEnv } from '../core/env';
import {
  buildDepositPreviewResponse,
  buildDepositRequestFromForm,
  type DepositRequestValues,
} from './web';
import {
  createSeedDepositPresets,
  type DepositChannelConfig,
  type DepositCommonConfig,
  type DepositPresetSource,
  normalizeDepositPresets,
  toDepositDefaultsResponse,
  updateDepositPreset,
} from './presets';
import { createRunner } from '../runner';
import { buildDepositCreateResponse } from './web';
import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const env = getCliEnv({
  API_BASE_URL: 'https://example.test',
  MERCHANT_SIGN: 'sign-key',
  NORMAL_MERCHANT_API_TOKEN: 'default-token',
  INDIA_BANGLADESH_MERCHANT_API_TOKEN: 'india-bangladesh-token',
  CALLBACK_URL_DEPOSIT: 'https://merchant.example.com/deposit',
  DEPOSIT_SOUTHAFICA_CARDS: 'DEP-BOUND-USD',
});

const makeId = (prefix: string) => `${prefix}fixed-id`;

describe('deposit web helpers', () => {
  test('creates seed deposit presets for all channels', () => {
    const result = createSeedDepositPresets(env, makeId);

    expect(result.channels.southafrica_cards.commonValues.productNo).toBe('DEP-BOUND-USD');
    expect(result.channels.international_credit_cards.commonValues.productNo).toBe(
      'DEP-FUTUREPAY_COLLECT-COLLECT-USD',
    );
    expect(result.channels.international_credit_cards.values).toMatchObject({
      payment_order: {
        collect: {
          country_code: 'US',
          product_detail: 'Collect order for %s',
          product_name: 'Collect Checkout',
          shopper_reference: 'CUSTOMER_001',
          origin: 'merchant.example.com',
        },
      },
    });
    expect(result.common.values.merchantRef).toBe('TEST_ORDER_fixed-id');
    expect(result.common.values.returnUrl).toBe('https://merchant.example.com/deposit');
  });

  test('includes the new deposit channel presets', () => {
    const result = createSeedDepositPresets(env, makeId);

    expect(result.channels['JCB-USD'].commonValues).toEqual({
      productNo: 'DEP-FUTUREPAY_COLLECT-GENERALJCBCOLLECT-USD',
      amount: '99.99',
      currencyCode: 'USD',
    });
    expect(result.channels['JCB-JPY'].values).toMatchObject({
      payment_order: { collect: { country_code: 'JP', product_name: 'JCB for JPY' } },
    });
    expect(result.channels['ALIPAY-CNY'].values).toMatchObject({
      payment_order: { collect: { country_code: 'CN', product_name: 'aliPay for CNY' } },
    });
    expect(result.channels['ALIPAY-8000'].values).toEqual({});
  });

  test('builds requests for a new deposit channel with a generated merchant reference', () => {
    const defaults = toDepositDefaultsResponse(
      'JCB-USD',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload.product_no).toBe('DEP-FUTUREPAY_COLLECT-GENERALJCBCOLLECT-USD');
    expect(payload.merchant_ref).toBe('TEST_ORDER_fixed-id');
    expect(payload.return_url).toBe('https://merchant.example.com/deposit');
    expect(payload.payment_order).toMatchObject({
      collect: { country_code: 'US', product_name: 'JCB for USD' },
    });
  });

  test('builds masked preview response', () => {
    const defaults = toDepositDefaultsResponse(
      'southafrica_cards',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const values: DepositRequestValues = {
      ...defaults.form,
      commonValues: {
        ...defaults.form.commonValues,
        merchantRef: 'TEST_ORDER_217',
      },
    };

    const preview = buildDepositPreviewResponse(env, values, makeId);

    expect(preview.request.headers?.Authorization).toBe('ApiKey ****-token');
    expect((preview.request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_fixed-id');
  });

  test('builds request from form values', () => {
    const defaults = toDepositDefaultsResponse(
      'southafrica_cards',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const values: DepositRequestValues = {
      ...defaults.form,
      commonValues: {
        ...defaults.form.commonValues,
        merchantRef: 'TEST_ORDER_217',
      },
    };

    const request = buildDepositRequestFromForm(env, values, makeId);
    expect(request.url).toBe('https://example.test/s2s/v1/intents/deposit');
    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect((request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_217');
  });

  test('preview generates a fresh merchant reference even when the form already has one', () => {
    const defaults = toDepositDefaultsResponse(
      'southafrica_cards',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const values: DepositRequestValues = {
      ...defaults.form,
      commonValues: {
        ...defaults.form.commonValues,
        merchantRef: 'TEST_PREVIEW_217',
      },
    };

    const preview = buildDepositPreviewResponse(env, values, makeId);

    expect((preview.request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_fixed-id');
  });

  test('uses channel-scoped merchant token for India deposit channels', () => {
    const defaults = toDepositDefaultsResponse('inr_upi', env, createSeedDepositPresets(env, makeId));
    const values: DepositRequestValues = {
      ...defaults.form,
      commonValues: {
        ...defaults.form.commonValues,
        merchantRef: 'TEST_ORDER_IN_217',
      },
    };

    const request = buildDepositRequestFromForm(env, values, makeId);
    expect(request.headers?.Authorization).toBe('ApiKey india-bangladesh-token');
  });

  test('creates a unique merchant reference when form value is blank', () => {
    const defaults = toDepositDefaultsResponse(
      'southafrica_cards',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const values: DepositRequestValues = {
      ...defaults.form,
      commonValues: {
        ...defaults.form.commonValues,
        merchantRef: '   ',
      },
    };

    const request = buildDepositRequestFromForm(env, values, makeId);
    expect((request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_fixed-id');
  });

  test('uses a manually provided deposit api key when present', () => {
    const defaults = toDepositDefaultsResponse(
      'southafrica_cards',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const values: DepositRequestValues = {
      ...defaults.form,
      apiKey: 'manual-deposit-token',
    };

    const request = buildDepositRequestFromForm(env, values, makeId);
    expect(request.headers?.Authorization).toBe('ApiKey manual-deposit-token');
  });

  test('adds binding hint to failed create response', async () => {
    const runner = createRunner({
      httpClient: async () =>
        new Response(JSON.stringify({ code: 'binding_missing', message: 'merchant product not bound' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      logger: console,
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

    expect(buildDepositCreateResponse(result).hint).toContain('not bound to this product_no');
  });

  test('normalizes missing channels with seed defaults', () => {
    const normalized = normalizeDepositPresets(
      {
        common: {
          values: {
            merchantRef: 'TEST_ORDER_CUSTOM',
            returnUrl: 'https://custom.example.com/return',
          },
        } as Partial<DepositCommonConfig>,
        channels: {
          southafrica_cards: {
            commonValues: {
              productNo: 'DEP-CUSTOM-001',
              amount: '88.00',
              currencyCode: 'USD',
            },
            values: {
              payment_order: {
                collect: {
                  country_code: 'US',
                  product_detail: 'Collect order for %s',
                  product_name: 'Custom Product',
                  shopper_reference: 'CUSTOMER_001',
                  origin: 'https://www.amazon.com/',
                },
              },
            },
          } as Partial<DepositChannelConfig>,
        },
      } satisfies DepositPresetSource,
      env,
      makeId,
    );

    expect(normalized.channels.southafrica_cards.commonValues.productNo).toBe('DEP-CUSTOM-001');
    expect(
      ((normalized.channels.southafrica_cards.values.payment_order as Record<string, unknown>).collect as Record<string, string>)
        .product_name,
    ).toBe('Custom Product');
    expect(normalized.channels.linepay.commonValues.productNo).toBe('DEP-LINEPAY_ONLINE-ONLINE-TWD');
    expect(normalized.channels.international_credit_cards.commonValues.productNo).toBe(
      'DEP-FUTUREPAY_COLLECT-COLLECT-USD',
    );
  });

  test('updates and writes preset file by channel', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'deposit-preset-'));
    const dirPath = join(tempDir, 'deposit');
    const values = toDepositDefaultsResponse('linepay', env, createSeedDepositPresets(env, makeId)).form;
    values.commonValues.productNo = 'DEP-LINEPAY-CUSTOM';
    values.commonValues.merchantRef = 'TEST_ORDER_OVERRIDDEN';

    const presets = await updateDepositPreset({
      dirPath,
      channel: 'linepay',
      values,
      env,
      makeId,
    });

    const savedCommon = await readFile(join(dirPath, 'common.json'), 'utf8');
    const savedChannel = await readFile(join(dirPath, 'channels', 'linepay.json'), 'utf8');
    expect(presets.channels.linepay.commonValues.productNo).toBe('DEP-LINEPAY-CUSTOM');
    expect(savedCommon).toContain('"merchantRef": "TEST_ORDER_OVERRIDDEN"');
    expect(savedChannel).toContain('"productNo": "DEP-LINEPAY-CUSTOM"');
  });
});
