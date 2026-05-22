import { beforeEach, describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { getCliEnv } from '../core/env';
import { generateSign } from '../utils';
import {
  buildSubscriptionPreviewResponse,
  buildSubscriptionRequestFromForm,
  type SubscriptionFormValues,
} from './web';
import {
  createSeedSubscriptionPresets,
  loadSubscriptionPresets,
  toSubscriptionDefaultsResponse,
  updateSubscriptionPreset,
} from './presets';

const env = getCliEnv({
  API_BASE_URL: 'https://example.test',
  MERCHANT_SIGN: 'sign-key',
  NORMAL_MERCHANT_API_TOKEN: 'subscription-token',
  SUBSCRIPTION_URL: '/s2s/v1/subscriptions',
  CALLBACK_URL_SUBSCRIPTION: 'https://merchant.example.com/subscription/callback',
  SUBSCRIPTION_PLAN: 'PLAN-DEFAULT-001',
});

const makeId = (prefix: string) => `${prefix}fixed-id`;
const sourceDirPath = resolve(process.cwd(), 'data/subscription');

let presetDirPath = sourceDirPath;

const copySubscriptionFixtures = async (): Promise<string> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'subscription-preset-'));
  const dirPath = join(tempDir, 'subscription');
  await cp(sourceDirPath, dirPath, { recursive: true });
  return dirPath;
};

beforeEach(async () => {
  presetDirPath = await copySubscriptionFixtures();
});

describe('subscription web helpers', () => {
  test('creates seed subscription presets for the default channel', async () => {
    const result = await createSeedSubscriptionPresets({ dirPath: presetDirPath, env, makeId });

    expect(result.common.values.merchantRef).toBe('TEST_ORDER_fixed-id');
    expect(result.channels.default.values.subs_plan_id).toBe('01KKTEEJCJ5W12EMC01469Z4ZJ');
    expect(result.channels.default.values.payment_instrument).toEqual({
      os_type: 'WEB',
      terminal_type: 'WEB',
    });
  });

  test('builds masked subscription preview response', async () => {
    const defaults = toSubscriptionDefaultsResponse(
      'default',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionFormValues = {
      ...defaults.form,
      commonValues: {
        ...defaults.form.commonValues,
        merchantRef: 'TEST_SUB_217',
      },
    };

    const preview = buildSubscriptionPreviewResponse(env, values, makeId);
    const payload = preview.request.payload as Record<string, unknown>;

    expect(preview.request.headers?.Authorization).toBe('ApiKey ****-token');
    expect(payload.merchant_ref).toBe('TEST_ORDER_fixed-id');
    expect(payload.return_url).toBe('https://merchant.example.com/subscription/callback');
  });

  test('builds subscription request from form values', async () => {
    const defaults = toSubscriptionDefaultsResponse(
      'default',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionFormValues = {
      ...defaults.form,
      commonValues: {
        merchantRef: 'TEST_SUB_001',
        returnUrl: 'https://merchant.example.com/subscription/return',
      },
    };

    const request = buildSubscriptionRequestFromForm(env, values, makeId);
    const payload = request.payload as Record<string, unknown>;

    expect(request.url).toBe('https://example.test/s2s/v1/subscriptions');
    expect(request.headers?.Authorization).toBe('ApiKey subscription-token');
    expect(payload.merchant_ref).toBe('TEST_SUB_001');
    expect(payload.return_url).toBe('https://merchant.example.com/subscription/return');
    expect(payload.sign).toBe(
      generateSign(
        {
          ...payload,
          sign: undefined,
        },
        ['merchant_no', 'merchant_ref', 'order_id', 'status'],
        'sign-key',
      ),
    );
  });

  test('preview generates a fresh merchant reference even when the form already has one', async () => {
    const defaults = toSubscriptionDefaultsResponse(
      'default',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionFormValues = {
      ...defaults.form,
      commonValues: {
        ...defaults.form.commonValues,
        merchantRef: 'TEST_SUB_PREVIEW_001',
      },
    };

    const preview = buildSubscriptionPreviewResponse(env, values, makeId);

    expect((preview.request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_fixed-id');
  });

  test('creates a unique merchant reference when form value is blank', async () => {
    const defaults = toSubscriptionDefaultsResponse(
      'default',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionFormValues = {
      ...defaults.form,
      commonValues: {
        ...defaults.form.commonValues,
        merchantRef: '   ',
      },
    };

    const request = buildSubscriptionRequestFromForm(env, values, makeId);
    expect((request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_fixed-id');
  });

  test('updates and writes subscription preset file by channel', async () => {
    const values = toSubscriptionDefaultsResponse(
      'default',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    ).form;
    values.commonValues.merchantRef = 'TEST_SUB_OVERRIDDEN';
    values.commonValues.returnUrl = 'https://merchant.example.com/subscription/updated';
    values.channelValues.product_name = 'Updated subscription product';

    const presets = await updateSubscriptionPreset({
      dirPath: presetDirPath,
      channel: 'default',
      values,
      env,
      makeId,
    });

    const savedCommon = await readFile(join(presetDirPath, 'common.json'), 'utf8');
    const savedChannel = await readFile(join(presetDirPath, 'channels', 'default.json'), 'utf8');
    expect(presets.common.values.merchantRef).toBe('TEST_SUB_OVERRIDDEN');
    expect(savedCommon).toContain('"merchant_ref": "TEST_SUB_OVERRIDDEN"');
    expect(savedCommon).toContain('"return_url": "https://merchant.example.com/subscription/updated"');
    expect(savedChannel).toContain('"product_name": "Updated subscription product"');
  });
});
