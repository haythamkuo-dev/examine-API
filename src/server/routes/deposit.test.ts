import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { DEPOSIT_CHANNELS } from '../../core/env';
import { targetEnvironmentHeaderName } from '../../core/targetEnvironment';
import {
  createTestCliEnvRegistry,
  startApiTestServer,
  type ApiTestServerContext,
} from '../../../tests/server-setup';

type DepositApiRequestBody = {
  apiKey?: string;
  channel: string;
  commonValues: {
    productNo: string;
    merchantRef: string;
    amount: string;
    currencyCode: string;
    returnUrl: string;
  };
  channelValues: Record<string, unknown>;
};

type DepositUpstreamBody = {
  merchant_ref: string;
};

const createRequestUrl = (baseUrl: string, path: string): string => `${baseUrl}${path}`;

const createValidBody = (): DepositApiRequestBody => ({
  channel: 'southafrica_cards',
  commonValues: {
    productNo: 'DEP-FUTUREPAY_COLLECT-ZASOUTHAFRICACARDS-USD',
    merchantRef: 'TEST_DEPOSIT_ORDER_125',
    amount: '99.00',
    currencyCode: 'USD',
    returnUrl: 'https://merchant.example.com/deposit/callback',
  },
  channelValues: {
    payment_order: {
      collect: {
        country_code: 'US',
        product_detail: 'Collect order for %s',
        product_name: 'Hugo industry',
        shopper_reference: 'CUSTOMER_001',
        origin: 'https://www.amazon.com/',
      },
    },
  },
});

