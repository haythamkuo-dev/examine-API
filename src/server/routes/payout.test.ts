import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { startApiTestServer, type ApiTestServerContext } from '../../../tests/server-setup';

type PayoutApiRequestBody = {
  apiKey?: string;
  channel: string;
  commonValues: {
    merchantReference: string;
  };
  channelValues: Record<string, unknown>;
};

type PayoutUpstreamBody = {
  merchant_reference: string;
  payout_info?: {
    remitter?: unknown;
  };
};

const createRequestUrl = (baseUrl: string, path: string): string => `${baseUrl}${path}`;

const createValidBody = (): PayoutApiRequestBody => ({
  channel: 'co_bank',
  commonValues: { merchantReference: 'TEST_BT_ORDER_125' },
  channelValues: {
    product_no: 'PAY-FUTUREPAY_COLLECT-BANKTRANSFERCO-COP',
    amount: { amount: '10.00', currency_code: 'COP' },
    payout_info: {
      account_type: 'individual',
      narration: 'E2E payout order',
      client_ip: '127.0.0.1',
      beneficiary: {
        name: 'E2E Payout Beneficiary',
        first_name: 'E2E',
        last_name: 'Beneficiary',
        identification_type: 'CC',
        id_number: '1020806281',
        account_number: '03179596864',
        bank_account_type: 'cc',
        bank_code: '1007',
        bank_name: 'BANCOLOMBIA',
        email: 'e2e@example.com',
        identification: '其他識別編號 (非必填)',
        date_of_birth: '出生日期 YYYY-MM-DD (非必填)',
        contact_number: {
          country_code: '國碼 (非必填)',
          number: '電話號碼 (非必填)',
        },
        address: {
          line1: '地址第一行 (非必填)',
          line2: '地址第二行 (非必填)',
          city: '城市 (非必填)',
          state: '州/省 (非必填)',
          country_code: '國別代碼 (非必填)',
          postal_code: '郵遞區號 (非必填)',
        },
      },
      remitter: {
        name: '付款人姓名 (非必填)',
        phone_num: '付款人電話 (非必填)',
        address: '付款人地址 (非必填)',
        email: '付款人 Email (非必填)',
        country_code: '國別代碼 (非必填)',
        city: '城市 (非必填)',
        id_type: '證件類型 (非必填)',
        id_number: '證件號碼 (非必填)',
        id_expiry: '證件效期 YYYY-MM-DD (非必填)',
        date_of_birth: '出生日期 YYYY-MM-DD (非必填)',
      },
    },
  },
});

