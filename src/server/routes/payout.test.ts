import { beforeEach,afterEach, describe, expect, mock, test } from 'bun:test';
import { cp, mkdtemp,rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { getCliEnv } from '../../core/env';
import { handlePayoutRoute } from './payout';

const env = getCliEnv({
  API_BASE_URL: 'https://example.test',
  MERCHANT_SIGN: 'sign-key',
  MERCHANT_API_TOKEN_PAYOUT: 'payout-token',
  PAYOUT_URL_BANK: '/s2s/v1/payout/orders/co/bank-transfer',
  PAYOUT_CO_BANK: 'PAY-CO-BANK',
});

const makeId = (prefix: string) => `${prefix}fixed-id`;
const sourceDirPath = resolve(process.cwd(), 'data/payout');

let presetDirPath = sourceDirPath;
const originalFetch = globalThis.fetch;




const  createRouteDeps=(currentPresetDir:string)=>({
  env,
  presetDirPath: currentPresetDir,
  makeId,
  logger: console,
})


describe('handlePayoutRoute', () => {
  let activeTempDir:string;
  let testPresetDirpath:string;

  beforeEach(async()=>{
    activeTempDir = await mkdtemp(join(tmpdir(), 'payout-route-'));
    testPresetDirpath=join(activeTempDir, 'payout');
    await cp(sourceDirPath, testPresetDirpath, { recursive: true });
  })


  afterEach(async()=>{
    if(activeTempDir){
      await rm(activeTempDir, { recursive: true, force: true });
    }
    mock.restore();
  })



test('returns payout defaults bundle',async()=>{
  const res=await handlePayoutRoute({
    request:new Request('http://localhost/api/payout/defaults?channel=co_bank'),
    url:new URL('http://localhost/api/payout/defaults?channel=co_bank'),
    deps:createRouteDeps(testPresetDirpath),
  })


  expect(res).not.toBeNull();
  const body=await re
})




})

beforeEach(async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'payout-route-'));
  presetDirPath = join(tempDir, 'payout');
  await cp(sourceDirPath, presetDirPath, { recursive: true });
  globalThis.fetch = originalFetch;
});

describe('handlePayoutRoute', () => {
  test('returns payout defaults bundle', async () => {
    const response = await handlePayoutRoute({
      request: new Request('http://localhost/api/payout/defaults?channel=co_bank'),
      url: new URL('http://localhost/api/payout/defaults?channel=co_bank'),
      deps: createRouteDeps(),
    });

    expect(response).not.toBeNull();
    const body = await response?.json();
    expect(body.channel).toBe('co_bank');
    expect(body.availableChannels).toContain('imps');
    expect(body.form.commonValues.merchantReference).toBe('TEST_BT_ORDER_131');
  });

  test('returns 400 when required payout field is missing', async () => {
    const requestBody = {
      channel: 'co_bank',
      commonValues: { merchantReference: 'TEST_BAD_001' },
      channelValues: {
        product_no: 'PAY-CO-BANK',
        amount: { amount: '100.00', currency_code: 'COP' },
        payout_info: {
          account_type: 'individual',
          narration: 'E2E payout order',
          client_ip: '127.0.0.1',
          beneficiary: {
            name: '   ',
            first_name: 'E2E',
            last_name: 'Beneficiary',
            identification_type: 'CC',
            id_number: '1020806281',
            account_number: '03179596864',
            bank_account_type: 'cc',
            bank_code: '1007',
            bank_name: 'BANCOLOMBIA',
            email: 'e2e@example.com',
          },
        },
      },
    };

    const response = await handlePayoutRoute({
      request: new Request('http://localhost/api/payout/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }),
      url: new URL('http://localhost/api/payout/preview'),
      deps: createRouteDeps(),
    });

    expect(response?.status).toBe(400);
    const body = await response?.json();
    expect(body.message).toBe('payout_info.beneficiary.name is required');
  });

  test('returns preview payload for valid payout form', async () => {
    const response = await handlePayoutRoute({
      request: new Request('http://localhost/api/payout/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'imps',
          commonValues: { merchantReference: 'TEST_IMPS_002' },
          channelValues: {
            product_no: 'PAY-IN-IMPS',
            amount: { amount: '100.00', currency_code: 'INR' },
            payout_info: {
              beneficiary: {
                name: 'Rahul Kumar',
                account_number: '1234567890',
                bank_name: 'BENEFICIARY BANK',
                bank_code: 'BANK0001234',
              },
            },
          },
        }),
      }),
      url: new URL('http://localhost/api/payout/preview'),
      deps: createRouteDeps(),
    });

    expect(response?.status).toBe(200);
    const body = await response?.json();
    expect(body.request.url).toBe('https://example.test/s2s/v1/payout/orders/in/imps');
    expect(body.request.headers.Authorization).toBe('ApiKey ****-token');
  });

  test('prunes optional placeholder fields from preview payload', async () => {
    const response = await handlePayoutRoute({
      request: new Request('http://localhost/api/payout/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      }),
      url: new URL('http://localhost/api/payout/preview'),
      deps: createRouteDeps(),
    });

    expect(response?.status).toBe(200);
    const body = await response?.json();
    expect(body.request.payload.payout_info.beneficiary.identification).toBeUndefined();
    expect(body.request.payload.payout_info.beneficiary.contact_number).toBeUndefined();
    expect(body.request.payload.payout_info.beneficiary.address).toBeUndefined();
    expect(body.request.payload.payout_info.remitter).toBeUndefined();
  });

  test('returns create result with upstream status', async () => {
    let upstreamBody: Record<string, unknown> | null = null;

    globalThis.fetch = mock(async (_input, init) => {
      upstreamBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;

      return new Response(JSON.stringify({ ok: true, transaction_id: 'po_123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const response = await handlePayoutRoute({
      request: new Request('http://localhost/api/payout/create', {
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
      }),
      url: new URL('http://localhost/api/payout/create'),
      deps: createRouteDeps(),
    });

    expect(response?.status).toBe(200);
    const body = await response?.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe(201);
    expect(upstreamBody?.payout_info).toBeDefined();
    expect((upstreamBody?.payout_info as Record<string, unknown>).remitter).toBeUndefined();
  });
});


