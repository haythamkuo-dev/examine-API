/// <reference lib="dom" />

import '../../tests/web-setup';
import { beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { act } from 'react';
import type {
  SubscriptionDefaultsResponse,
  SubscriptionDefaultsSavedResponse,
  SubscriptionFieldMap,
  SubscriptionFormValues,
  SubscriptionMerchantRefResponse,
} from '../../src/subscription/web';
import { normalizeCreateResult, SubscriptionPage } from './SubscriptionPage';
import { AppThemeProvider } from './pageChrome';

const channel = 'default';

type FetchRequestRecord = {
  body: SubscriptionFormValues | null;
  method: string;
  url: string;
};

type MockRouteHandler = (request: FetchRequestRecord) => Response | Promise<Response>;

const commonSchema: SubscriptionFieldMap = {
  merchantRef: {
    kind: 'text',
    label: 'Merchant reference',
    required: true,
  },
  returnUrl: {
    kind: 'text',
    label: 'Return URL',
    required: true,
  },
};

const channelSchema: SubscriptionFieldMap = {
  subs_plan_id: {
    kind: 'text',
    label: 'Plan ID',
    required: true,
  },
  product_name: {
    kind: 'text',
    label: 'Product name',
    required: true,
  },
};

const createForm = (overrides?: Partial<SubscriptionFormValues>): SubscriptionFormValues => ({
  channel,
  commonValues: {
    merchantRef: 'merchant-sub-default',
    returnUrl: 'https://merchant.example.com/subscription',
    ...(overrides?.commonValues ?? {}),
  },
  channelValues: {
    subs_plan_id: 'plan-default',
    product_name: 'Subscription product',
    ...(overrides?.channelValues ?? {}),
  },
});

const createDefaultsResponse = (
  overrides?: Partial<SubscriptionDefaultsResponse>,
): SubscriptionDefaultsResponse => ({
  availableChannels: [channel],
  channel,
  commonSchema,
  channelSchema,
  form: createForm(overrides?.form),
  ...overrides,
});

const createSavedDefaultsResponse = (
  productName: string,
): SubscriptionDefaultsSavedResponse => ({
  ok: true,
  availableChannels: [channel],
  channel,
  commonSchema,
  channelSchema,
  form: createForm({
    channelValues: {
      product_name: productName,
    },
  }),
});

const createMerchantRefResponse = (
  merchantRef: string,
): SubscriptionMerchantRefResponse => ({
  ok: true,
  merchantRef,
});

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

const textResponse = (body: string, init?: ResponseInit): Response =>
  new Response(body, {
    headers: { 'Content-Type': 'text/plain' },
    ...init,
  });

const fetchRecords: FetchRequestRecord[] = [];
let routeHandlers = new Map<string, MockRouteHandler>();

const renderSubscriptionPage = () =>
  render(
    <AppThemeProvider>
      <SubscriptionPage />
    </AppThemeProvider>,
  );

const readPostedForm = (body: BodyInit | null | undefined): SubscriptionFormValues | null => {
  if (typeof body !== 'string' || !body.trim()) {
    return null;
  }

  return JSON.parse(body) as SubscriptionFormValues;
};

beforeEach(() => {
  fetchRecords.length = 0;
  routeHandlers = new Map();
  localStorage.clear();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? 'GET';
    const record: FetchRequestRecord = {
      url,
      method,
      body: readPostedForm(init?.body),
    };

    fetchRecords.push(record);

    const handler = routeHandlers.get(`${method} ${url}`);
    if (!handler) {
      throw new Error(`Unexpected fetch request: ${method} ${url}`);
    }

    return await handler(record);
  }) as typeof fetch;
});

const setRouteHandlers = (handlers: Record<string, MockRouteHandler>): void => {
  routeHandlers = new Map(Object.entries(handlers));
};

describe('normalizeCreateResult', () => {
  test('keeps JSON object response as structured success output', async () => {
    const response = new Response(
      JSON.stringify({
        requestName: 'subscription:create:default',
        ok: true,
        status: 200,
        request: { method: 'POST', url: 'https://example.test', payload: { value: 1 } },
        response: { ok: true },
        durationMs: 10,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

    const result = await normalizeCreateResult(response);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.message).toBe('Request sent successfully.');
    expect((result.raw as { data: { requestName: string } }).data.requestName).toBe('subscription:create:default');
  });

  test('builds fallback error result for non-JSON failure response', async () => {
    const response = new Response('gateway failed', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/plain' },
    });

    const result = await normalizeCreateResult(response);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.message).toBe('gateway failed');
    expect((result.raw as { body: string }).body).toBe('gateway failed');
  });
});

