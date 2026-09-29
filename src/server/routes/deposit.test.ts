import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { DEPOSIT_CHANNELS } from '../../core/env';
import { targetEnvironmentHeaderName } from '../../core/targetEnvironment';
import {
  createTestCliEnvRegistry,
  startApiTestServer,
  type ApiTestServerContext,
} from '../../../tests/server-setup';
import type { DepositFormValues } from '../../deposit/web';
import { updateDepositPreset } from '../../deposit/presets';

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

const createPixBody = (): DepositApiRequestBody => ({
  channel: 'pix_brl',
  commonValues: {
    productNo: 'DEP-FUTUREPAY_COLLECT-PIX-USD',
    merchantRef: 'M-ORDER-PIX-BRL-20260929-000001',
    amount: '12.34',
    currencyCode: 'BRL',
    returnUrl: 'https://merchant.example.com/deposit/result',
  },
  channelValues: {
    issue_invoice: false,
    checkout_url_type: 'direct',
    payment_order: {
      collect: {
        country_code: 'BR',
        product_detail: 'Pix order %s',
        product_name: 'Pix Checkout',
        shopper_reference: 'SHOPPER-PIX-BRL-000001',
        shopper_email: 'customer@example.com',
        origin: 'https://merchant.example.com/checkout',
      },
    },
  },
});

