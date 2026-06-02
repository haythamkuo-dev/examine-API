import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getCliEnvRegistry } from '../../core/env';
import { startApiTestServer, type ApiTestServerContext } from '../../../tests/server-setup';

type SubscriptionApiRequestBody = {
  apiKey?: string;
  channel: string;
  commonValues: {
    merchantRef: string;
    returnUrl: string;
  };
  channelValues: Record<string, unknown>;
};

type SubscriptionUpstreamBody = {
  merchant_ref: string;
  subs_plan_id: string;
};

const createRequestUrl = (baseUrl: string, path: string): string => `${baseUrl}${path}`;

const createValidBody = (): SubscriptionApiRequestBody => ({
  channel: 'default',
  commonValues: {
    merchantRef: 'TEST_SUB_ORDER_125',
    returnUrl: 'https://merchant.example.com/subscription/callback',
  },
  channelValues: {
    amount: { amount: '111.00', currency_code: 'USD' },
    interval_unit: 'day',
    interval_count: 1,
    times: 6,
    product_detail: '測試訂閱商品描述加簽',
    product_name: 'Hugo Industry',
    consumer_id: 'user_999',
    consumer_profile: {
      name: '王小明',
      phone: '0912345678',
      email: 'test@example.com',
      country_code: 'ZA',
    },
    origin: 'https://www.amazon.com/',
    payment_instrument: {
      os_type: 'WEB',
      terminal_type: 'WEB',
    },
  },
});

