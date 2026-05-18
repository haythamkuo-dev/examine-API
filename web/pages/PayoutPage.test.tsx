/// <reference lib="dom" />

import '../../tests/web-setup';
import { beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { PAYOUT_CHANNELS } from '../../src/core/env';
import type {
  PayoutCreateResponse,
  PayoutDefaultsResponse,
  PayoutFieldMap,
  PayoutFormValues,
} from '../../src/payout/web';
import { normalizeCreateResult, PayoutPage, shouldHidePayoutField } from './PayoutPage';

const defaultsEndpoint = '/api/payout/defaults';
const createEndpoint = '/api/payout/create';

const primaryChannel = PAYOUT_CHANNELS[0];
const secondaryChannel = PAYOUT_CHANNELS[1];

if (!primaryChannel || !secondaryChannel) {
  throw new Error('Payout channels are not configured.');
}

type FetchRequestRecord = {
  body: PayoutFormValues | null;
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
  availableChannels: [primaryChannel, secondaryChannel],
  channel,
  commonSchema,
  channelSchema,
  form: createForm(channel, overrides?.form),
  ...overrides,
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

const setRouteHandler = (url: string, handler: MockRouteHandler) => {
  routeHandlers.set(url, handler);
};

beforeEach(() => {
  fetchRecords.length = 0;
  routeHandlers = new Map<string, MockRouteHandler>();

  setRouteHandler(defaultsEndpoint, () => jsonResponse(createDefaultsResponse(primaryChannel)));

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const rawBody = typeof init?.body === 'string' ? init.body : null;
    const body = rawBody ? (JSON.parse(rawBody) as PayoutFormValues) : null;

    fetchRecords.push({ url, method, body });

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
    expect(result.raw).toEqual({
      requestName: 'payout:create:co_bank',
      ok: true,
      status: 200,
      request: { method: 'POST', url: 'https://example.test', payload: { value: 1 } },
      response: { ok: true },
      durationMs: 10,
    });
  });

  test('builds fallback failure details for non-JSON responses', async () => {
    const response = new Response('gateway failed', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/plain' },
    });

    const result = await normalizeCreateResult(response);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.message).toBe('Bad Gateway');
    expect(result.details).toBe('gateway failed');
    expect(result.raw).toEqual({
      ok: false,
      action: 'create',
      status: 502,
      contentType: 'text/plain',
      body: 'gateway failed',
    });
  });
});

describe('PayoutPage', () => {
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

    const view = render(<PayoutPage />);

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Send request' })).toBeEnabled();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Send request' }));
    });

    await waitFor(() => {
      expect(view.getByText('Request sent successfully.')).toBeInTheDocument();
      expect(view.getByText('CREATE Status 200')).toBeInTheDocument();
    });
  });

  test('shows a failure banner with diagnostics after create fails', async () => {
    setRouteHandler(createEndpoint, () =>
      textResponse('gateway failed', {
        status: 502,
        statusText: 'Bad Gateway',
      }),
    );

    const view = render(<PayoutPage />);

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'Send request' })).toBeEnabled();
    });

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Send request' }));
    });

    await waitFor(() => {
      expect(view.getByText('Bad Gateway')).toBeInTheDocument();
      expect(view.getByText('gateway failed')).toBeInTheDocument();
      expect(view.getByText('CREATE Status 502')).toBeInTheDocument();
    });
  });
});
