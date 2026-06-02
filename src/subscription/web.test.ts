import { beforeEach, describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { getCliEnv, getProductCliEnv } from '../core/env';
import { generateSign } from '../utils';
import {
  buildSubscriptionPreviewResponse,
  buildSubscriptionRequestFromForm,
  type SubscriptionRequestValues,
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
  SUBSCRIPTION_PLAN_LINEPAY: 'PLAN-LINEPAY-001',
  SUBSCRIPTION_PLAN_TNG: 'PLAN-TNG-001',
});

const productEnv = getProductCliEnv({
  API_PROD_BASE_URL: 'https://prod.example.test',
  MERCHANT_SIGN: 'prod-sign-key',
  PROD_MERCHANT_API_TOKEN: 'subscription-prod-token',
  SUBSCRIPTION_URL: '/s2s/v1/subscriptions',
  CALLBACK_URL_SUBSCRIPTION: 'https://merchant.example.com/subscription/callback',
  SUBSCRIPTION_PLAN: 'PLAN-STAGE-001',
  SUBSCRIPTION_PLAN_PROD: 'PLAN-PROD-001',
  SUBSCRIPTION_PLAN_PROD_LINEPAY: 'PLAN-PROD-LINEPAY-001',
  SUBSCRIPTION_PLAN_PROD_TNG: 'PLAN-PROD-TNG-001',
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
  test('creates seed subscription presets for all configured channels without editable plan ids', async () => {
    const result = await createSeedSubscriptionPresets({ dirPath: presetDirPath, env, makeId });
    const defaultIntervalCount = result.channels.default.schema.interval_count;
    const rabbitLinePayIntervalCount = result.channels.rabbitLinePay.schema.interval_count;
    const touchAndGoIntervalCount = result.channels.touchAndGo.schema.interval_count;

    expect(result.common.values.merchantRef).toBe('TEST_ORDER_fixed-id');
    expect(defaultIntervalCount?.kind).toBe('number');
    expect(rabbitLinePayIntervalCount?.kind).toBe('number');
    expect(touchAndGoIntervalCount?.kind).toBe('number');
    expect(result.channels.default.values.subs_plan_id).toBeUndefined();
    expect(result.channels.default.values.payment_instrument).toEqual({
      os_type: 'WEB',
      terminal_type: 'WEB',
    });
  });

  test('builds masked subscription preview response', async () => {
    const defaults = toSubscriptionDefaultsResponse(
      'default',
      env,
      'local',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionRequestValues = {
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
      env,
      'local',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionRequestValues = {
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
    expect(payload.subs_plan_id).toBe('PLAN-DEFAULT-001');
  });

  test('uses a draft plan id override from the editable subscription form', async () => {
    const defaults = toSubscriptionDefaultsResponse(
      'default',
      env,
      'local',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionRequestValues = {
      ...defaults.form,
      channelValues: {
        ...defaults.form.channelValues,
        subs_plan_id: 'PLAN-DRAFT-OVERRIDE-001',
      },
    };

    const request = buildSubscriptionRequestFromForm(env, values, makeId);

    expect((request.payload as Record<string, unknown>).subs_plan_id).toBe('PLAN-DRAFT-OVERRIDE-001');
  });

  test('builds channel-specific subscription requests for local and product envs', async () => {
    const channels = [
      ['default', 'PLAN-DEFAULT-001', 'PLAN-PROD-001'],
      ['rabbitLinePay', 'PLAN-LINEPAY-001', 'PLAN-PROD-LINEPAY-001'],
      ['touchAndGo', 'PLAN-TNG-001', 'PLAN-PROD-TNG-001'],
    ] as const;

    for (const [channel, localPlanId, productPlanId] of channels) {
      const localDefaults = toSubscriptionDefaultsResponse(
        channel,
        env,
        'local',
        await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
      );
      const productDefaults = toSubscriptionDefaultsResponse(
        channel,
        productEnv,
        'product',
        await loadSubscriptionPresets({ dirPath: presetDirPath, env: productEnv, makeId }),
      );
      const localValues: SubscriptionRequestValues = {
        ...localDefaults.form,
        channel,
        commonValues: {
          merchantRef: `TEST_SUB_${channel}`,
          returnUrl: 'https://merchant.example.com/subscription/return',
        },
      };
      const productValues: SubscriptionRequestValues = {
        ...productDefaults.form,
        channel,
        commonValues: {
          merchantRef: `TEST_SUB_${channel}`,
          returnUrl: 'https://merchant.example.com/subscription/return',
        },
      };

      const localRequest = buildSubscriptionRequestFromForm(env, localValues, makeId);
      const productRequest = buildSubscriptionRequestFromForm(productEnv, productValues, makeId);

      expect(localRequest.url).toBe('https://example.test/s2s/v1/subscriptions');
      expect((localRequest.payload as Record<string, unknown>).subs_plan_id).toBe(localPlanId);
      expect(productRequest.url).toBe('https://prod.example.test/s2s/v1/subscriptions');
      expect((productRequest.payload as Record<string, unknown>).subs_plan_id).toBe(productPlanId);
    }
  });

  test('injects the resolved plan id into subscription defaults responses without persisting it in seed presets', async () => {
    const defaults = toSubscriptionDefaultsResponse(
      'rabbitLinePay',
      env,
      'local',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );

    expect(defaults.resolvedPlanId).toBe('PLAN-LINEPAY-001');
    expect(defaults.form.channelValues.subs_plan_id).toBe('PLAN-LINEPAY-001');
  });

  test('preview generates a fresh merchant reference even when the form already has one', async () => {
    const defaults = toSubscriptionDefaultsResponse(
      'default',
      env,
      'local',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionRequestValues = {
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
      env,
      'local',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionRequestValues = {
      ...defaults.form,
      commonValues: {
        ...defaults.form.commonValues,
        merchantRef: '   ',
      },
    };

    const request = buildSubscriptionRequestFromForm(env, values, makeId);
    expect((request.payload as Record<string, unknown>).merchant_ref).toBe('TEST_ORDER_fixed-id');
  });

  test('uses a manually provided subscription api key when present', async () => {
    const defaults = toSubscriptionDefaultsResponse(
      'default',
      env,
      'local',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionRequestValues = {
      ...defaults.form,
      apiKey: 'manual-subscription-token',
    };

    const request = buildSubscriptionRequestFromForm(env, values, makeId);
    expect(request.headers?.Authorization).toBe('ApiKey manual-subscription-token');
  });

  test('updates and writes subscription preset file by channel', async () => {
    const values = toSubscriptionDefaultsResponse(
      'default',
      env,
      'local',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    ).form;
    values.commonValues.merchantRef = 'TEST_SUB_OVERRIDDEN';
    values.commonValues.returnUrl = 'https://merchant.example.com/subscription/updated';
    values.channelValues.subs_plan_id = 'PLAN-DRAFT-SHOULD-NOT-SAVE';
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
    expect(savedChannel).not.toContain('subs_plan_id');
    expect(presets.channels.default.values.subs_plan_id).toBeUndefined();
  });

  test('throws when a selected channel has no configured subscription plan', async () => {
    const defaults = toSubscriptionDefaultsResponse(
      'rabbitLinePay',
      env,
      'local',
      await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId }),
    );
    const values: SubscriptionRequestValues = {
      ...defaults.form,
      channel: 'rabbitLinePay',
      channelValues: {
        ...defaults.form.channelValues,
        subs_plan_id: '',
      },
    };
    const invalidEnv = getCliEnv({
      API_BASE_URL: 'https://example.test',
      MERCHANT_SIGN: 'sign-key',
      NORMAL_MERCHANT_API_TOKEN: 'subscription-token',
      SUBSCRIPTION_URL: '/s2s/v1/subscriptions',
      CALLBACK_URL_SUBSCRIPTION: 'https://merchant.example.com/subscription/callback',
      SUBSCRIPTION_PLAN: 'PLAN-DEFAULT-001',
    });

    expect(() => buildSubscriptionRequestFromForm(invalidEnv, values, makeId)).toThrow(
      'Missing subscription plan configuration for "rabbitLinePay". Expected env var: SUBSCRIPTION_PLAN_LINEPAY',
    );
  });
});