describe('subscription API routes', () => {
  let context: ApiTestServerContext;

  beforeAll(async () => {
    context = await startApiTestServer({
      envRegistry: getCliEnvRegistry({
        ...process.env,
        SUBSCRIPTION_PLAN: 'PLAN-STAGE-DEFAULT',
        SUBSCRIPTION_PLAN_LINEPAY: 'PLAN-STAGE-LINEPAY',
        SUBSCRIPTION_PLAN_TNG: 'PLAN-STAGE-TNG',
      }),
    });
  });

  afterAll(async () => {
    if (context) {
      await context.stop();
    }
  });

  beforeEach(async () => {
    mock.restore();
    await context.resetSubscriptionFixtures();
  });

  test('GET /api/subscription/defaults returns subscription defaults bundle', async () => {
    const response = await context.requestApi('/api/subscription/defaults?channel=default');

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const form = body.form as Record<string, unknown>;
    const commonValues = form.commonValues as Record<string, unknown>;

    expect(body.channel).toBe('default');
    expect(body.availableChannels).toEqual(['default', 'rabbitLinePay', 'touchAndGo']);
    expect(body.apiKey).toBe('payout-token');
    expect(body.resolvedPlanId).toBe('PLAN-STAGE-DEFAULT');
    expect(commonValues.merchantRef).toBe('Click button to acquire a merchant ref');
  });

  test('GET /api/subscription/defaults returns channel-specific defaults with a draft plan id field', async () => {
    const response = await context.requestApi('/api/subscription/defaults?channel=rabbitLinePay');

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const channelSchema = body.channelSchema as Record<string, unknown>;
    const form = body.form as Record<string, unknown>;
    const channelValues = form.channelValues as Record<string, unknown>;

    expect(body.channel).toBe('rabbitLinePay');
    expect(body.resolvedPlanId).toBe('PLAN-STAGE-LINEPAY');
    expect(channelSchema.subs_plan_id).toBeUndefined();
    expect(channelValues.subs_plan_id).toBe('PLAN-STAGE-LINEPAY');
  });

  test('GET /api/subscription/defaults switches resolved plan id for the product environment', async () => {
    const response = await context.requestApi('/api/subscription/defaults?channel=touchAndGo', {
      headers: { 'X-Target-Environment': 'product' },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.apiKey).toBe(context.envRegistry.product.tokens.subscription);
    expect(body.resolvedPlanId).toBe('PLAN-PROD-TNG');
  });

  test('POST /api/subscription/merchant-ref returns a generated merchant reference', async () => {
    const response = await context.requestApi('/api/subscription/merchant-ref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.merchantRef).toBe('TEST_ORDER_fixed-id');
  });

  test('POST /api/subscription/preview returns 400 when required subscription field is blank', async () => {
    const requestBody = createValidBody();
    requestBody.channelValues.product_name = '   ';

    const response = await context.requestApi('/api/subscription/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.message).toBe('product_name is required');
  });

  test('POST /api/subscription/preview returns masked preview payload for valid subscription form', async () => {
    const response = await context.requestApi('/api/subscription/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createValidBody()),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const request = body.request as Record<string, unknown>;
    const headers = request.headers as Record<string, unknown>;
    const payload = request.payload as Record<string, unknown>;

    expect(request.url).toBe('https://example.test/s2s/v1/subscriptions');
    expect(headers.Authorization).toBe('ApiKey ****-token');
    expect(payload.merchant_ref).toBe('TEST_ORDER_fixed-id');
    expect(payload.subs_plan_id).toBe('PLAN-STAGE-DEFAULT');
  });

  test('POST /api/subscription/preview injects the selected channel plan id', async () => {
    const requestBody = createValidBody();
    requestBody.channel = 'touchAndGo';

    const response = await context.requestApi('/api/subscription/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const request = body.request as Record<string, unknown>;
    const payload = request.payload as Record<string, unknown>;

    expect(payload.subs_plan_id).toBe('PLAN-STAGE-TNG');
  });

  test('POST /api/subscription/preview uses a draft plan id override when provided', async () => {
    const requestBody = createValidBody();
    requestBody.channelValues.subs_plan_id = 'PLAN-DRAFT-ROUTE-001';

    const response = await context.requestApi('/api/subscription/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const request = body.request as Record<string, unknown>;
    const payload = request.payload as Record<string, unknown>;

    expect(payload.subs_plan_id).toBe('PLAN-DRAFT-ROUTE-001');
  });

  test('POST /api/subscription/create proxies upstream status and preserves the provided merchant ref', async () => {
    let upstreamBody: SubscriptionUpstreamBody | null = null;
    let upstreamAuthorization = '';

    globalThis.fetch = mock(async (_input, init) => {
      upstreamBody = JSON.parse(String(init?.body ?? '{}')) as SubscriptionUpstreamBody;
      upstreamAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization || '');

      return new Response(JSON.stringify({ ok: true, subscription_id: 'sub_123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const response = await context.requestApi('/api/subscription/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createValidBody()),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.status).toBe(201);
    expect(upstreamAuthorization).toBe('ApiKey payout-token');
    expect(upstreamBody).not.toBeNull();
    const capturedUpstreamBody = upstreamBody as unknown as SubscriptionUpstreamBody;
    expect(capturedUpstreamBody.merchant_ref).toBe('TEST_SUB_ORDER_125');
    expect(capturedUpstreamBody.subs_plan_id).toBe('PLAN-STAGE-DEFAULT');
  });

  test('POST /api/subscription/create uses a manually provided api key override', async () => {
    let upstreamAuthorization = '';

    globalThis.fetch = mock(async (_input, init) => {
      upstreamAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization || '');

      return new Response(JSON.stringify({ ok: true, subscription_id: 'sub_manual_123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const response = await context.requestApi('/api/subscription/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createValidBody(),
        apiKey: 'manual-subscription-token',
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamAuthorization).toBe('ApiKey manual-subscription-token');
  });

  test('POST /api/subscription/create forwards a draft plan id override upstream', async () => {
    let upstreamBody: SubscriptionUpstreamBody | null = null;

    globalThis.fetch = mock(async (_input, init) => {
      upstreamBody = JSON.parse(String(init?.body ?? '{}')) as SubscriptionUpstreamBody;

      return new Response(JSON.stringify({ ok: true, subscription_id: 'sub_draft_plan_123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const response = await context.requestApi('/api/subscription/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createValidBody(),
        channelValues: {
          ...createValidBody().channelValues,
          subs_plan_id: 'PLAN-DRAFT-UPSTREAM-001',
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamBody).not.toBeNull();
    expect((upstreamBody as SubscriptionUpstreamBody).subs_plan_id).toBe('PLAN-DRAFT-UPSTREAM-001');
  });

  test('POST /api/subscription/create returns 400 when the selected channel is missing a configured plan id', async () => {
    const missingPlanContext = await startApiTestServer({
      envRegistry: getCliEnvRegistry({
        ...process.env,
        SUBSCRIPTION_PLAN: 'PLAN-STAGE-DEFAULT',
        SUBSCRIPTION_PLAN_LINEPAY: '',
        SUBSCRIPTION_PLAN_TNG: 'PLAN-STAGE-TNG',
      }),
    });

    try {
      const response = await missingPlanContext.requestApi('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createValidBody(),
          channel: 'rabbitLinePay',
        }),
      });

      expect(response.status).toBe(400);

      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('MISSING_SUBSCRIPTION_PLAN');
      expect(body.message).toBe(
        'Missing subscription plan configuration for "rabbitLinePay". Expected env var: SUBSCRIPTION_PLAN_LINEPAY',
      );
    } finally {
      await missingPlanContext.stop();
    }
  });

  test('GET /api/subscription/defaults returns 400 when the selected channel is missing a configured plan id', async () => {
    const missingPlanContext = await startApiTestServer({
      envRegistry: getCliEnvRegistry({
        ...process.env,
        SUBSCRIPTION_PLAN: 'PLAN-STAGE-DEFAULT',
        SUBSCRIPTION_PLAN_LINEPAY: '',
        SUBSCRIPTION_PLAN_TNG: 'PLAN-STAGE-TNG',
      }),
    });

    try {
      const response = await missingPlanContext.requestApi('/api/subscription/defaults?channel=rabbitLinePay');

      expect(response.status).toBe(400);

      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('MISSING_SUBSCRIPTION_PLAN');
      expect(body.message).toBe(
        'Missing subscription plan configuration for "rabbitLinePay". Expected env var: SUBSCRIPTION_PLAN_LINEPAY',
      );
    } finally {
      await missingPlanContext.stop();
    }
  });

  test('PUT /api/subscription/defaults persists subscription defaults into the isolated fixture copy', async () => {
    const requestBody = {
      apiKey: 'manual-subscription-token',
      channel: 'default',
      commonValues: {
        merchantRef: 'TEST_SUB_OVERRIDDEN',
        returnUrl: 'https://merchant.example.com/subscription/updated',
      },
      channelValues: {
        amount: { amount: '111.00', currency_code: 'USD' },
        interval_unit: 'day',
        interval_count: 1,
        times: 6,
        product_detail: '測試訂閱商品描述加簽',
        product_name: 'Updated subscription product',
        consumer_id: 'user_999',
        consumer_profile: {
          name: '王小明',
          phone: '0912345678',
          email: 'test@example.com',
          country_code: 'ZA',
        },
        origin: 'https://www.amazon.com/',
        payment_instrument: {
          os_type: 'WEB',
          terminal_type: 'WEB',
        },
      },
    };

    const updateResponse = await context.requestApi('/api/subscription/defaults?channel=default', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(updateResponse.status).toBe(200);

    const updatedDefaultsResponse = await context.requestApi('/api/subscription/defaults?channel=default');
    const updatedDefaults = (await updatedDefaultsResponse.json()) as Record<string, unknown>;
    const form = updatedDefaults.form as Record<string, unknown>;
    const commonValues = form.commonValues as Record<string, unknown>;
    const channelValues = form.channelValues as Record<string, unknown>;

    expect(commonValues.merchantRef).toBe('TEST_SUB_OVERRIDDEN');
    expect(commonValues.returnUrl).toBe('https://merchant.example.com/subscription/updated');
    expect(channelValues.product_name).toBe('Updated subscription product');
    expect(updatedDefaults.apiKey).toBe('payout-token');

    const savedCommon = await readFile(join(context.subscriptionPresetDirPath, 'common.json'), 'utf8');
    const savedChannel = await readFile(join(context.subscriptionPresetDirPath, 'channels', 'default.json'), 'utf8');

    expect(savedCommon).toContain('"merchant_ref": "TEST_SUB_OVERRIDDEN"');
    expect(savedCommon).toContain('"return_url": "https://merchant.example.com/subscription/updated"');
    expect(savedChannel).toContain('"product_name": "Updated subscription product"');
    expect(savedChannel).not.toContain('subs_plan_id');
  });
});
