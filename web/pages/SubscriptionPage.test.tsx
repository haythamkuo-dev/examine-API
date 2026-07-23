/// <reference lib="dom" />

import '../../tests/web-setup';
import { beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { targetEnvironmentHeaderName } from '../../src/core/targetEnvironment';
import type {
  SubscriptionDefaultsResponse,
  SubscriptionDefaultsSavedResponse,
  SubscriptionFieldMap,
  SubscriptionFormValues,
  SubscriptionMerchantRefResponse,
  SubscriptionRequestValues,
} from '../../src/subscription/web';
import { normalizeCreateResult, SubscriptionPage } from './SubscriptionPage';
import { AppThemeProvider, EnvironmentModeToggle, useAppTheme } from './pageChrome';
import { ModalProvider } from './utils/modal';

const channel = 'default';

type FetchRequestRecord = {
  body: SubscriptionRequestValues | null;
  headers: Headers;
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
  product_name: {
    kind: 'text',
    label: 'Product name',
    required: true,
  },
};

const createForm = (overrides?: Partial<SubscriptionFormValues>): SubscriptionFormValues => ({
  channel: overrides?.channel ?? channel,
  commonValues: {
    merchantRef: 'merchant-sub-default',
    returnUrl: 'https://merchant.example.com/subscription',
    ...(overrides?.commonValues ?? {}),
  },
  channelValues: {
    product_name: 'Subscription product',
    ...(overrides?.channelValues ?? {}),
  },
});

const createDefaultsResponse = (
  overrides?: Partial<SubscriptionDefaultsResponse>,
): SubscriptionDefaultsResponse => ({
  apiKey: 'subscription-default-key',
  availableChannels: [channel],
  channel,
  resolvedPlanId: 'plan-default',
  commonSchema,
  channelSchema,
  form: createForm(overrides?.form),
  ...overrides,
});

const createSavedDefaultsResponse = (
  productName: string,
): SubscriptionDefaultsSavedResponse => ({
  ok: true,
  apiKey: 'subscription-saved-key',
  availableChannels: [channel],
  channel,
  resolvedPlanId: 'plan-default',
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

const TestEnvironmentControl = () => {
  const theme = useAppTheme();
  return <EnvironmentModeToggle mode={theme.environmentMode} onChange={theme.setEnvironmentMode} />;
};

const renderSubscriptionPage = () => {
  const view = render(
    <AppThemeProvider>
      <ModalProvider>
        <TestEnvironmentControl />
        <SubscriptionPage />
      </ModalProvider>
    </AppThemeProvider>,
  );

  return { ...view, ...within(view.container) };
};

const updateApiKeyFromModal = async (
  view: ReturnType<typeof renderSubscriptionPage>,
  value: string,
  action: 'Confirm' | 'Cancel' = 'Confirm',
) => {
  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: 'Edit API key' }));
  });

  await waitFor(() => {
    expect(view.getByRole('dialog')).toBeInTheDocument();
  });

  await act(async () => {
    fireEvent.input(view.getByLabelText('API key'), {
      target: { value },
    });
  });

  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: action }));
  });
};

const updatePlanIdFromModal = async (
  view: ReturnType<typeof renderSubscriptionPage>,
  value: string,
  action: 'Confirm' | 'Cancel' = 'Confirm',
) => {
  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: 'Edit Plan ID' }));
  });

  await waitFor(() => {
    expect(view.getByRole('dialog')).toBeInTheDocument();
  });

  await act(async () => {
    fireEvent.input(view.getByLabelText('Plan ID'), {
      target: { value },
    });
  });

  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: action }));
  });
};

const readPostedForm = (body: BodyInit | null | undefined): SubscriptionRequestValues | null => {
  if (typeof body !== 'string' || !body.trim()) {
    return null;
  }

  return JSON.parse(body) as SubscriptionRequestValues;
};

