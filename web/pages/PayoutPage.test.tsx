/// <reference lib="dom" />

import '../../tests/web-setup';
import { beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { PAYOUT_CHANNELS } from '../../src/core/env';
import { targetEnvironmentHeaderName } from '../../src/core/targetEnvironment';
import type {
  PayoutCreateResponse,
  PayoutDefaultsResponse,
  PayoutDefaultsSavedResponse,
  PayoutFieldMap,
  PayoutFormValues,
  PayoutMerchantReferenceResponse,
  PayoutRequestValues,
} from '../../src/payout/web';
import { normalizeCreateResult, PayoutPage, shouldHidePayoutField } from './PayoutPage';
import { AppThemeProvider } from './pageChrome';
import { ModalProvider } from './utils/modal';
import { getPayoutChannelLabel } from './helper/payoutChannelLabels';

const defaultsEndpoint = '/api/payout/defaults';
const previewEndpoint = '/api/payout/preview';
const createEndpoint = '/api/payout/create';
const merchantReferenceEndpoint = '/api/payout/merchant-reference';

const primaryChannel = PAYOUT_CHANNELS[0];
const secondaryChannel = PAYOUT_CHANNELS[1];
const specialPayoutChannels = PAYOUT_CHANNELS.filter(
  (channel): channel is 'imps' | 'bd_wallet' => channel === 'imps' || channel === 'bd_wallet',
);
const [firstSpecialPayoutChannel, secondSpecialPayoutChannel] = specialPayoutChannels;

if (!primaryChannel || !secondaryChannel || !firstSpecialPayoutChannel || !secondSpecialPayoutChannel) {
  throw new Error('Payout channels are not configured.');
}

type FetchRequestRecord = {
  body: PayoutRequestValues | null;
  headers: Headers;
  method: string;
  url: string;
};

type MockRouteHandler = (request: FetchRequestRecord) => Response | Promise<Response>;

const commonSchema: PayoutFieldMap = {
  merchantReference: {
    kind: 'text',
    label: 'Merchant reference',
    required: true,
  },
};

const channelSchema: PayoutFieldMap = {
  product_no: {
    kind: 'text',
    label: 'Product number',
    required: true,
  },
  amount: {
    kind: 'object',
    label: 'Amount',
    fields: {
      amount: {
        kind: 'text',
        label: 'Amount',
        required: true,
      },
      currency_code: {
        kind: 'text',
        label: 'Currency code',
        required: true,
      },
    },
  },
  optional_note: {
    kind: 'text',
    label: 'Optional note',
  },
  remitter: {
    kind: 'object',
    label: 'Remitter',
    fields: {
      optional_name: {
        kind: 'text',
        label: 'Optional name',
      },
      optional_city: {
        kind: 'text',
        label: 'Optional city',
      },
    },
  },
  beneficiary: {
    kind: 'object',
    label: 'Beneficiary',
    fields: {
      required_name: {
        kind: 'text',
        label: 'Required name',
        required: true,
      },
      optional_identification: {
        kind: 'text',
        label: 'Optional identification',
      },
    },
  },
};

const createForm = (channel: typeof primaryChannel, overrides?: Partial<PayoutFormValues>): PayoutFormValues => ({
  channel,
  commonValues: {
    merchantReference: `merchant-${channel}`,
    ...(overrides?.commonValues ?? {}),
  },
  channelValues: {
    product_no: `product-${channel}`,
    amount: {
      amount: '15.00',
      currency_code: channel === secondaryChannel ? 'USD' : 'COP',
    },
    optional_note: '付款人姓名 (非必填)',
    remitter: {
      optional_name: '付款人姓名 (非必填)',
      optional_city: '城市 (非必填)',
    },
    beneficiary: {
      required_name: `Beneficiary ${channel}`,
      optional_identification: '其他識別編號 (非必填)',
    },
    ...(overrides?.channelValues ?? {}),
  },
});

const createDefaultsResponse = (
  channel: typeof primaryChannel,
  overrides?: Partial<PayoutDefaultsResponse>,
): PayoutDefaultsResponse => ({
  apiKey: `api-key-${channel}`,
  availableChannels: [primaryChannel, secondaryChannel, ...specialPayoutChannels],
  channel,
  commonSchema,
  channelSchema,
  form: createForm(channel, overrides?.form),
  ...overrides,
});

const createSavedDefaultsResponse = (
  channel: typeof primaryChannel,
  productNo: string,
): PayoutDefaultsSavedResponse => ({
  ok: true,
  apiKey: `saved-api-key-${channel}`,
  availableChannels: [primaryChannel, secondaryChannel, ...specialPayoutChannels],
  channel,
  commonSchema,
  channelSchema,
  form: createForm(channel, {
    channelValues: {
      product_no: productNo,
    },
  }),
});

const createMerchantReferenceResponse = (
  merchantReference: string,
): PayoutMerchantReferenceResponse => ({
  ok: true,
  merchantReference,
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

const renderPayoutPage = () => {
  const view = render(
    <AppThemeProvider>
      <ModalProvider>
        <PayoutPage />
      </ModalProvider>
    </AppThemeProvider>,
  );

  return { ...view, ...within(view.container) };
};

const updateApiKeyFromModal = async (
  view: ReturnType<typeof renderPayoutPage>,
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

const setRouteHandler = (url: string, handler: MockRouteHandler) => {
  routeHandlers.set(url, handler);
};

beforeEach(() => {
  fetchRecords.length = 0;
  routeHandlers = new Map<string, MockRouteHandler>();
  localStorage.clear();
  sessionStorage.clear();

  setRouteHandler(defaultsEndpoint, () => jsonResponse(createDefaultsResponse(primaryChannel)));

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const rawBody = typeof init?.body === 'string' ? init.body : null;
    const body = rawBody ? (JSON.parse(rawBody) as PayoutRequestValues) : null;

    fetchRecords.push({ url, method, body, headers: new Headers(init?.headers) });

    const [pathname] = url.split('?');
    const handler = routeHandlers.get(pathname);
    if (!handler) {
      throw new Error(`Unhandled fetch for ${method} ${url}`);
    }

    return await handler({ url, method, body });
  }) as typeof fetch;
});

describe('shouldHidePayoutField', () => {
  test('hides optional placeholder-only scalar fields', () => {
    expect(shouldHidePayoutField(channelSchema.optional_note, '付款人姓名 (非必填)')).toBe(true);
  });

  test('keeps required fields visible', () => {
    expect(shouldHidePayoutField(commonSchema.merchantReference, '   ')).toBe(false);
  });

  test('keeps optional fields visible when they have real values', () => {
    expect(shouldHidePayoutField(channelSchema.optional_note, 'Operator provided note')).toBe(false);
  });

  test('hides optional object containers when all descendants are placeholder-only', () => {
    expect(
      shouldHidePayoutField(channelSchema.remitter, {
        optional_name: '付款人姓名 (非必填)',
        optional_city: '城市 (非必填)',
      }),
    ).toBe(true);
  });

  test('keeps object containers visible when they contain a visible descendant', () => {
    expect(
      shouldHidePayoutField(channelSchema.beneficiary, {
        required_name: 'E2E Beneficiary',
        optional_identification: '其他識別編號 (非必填)',
      }),
    ).toBe(false);
  });
});

describe('normalizeCreateResult', () => {
  test('returns a success banner model for JSON object payloads', async () => {
    const response = new Response(
      JSON.stringify({
        requestName: 'payout:create:co_bank',
        ok: true,
        status: 200,
        request: { method: 'POST', url: 'https://example.test', payload: { value: 1 } },
        response: { ok: true },
        durationMs: 10,
      } satisfies PayoutCreateResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

    const result = await normalizeCreateResult(response);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.message).toBe('Request sent successfully.');
    expect(result.raw).toEqual({ response: { ok: true } });
  });

  test('builds a single normalized failure envelope for non-JSON responses', async () => {
    const response = new Response('gateway failed', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/plain' },
    });

    const result = await normalizeCreateResult(response);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.message).toBe('gateway failed');
    expect(result.details).toBeUndefined();
    expect(result.raw).toEqual({
      response: {
        status: 502,
        code: 'UNKNOWN_ERROR',
        message: 'gateway failed',
      },
    });
  });
});

describe('PayoutPage', () => {
  test('translates payout channel labels without changing channel values', async () => {
    setRouteHandler(defaultsEndpoint, () => jsonResponse(createDefaultsResponse('co_bank')));

    const view = renderPayoutPage();
    await view.findByRole('heading', { name: 'Payout' });
    await view.findByText('Request builder');

    const channelSelect = view.getByLabelText('Channel');
    expect(within(channelSelect).getByRole('option', { name: '哥倫比亞銀行轉帳' })).toHaveValue('co_bank');
    expect(getPayoutChannelLabel('unknown_channel')).toBe('unknown_channel');
  });

  test('renders a read-only merchant reference field and updates it via generate', async () => {
    setRouteHandler(merchantReferenceEndpoint, () =>
      jsonResponse(createMerchantReferenceResponse('GENERATED-PAYOUT-001')),
    );

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Generate' })).toBeEnabled();
    });

    expect(view.getByLabelText('Merchant reference *')).toHaveAttribute('readonly');
    expect(view.getByText(`api-key-${primaryChannel}`)).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Edit API key' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-PAYOUT-001');
      expect(view.getByText('Merchant reference generated.')).toBeInTheDocument();
    });
  });

  test('renders preview API failures in the API result panel', async () => {
    const previewErrorMessage = 'product_no is invalid';

    setRouteHandler(defaultsEndpoint, () => jsonResponse(createDefaultsResponse(primaryChannel)));
    setRouteHandler(previewEndpoint, () =>
      jsonResponse(
        {
          ok: false,
          message: previewErrorMessage,
        },
        { status: 400 },
      ),
    );

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Preview request' })).toBeEnabled();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    await waitFor(() => {
      const resultHeading = view.getByRole('heading', { name: 'API result' });
      const resultCard = resultHeading.parentElement?.parentElement?.parentElement;

      expect(resultCard).not.toBeNull();
      expect(within(resultCard as HTMLElement).getByText(previewErrorMessage)).toBeInTheDocument();
      expect(within(resultCard as HTMLElement).getByText(/PREVIEW Status 400/)).toBeInTheDocument();
      expect(view.getByText(/Temporary session draft/).parentElement).not.toContainElement(
        view.getByText(previewErrorMessage),
      );
    });

    expect(view.getByText(/Run a preview to inspect the exact request body/)).toBeInTheDocument();
  });

  test('restores the channel-specific merchant reference draft when returning to a previous channel', async () => {
    setRouteHandler(merchantReferenceEndpoint, () =>
      jsonResponse(createMerchantReferenceResponse('GENERATED-PAYOUT-002')),
    );
    setRouteHandler(defaultsEndpoint, ({ url }) => {
      const parsedUrl = new URL(url, 'http://localhost');
      const channel = parsedUrl.searchParams.get('channel');

      if (channel === secondaryChannel) {
        return jsonResponse(
          createDefaultsResponse(secondaryChannel, {
            form: createForm(secondaryChannel, {
              commonValues: {
                merchantReference: 'merchant-secondary-server',
              },
              channelValues: {
                product_no: 'product-secondary-server',
              },
            }),
          }),
        );
      }

      return jsonResponse(
        createDefaultsResponse(primaryChannel, {
          form: createForm(primaryChannel, {
            commonValues: {
              merchantReference: 'merchant-primary-server',
            },
            channelValues: {
              product_no: 'product-primary-server',
            },
          }),
        }),
      );
    });
    setRouteHandler(previewEndpoint, () =>
      jsonResponse({
        request: {
          name: 'payout:preview:test',
          method: 'POST',
          url: 'https://gateway.example.test/payout',
          headers: {
            Authorization: 'ApiKey ****token',
          },
          payload: {
            merchant_reference: 'GENERATED-PAYOUT-002',
          },
        },
      }),
    );

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Generate' })).toBeEnabled();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-PAYOUT-002');
    });

    await updateApiKeyFromModal(view, 'typed-payout-key');

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: secondaryChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('merchant-secondary-server');
    });

    await waitFor(() => {
      const productNumber = view.getByLabelText(/Product number/);
      expect(productNumber).toHaveValue('product-secondary-server');
      expect(productNumber).toHaveAttribute('readonly');
      expect(productNumber).toHaveAttribute('aria-readonly', 'true');
    });

    expect(view.getByText('typed-payout-key')).toBeInTheDocument();
    expect(view.queryByText(`api-key-${secondaryChannel}`)).toBeNull();

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: primaryChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-PAYOUT-002');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.apiKey).toBe('typed-payout-key');
  });

  test('switching to a special payout channel resets the api key to that channel default', async () => {
    setRouteHandler(defaultsEndpoint, ({ url }) => {
      const parsedUrl = new URL(url, 'http://localhost');
      const channel = parsedUrl.searchParams.get('channel');

      if (channel === firstSpecialPayoutChannel) {
        return jsonResponse(createDefaultsResponse(firstSpecialPayoutChannel));
      }

      return jsonResponse(createDefaultsResponse(primaryChannel));
    });
    setRouteHandler(previewEndpoint, () =>
      jsonResponse({
        request: {
          name: 'payout:preview:test',
          method: 'POST',
          url: 'https://gateway.example.test/payout',
          headers: {
            Authorization: 'ApiKey ****token',
          },
          payload: {
            merchant_reference: `SPECIAL-${firstSpecialPayoutChannel}`,
          },
        },
      }),
    );

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Generate' })).toBeEnabled();
    });

    await updateApiKeyFromModal(view, 'typed-payout-key');

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: firstSpecialPayoutChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByText(`api-key-${firstSpecialPayoutChannel}`)).toBeInTheDocument();
    });

    expect(view.queryByText('typed-payout-key')).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.apiKey).toBe(`api-key-${firstSpecialPayoutChannel}`);
  });

  test('switching from a special payout channel back to a normal channel resets the api key to the normal default', async () => {
    setRouteHandler(defaultsEndpoint, ({ url }) => {
      const parsedUrl = new URL(url, 'http://localhost');
      const channel = parsedUrl.searchParams.get('channel');

      if (channel === firstSpecialPayoutChannel) {
        return jsonResponse(createDefaultsResponse(firstSpecialPayoutChannel));
      }

      if (channel === secondSpecialPayoutChannel) {
        return jsonResponse(createDefaultsResponse(secondSpecialPayoutChannel));
      }

      return jsonResponse(createDefaultsResponse(primaryChannel));
    });
    setRouteHandler(previewEndpoint, () =>
      jsonResponse({
        request: {
          name: 'payout:preview:test',
          method: 'POST',
          url: 'https://gateway.example.test/payout',
          headers: {
            Authorization: 'ApiKey ****token',
          },
          payload: {
            merchant_reference: `RESET-${primaryChannel}`,
          },
        },
      }),
    );

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Generate' })).toBeEnabled();
    });

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: firstSpecialPayoutChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByText(`api-key-${firstSpecialPayoutChannel}`)).toBeInTheDocument();
    });

    await updateApiKeyFromModal(view, 'typed-special-payout-key');

    await act(async () => {
      fireEvent.change(view.getByLabelText('Channel'), {
        target: { value: primaryChannel },
      });
    });

    await waitFor(() => {
      expect(view.getByText(`api-key-${primaryChannel}`)).toBeInTheDocument();
    });

    expect(view.queryByText('typed-special-payout-key')).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.apiKey).toBe(`api-key-${primaryChannel}`);
  });

  test('new draft resets the generated merchant reference to backend defaults', async () => {
    setRouteHandler(merchantReferenceEndpoint, () =>
      jsonResponse(createMerchantReferenceResponse('GENERATED-PAYOUT-003')),
    );
    setRouteHandler(defaultsEndpoint, ({ url }) => {
      const parsedUrl = new URL(url, 'http://localhost');

      if (parsedUrl.searchParams.get('channel') === primaryChannel) {
        return jsonResponse(
          createDefaultsResponse(primaryChannel, {
            form: createForm(primaryChannel, {
              commonValues: {
                merchantReference: 'merchant-reset-server',
              },
            }),
          }),
        );
      }

      return jsonResponse(
        createDefaultsResponse(primaryChannel),
      );
    });

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Generate' })).toBeEnabled();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('GENERATED-PAYOUT-003');
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'New draft' }));
    });

    await waitFor(() => {
      expect(view.getByLabelText('Merchant reference *')).toHaveValue('merchant-reset-server');
    });
  });

  test('keeps the current merchant reference when backend generation fails', async () => {
    setRouteHandler(merchantReferenceEndpoint, () =>
      textResponse('generator unavailable', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Generate' })).toBeEnabled();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Generate' }));
    });

    await waitFor(() => {
      expect(view.getByText('generator unavailable')).toBeInTheDocument();
    });

    expect(view.getByLabelText('Merchant reference *')).toHaveValue('merchant-co_bank');
  });

  test('shows a success banner after create succeeds', async () => {
    setRouteHandler(createEndpoint, () =>
      jsonResponse({
        requestName: 'payout:create:co_bank',
        ok: true,
        status: 200,
        request: { method: 'POST', url: 'https://gateway.example.test/payout', payload: { ok: true } },
        response: { ok: true },
        durationMs: 6,
      } satisfies PayoutCreateResponse),
    );

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Send request' })).toBeEnabled();
    });

    await updateApiKeyFromModal(view, 'typed-payout-key');

    await waitFor(() => {
      expect(view.getByText('typed-payout-key')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Send request' }));
    });

    await waitFor(() => {
      expect(view.getByText('Request sent successfully.')).toBeInTheDocument();
      expect(view.getByText('CREATE Status 200')).toBeInTheDocument();
      expect(view.getAllByText('模式 沙盒 · 目標 沙盒代理').length).toBeGreaterThan(0);
    });

    const createCall = fetchRecords.find((record) => record.method === 'POST' && record.url === createEndpoint);
    expect(createCall?.body?.apiKey).toBe('typed-payout-key');
  });

  test('preview replaces the current merchant reference with the backend-generated value and create reuses it', async () => {
    setRouteHandler(defaultsEndpoint, () =>
      jsonResponse(
        createDefaultsResponse(primaryChannel, {
          form: createForm(primaryChannel, {
            commonValues: {
              merchantReference: 'merchant-preview-start',
            },
          }),
        }),
      ),
    );
    setRouteHandler(previewEndpoint, ({ body }) =>
      jsonResponse({
        request: {
          name: 'payout:create:co_bank',
          method: 'POST',
          url: 'https://gateway.example.test/payout',
          headers: { Authorization: 'ApiKey ****-token' },
          payload: {
            merchant_reference: `preview-generated-${body?.commonValues.merchantReference}`,
          },
        },
      }),
    );
    setRouteHandler(createEndpoint, ({ body }) => {
      expect(body?.commonValues.merchantReference).toBe('preview-generated-merchant-preview-start');

      return jsonResponse({
        requestName: 'payout:create:co_bank',
        ok: true,
        status: 200,
        request: {
          method: 'POST',
          url: 'https://gateway.example.test/payout',
          payload: { merchant_reference: body?.commonValues.merchantReference },
        },
        response: { ok: true },
        durationMs: 6,
      } satisfies PayoutCreateResponse);
    });

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Preview request' })).toBeEnabled();
    });

    expect(view.getByLabelText('Merchant reference *')).toHaveValue('merchant-preview-start');

    await updateApiKeyFromModal(view, 'preview-payout-key');

    await waitFor(() => {
      expect(view.getByText('preview-payout-key')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    await waitFor(() => {
    expect(view.getByLabelText('Merchant reference *')).toHaveValue('preview-generated-merchant-preview-start');
    expect(view.queryByText('payout:preview:test')).toBeNull();
    expect(view.queryByText('https://gateway.example.test/payout')).toBeNull();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Send request' }));
    });

    await waitFor(() => {
      expect(view.getByText('Request sent successfully.')).toBeInTheDocument();
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.apiKey).toBe('preview-payout-key');
  });

  test('resets the api key to the backend default when the environment changes', async () => {
    setRouteHandler(defaultsEndpoint, ({ url }) => {
      const parsedUrl = new URL(url, 'http://localhost');
      if (parsedUrl.searchParams.get('channel') === primaryChannel) {
        return jsonResponse(
          createDefaultsResponse(primaryChannel, {
            apiKey: 'product-payout-key',
          }),
        );
      }

      return jsonResponse(createDefaultsResponse(primaryChannel));
    });

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Generate' })).toBeEnabled();
    });

    await updateApiKeyFromModal(view, 'typed-payout-key');

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: '產品' }));
    });

    await waitFor(() => {
      expect(view.getByText('product-payout-key')).toBeInTheDocument();
    });

    const productDefaultsCall = fetchRecords.find(
      (record) =>
        record.method === 'GET' &&
        record.url === `${defaultsEndpoint}?channel=${primaryChannel}` &&
        record.headers.get(targetEnvironmentHeaderName) === 'product',
    );

    expect(productDefaultsCall).toBeDefined();
  });

  test('cancels api key edits without applying the draft value', async () => {
    setRouteHandler(previewEndpoint, () =>
      jsonResponse({
        request: {
          name: 'payout:create:co_bank',
          method: 'POST',
          url: 'https://gateway.example.test/payout',
          headers: { Authorization: 'ApiKey ****-token' },
          payload: {
            merchant_reference: `merchant-${primaryChannel}`,
          },
        },
      }),
    );

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Preview request' })).toBeEnabled();
    });

    await updateApiKeyFromModal(view, 'cancelled-payout-key', 'Cancel');

    expect(view.queryByRole('dialog')).toBeNull();
    expect(view.getByText(`api-key-${primaryChannel}`)).toBeInTheDocument();
    expect(view.queryByText('cancelled-payout-key')).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Preview request' }));
    });

    const previewCall = fetchRecords.find((record) => record.method === 'POST' && record.url === previewEndpoint);
    expect(previewCall?.body?.apiKey).toBe(`api-key-${primaryChannel}`);
  });

  test('shows a failure banner with diagnostics after create fails', async () => {
    setRouteHandler(createEndpoint, () =>
      textResponse('gateway failed', {
        status: 502,
        statusText: 'Bad Gateway',
      }),
    );

    const view = renderPayoutPage();

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Send request' })).toBeEnabled();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Send request' }));
    });

    await waitFor(() => {
      expect(view.getByText('gateway failed')).toBeInTheDocument();
      expect(view.getByText('CREATE Status 502')).toBeInTheDocument();
      expect(view.getAllByText('模式 沙盒 · 目標 沙盒代理').length).toBeGreaterThan(0);
    });
  });
});
