import { beforeEach, describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { getCliEnv } from '../core/env';
import { generateSign } from '../utils';
import { buildPayoutPreviewResponse, buildPayoutRequestFromForm, type PayoutFormValues } from './web';
import { createSeedPayoutPresets, loadPayoutPresets, toPayoutDefaultsResponse, updatePayoutPreset } from './presets';

const env = getCliEnv({
  API_BASE_URL: 'https://example.test',
  MERCHANT_SIGN: 'sign-key',
  NORMAL_MERCHANT_API_TOKEN: 'default-token',
  INDIA_BANGLADESH_MERCHANT_API_TOKEN: 'india-bangladesh-token',
  PAYOUT_URL_BANK: '/s2s/v1/payout/orders/co/bank-transfer',
  PAYOUT_URL_CO_WALLET: '/s2s/v1/payout/orders/co/mobile-money',
  PAYOUT_URL_IMPS: '/s2s/v1/payout/orders/in/imps',
  PAYOUT_URL_BD_WALLET: '/s2s/v1/payout/orders/bd/mobile-wallet',
  PAYOUT_CO_BANK: 'PAY-CO-BANK',
  PAYOUT_CO_WALLET: 'PAY-CO-WALLET',
  PAYOUT_IMPS: 'PAY-IN-IMPS',
  PAYOUT_BD_WALLET: 'PAY-BD-WALLET',
});

const makeId = (prefix: string) => `${prefix}fixed-id`;
const sourceDirPath = resolve(process.cwd(), 'data/payout');

let presetDirPath = sourceDirPath;

const copyPayoutFixtures = async (): Promise<string> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'payout-preset-'));
  const dirPath = join(tempDir, 'payout');
  await cp(sourceDirPath, dirPath, { recursive: true });
  return dirPath;
};

beforeEach(async () => {
  presetDirPath = await copyPayoutFixtures();
});

