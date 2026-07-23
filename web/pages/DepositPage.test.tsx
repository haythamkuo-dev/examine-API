/// <reference lib="dom" />

import '../../tests/web-setup';
import { beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { DEPOSIT_CHANNELS } from '../../src/core/env';
import { targetEnvironmentHeaderName } from '../../src/core/targetEnvironment';
import type {
  DepositCreateResponse,
  DepositDefaultsResponse,
  DepositDefaultsSavedResponse,
  DepositFieldMap,
  DepositFormValues,
  DepositMerchantRefResponse,
  DepositPreviewResponse,
  DepositRequestValues,
} from '../../src/deposit/web';
import { DepositPage } from './DepositPage';
import { AppThemeProvider } from './pageChrome';
import { ModalProvider } from './utils/modal';
import { getDepositChannelLabel } from './helper/depositChannelLabels';

const defaultsEndpoint = '/api/deposit/defaults';
const previewEndpoint = '/api/deposit/preview';
const createEndpoint = '/api/deposit/create';
const merchantRefEndpoint = '/api/deposit/merchant-ref';

const primaryChannel = DEPOSIT_CHANNELS[0];
const secondaryChannel = DEPOSIT_CHANNELS[1];
const specialDepositChannels = DEPOSIT_CHANNELS.filter(
  (channel): channel is 'bdt_worldpay' | 'inr_upi' =>
    channel === 'bdt_worldpay' || channel === 'inr_upi',
);
const [firstSpecialDepositChannel, secondSpecialDepositChannel] = specialDepositChannels;

if (!primaryChannel || !secondaryChannel || !firstSpecialDepositChannel || !secondSpecialDepositChannel) {
  throw new Error('Deposit channels are not configured.');
}

type FetchRequestRecord = {
  body: DepositRequestValues | null;
  headers: Headers;
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
  apiKey: `api-key-${channel}`,
  availableChannels: [primaryChannel, secondaryChannel, ...specialDepositChannels],
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

const createMerchantRefResponse = (merchantRef: string): DepositMerchantRefResponse => ({
  ok: true,
  merchantRef,
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
  apiKey: `saved-api-key-${channel}`,
  availableChannels: [primaryChannel, secondaryChannel, ...specialDepositChannels],
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

const renderDepositPage = () => {
  const view = render(
    <AppThemeProvider>
      <ModalProvider>
        <DepositPage />
      </ModalProvider>
    </AppThemeProvider>,
  );

  return { ...view, ...within(view.container) };
};

const updateApiKeyFromModal = async (
  view: ReturnType<typeof renderDepositPage>,
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

const setRouteHandlers = (handlers: Record<string, MockRouteHandler>): void => {
  routeHandlers = new Map(Object.entries(handlers));
};

const readPostedForm = (body: BodyInit | null | undefined): DepositRequestValues | null => {
  if (typeof body !== 'string' || !body.trim()) {
    return null;
  }

  return JSON.parse(body) as DepositRequestValues;
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

describe('DepositPage', () => {
  test('translates deposit channel labels without changing channel values', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () =>
        jsonResponse(createDefaultsResponse('southafrica_cards')),
    });

    const view = renderDepositPage();
    await view.findByRole('heading', { name: 'Deposit' });
    await view.findByText('Request builder');

    const channelSelect = view.getByLabelText('Channel');
    expect(within(channelSelect).getByRole('option', { name: '南非卡' })).toHaveValue('southafrica_cards');
    expect(getDepositChannelLabel('unknown_channel')).toBe('unknown_channel');
  });

  test('loads defaults and renders the request builder', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
    });

    const view = renderDepositPage();

    expect(view.getByText('Loading server-side defaults for the selected channel.')).toBeInTheDocument();
    expect(view.container.querySelector('svg.animate-spin')).toBeInTheDocument();

    await view.findByRole('heading', { name: 'Deposit' });
    await view.findByText('Request builder');

    expect(view.getByText('Request builder')).toBeInTheDocument();
    expect(view.getByLabelText('Channel')).toHaveValue(primaryChannel);
    expect(view.getByText(`api-key-${primaryChannel}`)).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Edit API key' })).toBeInTheDocument();
    expect(view.getByLabelText('Merchant reference *')).toHaveValue(`MERCHANT-${primaryChannel}`);
    expect(view.getByLabelText('Merchant reference *')).toHaveAttribute('readonly');
  });

  test('wraps request fields in a scroll container with a max height', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });
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
        jsonResponse(createPreviewResponse(`PREVIEW-${primaryChannel}`)),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });
    await view.findByText('Request builder');
    await view.findByLabelText('Currency code *');

    await act(async () => {
      fireEvent.change(view.getByLabelText('Currency code *'), {
        target: { value: 'USD' },
      });
      fireEvent.click(view.getByLabelText('Approval required'));
      fireEvent.click(view.getByLabelText('Enabled flag'));
    });

    await updateApiKeyFromModal(view, 'typed-deposit-key');

    await waitFor(() => {
      expect(view.getByLabelText('Currency code *')).toHaveValue('USD');
      expect(view.getByText('typed-deposit-key')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    await waitFor(() => {
      expect(view.queryByText('Preview completed.')).toBeNull();
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.apiKey).toBe('typed-deposit-key');
    expect(previewCall?.body?.commonValues.currencyCode).toBe('USD');

    const channelValues = previewCall?.body?.channelValues as {
      approvalRequired: boolean;
      collects: Array<{ countryCode: string; enabled: boolean; referenceTag: string }>;
      payment_order: { callbackKey: string; gatewayNote: string };
    };

    expect(channelValues.approvalRequired).toBe(true);
    expect(channelValues.collects[0]?.enabled).toBe(false);
    expect(view.getByLabelText('Merchant reference *')).toHaveValue(`PREVIEW-${primaryChannel}`);
    expect(view.getAllByText(new RegExp(`"merchant_ref": "PREVIEW-${primaryChannel}"`))).toHaveLength(1);
    expect(view.queryByText('deposit:preview:test')).toBeNull();
    expect(view.queryByText('https://gateway.example.test/deposit')).toBeNull();
  });

  test('loads channel-specific defaults and restores prior channel drafts when switching channels', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      [`GET /api/deposit/defaults?channel=${primaryChannel}`]: async () =>
        jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/preview': async () =>
        jsonResponse(createPreviewResponse(`SWITCH-${primaryChannel}`)),
      'POST /api/deposit/merchant-ref': async () => jsonResponse(createMerchantRefResponse('GENERATED-001')),
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

    await view.findByRole('heading', { name: 'Deposit' });
    await view.findByRole('button', { name: 'Generate' });

    await updateApiKeyFromModal(view, 'typed-deposit-key');

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await view.findByText('Merchant reference generated.');

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: secondaryChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('MERCHANT-SECONDARY');
    });

    expect(view.getByRole('textbox', { name: /Product number/ })).toHaveValue('PROD-SECONDARY');
    expect(view.getByText('typed-deposit-key')).toBeInTheDocument();
    expect(view.queryByText(`api-key-${secondaryChannel}`)).toBeNull();

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: primaryChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-001');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.apiKey).toBe('typed-deposit-key');
  });

  test('switching to a special deposit channel resets the api key to that channel default', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      [`GET /api/deposit/defaults?channel=${firstSpecialDepositChannel}`]: async () =>
        jsonResponse(createDefaultsResponse(firstSpecialDepositChannel)),
      'POST /api/deposit/preview': async () =>
        jsonResponse(createPreviewResponse(`SPECIAL-${firstSpecialDepositChannel}`)),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });
    await view.findByRole('button', { name: 'Edit API key' });
    await updateApiKeyFromModal(view, 'typed-deposit-key');

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: firstSpecialDepositChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByText(`api-key-${firstSpecialDepositChannel}`)).toBeInTheDocument();
    });

    expect(view.queryByText('typed-deposit-key')).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.apiKey).toBe(`api-key-${firstSpecialDepositChannel}`);
  });

  test('switching from a special deposit channel back to a normal channel resets the api key to the normal default', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      [`GET /api/deposit/defaults?channel=${firstSpecialDepositChannel}`]: async () =>
        jsonResponse(createDefaultsResponse(firstSpecialDepositChannel)),
      [`GET /api/deposit/defaults?channel=${secondSpecialDepositChannel}`]: async () =>
        jsonResponse(createDefaultsResponse(secondSpecialDepositChannel)),
      [`GET /api/deposit/defaults?channel=${primaryChannel}`]: async () =>
        jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/preview': async () =>
        jsonResponse(createPreviewResponse(`RESET-${primaryChannel}`)),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: firstSpecialDepositChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByText(`api-key-${firstSpecialDepositChannel}`)).toBeInTheDocument();
    });

    await updateApiKeyFromModal(view, 'typed-special-deposit-key');

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: primaryChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByText(`api-key-${primaryChannel}`)).toBeInTheDocument();
    });

    expect(view.queryByText('typed-special-deposit-key')).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.apiKey).toBe(`api-key-${primaryChannel}`);
  });

  test('generates a new merchant reference and keeps it while shared fields change', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/merchant-ref': async () => jsonResponse(createMerchantRefResponse('GENERATED-002')),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });
    await view.findByRole('button', { name: 'Generate' });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-002');
    });

    expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-002');
    const productNoField = view.getByRole('textbox', { name: /Product number/ });
    expect(productNoField).toHaveProperty('readOnly', true);
    expect(view.getByText('ReadOnly')).toBeInTheDocument();
    expect(productNoField).toHaveValue(`PROD-${primaryChannel}`);
  });

  test('keeps the existing merchant reference when generation fails', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/merchant-ref': async () =>
        textResponse('generator unavailable', { status: 500, statusText: 'Internal Server Error' }),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await view.findByText('generator unavailable');
    expect(view.getByLabelText('Merchant reference *')).toHaveValue(`MERCHANT-${primaryChannel}`);
  });

  test('keeps the generated merchant reference when reloading defaults', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      [`GET /api/deposit/defaults?channel=${primaryChannel}`]: async () =>
        jsonResponse(
          createDefaultsResponse(primaryChannel, {
            form: createForm(primaryChannel, {
              commonValues: {
                merchantRef: 'MERCHANT-RELOADED',
                productNo: 'PROD-RELOADED',
              },
            }),
          }),
        ),
      'POST /api/deposit/merchant-ref': async () => jsonResponse(createMerchantRefResponse('GENERATED-003')),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-003');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Reload defaults' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-003');
    });

    expect(view.getByRole('textbox', { name: /Product number/ })).toHaveValue(`PROD-${primaryChannel}`);
  });

  test('resets the api key to the backend default when the environment changes', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      [`GET /api/deposit/defaults?channel=${primaryChannel}`]: async () =>
        jsonResponse(
          createDefaultsResponse(primaryChannel, {
            apiKey: 'product-deposit-key',
          }),
        ),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });

    await updateApiKeyFromModal(view, 'typed-deposit-key');

    expect(view.getByText('typed-deposit-key')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: '產品' }));
    });

    await waitFor(() => {
      expect(view.getByText('product-deposit-key')).toBeInTheDocument();
    });

    const productDefaultsCall = fetchRecords.find(
      (record) =>
        record.method === 'GET' &&
        record.url === `${defaultsEndpoint}?channel=${primaryChannel}` &&
        record.headers.get(targetEnvironmentHeaderName) === 'product',
    );

    expect(productDefaultsCall).toBeDefined();
  });

  test('new draft resets the merchant reference to the backend default', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      [`GET /api/deposit/defaults?channel=${primaryChannel}`]: async () =>
        jsonResponse(
          createDefaultsResponse(primaryChannel, {
            form: createForm(primaryChannel, {
              commonValues: {
                merchantRef: 'MERCHANT-NEW-DRAFT',
              },
            }),
          }),
        ),
      'POST /api/deposit/merchant-ref': async () => jsonResponse(createMerchantRefResponse('GENERATED-004')),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-004');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'New draft' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('MERCHANT-NEW-DRAFT');
    });
  });

  test('submits create requests and shows the API result', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/create': async () => jsonResponse(createResponseBody),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Send request' }));
    });

    await view.findByText('Request sent successfully.');
    expect(view.getByText(/"response":/)).toBeInTheDocument();
    expect(view.queryByText(/"requestName": "deposit:create:test"/)).toBeNull();
    expect(view.getAllByText('模式 沙盒 · 目標 沙盒代理').length).toBeGreaterThan(0);
    expect(view.getByText('/api/deposit/create')).toBeInTheDocument();
  });

  test('preview replaces the current merchant reference and create reuses it', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/preview': async (request) =>
        jsonResponse(createPreviewResponse(`PREVIEW-${request.body?.commonValues.merchantRef}`)),
      'POST /api/deposit/create': async (request) => {
        expect(request.body?.commonValues.merchantRef).toBe(`PREVIEW-MERCHANT-${primaryChannel}`);
        return jsonResponse(createResponseBody);
      },
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });
    expect(view.getByLabelText('Merchant reference *')).toHaveValue(`MERCHANT-${primaryChannel}`);

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue(`PREVIEW-MERCHANT-${primaryChannel}`);
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Send request' }));
    });

    await view.findByText('Request sent successfully.');
  });

  test('toggles the operator environment mode and persists the selected target', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/merchant-ref': async () => jsonResponse(createMerchantRefResponse('GENERATED-ENV')),
    });

    const firstView = renderDepositPage();

    await firstView.findByRole('heading', { name: 'Deposit' });
    expect(firstView.getByText('環境: 沙盒')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(firstView.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(firstView.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-ENV');
    });

    await act(async () => {
      fireEvent.click(firstView.getByRole('button', { name: '產品' }));
    });

    await waitFor(() => {
      expect(firstView.getByText('環境: 產品')).toBeInTheDocument();
    });

    expect(localStorage.getItem('examine-api.operator-environment')).toBe('product');

    firstView.unmount();

    const secondView = renderDepositPage();

    await secondView.findByRole('heading', { name: 'Deposit' });
    expect(secondView.getByText('環境: 產品')).toBeInTheDocument();
    expect(secondView.getByLabelText('Merchant reference *')).toHaveValue(`MERCHANT-${primaryChannel}`);
  });

  test('new draft resets the current merchant reference without affecting the local api key draft', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/merchant-ref': async () => jsonResponse(createMerchantRefResponse('GENERATED-SAVE')),
      [`GET /api/deposit/defaults?channel=${primaryChannel}`]: async () =>
        jsonResponse(
          createDefaultsResponse(primaryChannel, {
            form: createForm(primaryChannel, {
              commonValues: {
                merchantRef: 'MERCHANT-RESET-SERVER',
              },
            }),
          }),
        ),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });
    await updateApiKeyFromModal(view, 'typed-deposit-key');

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-SAVE');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'New draft' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('MERCHANT-RESET-SERVER');
    });
    expect(view.getByText('typed-deposit-key')).toBeInTheDocument();
  });

  test('cancels api key edits without applying the draft value', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () => jsonResponse(createDefaultsResponse(primaryChannel)),
      'POST /api/deposit/preview': async () => jsonResponse(createPreviewResponse(`PREVIEW-${primaryChannel}`)),
    });

    const view = renderDepositPage();

    await view.findByRole('heading', { name: 'Deposit' });

    await updateApiKeyFromModal(view, 'cancelled-deposit-key', 'Cancel');

    expect(view.queryByRole('dialog')).toBeNull();
    expect(view.getByText(`api-key-${primaryChannel}`)).toBeInTheDocument();
    expect(view.queryByText('cancelled-deposit-key')).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    await waitFor(() => {
      expect(view.queryByText('Preview completed.')).toBeNull();
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.apiKey).toBe(`api-key-${primaryChannel}`);
  });

  test('shows an error state when loading defaults fails', async () => {
    setRouteHandlers({
      'GET /api/deposit/defaults': async () =>
        textResponse('defaults unavailable', { status: 503, statusText: 'Service Unavailable' }),
    });

    const view = renderDepositPage();

    await view.findByText('API 503 from /api/deposit/defaults: defaults unavailable');
    expect(view.container.querySelector('svg.animate-spin')).not.toBeInTheDocument();
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

    await view.findByRole('heading', { name: 'Deposit' });

    await act(async () => {
      fireEvent.change(view.getByRole('textbox', { name: /Product number/ }), {
        target: { value: '' },
      });
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    await view.findByText('API 400 from /api/deposit/preview: commonValues.productNo is required');
  });
});