describe('deposit API routes', () => {
  let context: ApiTestServerContext;
  const originalFetch = globalThis.fetch;
  const requestApi = (path: string, init?: RequestInit): Promise<Response> =>
    originalFetch(createRequestUrl(context.baseUrl, path), init);

  beforeAll(async () => {
    const envRegistry = createTestCliEnvRegistry();

    context = await startApiTestServer({
      envRegistry: {
        ...envRegistry,
        product: {
          ...envRegistry.product,
          baseUrl: 'https://product.example.test',
          tokens: {
            ...envRegistry.product.tokens,
            deposit: 'product-deposit-token',
            payout: 'product-payout-token',
            subscription: 'product-subscription-token',
          },
          merchantTokens: {
            ...envRegistry.product.merchantTokens,
            normal: 'product-deposit-token',
            india: 'product-india-token',
            bangladesh: 'product-india-token',
          },
        },
      },
    });
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
    await context.resetDepositFixtures();
  });

  test('GET /api/deposit/defaults returns deposit defaults bundle', async () => {
    const response = await requestApi('/api/deposit/defaults?channel=southafrica_cards');

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const form = body.form as Record<string, unknown>;
    const commonValues = form.commonValues as Record<string, unknown>;

    expect(body.channel).toBe('southafrica_cards');
    expect(body.availableChannels).toEqual([...DEPOSIT_CHANNELS]);
    expect(body.apiKey).toBe('payout-token');
    expect(commonValues.merchantRef).toBe('TEST_ORDER_000001');
  });

  test('POST /api/deposit/merchant-ref returns a generated merchant reference', async () => {
    const response = await requestApi('/api/deposit/merchant-ref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.merchantRef).toBe('TEST_ORDER_fixed-id');
  });

  test('POST /api/deposit/preview returns 400 when required deposit field is blank', async () => {
    const requestBody = createValidBody();
    const paymentOrder = requestBody.channelValues.payment_order as Record<string, unknown>;
    const collect = paymentOrder.collect as Record<string, unknown>;
    collect.product_name = '   ';

    const response = await requestApi('/api/deposit/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.message).toBe('payment_order.collect.product_name is required');
  });

  test('POST /api/deposit/preview returns masked preview payload for valid deposit form', async () => {
    const response = await requestApi('/api/deposit/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [targetEnvironmentHeaderName]: 'local',
      },
      body: JSON.stringify(createValidBody()),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const request = body.request as Record<string, unknown>;
    const headers = request.headers as Record<string, unknown>;
    const payload = request.payload as Record<string, unknown>;

    expect(request.url).toBe('https://example.test/s2s/v1/intents/deposit');
    expect(headers.Authorization).toBe('ApiKey ****-token');
    expect(payload.merchant_ref).toBe('TEST_ORDER_fixed-id');
  });

  test('GET /api/deposit/defaults switches the default api key for the product environment', async () => {
    const response = await requestApi('/api/deposit/defaults?channel=southafrica_cards', {
      headers: {
        [targetEnvironmentHeaderName]: 'product',
      },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.apiKey).toBe('product-deposit-token');
  });

  test('POST /api/deposit/create proxies upstream status and preserves the provided merchant ref', async () => {
    let upstreamBody: DepositUpstreamBody | null = null;
    let upstreamAuthorization = '';

    globalThis.fetch = mock(async (_input, init) => {
      upstreamBody = JSON.parse(String(init?.body ?? '{}')) as DepositUpstreamBody;
      upstreamAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization || '');

      return new Response(JSON.stringify({ ok: true, intent_id: 'dep_123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const response = await requestApi('/api/deposit/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [targetEnvironmentHeaderName]: 'local',
      },
      body: JSON.stringify(createValidBody()),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.status).toBe(201);
    expect(upstreamAuthorization).toBe('ApiKey payout-token');
    expect(upstreamBody).not.toBeNull();
    const capturedUpstreamBody = upstreamBody as unknown as DepositUpstreamBody;
    expect(capturedUpstreamBody.merchant_ref).toBe('TEST_DEPOSIT_ORDER_125');
  });

  test('POST /api/deposit/create switches to the product env when requested', async () => {
    let upstreamUrl = '';
    let upstreamAuthorization = '';

    globalThis.fetch = mock(async (input, init) => {
      upstreamUrl = String(input);
      upstreamAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization || '');

      return new Response(JSON.stringify({ ok: true, intent_id: 'dep_prod_123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const response = await requestApi('/api/deposit/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [targetEnvironmentHeaderName]: 'product',
      },
      body: JSON.stringify(createValidBody()),
    });

    expect(response.status).toBe(200);
    expect(upstreamUrl).toBe('https://product.example.test/s2s/v1/intents/deposit');
    expect(upstreamAuthorization).toBe('ApiKey product-deposit-token');
  });

  test('POST /api/deposit/create uses a manually provided api key override', async () => {
    let upstreamAuthorization = '';

    globalThis.fetch = mock(async (_input, init) => {
      upstreamAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization || '');

      return new Response(JSON.stringify({ ok: true, intent_id: 'dep_manual_123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const response = await requestApi('/api/deposit/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [targetEnvironmentHeaderName]: 'local',
      },
      body: JSON.stringify({
        ...createValidBody(),
        apiKey: 'manual-deposit-token',
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamAuthorization).toBe('ApiKey manual-deposit-token');
  });

  test('POST /api/deposit/create rejects unsupported target environments', async () => {
    const response = await requestApi('/api/deposit/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [targetEnvironmentHeaderName]: 'staging',
      },
      body: JSON.stringify(createValidBody()),
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.message).toBe('Unsupported target environment: staging');
  });

  test('PUT /api/deposit/defaults persists deposit defaults into the isolated fixture copy', async () => {
    const requestBody = createValidBody();
    requestBody.apiKey = 'manual-deposit-token';
    requestBody.commonValues.productNo = 'DEP-CUSTOM-TEST-001';
    requestBody.commonValues.merchantRef = 'TEST_DEPOSIT_OVERRIDDEN';
    requestBody.channelValues = {
      payment_order: {
        collect: {
          country_code: 'US',
          product_detail: 'Collect order for %s',
          product_name: 'Updated deposit product',
          shopper_reference: 'CUSTOMER_001',
          origin: 'https://www.amazon.com/',
        },
      },
    };

    const updateResponse = await requestApi('/api/deposit/defaults?channel=southafrica_cards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(updateResponse.status).toBe(200);

    const updatedDefaultsResponse = await requestApi('/api/deposit/defaults?channel=southafrica_cards');
    const updatedDefaults = (await updatedDefaultsResponse.json()) as Record<string, unknown>;
    const form = updatedDefaults.form as Record<string, unknown>;
    const commonValues = form.commonValues as Record<string, unknown>;
    const channelValues = form.channelValues as Record<string, unknown>;
    const paymentOrder = channelValues.payment_order as Record<string, unknown>;
    const collect = paymentOrder.collect as Record<string, unknown>;

    expect(commonValues.productNo).toBe('DEP-CUSTOM-TEST-001');
    expect(commonValues.merchantRef).toBe('TEST_DEPOSIT_OVERRIDDEN');
    expect(collect.product_name).toBe('Updated deposit product');
    expect(updatedDefaults.apiKey).toBe('payout-token');

    const savedCommon = await readFile(join(context.depositPresetDirPath, 'common.json'), 'utf8');
    const savedChannel = await readFile(
      join(context.depositPresetDirPath, 'channels', 'southafrica_cards.json'),
      'utf8',
    );

    expect(savedCommon).toContain('"merchantRef": "TEST_DEPOSIT_OVERRIDDEN"');
    expect(savedChannel).toContain('"productNo": "DEP-CUSTOM-TEST-001"');
    expect(savedChannel).toContain('"product_name": "Updated deposit product"');
  });
});