describe('payout API routes', () => {
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
    await context.resetPayoutFixtures();
  });

  test('GET /api/payout/defaults returns payout defaults bundle', async () => {
    const response = await requestApi('/api/payout/defaults?channel=co_bank');

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const form = body.form as Record<string, unknown>;
    const commonValues = form.commonValues as Record<string, unknown>;

    expect(body.channel).toBe('co_bank');
    expect(body.availableChannels).toEqual(['co_bank', 'co_wallet', 'imps', 'bd_wallet']);
    expect(body.apiKey).toBe('payout-token');
    expect(commonValues.merchantReference).toBe('TEST_PAYOUT_ORDER_131');
  });

  test('POST /api/payout/merchant-reference returns a generated merchant reference', async () => {
    const response = await requestApi('/api/payout/merchant-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.merchantReference).toBe('TEST_ORDER_fixed-id');
  });

  test('POST /api/payout/preview returns 400 when required payout field is blank', async () => {
    const requestBody = createValidBody();
    const payoutInfo = requestBody.channelValues.payout_info as Record<string, unknown>;
    const beneficiary = payoutInfo.beneficiary as Record<string, unknown>;
    beneficiary.name = '   ';

    const response = await requestApi('/api/payout/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.message).toBe('payout_info.beneficiary.name is required');
  });

  test('POST /api/payout/preview returns masked preview payload for valid payout form', async () => {
    const response = await requestApi('/api/payout/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createValidBody()),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const request = body.request as Record<string, unknown>;
    const headers = request.headers as Record<string, unknown>;
    const payload = request.payload as Record<string, unknown>;
    const payoutInfo = payload.payout_info as Record<string, unknown>;
    const beneficiary = payoutInfo.beneficiary as Record<string, unknown>;

    expect(request.url).toBe('https://example.test/s2s/v1/payout/orders/co/bank-transfer');
    expect(headers.Authorization).toBe('ApiKey ****-token');
    expect(payload.merchant_reference).toBe('TEST_ORDER_fixed-id');
    expect(beneficiary.identification).toBeUndefined();
    expect(beneficiary.contact_number).toBeUndefined();
    expect(beneficiary.address).toBeUndefined();
    expect(payoutInfo.remitter).toBeUndefined();
  });

  test('POST /api/payout/create uses a manually provided api key override', async () => {
    let upstreamAuthorization = '';

    globalThis.fetch = mock(async (_input, init) => {
      upstreamAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization || '');

      return new Response(JSON.stringify({ ok: true, transaction_id: 'po_manual_123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const response = await requestApi('/api/payout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createValidBody(),
        apiKey: 'manual-payout-token',
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamAuthorization).toBe('ApiKey manual-payout-token');
  });

  test('POST /api/payout/create proxies upstream status, prunes optional remitter fields, and preserves the provided merchant ref', async () => {
    let upstreamBody: PayoutUpstreamBody | null = null;
    let upstreamAuthorization = '';

    globalThis.fetch = mock(async (_input, init) => {
      upstreamBody = JSON.parse(String(init?.body ?? '{}')) as PayoutUpstreamBody;
      upstreamAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization || '');

      return new Response(JSON.stringify({ ok: true, transaction_id: 'po_123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const response = await requestApi('/api/payout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'bd_wallet',
        commonValues: { merchantReference: 'TEST_BD_001' },
        channelValues: {
          product_no: 'PAY-BD-WALLET',
          amount: { amount: '100.00', currency_code: 'BDT' },
          payout_info: {
            narration: 'Test payout transaction',
            beneficiary: {
              name: 'John Doe',
              account_number: '01712345678',
            },
            remitter: {
              name: '付款人姓名 (非必填)',
            },
          },
        },
      }),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.status).toBe(201);
    expect(upstreamAuthorization).toBe('ApiKey india-bangladesh-token');
    expect(upstreamBody).not.toBeNull();
    const capturedUpstreamBody = upstreamBody as unknown as PayoutUpstreamBody;
    expect(capturedUpstreamBody.merchant_reference).toBe('TEST_BD_001');
    expect(capturedUpstreamBody.payout_info?.remitter).toBeUndefined();
  });

  test('PUT /api/payout/defaults persists payout defaults into the isolated fixture copy', async () => {
    const requestBody = {
      apiKey: 'manual-payout-token',
      channel: 'co_wallet',
      commonValues: {
        merchantReference: 'TEST_ORDER_OVERRIDDEN',
      },
      channelValues: {
        product_no: 'PAY-FUTUREPAY_COLLECT-MOBILEMONEY-COP',
        amount: { amount: '10.00', currency_code: 'COP' },
        payout_info: {
          account_type: 'individual',
          narration: 'Updated payout narration',
          client_ip: '127.0.0.1',
          beneficiary: {
            name: 'E2E Payout Beneficiary',
            identification_type: 'CC',
            id_number: '1020806281',
            account_number: '03179596864',
            bank_account_type: 'dp',
            bank_code: '1007',
            bank_name: 'NEQUI',
          },
        },
      },
    };

    const updateResponse = await requestApi('/api/payout/defaults?channel=co_wallet', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(updateResponse.status).toBe(200);

    const updatedDefaultsResponse = await requestApi('/api/payout/defaults?channel=co_wallet');
    const updatedDefaults = (await updatedDefaultsResponse.json()) as Record<string, unknown>;
    const form = updatedDefaults.form as Record<string, unknown>;
    const commonValues = form.commonValues as Record<string, unknown>;
    const channelValues = form.channelValues as Record<string, unknown>;
    const payoutInfo = channelValues.payout_info as Record<string, unknown>;

    expect(commonValues.merchantReference).toBe('TEST_ORDER_OVERRIDDEN');
    expect(payoutInfo.narration).toBe('Updated payout narration');
    expect(updatedDefaults.apiKey).toBe('payout-token');

    const savedCommon = await readFile(join(context.payoutPresetDirPath, 'common.json'), 'utf8');
    const savedChannel = await readFile(join(context.payoutPresetDirPath, 'channels', 'co_wallet.json'), 'utf8');

    expect(savedCommon).toContain('"merchant_reference": "TEST_ORDER_OVERRIDDEN"');
    expect(savedChannel).toContain('"narration": "Updated payout narration"');
  });
});
