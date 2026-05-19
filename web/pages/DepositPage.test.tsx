/// <reference lib="dom" />

import '../../tests/web-setup';
import { beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { DEPOSIT_CHANNELS } from '../../src/core/env';
import type {
  DepositCreateResponse,
  DepositDefaultsResponse,
  DepositDefaultsSavedResponse,
  DepositFieldMap,
  DepositFormValues,
  DepositPreviewResponse,
} from '../../src/deposit/web';
import { DepositPage } from './DepositPage';
import { AppThemeProvider } from './pageChrome';

const defaultsEndpoint = '/api/deposit/defaults';
const previewEndpoint = '/api/deposit/preview';
const createEndpoint = '/api/deposit/create';

const primaryChannel = DEPOSIT_CHANNELS[0];
const secondaryChannel = DEPOSIT_CHANNELS[1];

if (!primaryChannel || !secondaryChannel) {
  throw new Error('Deposit channels are not configured.');
}

type FetchRequestRecord = {
  body: DepositFormValues | null;
  method: string;
  url: string;
};

type MockRouteHandler = (request: FetchRequestRecord) => Response | Promise<Response>;

const commonSchema: DepositFieldMap = {
  productNo: {
    kind: 'text',
    label: 'Product number',
    required: true,
  },
  merchantRef: {
    kind: 'text',
    label: 'Merchant reference',
    required: true,
  },
  amount: {
    kind: 'text',
    label: 'Amount',
    required: true,
  },
  currencyCode: {
    kind: 'select',
    label: 'Currency code',
    required: true,
    options: [
      { label: 'US Dollar', value: 'USD' },
      { label: 'South African Rand', value: 'ZAR' },
      { label: 'Japanese Yen', value: 'JPY' },
    ],
  },
  returnUrl: {
    kind: 'text',
    label: 'Return URL',
    required: true,
  },
  operatorNote: {
    kind: 'textarea',
    label: 'Operator note',
  },
};

const channelSchema: DepositFieldMap = {
  approvalRequired: {
    kind: 'boolean',
    label: 'Approval required',
  },
  payment_order: {
    kind: 'object',
    label: 'Payment order',
    fields: {
      callbackKey: {
        kind: 'text',
        label: 'Callback key',
        required: true,
      },
      gatewayNote: {
        kind: 'textarea',
        label: 'Gateway note',
      },
    },
  },
  collects: {
    kind: 'array',
    label: 'Collects',
    itemLabel: 'Collect',
    itemSchema: {
      kind: 'object',
      label: 'Collect item',
      fields: {
        countryCode: {
          kind: 'text',
          label: 'Country code',
          required: true,
        },
        referenceTag: {
          kind: 'text',
          label: 'Reference tag',
        },
        enabled: {
          kind: 'boolean',
          label: 'Enabled flag',
        },
      },
    },
  },
};

const createForm = (channel: typeof primaryChannel, overrides?: Partial<DepositFormValues>): DepositFormValues => ({
  channel,
  commonValues: {
    productNo: `PROD-${channel}`,
    merchantRef: `MERCHANT-${channel}`,
    amount: '50.00',
    currencyCode: channel === secondaryChannel ? 'JPY' : 'ZAR',
    returnUrl: `https://merchant.example.com/${channel}`,
    ...(overrides?.commonValues ?? {}),
  },
  channelValues: {
    approvalRequired: false,
    payment_order: {
      callbackKey: `callback-${channel}`,
      gatewayNote: `note-${channel}`,
    },
    collects: [
      {
        countryCode: channel === secondaryChannel ? 'JP' : 'ZA',
        referenceTag: `reference-${channel}`,
        enabled: true,
      },
    ],
    ...(overrides?.channelValues ?? {}),
  },
});

const createDefaultsResponse = (
  channel: typeof primaryChannel,
  overrides?: Partial<DepositDefaultsResponse>,
): DepositDefaultsResponse => ({
  availableChannels: [primaryChannel, secondaryChannel],
  channel,
  commonSchema,
  channelSchema,
  form: createForm(channel, overrides?.form),
  ...overrides,
});

const createPreviewResponse = (merchantRef: string): DepositPreviewResponse => ({
  request: {
    name: 'deposit:preview:test',
    method: 'POST',
    url: 'https://gateway.example.test/deposit',
    headers: {
      Authorization: 'ApiKey ****token',
    },
    payload: {
      merchant_ref: merchantRef,
    },
  },
});

const createResponseBody: DepositCreateResponse = {
  requestName: 'deposit:create:test',
  ok: true,
  status: 200,
  request: {
    method: 'POST',
    url: 'https://gateway.example.test/deposit',
    payload: {
      ok: true,
    },
  },
  response: {
    ok: true,
  },
  message: 'create completed',
  durationMs: 5,
};

const createSavedDefaultsResponse = (
  channel: typeof primaryChannel,
  productNo: string,
): DepositDefaultsSavedResponse => ({
  ok: true,
  availableChannels: [primaryChannel, secondaryChannel],
  channel,
  commonSchema,
  channelSchema,
  form: createForm(channel, {
    commonValues: {
      productNo,
    },
  }),
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

const renderDepositPage = () =>
  render(
    <AppThemeProvider>
      <DepositPage />
    </AppThemeProvider>,
  );

const setRouteHandlers = (handlers: Record<string, MockRouteHandler>): void => {
  routeHandlers = new Map(Object.entries(handlers));
};

const readPostedForm = (body: BodyInit | null | undefined): DepositFormValues | null => {
  if (typeof body !== 'string' || !body.trim()) {
    return null;
  }

  return JSON.parse(body) as DepositFormValues;
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

describe('DepositPage', () => {
  test('loads defaults and renders the request builder', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
    });

    const view = renderDepositPage();

    expect(view.getByText('Loading server-side defaults for the selected channel.')).toBeInTheDocument();

    await view.findByRole('heading', { name: 'Deposit Operator Console' });
    await view.findByText('Request builder');

    expect(view.getByText('Request builder')).toBeInTheDocument();
    expect(view.getByLabelText('Channel')).toHaveValue(primaryChannel);
    expect(view.getByLabelText('Merchant reference *')).toHaveValue(`MERCHANT-${primaryChannel}`);
  });

  test('wraps request fields in a scroll container with a max height', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit Operator Console' });
    await view.findByText('Request builder');

    const fieldsContainer = view.getByTestId('request-builder-fields');

    expect(fieldsContainer).toBeInTheDocument();
    expect(fieldsContainer.className).toContain('overflow-y-auto');
    expect(fieldsContainer.className).toContain('max-h-[32rem]');
    expect(fieldsContainer.className).toContain('lg:max-h-[calc(100vh-18rem)]');
  });

  test('submits the edited form to preview and renders the preview payload', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/preview': async () =>
        jsonResponse(createPreviewResponse(`MERCHANT-${primaryChannel}`)),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit Operator Console' });
    await view.findByText('Request builder');
    await view.findByLabelText('Currency code *');

    await act(async () => {
      fireEvent.change(view.getByLabelText('Currency code *'), {
        target: { value: 'USD' },
      });
      fireEvent.click(view.getByLabelText('Approval required'));
      fireEvent.click(view.getByLabelText('Enabled flag'));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Currency code *')).toHaveValue('USD');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    await view.findByText('Preview completed.');

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.commonValues.currencyCode).toBe('USD');

    const channelValues = previewCall?.body?.channelValues as {
      approvalRequired: boolean;
      collects: Array<{ countryCode: string; enabled: boolean; referenceTag: string }>;
      payment_order: { callbackKey: string; gatewayNote: string };
    };

    expect(channelValues.approvalRequired).toBe(true);
    expect(channelValues.collects[0]?.enabled).toBe(false);
    expect(view.getAllByText(new RegExp(`"merchant_ref": "MERCHANT-${primaryChannel}"`))).toHaveLength(2);
  });

  test('reloads channel defaults when the selected channel changes', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      [`GET /api/deposit/defaults?channel=${secondaryChannel}`]: async () =>
        jsonResponse(
          createDefaultsResponse(secondaryChannel, {
            form: createForm(secondaryChannel, {
              commonValues: {
                merchantRef: 'MERCHANT-SECONDARY',
                productNo: 'PROD-SECONDARY',
              },
            }),
          }),
        ),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit Operator Console' });

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: secondaryChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('MERCHANT-SECONDARY');
    });

    expect(view.getByLabelText('Product number *')).toHaveValue('PROD-SECONDARY');
  });

  test('submits create requests and shows the API result', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/create': async () => jsonResponse(createResponseBody),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit Operator Console' });
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Send request' }));
    });

    await view.findByText('Request sent successfully.');
    expect(view.getByText(/"requestName": "deposit:create:test"/)).toBeInTheDocument();
    expect(view.getAllByText('模式 本地 · 目標 本地代理').length).toBeGreaterThan(0);
    expect(view.getByText('/api/deposit/create')).toBeInTheDocument();
  });

  test('toggles the operator environment mode and persists the selected target', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
    });

    const firstView = renderDepositPage();

    await firstView.findByRole('heading', { name: 'Deposit Operator Console' });
    expect(firstView.getByText('環境: 本地')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(firstView.getByRole('button', { name: '線上' }));
    });

    await waitFor(() => {
      expect(firstView.getByText('環境: 線上')).toBeInTheDocument();
    });

    expect(localStorage.getItem('examine-api.operator-environment')).toBe('online');

    firstView.unmount();

    const secondView = renderDepositPage();

    await secondView.findByRole('heading', { name: 'Deposit Operator Console' });
    expect(secondView.getByText('環境: 線上')).toBeInTheDocument();
  });

  test('saves defaults and applies the returned bundle', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      [`PUT /api/deposit/defaults?channel=${primaryChannel}`]: async () =>
        jsonResponse(createSavedDefaultsResponse(primaryChannel, 'PROD-SAVED')),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit Operator Console' });
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Save defaults' }));
    });

    await view.findByText(`Saved defaults for ${primaryChannel}.`);
    expect(view.getByLabelText('Product number *')).toHaveValue('PROD-SAVED');
  });

  test('shows an error state when loading defaults fails', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () =>
        textResponse('defaults unavailable', { status: 503, statusText: 'Service Unavailable' }),
    });

    const view = renderDepositPage();

    await view.findByText('API 503 from /api/deposit/defaults: defaults unavailable');
    expect(view.queryByRole('heading', { name: 'Request builder' })).not.toBeInTheDocument();
  });

  test('shows API diagnostics when preview fails after a required field is cleared', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/preview': async () =>
        textResponse('commonValues.productNo is required', {
          status: 400,
          statusText: 'Bad Request',
        }),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit Operator Console' });

    await act(async () => {
      fireEvent.change(view.getByLabelText('Product number *'), {
        target: { value: '' },
      });
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    await view.findByText('API 400 from /api/deposit/preview: commonValues.productNo is required');
    expect(view.getByText('commonValues.productNo is required')).toBeInTheDocument();
  });
});
