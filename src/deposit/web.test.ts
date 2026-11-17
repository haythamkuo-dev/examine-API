import { describe, expect, test } from 'bun:test';
import { DEPOSIT_CHANNELS, getCliEnv } from '../core/env';
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
  loadDepositPresets,
  normalizeDepositPresets,
  toDepositDefaultsResponse,
  updateDepositPreset,
} from './presets';
import { createRunner } from '../runner';
import { buildDepositCreateResponse } from './web';
import { PresetStorageInvalidError } from '../core/presetStorage';
import { cp, mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const env = getCliEnv({
  API_BASE_URL: 'https://example.test',
  MERCHANT_SIGN: 'sign-key',
  NORMAL_MERCHANT_API_TOKEN: 'default-token',
  INDIA_BANGLADESH_MERCHANT_API_TOKEN: 'india-bangladesh-token',
  CALLBACK_URL_DEPOSIT: 'https://merchant.example.com/deposit',
  DEPOSIT_SOUTHAFICA_CARDS: 'DEP-BOUND-USD',
});

const makeId = (prefix: string) => `${prefix}fixed-id`;
const sourceDirPath = resolve(process.cwd(), 'data/deposit');

describe('deposit web helpers', () => {
  test('rejects an invalid channel projection instead of falling back to seed values', async () => {
    expect.hasAssertions();

    const tempDir = await mkdtemp(join(tmpdir(), 'deposit-invalid-preset-'));
    const presetDirPath = join(tempDir, 'deposit');
    await cp(sourceDirPath, presetDirPath, { recursive: true });
    await writeFile(join(presetDirPath, 'channels', 'southafrica_cards.json'), '{}\n', 'utf8');

    await expect(
      loadDepositPresets({
        dirPath: presetDirPath,
        env,
        makeId,
      }),
    ).rejects.toBeInstanceOf(PresetStorageInvalidError);
  });

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
    expect(result.common.values).not.toHaveProperty('merchantRef');
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
    expect(result.channels.my_fpx_usd.commonValues).toEqual({
      productNo: 'DEP-FUTUREPAY_COLLECT-FPX-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels.my_fpx_usd.values).toEqual({
      payment_order: {
        collect: {
          shopper_email: 'customer@example.com',
          telephone_number: '60123456789',
          product_name: 'Bank Transfer Checkout',
        },
      },
    });
    expect(result.channels.mx_spei_usd.commonValues).toEqual({
      productNo: 'DEP-FUTUREPAY_COLLECT-SPEI-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels.mx_spei_usd.values).toEqual({
      payment_order: {
        collect: {
          shopper_email: 'spei-test@example.com',
          country_code: 'MX',
        },
      },
    });
    expect(result.channels['loki-intercard-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-INTERCARDMY-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-intercard-usd'].values).toEqual({
      payment_order: {
        collect: {
          shopper_email: 'test@example.com',
        },
      },
    });
    expect(result.channels['loki-intercard-sg-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-INTERCARDSG-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-intercard-sg-usd'].values).toEqual({
      payment_order: {
        collect: {
          shopper_email: 'test@example.com',
        },
      },
    });
    expect(result.channels['loki-intercard-vn-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-INTERCARDVN-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-intercard-vn-usd'].values).toEqual({
      payment_order: {
        collect: {
          shopper_email: 'test@example.com',
        },
      },
    });
    expect(result.channels['loki-intercard-th-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-INTERCARDTH-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-intercard-th-usd'].values).toEqual({
      payment_order: {
        collect: {
          shopper_email: 'test@example.com',
        },
      },
    });
    expect(result.channels['loki-intercard-ph-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-INTERCARDPH-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-intercard-ph-usd'].values).toEqual({
      payment_order: {
        collect: {
          shopper_email: 'test@example.com',
        },
      },
    });
    expect(result.channels['loki-intercard-id-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-INTERCARDID-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-intercard-id-usd'].values).toEqual({
      payment_order: {
        collect: {
          shopper_email: 'test@example.com',
        },
      },
    });
    expect(result.channels['loki-intercard-hk-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-INTERCARDHK-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-intercard-hk-usd'].values).toEqual({
      payment_order: {
        collect: {
          shopper_email: 'test@example.com',
        },
      },
    });
    expect(result.channels.th_kplus_usd.commonValues).toEqual({
      productNo: 'DEP-SINGLEPAYMENT-KPLUS-USD',
      amount: '45.00',
      currencyCode: 'USD',
    });
    expect(result.channels.th_kplus_usd.values).toMatchObject({
      payment_order: {
        country_code: 'TH',
        product_detail: 'KPlus order for %s',
        singlepayment_kplus: {
          origin: 'https://merchant.example.com',
          shopper_reference: 'KPLUS-CUSTOMER-001',
          shopper_email: 'shopper@example.com',
          holder_name: 'Test User',
          browser_info: { os_type: 'ANDROID', terminal_type: 'WEB' },
        },
      },
    });
    expect(result.channels.th_tmn_usd.commonValues).toEqual({
      productNo: 'DEP-SINGLEPAYMENT-TMN-USD',
      amount: '100.00',
      currencyCode: 'USD',
    });
    expect(result.channels.th_tmn_usd.values).toMatchObject({
      payment_order: {
        country_code: 'TH',
        product_detail: 'Test TrueMoney Wallet USD order for %s',
        singlepayment_tmn: {
          shopper_email: 'payer.usd@example.com',
          holder_name: 'Test USD Payer',
          origin: 'https://merchant.example.com',
          shopper_reference: 'TEST-TMN-PAYER-USD-000001',
          browser_info: { os_type: 'ANDROID', terminal_type: 'WEB' },
        },
      },
    });
    expect(result.channels.my_boost_usd.commonValues).toEqual({
      productNo: 'DEP-SINGLEPAYMENT-BOOST-USD',
      amount: '45.00',
      currencyCode: 'USD',
    });
    expect(result.channels.my_boost_usd.values).toEqual({
      payment_order: {
        country_code: 'MY',
        product_detail: 'Boost USD test order for %s',
        singlepayment_boost: {
          origin: 'merchant.example.com',
          shopper_reference: 'BOOST_TEST_SHOPPER_001',
          shopper_email: 'shopper@example.com',
          holder_name: 'Test Shopper',
          browser_info: {
            os_type: 'ANDROID',
            terminal_type: 'WEB',
          },
        },
      },
    });
    expect(result.channels['ALIPAY-8000'].values).toEqual({});
    expect(result.channels['WECHAT-6016-USD'].commonValues).toEqual({
      productNo: 'DEP-HONGYUNPAY-WECHAT6016-USD',
      amount: '100.00',
      currencyCode: 'USD',
    });
    expect(result.channels['WECHAT-6016-USD'].values).toEqual({});
    expect(result.channels['WECHAT-6013'].commonValues).toEqual({
      productNo: 'DEP-HONGYUNPAY-WECHAT6013-CNY',
      amount: '10.00',
      currencyCode: 'CNY',
    });
    expect(result.channels['WECHAT-6013'].values).toEqual({});
    expect(result.channels['WECHAT-6038'].commonValues).toEqual({
      productNo: 'DEP-HONGYUNPAY-WECHAT6038-CNY',
      amount: '10.00',
      currencyCode: 'CNY',
    });
    expect(result.channels['WECHAT-6038'].values).toEqual({});
    expect(result.channels['ALIPAY-6014-USD'].commonValues).toEqual({
      productNo: 'DEP-HONGYUNPAY-ALIPAY6014-USD',
      amount: '120.00',
      currencyCode: 'USD',
    });
    expect(result.channels['ALIPAY-6014-USD'].values).toEqual({});
    expect(result.channels['loki-googlepay-jp-jpy'].commonValues).toEqual({
      productNo: 'DEP-LOKI-GOOGLEPAYJP-JPY',
      amount: '100',
      currencyCode: 'JPY',
    });
    expect(result.channels['loki-googlepay-jp-jpy'].values).toEqual({
      payment_order: {
        collect: {
          product_name: 'Google Pay Japan Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+819012345678',
          origin: 'https://merchant.example.com',
        },
      },
    });
    expect(result.channels['loki-applepay-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-APPLEPAY-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-applepay-usd'].values).toEqual({
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay USD Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+14155550100',
          origin: 'https://merchant.example.com',
        },
      },
    });
    expect(result.channels['loki-applepay-hk-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-APPLEPAYHK-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-applepay-hk-usd'].values).toEqual({
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Hong Kong Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+85291234567',
          origin: 'https://merchant.example.com',
        },
      },
    });
    expect(result.channels['loki-applepay-id-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-APPLEPAYID-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-applepay-id-usd'].values).toEqual({
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Indonesia Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+6281234567890',
          origin: 'https://merchant.example.com',
        },
      },
    });
    expect(result.channels['loki-applepay-jp-jpy'].commonValues).toEqual({
      productNo: 'DEP-LOKI-APPLEPAYJP-JPY',
      amount: '100',
      currencyCode: 'JPY',
    });
    expect(result.channels['loki-applepay-jp-jpy'].values).toEqual({
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Japan Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+819012345678',
          origin: 'https://merchant.example.com',
        },
      },
    });
    expect(result.channels['loki-applepay-my-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-APPLEPAYMY-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-applepay-my-usd'].values).toEqual({
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Malaysia Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+60123456789',
          origin: 'https://merchant.example.com',
        },
      },
    });
    expect(result.channels['loki-applepay-ph-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-APPLEPAYPH-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-applepay-ph-usd'].values).toEqual({
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Philippines Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+639123456789',
          origin: 'https://merchant.example.com',
        },
      },
    });
    expect(result.channels['loki-applepay-sg-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-APPLEPAYSG-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-applepay-sg-usd'].values).toEqual({
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Singapore Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+6591234567',
          origin: 'https://merchant.example.com',
        },
      },
    });
    expect(result.channels['loki-applepay-th-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-APPLEPAYTH-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-applepay-th-usd'].values).toEqual({
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Thailand Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+66812345678',
          origin: 'https://merchant.example.com',
        },
      },
    });
    expect(result.channels['loki-applepay-vn-usd'].commonValues).toEqual({
      productNo: 'DEP-LOKI-APPLEPAYVN-USD',
      amount: '10.00',
      currencyCode: 'USD',
    });
    expect(result.channels['loki-applepay-vn-usd'].values).toEqual({
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Vietnam Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+84912345678',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the Boost USD request with the provider-specific payload key', () => {
    const defaults = toDepositDefaultsResponse(
      'my_boost_usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-SINGLEPAYMENT-BOOST-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '45.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      payment_order: {
        country_code: 'MY',
        product_detail: 'Boost USD test order for %s',
        singlepayment_boost: {
          origin: 'merchant.example.com',
          shopper_reference: 'BOOST_TEST_SHOPPER_001',
          shopper_email: 'shopper@example.com',
          holder_name: 'Test Shopper',
          browser_info: { os_type: 'ANDROID', terminal_type: 'WEB' },
        },
      },
    });
  });

  test('builds the Hongyun WeChat 6016 USD request without provider-specific fields', () => {
    const defaults = toDepositDefaultsResponse(
      'WECHAT-6016-USD',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-HONGYUNPAY-WECHAT6016-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '100.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
    });
    expect(payload).not.toHaveProperty('payment_order');
  });

  test('builds the Hongyun WeChat 6013 CNY request without provider-specific fields', () => {
    const defaults = toDepositDefaultsResponse(
      'WECHAT-6013',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-HONGYUNPAY-WECHAT6013-CNY',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'CNY' },
      return_url: 'https://merchant.example.com/deposit',
    });
    expect(payload).not.toHaveProperty('payment_order');
  });

  test('builds the Hongyun WeChat 6038 CNY request without provider-specific fields', () => {
    const defaults = toDepositDefaultsResponse(
      'WECHAT-6038',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-HONGYUNPAY-WECHAT6038-CNY',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'CNY' },
      return_url: 'https://merchant.example.com/deposit',
    });
    expect(payload).not.toHaveProperty('payment_order');
  });

  test('builds the Hongyun Alipay 6014 USD request without provider-specific fields', () => {
    const defaults = toDepositDefaultsResponse(
      'ALIPAY-6014-USD',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-HONGYUNPAY-ALIPAY6014-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '120.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
    });
    expect(payload).not.toHaveProperty('payment_order');
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

  test('builds the Mexico SPEI USD request with the shared deposit defaults', () => {
    const defaults = toDepositDefaultsResponse(
      'mx_spei_usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-FUTUREPAY_COLLECT-SPEI-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      payment_order: {
        collect: {
          shopper_email: 'spei-test@example.com',
          country_code: 'MX',
        },
      },
    });
  });

  test('builds the Thailand KPlus USD request with the provider-specific payload key', () => {
    const defaults = toDepositDefaultsResponse(
      'th_kplus_usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-SINGLEPAYMENT-KPLUS-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '45.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      payment_order: {
        country_code: 'TH',
        product_detail: 'KPlus order for %s',
        singlepayment_kplus: {
          origin: 'https://merchant.example.com',
          shopper_reference: 'KPLUS-CUSTOMER-001',
          shopper_email: 'shopper@example.com',
          holder_name: 'Test User',
          browser_info: { os_type: 'ANDROID', terminal_type: 'WEB' },
        },
      },
    });
  });

  test('builds the Thailand TrueMoney USD request with the provider-specific payload key', () => {
    const defaults = toDepositDefaultsResponse(
      'th_tmn_usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-SINGLEPAYMENT-TMN-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '100.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      payment_order: {
        country_code: 'TH',
        product_detail: 'Test TrueMoney Wallet USD order for %s',
        singlepayment_tmn: {
          shopper_email: 'payer.usd@example.com',
          holder_name: 'Test USD Payer',
          origin: 'https://merchant.example.com',
          shopper_reference: 'TEST-TMN-PAYER-USD-000001',
          browser_info: { os_type: 'ANDROID', terminal_type: 'WEB' },
        },
      },
    });
  });

  test('builds the temporary cmoney intercard request from its preset', () => {
    const defaults = toDepositDefaultsResponse(
      'cmoney-intercard',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;
    const amount = payload.amount as { amount: string; currency_code: string };

    expect(payload.product_no).toBe('DEP-CMONEY-INTERCARD-USD');
    expect(amount).toEqual({ amount: '100.00', currency_code: 'USD' });
    expect(payload.merchant_ref).toBe('TEST_ORDER_fixed-id');
    expect(payload.return_url).toBe('https://merchant.example.com/deposit');
    expect(payload.payment_order).toBeUndefined();
  });

  test('builds the Loki MY intercard request with the normal merchant token', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-intercard-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-INTERCARDMY-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      payment_order: {
        collect: { shopper_email: 'test@example.com' },
      },
    });
  });

  test('builds the Loki SG intercard request with the normal merchant token', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-intercard-sg-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-INTERCARDSG-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      payment_order: {
        collect: { shopper_email: 'test@example.com' },
      },
    });
  });

  test('builds the Loki VN intercard request with the normal merchant token', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-intercard-vn-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-INTERCARDVN-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      payment_order: {
        collect: { shopper_email: 'test@example.com' },
      },
    });
  });

  test('builds the Loki TH intercard request with the normal merchant token', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-intercard-th-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-INTERCARDTH-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      payment_order: {
        collect: { shopper_email: 'test@example.com' },
      },
    });
  });

  test('builds the Loki PH intercard request with the normal merchant token', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-intercard-ph-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-INTERCARDPH-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      payment_order: {
        collect: { shopper_email: 'test@example.com' },
      },
    });
  });

  test('builds the Loki ID intercard request with the normal merchant token', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-intercard-id-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-INTERCARDID-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      payment_order: {
        collect: { shopper_email: 'test@example.com' },
      },
    });
  });

  test('builds the Loki HK intercard request with the normal merchant token', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-intercard-hk-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-INTERCARDHK-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      payment_order: {
        collect: { shopper_email: 'test@example.com' },
      },
    });
  });

  test('builds the Japan Google Pay JPY request with the collect payload', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-googlepay-jp-jpy',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-GOOGLEPAYJP-JPY',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '100', currency_code: 'JPY' },
      payment_order: {
        collect: {
          product_name: 'Google Pay Japan Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+819012345678',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the Apple Pay USD request with direct checkout and collect payload', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-applepay-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-APPLEPAY-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay USD Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+14155550100',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the Apple Pay Malaysia USD request with direct checkout and collect payload', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-applepay-my-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-APPLEPAYMY-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Malaysia Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+60123456789',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the Apple Pay Philippines USD request with direct checkout and collect payload', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-applepay-ph-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-APPLEPAYPH-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Philippines Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+639123456789',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the Apple Pay Singapore USD request with direct checkout and collect payload', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-applepay-sg-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-APPLEPAYSG-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Singapore Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+6591234567',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the Apple Pay Thailand USD request with direct checkout and collect payload', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-applepay-th-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-APPLEPAYTH-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Thailand Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+66812345678',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the Apple Pay Vietnam USD request with direct checkout and collect payload', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-applepay-vn-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-APPLEPAYVN-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Vietnam Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+84912345678',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the Apple Pay Hong Kong USD request with direct checkout and collect payload', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-applepay-hk-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-APPLEPAYHK-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Hong Kong Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+85291234567',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the Apple Pay Indonesia USD request with direct checkout and collect payload', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-applepay-id-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-APPLEPAYID-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '10.00', currency_code: 'USD' },
      return_url: 'https://merchant.example.com/deposit',
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Indonesia Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+6281234567890',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the Apple Pay Japan JPY request with direct checkout and collect payload', () => {
    const defaults = toDepositDefaultsResponse(
      'loki-applepay-jp-jpy',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.headers?.Authorization).toBe('ApiKey default-token');
    expect(payload).toMatchObject({
      product_no: 'DEP-LOKI-APPLEPAYJP-JPY',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '100', currency_code: 'JPY' },
      return_url: 'https://merchant.example.com/deposit',
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          product_name: 'Apple Pay Japan Test',
          product_detail: 'Test order for %s',
          shopper_reference: 'shopper-test-001',
          shopper_email: 'shopper@example.com',
          telephone_number: '+819012345678',
          origin: 'https://merchant.example.com',
        },
      },
    });
  });

  test('builds the ezpay USD intercard request from its preset', () => {
    const defaults = toDepositDefaultsResponse(
      'ez-intercard-usd',
      env,
      createSeedDepositPresets(env, makeId),
    );
    const request = buildDepositRequestFromForm(env, defaults.form, makeId);
    const payload = request.payload as Record<string, unknown>;
    const amount = payload.amount as { amount: string; currency_code: string };

    expect(payload.product_no).toBe('DEP-EZPAY-INTERCARD-USD');
    expect(amount).toEqual({ amount: '99.99', currency_code: 'USD' });
    expect(payload.merchant_ref).toBe('TEST_ORDER_fixed-id');
    expect(payload.payment_order).toEqual({
      collect: {
        country_code: 'US',
        product_detail: 'USD intercard order for %s',
        product_name: 'USD Checkout',
        shopper_reference: 'CUSTOMER_001',
        origin: 'https://www.fellowproducts.com.tw/products/ekgpro',
      },
    });
  });

  test('builds all ezpay intercard requests from their channel presets', async () => {
    const presets = await loadDepositPresets({
      dirPath: resolve(process.cwd(), 'data/deposit'),
      env,
      makeId,
    });
    const channels = DEPOSIT_CHANNELS.filter((channel) => channel.startsWith('ez-intercard-'));

    for (const channel of channels) {
      const defaults = toDepositDefaultsResponse(channel, env, presets);
      const request = buildDepositRequestFromForm(env, defaults.form, makeId);
      const payload = request.payload as Record<string, unknown>;

      expect(payload.product_no).toBe(defaults.form.commonValues.productNo);
      expect(payload.amount).toEqual({
        amount: defaults.form.commonValues.amount,
        currency_code: defaults.form.commonValues.currencyCode,
      });
      expect(payload.payment_order).toEqual(defaults.form.channelValues.payment_order);
    }
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
    expect((request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_fixed-id');
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
    await cp(sourceDirPath, dirPath, { recursive: true });
    const values = toDepositDefaultsResponse('linepay', env, createSeedDepositPresets(env, makeId)).form;
    values.commonValues.productNo = 'DEP-LINEPAY-CUSTOM';
    values.commonValues.merchantRef = 'TEST_ORDER_OVERRIDDEN';
    values.channelValues.merchant_ref = 'TEST_CHANNEL_MERCHANT_REF';

    const presets = await updateDepositPreset({
      dirPath,
      channel: 'linepay',
      values,
      env,
      makeId,
    });

    const savedCommon = await readFile(join(dirPath, 'common.json'), 'utf8');
    const savedChannel = await readFile(join(dirPath, 'channels', 'linepay.json'), 'utf8');
    const savedCommonPreset = JSON.parse(savedCommon) as { values?: Record<string, unknown> };
    const savedChannelPreset = JSON.parse(savedChannel) as { values?: Record<string, unknown> };
    expect(presets.channels.linepay.commonValues.productNo).toBe('DEP-LINEPAY-CUSTOM');
    expect(savedCommonPreset.values).not.toHaveProperty('merchantRef');
    expect(savedChannelPreset.values).not.toHaveProperty('merchant_ref');
    expect(savedChannel).toContain('"productNo": "DEP-LINEPAY-CUSTOM"');
  });
});