describe('payout web helpers', () => {
  test('creates seed payout presets for all channels', async () => {
    const result = await createSeedPayoutPresets({ dirPath: presetDirPath, makeId });

    expect(result.common.values.merchantReference).toBe('TEST_ORDER_fixed-id');
    expect(result.channels.co_bank.values.product_no).toBe('PAY-FUTUREPAY_COLLECT-BANKTRANSFERCO-COP');
    expect(result.channels.imps.values.amount).toEqual({ amount: '100.00', currency_code: 'INR' });
  });

  test('builds masked payout preview response', async () => {
    const defaults = toPayoutDefaultsResponse('co_bank', await loadPayoutPresets({ dirPath: presetDirPath, makeId }));
    const values: PayoutFormValues = {
      ...defaults.form,
      commonValues: {
        merchantReference: 'TEST_ORDER_217',
      },
    };

    const preview = buildPayoutPreviewResponse(env, values, makeId);
    const payload = preview.request.payload as Record<string, unknown>;
    const payoutInfo = payload.payout_info as Record<string, unknown>;
    const beneficiary = payoutInfo.beneficiary as Record<string, unknown>;

    expect(preview.request.headers?.Authorization).toBe('ApiKey ****-token');
    expect(payload.merchant_reference).toBe('TEST_ORDER_fixed-id');
    expect(beneficiary.identification).toBeUndefined();
    expect(beneficiary.date_of_birth).toBeUndefined();
    expect(beneficiary.contact_number).toBeUndefined();
    expect(beneficiary.address).toBeUndefined();
    expect(payoutInfo.remitter).toBeUndefined();
  });

  test('builds payout request from form values', async () => {
    const defaults = toPayoutDefaultsResponse('imps', await loadPayoutPresets({ dirPath: presetDirPath, makeId }));
    const values: PayoutFormValues = {
      ...defaults.form,
      commonValues: {
        merchantReference: 'TEST_IMPS_001',
      },
    };

    const request = buildPayoutRequestFromForm(env, values, makeId);
    expect(request.url).toBe('https://example.test/s2s/v1/payout/orders/in/imps');
    expect(request.headers?.Authorization).toBe('ApiKey india-bangladesh-token');
    expect((request.payload as Record<string, unknown>).merchant_reference).toBe('TEST_IMPS_001');
  });

  test('preview generates a fresh merchant reference even when the form already has one', async () => {
    const defaults = toPayoutDefaultsResponse('co_bank', await loadPayoutPresets({ dirPath: presetDirPath, makeId }));
    const values: PayoutFormValues = {
      ...defaults.form,
      commonValues: {
        merchantReference: 'TEST_PREVIEW_001',
      },
    };

    const preview = buildPayoutPreviewResponse(env, values, makeId);

    expect((preview.request.payload as Record<string, unknown>).merchant_reference).toBe('TEST_ORDER_fixed-id');
  });

  test('uses Bangladesh merchant token for bd_wallet payout requests', async () => {
    const defaults = toPayoutDefaultsResponse('bd_wallet', await loadPayoutPresets({ dirPath: presetDirPath, makeId }));
    const request = buildPayoutRequestFromForm(env, defaults.form, makeId);

    expect(request.headers?.Authorization).toBe('ApiKey india-bangladesh-token');
  });

  test('prunes optional placeholder and blank payout fields before signing', async () => {
    const defaults = toPayoutDefaultsResponse('co_bank', await loadPayoutPresets({ dirPath: presetDirPath, makeId }));
    const values: PayoutFormValues = {
      ...defaults.form,
      commonValues: {
        merchantReference: 'TEST_BT_ORDER_125',
      },
      channelValues: {
        ...defaults.form.channelValues,
        payout_info: {
          ...((defaults.form.channelValues.payout_info as Record<string, unknown>) || {}),
          beneficiary: {
            ...((((defaults.form.channelValues.payout_info as Record<string, unknown>) || {}).beneficiary as Record<string, unknown>) || {}),
            email: 'e2e@example.com',
          },
        },
      },
    };

    const request = buildPayoutRequestFromForm(env, values, makeId);
    const payload = request.payload as Record<string, unknown>;
    const payoutInfo = payload.payout_info as Record<string, unknown>;
    const beneficiary = payoutInfo.beneficiary as Record<string, unknown>;

    expect(beneficiary.identification).toBeUndefined();
    expect(beneficiary.date_of_birth).toBeUndefined();
    expect(beneficiary.contact_number).toBeUndefined();
    expect(beneficiary.address).toBeUndefined();
    expect(payoutInfo.remitter).toBeUndefined();
    expect(payload.merchant_reference).toBe('TEST_BT_ORDER_125');
    expect(payload.sign).toBe(
      generateSign(payload, ['amount.amount', 'amount.currency_code', 'merchant_reference', 'product_no'], 'sign-key'),
    );
  });

  test('creates a unique merchant reference when form value is blank', async () => {
    const defaults = toPayoutDefaultsResponse('bd_wallet', await loadPayoutPresets({ dirPath: presetDirPath, makeId }));
    const values: PayoutFormValues = {
      ...defaults.form,
      commonValues: {
        merchantReference: '   ',
      },
    };

    const request = buildPayoutRequestFromForm(env, values, makeId);
    expect((request.payload as Record<string, unknown>).merchant_reference).toBe('TEST_ORDER_fixed-id');
  });

  test('updates and writes payout preset file by channel', async () => {
    const values = toPayoutDefaultsResponse('co_wallet', await loadPayoutPresets({ dirPath: presetDirPath, makeId })).form;
    values.commonValues.merchantReference = 'TEST_ORDER_OVERRIDDEN';
    (values.channelValues.payout_info as Record<string, unknown>).narration = 'Updated payout narration';

    const presets = await updatePayoutPreset({
      dirPath: presetDirPath,
      channel: 'co_wallet',
      values,
      makeId,
    });

    const savedCommon = await readFile(join(presetDirPath, 'common.json'), 'utf8');
    const savedChannel = await readFile(join(presetDirPath, 'channels', 'co_wallet.json'), 'utf8');
    expect(presets.common.values.merchantReference).toBe('TEST_ORDER_OVERRIDDEN');
    expect(savedCommon).toContain('"merchant_reference": "TEST_ORDER_OVERRIDDEN"');
    expect(savedChannel).toContain('"narration": "Updated payout narration"');
  });
});
