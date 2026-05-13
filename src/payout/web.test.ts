import { beforeEach, describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { getCliEnv } from '../core/env';
import { buildPayoutPreviewResponse, buildPayoutRequestFromForm, type PayoutFormValues } from './web';
import { createSeedPayoutPresets, loadPayoutPresets, toPayoutDefaultsResponse, updatePayoutPreset } from './presets';

const env = getCliEnv({
  API_BASE_URL: 'https://example.test',
  MERCHANT_SIGN: 'sign-key',
  MERCHANT_API_TOKEN_PAYOUT: 'payout-token',
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

    expect(preview.request.headers?.Authorization).toBe('ApiKey ****-token');
    expect((preview.request.payload as Record<string, unknown>).merchant_reference).toBe('TEST_ORDER_217_fixed-id');
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
    expect(request.headers?.Authorization).toBe('ApiKey payout-token');
    expect((request.payload as Record<string, unknown>).merchant_reference).toBe('TEST_IMPS_001_fixed-id');
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
