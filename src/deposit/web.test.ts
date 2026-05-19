import { describe, expect, test } from 'bun:test';
import { getCliEnv } from '../core/env';
import {
  buildDepositPreviewResponse,
  buildDepositRequestFromForm,
  type DepositFormValues,
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
    expect(result.common.values.merchantRef).toBe('TEST_ORDER_fixed-id');
    expect(result.common.values.returnUrl).toBe('https://merchant.example.com/deposit');
  });

  test('builds masked preview response', () => {
    const values: DepositFormValues = {
      ...toDepositDefaultsResponse('southafrica_cards', createSeedDepositPresets(env, makeId)).form,
      commonValues: {
        ...toDepositDefaultsResponse('southafrica_cards', createSeedDepositPresets(env, makeId)).form.commonValues,
        merchantRef: 'TEST_ORDER_217',
      },
    };

    const preview = buildDepositPreviewResponse(env, values, makeId);

    expect(preview.request.headers?.Authorization).toBe('ApiKey ****-token');
    expect((preview.request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_217_fixed-id');
  });

  test('builds request from form values', () => {
    const values: DepositFormValues = {
      ...toDepositDefaultsResponse('southafrica_cards', createSeedDepositPresets(env, makeId)).form,
      commonValues: {
        ...toDepositDefaultsResponse('southafrica_cards', createSeedDepositPresets(env, makeId)).form.commonValues,
        merchantRef: 'TEST_ORDER_217',
      },
    };

    const request = buildDepositRequestFromForm(env, values, makeId);
    expect(request.url).toBe('https://example.test/s2s/v1/intents/deposit');
    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect((request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_217_fixed-id');
  });

  test('uses channel-scoped merchant token for India deposit channels', () => {
    const values: DepositFormValues = {
      ...toDepositDefaultsResponse('inr_upi', createSeedDepositPresets(env, makeId)).form,
      commonValues: {
        ...toDepositDefaultsResponse('inr_upi', createSeedDepositPresets(env, makeId)).form.commonValues,
        merchantRef: 'TEST_ORDER_IN_217',
      },
    };

    const request = buildDepositRequestFromForm(env, values, makeId);
    expect(request.headers?.Authorization).toBe('ApiKey india-bangladesh-token');
  });

  test('creates a unique merchant reference when form value is blank', () => {
    const values: DepositFormValues = {
      ...toDepositDefaultsResponse('southafrica_cards', createSeedDepositPresets(env, makeId)).form,
      commonValues: {
        ...toDepositDefaultsResponse('southafrica_cards', createSeedDepositPresets(env, makeId)).form.commonValues,
        merchantRef: '   ',
      },
    };

    const request = buildDepositRequestFromForm(env, values, makeId);
    expect((request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_fixed-id');
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
  });

  test('updates and writes preset file by channel', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'deposit-preset-'));
    const dirPath = join(tempDir, 'deposit');
    const values = toDepositDefaultsResponse('linepay', createSeedDepositPresets(env, makeId)).form;
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
