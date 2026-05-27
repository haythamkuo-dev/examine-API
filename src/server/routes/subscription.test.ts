import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { startApiTestServer, type ApiTestServerContext } from '../../../tests/server-setup';

type SubscriptionApiRequestBody = {
  channel: string;
  commonValues: {
    merchantRef: string;
    returnUrl: string;
  };
  channelValues: Record<string, unknown>;
};

const createRequestUrl = (baseUrl: string, path: string): string => `${baseUrl}${path}`;

const createValidBody = (): SubscriptionApiRequestBody => ({
  channel: 'default',
  commonValues: {
    merchantRef: 'TEST_SUB_ORDER_125',
    returnUrl: 'https://merchant.example.com/subscription/callback',
  },
  channelValues: {
    subs_plan_id: '01KKTEEJCJ5W12EMC01469Z4ZJ',
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
  const originalFetch = globalThis.fetch;
  const requestApi = (path: string, init?: RequestInit): Promise<Response> =>
    originalFetch(createRequestUrl(context.baseUrl, path), init);

  beforeAll(async () => {
    context = await startApiTestServer();
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (context) {
      await context.stop();
    }
  });

  beforeEach(async () => {
    globalThis.fetch = originalFetch;
    mock.restore();
    await context.resetSubscriptionFixtures();
  });

  test('GET /api/subscription/defaults returns subscription defaults bundle', async () => {
    const response = await requestApi('/api/subscription/defaults?channel=default');

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const form = body.form as Record<string, unknown>;
    const commonValues = form.commonValues as Record<string, unknown>;

    expect(body.channel).toBe('default');
    expect(body.availableChannels).toEqual(['default']);
    expect(commonValues.merchantRef).toBe('TEST_ORDER_1250');
  });

  test('POST /api/subscription/merchant-ref returns a generated merchant reference', async () => {
    const response = await requestApi('/api/subscription/merchant-ref', {
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

    const response = await requestApi('/api/subscription/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.message).toBe('product_name is required');
  });

  test('POST /api/subscription/preview returns masked preview payload for valid subscription form', async () => {
    const response = await requestApi('/api/subscription/preview', {
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
  });

  test('POST /api/subscription/create proxies upstream status and preserves the provided merchant ref', async () => {
    let upstreamBody: Record<string, unknown> | null = null;
    let upstreamAuthorization = '';

    globalThis.fetch = mock(async (_input, init) => {
      upstreamBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      upstreamAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization || '');

      return new Response(JSON.stringify({ ok: true, subscription_id: 'sub_123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const response = await requestApi('/api/subscription/create', {
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
    expect(upstreamBody?.merchant_ref).toBe('TEST_SUB_ORDER_125');
  });

  test('PUT /api/subscription/defaults persists subscription defaults into the isolated fixture copy', async () => {
    const requestBody = {
      channel: 'default',
      commonValues: {
        merchantRef: 'TEST_SUB_OVERRIDDEN',
        returnUrl: 'https://merchant.example.com/subscription/updated',
      },
      channelValues: {
        subs_plan_id: '01KKTEEJCJ5W12EMC01469Z4ZJ',
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

    const updateResponse = await requestApi('/api/subscription/defaults?channel=default', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(updateResponse.status).toBe(200);

    const updatedDefaultsResponse = await requestApi('/api/subscription/defaults?channel=default');
    const updatedDefaults = (await updatedDefaultsResponse.json()) as Record<string, unknown>;
    const form = updatedDefaults.form as Record<string, unknown>;
    const commonValues = form.commonValues as Record<string, unknown>;
    const channelValues = form.channelValues as Record<string, unknown>;

    expect(commonValues.merchantRef).toBe('TEST_SUB_OVERRIDDEN');
    expect(commonValues.returnUrl).toBe('https://merchant.example.com/subscription/updated');
    expect(channelValues.product_name).toBe('Updated subscription product');

    const savedCommon = await readFile(join(context.subscriptionPresetDirPath, 'common.json'), 'utf8');
    const savedChannel = await readFile(join(context.subscriptionPresetDirPath, 'channels', 'default.json'), 'utf8');

    expect(savedCommon).toContain('"merchant_ref": "TEST_SUB_OVERRIDDEN"');
    expect(savedCommon).toContain('"return_url": "https://merchant.example.com/subscription/updated"');
    expect(savedChannel).toContain('"product_name": "Updated subscription product"');
  });
});