beforeEach(() => {
  fetchRecords.length = 0;
  routeHandlers = new Map();
  localStorage.clear();
  sessionStorage.clear();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? 'GET';
    const record: FetchRequestRecord = {
      url,
      method,
      body: readPostedForm(init?.body),
      headers: new Headers(init?.headers),
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
  test('renders an editable plan id field and updates merchant reference via generate', async () => {
    setRouteHandlers({
      'GET /api/subscription/defaults': async () => jsonResponse(createDefaultsResponse()),
      'POST /api/subscription/merchant-ref': async () =>
        jsonResponse(createMerchantRefResponse('GENERATED-SUB-001')),
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription' });
    await view.findByLabelText('Merchant reference *');
    expect(view.getByLabelText('Merchant reference *')).toHaveAttribute('readonly');
    expect(view.getByText('plan-default')).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Edit Plan ID' })).toBeInTheDocument();
    expect(view.getByText('subscription-default-key')).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Edit API key' })).toBeInTheDocument();

    await updatePlanIdFromModal(view, 'plan-draft-override');

    await waitFor(() => {
      expect(view.getByText('plan-draft-override')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-SUB-001');
      expect(view.getByText('Merchant reference generated.')).toBeInTheDocument();
    });
  });

  test('uses environment-scoped drafts and resets to backend defaults on new draft', async () => {
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

    await view.findByRole('heading', { name: 'Subscription' });

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

    expect(view.getByLabelText('Merchant reference *')).toHaveValue('merchant-reset-server');

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Reload defaults' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('merchant-reset-server');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'New draft' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('merchant-reset-server');
    });
  });

  test('generation failures keep the previous merchant reference', async () => {
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
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription' });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
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

    await view.findByRole('heading', { name: 'Subscription' });
    await view.findByLabelText('Merchant reference *');
    expect(view.getByLabelText('Merchant reference *')).toHaveValue('subscription-preview-start');

    await updateApiKeyFromModal(view, 'typed-subscription-key');

    await updatePlanIdFromModal(view, 'plan-preview-override');

    await waitFor(() => {
      expect(view.getByText('typed-subscription-key')).toBeInTheDocument();
      expect(view.getByText('plan-preview-override')).toBeInTheDocument();
    });

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

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === '/api/subscription/preview');
    const createCall = fetchRecords.find((record) => record.method === 'POST' && record.url === '/api/subscription/create');
    expect(previewCall?.body?.apiKey).toBe('typed-subscription-key');
    expect(previewCall?.body?.channelValues.subs_plan_id).toBe('plan-preview-override');
    expect(createCall?.body?.apiKey).toBe('typed-subscription-key');
    expect(createCall?.body?.channelValues.subs_plan_id).toBe('plan-preview-override');
  });

  test('cancels api key edits without applying the draft value', async () => {
    setRouteHandlers({
      'GET /api/subscription/defaults': async () => jsonResponse(createDefaultsResponse()),
      'POST /api/subscription/preview': async () =>
        jsonResponse({
          request: {
            name: 'subscription:create:default',
            method: 'POST',
            url: 'https://gateway.example.test/subscription',
            headers: { Authorization: 'ApiKey ****-token' },
            payload: {
              merchant_ref: 'preview-merchant',
            },
          },
        }),
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription' });

    await updateApiKeyFromModal(view, 'cancelled-subscription-key', 'Cancel');

    expect(view.queryByRole('dialog')).toBeNull();
    expect(view.getByText('subscription-default-key')).toBeInTheDocument();
    expect(view.queryByText('cancelled-subscription-key')).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === '/api/subscription/preview');
    expect(previewCall?.body?.apiKey).toBe('subscription-default-key');
  });

  test('updates the displayed plan id when the selected channel changes', async () => {
    setRouteHandlers({
      'GET /api/subscription/defaults': async () =>
        jsonResponse(
          createDefaultsResponse({
            availableChannels: ['default', 'rabbitLinePay'],
          }),
        ),
      'POST /api/subscription/preview': async () =>
        jsonResponse({
          request: {
            name: 'subscription:preview:test',
            method: 'POST',
            url: 'https://gateway.example.test/subscription',
            headers: {
              Authorization: 'ApiKey ****token',
            },
            payload: {
              merchant_ref: 'subscription-preview',
            },
          },
        }),
      'GET /api/subscription/defaults?channel=rabbitLinePay': async () =>
        jsonResponse(
          createDefaultsResponse({
            availableChannels: ['default', 'rabbitLinePay'],
            channel: 'rabbitLinePay',
            resolvedPlanId: 'plan-rabbit-linepay',
            form: createForm({
              channel: 'rabbitLinePay',
            }),
          }),
        ),
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription' });
    expect(view.getByText('plan-default')).toBeInTheDocument();

    await updateApiKeyFromModal(view, 'typed-subscription-key');

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: 'rabbitLinePay' },
      });
    });

    await waitFor(() => {
      expect(view.getByText('plan-rabbit-linepay')).toBeInTheDocument();
    });

    expect(view.getByText('typed-subscription-key')).toBeInTheDocument();
    expect(view.queryByText('subscription-default-key')).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === '/api/subscription/preview');
    expect(previewCall?.body?.apiKey).toBe('typed-subscription-key');
  });

  test('keeps the selected channel visible while channel defaults are still loading', async () => {
    setRouteHandlers({
      'GET /api/subscription/defaults': async () =>
        jsonResponse(
          createDefaultsResponse({
            availableChannels: ['default', 'rabbitLinePay'],
          }),
        ),
      'GET /api/subscription/defaults?channel=rabbitLinePay': async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return jsonResponse(
          createDefaultsResponse({
            availableChannels: ['default', 'rabbitLinePay'],
            channel: 'rabbitLinePay',
            resolvedPlanId: 'plan-rabbit-linepay',
            form: createForm({
              channel: 'rabbitLinePay',
            }),
          }),
        );
      },
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription' });

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: 'rabbitLinePay' },
      });
    });

    await waitFor(() => {
      expect(view.getByLabelText('Channel')).toHaveValue('rabbitLinePay');
    });

    await waitFor(() => {
      expect(view.getByText('plan-rabbit-linepay')).toBeInTheDocument();
      expect(view.getByLabelText('Channel')).toHaveValue('rabbitLinePay');
    });
  });

  test('updates the displayed plan id when the environment changes', async () => {
    setRouteHandlers({
      'GET /api/subscription/defaults': async () => jsonResponse(createDefaultsResponse()),
      [`GET /api/subscription/defaults?channel=${channel}`]: async () =>
        jsonResponse(
          createDefaultsResponse({
            apiKey: 'subscription-product-key',
            resolvedPlanId: 'plan-product-default',
          }),
        ),
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription' });
    expect(view.getByText('plan-default')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: '產品' }));
    });

    await waitFor(() => {
      expect(view.getByText('plan-product-default')).toBeInTheDocument();
      expect(view.getByText('subscription-product-key')).toBeInTheDocument();
    });

    const productDefaultsCall = fetchRecords.find(
      (record) =>
        record.method === 'GET' &&
        record.url === `/api/subscription/defaults?channel=${channel}` &&
        record.headers.get(targetEnvironmentHeaderName) === 'product',
    );

    expect(productDefaultsCall).toBeDefined();
  });

  test('shows the exact missing-plan error and blocks request actions for the selected channel', async () => {
    const missingPlanMessage =
      'Missing subscription plan configuration for "rabbitLinePay". Expected env var: SUBSCRIPTION_PLAN_LINEPAY';

    setRouteHandlers({
      'GET /api/subscription/defaults': async () =>
        jsonResponse(
          createDefaultsResponse({
            availableChannels: ['default', 'rabbitLinePay'],
          }),
        ),
      'GET /api/subscription/defaults?channel=rabbitLinePay': async () =>
        jsonResponse(
          {
            ok: false,
            code: 'MISSING_SUBSCRIPTION_PLAN',
            message: missingPlanMessage,
          },
          { status: 400 },
        ),
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription' });

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: 'rabbitLinePay' },
      });
    });

    await waitFor(() => {
      expect(view.getByLabelText('Channel')).toHaveValue('rabbitLinePay');
      expect(view.getByRole('alert')).toHaveTextContent(missingPlanMessage);
    });

    expect(view.queryByRole('button', { name: 'Preview request' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Send request' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Save defaults' })).toBeNull();
    expect(view.getByRole('button', { name: 'Reload defaults' })).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'New draft' })).toBeInTheDocument();
  });

  test('cancels plan id edits without applying the draft value', async () => {
    setRouteHandlers({
      'GET /api/subscription/defaults': async () => jsonResponse(createDefaultsResponse()),
      'POST /api/subscription/preview': async () =>
        jsonResponse({
          request: {
            name: 'subscription:create:default',
            method: 'POST',
            url: 'https://gateway.example.test/subscription',
            headers: { Authorization: 'ApiKey ****-token' },
            payload: {
              merchant_ref: 'preview-merchant',
            },
          },
        }),
    });

    const view = renderSubscriptionPage();

    await view.findByRole('heading', { name: 'Subscription' });

    await updatePlanIdFromModal(view, 'cancelled-plan-id', 'Cancel');

    expect(view.queryByRole('dialog')).toBeNull();
    expect(view.getByText('plan-default')).toBeInTheDocument();
    expect(view.queryByText('cancelled-plan-id')).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === '/api/subscription/preview');
    expect(previewCall?.body?.channelValues.subs_plan_id).toBeUndefined();
  });
});