describe('SubscriptionPage', () => {
  test('renders a read-only merchant reference field and updates it via generate', async () => {
    setRouteHandlers({
      'GET /api/subscription/defaults': async () => jsonResponse(createDefaultsResponse()),
      'POST /api/subscription/merchant-ref': async () =>
        jsonResponse(createMerchantRefResponse('GENERATED-SUB-001')),
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription Operator Console' });
    expect(view.getByLabelText('Merchant reference *')).toHaveAttribute('readonly');

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-SUB-001');
      expect(view.getByText('Merchant reference generated.')).toBeInTheDocument();
    });
  });

  test('keeps the generated merchant reference during environment switches and resets on new draft', async () => {
    setRouteHandlers({
      'GET /api/subscription/defaults': async () => jsonResponse(createDefaultsResponse()),
      [`GET /api/subscription/defaults?channel=${channel}`]: async () =>
        jsonResponse(
          createDefaultsResponse({
            form: createForm({
              commonValues: {
                merchantRef: 'merchant-reset-server',
              },
            }),
          }),
        ),
      'POST /api/subscription/merchant-ref': async () =>
        jsonResponse(createMerchantRefResponse('GENERATED-SUB-002')),
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription Operator Console' });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-SUB-002');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: '產品' }));
    });

    await waitFor(() => {
      expect(view.getByText('環境: 產品')).toBeInTheDocument();
    });

    expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-SUB-002');

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Reload defaults' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-SUB-002');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'New draft' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('merchant-reset-server');
    });
  });

  test('save defaults strips the generated merchant reference and generation failures keep the old value', async () => {
    let generateCalls = 0;

    setRouteHandlers({
      'GET /api/subscription/defaults': async () => jsonResponse(createDefaultsResponse()),
      'POST /api/subscription/merchant-ref': async () => {
        generateCalls += 1;

        if (generateCalls === 1) {
          return jsonResponse(createMerchantRefResponse('GENERATED-SUB-003'));
        }

        return textResponse('generator unavailable', {
          status: 500,
          statusText: 'Internal Server Error',
        });
      },
      [`PUT /api/subscription/defaults?channel=${channel}`]: async (request) => {
        expect(request.body?.commonValues.merchantRef).toBe('merchant-sub-default');
        return jsonResponse(createSavedDefaultsResponse('Saved subscription product'));
      },
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription Operator Console' });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-SUB-003');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Save defaults' }));
    });

    await waitFor(() => {
      expect(view.getByText(`Saved defaults for ${channel}.`)).toBeInTheDocument();
      expect(view.getByLabelText('Product name *')).toHaveValue('Saved subscription product');
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-SUB-003');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByText('API 500 from /api/subscription/merchant-ref: generator unavailable')).toBeInTheDocument();
    });

    expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-SUB-003');
  });

  test('preview replaces the current merchant reference with the backend-generated value and create reuses it', async () => {
    setRouteHandlers({
      'GET /api/subscription/defaults': async () =>
        jsonResponse(
          createDefaultsResponse({
            form: createForm({
              commonValues: {
                merchantRef: 'subscription-preview-start',
              },
            }),
          }),
        ),
      'POST /api/subscription/preview': async (request) =>
        jsonResponse({
          request: {
            name: 'subscription:create:default',
            method: 'POST',
            url: 'https://gateway.example.test/subscription',
            headers: { Authorization: 'ApiKey ****-token' },
            payload: {
              merchant_ref: `preview-generated-${request.body?.commonValues.merchantRef}`,
            },
          },
        }),
      'POST /api/subscription/create': async (request) => {
        expect(request.body?.commonValues.merchantRef).toBe('preview-generated-subscription-preview-start');

        return jsonResponse({
          requestName: 'subscription:create:default',
          ok: true,
          status: 200,
          request: {
            method: 'POST',
            url: 'https://gateway.example.test/subscription',
            payload: { merchant_ref: request.body?.commonValues.merchantRef },
          },
          response: { ok: true },
          durationMs: 8,
        });
      },
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription Operator Console' });
    expect(view.getByLabelText('Merchant reference *')).toHaveValue('subscription-preview-start');

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('preview-generated-subscription-preview-start');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Send request' }));
    });

    await waitFor(() => {
      expect(view.getByText('Request sent successfully.')).toBeInTheDocument();
    });
  });
});