describe('deposit API routes', () => {
  let context: ApiTestServerContext;

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
    if (context) {
      await context.stop();
    }
  });

  beforeEach(async () => {
    mock.restore();
    await context.resetDepositFixtures();
  });

  test('GET /api/deposit/defaults returns deposit defaults bundle', async () => {
    const response = await context.requestApi('/api/deposit/defaults?channel=southafrica_cards');

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const form = body.form as Record<string, unknown>;
    const commonValues = form.commonValues as Record<string, unknown>;

    expect(body.channel).toBe('southafrica_cards');
    expect(body.availableChannels).toEqual([...DEPOSIT_CHANNELS]);
    expect(body.apiKey).toBe('payout-token');
    expect(commonValues.merchantRef).toBe('Click button to acquire a merchant ref');
  });

  test('GET /api/deposit/defaults returns the PIX Brazil defaults and required shopper email field', async () => {
    const response = await context.requestApi('/api/deposit/defaults?channel=pix_brl');

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const form = body.form as Record<string, unknown>;
    const commonValues = form.commonValues as Record<string, unknown>;
    const channelValues = form.channelValues as Record<string, unknown>;
    const channelSchema = body.channelSchema as Record<string, unknown>;
    const paymentOrderSchema = channelSchema.payment_order as Record<string, unknown>;
    const collectSchema = (paymentOrderSchema.fields as Record<string, unknown>).collect as Record<string, unknown>;
    const collectFields = collectSchema.fields as Record<string, unknown>;
    const shopperEmailSchema = collectFields.shopper_email as Record<string, unknown>;

    expect(body.channel).toBe('pix_brl');
    expect(commonValues).toMatchObject({
      productNo: 'DEP-FUTUREPAY_COLLECT-PIX-USD',
      amount: '12.34',
      currencyCode: 'BRL',
    });
    expect(channelValues).toMatchObject({
      issue_invoice: false,
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          country_code: 'BR',
          shopper_reference: 'SHOPPER-PIX-BRL-000001',
          shopper_email: 'customer@example.com',
        },
      },
    });
    expect(shopperEmailSchema.required).toBe(true);
  });

  test('POST /api/deposit/merchant-ref returns a generated merchant reference', async () => {
    const response = await context.requestApi('/api/deposit/merchant-ref', {
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

    const response = await context.requestApi('/api/deposit/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      response: { status: number; code: string; message: string };
    };
    expect(body.response).toEqual({
      status: 400,
      code: 'UNKNOWN_ERROR',
      message: 'payment_order.collect.product_name is required',
    });
  });

  test('POST /api/deposit/preview returns 400 when productNo looks like a token instead of a deposit product code', async () => {
    const requestBody = createValidBody();
    requestBody.commonValues.productNo = 'mk_general_01ksse4ja1th.ksqLSyDPzAQbdZu_DOAvvfPlZythxXGj';

    const response = await context.requestApi('/api/deposit/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      response: { status: number; code: string; message: string };
    };
    expect(body.response).toEqual({
      status: 400,
      code: 'UNKNOWN_ERROR',
      message: 'commonValues.productNo must be a valid deposit product code',
    });
  });

  test('POST /api/deposit/preview returns masked preview payload for valid deposit form', async () => {
    const response = await context.requestApi('/api/deposit/preview', {
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

  test('POST /api/deposit/preview builds the PIX Brazil payload with a generated merchant reference', async () => {
    const response = await context.requestApi('/api/deposit/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [targetEnvironmentHeaderName]: 'local',
      },
      body: JSON.stringify(createPixBody()),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as { request: { payload: Record<string, unknown> } };
    expect(body.request.payload).toMatchObject({
      product_no: 'DEP-FUTUREPAY_COLLECT-PIX-USD',
      merchant_ref: 'TEST_ORDER_fixed-id',
      amount: { amount: '12.34', currency_code: 'BRL' },
      issue_invoice: false,
      checkout_url_type: 'direct',
      payment_order: {
        collect: {
          country_code: 'BR',
          product_detail: 'Pix order %s',
          product_name: 'Pix Checkout',
          shopper_reference: 'SHOPPER-PIX-BRL-000001',
          shopper_email: 'customer@example.com',
          origin: 'https://merchant.example.com/checkout',
        },
      },
    });
  });

  test('POST /api/deposit/preview requires a PIX shopper email', async () => {
    const requestBody = createPixBody();
    const paymentOrder = requestBody.channelValues.payment_order as Record<string, unknown>;
    const collect = paymentOrder.collect as Record<string, unknown>;
    delete collect.shopper_email;

    const response = await context.requestApi('/api/deposit/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      response: {
        message: 'payment_order.collect.shopper_email is required',
      },
    });
  });

  test('keeps edited PIX amount for the request without persisting it to the preset', async () => {
    const defaultsResponse = await context.requestApi('/api/deposit/defaults?channel=pix_brl');
    const defaults = (await defaultsResponse.json()) as { form: DepositFormValues };
    const editedForm: DepositFormValues = {
      ...defaults.form,
      commonValues: {
        ...defaults.form.commonValues,
        amount: '88.88',
      },
    };

    await updateDepositPreset({
      dirPath: context.depositPresetDirPath,
      channel: 'pix_brl',
      values: editedForm,
      env: context.envRegistry.local,
      makeId: (prefix: string) => `${prefix}fixed-id`,
    });

    const reloadedResponse = await context.requestApi('/api/deposit/defaults?channel=pix_brl');
    const reloaded = (await reloadedResponse.json()) as { form: DepositFormValues };
    expect(reloaded.form.commonValues.amount).toBe('12.34');

    const previewResponse = await context.requestApi('/api/deposit/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editedForm),
    });
    const preview = (await previewResponse.json()) as { request: { payload: Record<string, unknown> } };
    expect(preview.request.payload.amount).toEqual({ amount: '88.88', currency_code: 'BRL' });
  });

  test('GET /api/deposit/defaults switches the default api key for the product environment', async () => {
    const response = await context.requestApi('/api/deposit/defaults?channel=southafrica_cards', {
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

      return new Response(JSON.stringify({
        ok: true,
        intent_id: 'dep_123',
        checkout: { checkout_url: 'https://checkout.example.test/deposit/dep_123' },
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const response = await context.requestApi('/api/deposit/create', {
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
    expect(body.checkoutUrl).toBe('https://checkout.example.test/deposit/dep_123');
    expect(upstreamAuthorization).toBe('ApiKey payout-token');
    expect(upstreamBody).not.toBeNull();
    const capturedUpstreamBody = upstreamBody as unknown as DepositUpstreamBody;
    expect(capturedUpstreamBody.merchant_ref).toBe('TEST_DEPOSIT_ORDER_125');
  });

  test('POST /api/deposit/create returns only the normalized upstream error envelope', async () => {
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({
          code: 'binding_missing',
          message: 'Binding missing; token=deposit-secret; context remains',
          raw_payload: { should_not: 'escape' },
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    ) as unknown as typeof fetch;

    const response = await context.requestApi('/api/deposit/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createValidBody()),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      response: {
        status: 422,
        code: 'binding_missing',
        message: 'Binding missing; token=[REDACTED]; context remains',
      },
    });
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

    const response = await context.requestApi('/api/deposit/create', {
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

    const response = await context.requestApi('/api/deposit/create', {
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
    const response = await context.requestApi('/api/deposit/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [targetEnvironmentHeaderName]: 'staging',
      },
      body: JSON.stringify(createValidBody()),
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      response: { status: number; code: string; message: string };
    };
    expect(body.response).toEqual({
      status: 400,
      code: 'UNKNOWN_ERROR',
      message: 'Unsupported target environment: staging',
    });
  });

});
