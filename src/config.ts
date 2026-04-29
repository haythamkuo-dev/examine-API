import { generateSign } from './utils';
import type { ApiTestCase } from './runner';
import { createPayoutPayload, type PayoutChannel } from './payouts';
import { createDepositPayload, type DepositChannel } from './deposit';
import { CHANNELS } from './channels';

const BASE_URL = Bun.env.API_BASE_URL || 'https://stage.sidediff.com';

const TOKENS = {
  DEPOSIT: Bun.env.MERCHANT_API_TOKEN_DEPOSIT || '',
  SUBSCRIPTION: Bun.env.MERCHANT_API_TOKEN_SUBSCRIPTION || '',
  PAYOUT: Bun.env.MERCHANT_API_TOKEN_PAYOUT || '',
};

// 解析 PayoutChannel，預設為 'co_bank'
const parsePayoutChannel = (value: string | undefined): PayoutChannel => {
  if (value === 'co_bank' || value === 'co_wallet' || value === 'imps' || value === 'bd_wallet') {
    return value;
  }

  return 'co_bank';
};

// 解析 DepositChannel，預設為 'southafrica_cards'
const parseDepositChannel = (value: string | undefined): DepositChannel => {
  if (
    value === 'southafrica_cards' ||
    value === 'linepay' ||
    value === 'linepay_invoice' ||
    value === 'inr_upi' ||
    value === 'bdt_worldpay' ||
    value === 'co_bank_transfer' ||
    value === 'co_cash' ||
    value === 'co_nequi' ||
    value === 'co_pse' ||
    value === 'th_rabbit_linepay' ||
    value === 'my_tng'
  ) {
    return value;
  }

  return 'southafrica_cards';
};

const PAYOUT_TEST_CHANNEL = parsePayoutChannel(Bun.env.PAYOUT_TEST_CHANNEL || 'co_bank');
const DEPOSIT_TEST_CHANNEL = parseDepositChannel(Bun.env.DEPOSIT_TEST_CHANNEL || 'southafrica_cards');

const PAYOUT_CHANNEL_TO_URL: Record<PayoutChannel, string> = {
  co_bank: `${BASE_URL}${CHANNELS.PAYOUT_CO_BANK}`,
  co_wallet: `${BASE_URL}${CHANNELS.PAYOUT_CO_WALLET}`,
  imps: `${BASE_URL}${CHANNELS.PAYOUT_IMPS_BANK}`,
  bd_wallet: `${BASE_URL}${CHANNELS.PAYOUT_BD_WALLET}`,
};

const payoutTestUrl =
  PAYOUT_CHANNEL_TO_URL[PAYOUT_TEST_CHANNEL] ?? `${BASE_URL}${CHANNELS.PAYOUT_CO_BANK}`;

// 透過環境變數指定測試的 PayoutChannel，產出對應的測試 URL 和 Payload
const createSignedPayoutPayload = (
  payoutChannel: PayoutChannel,
  makeId: (prefix: string) => string,
) => {
  const basePayload = createPayoutPayload(payoutChannel, makeId);
  const signFields = ['amount.amount', 'amount.currency_code', 'merchant_reference', 'product_no'];
  const sign = generateSign(basePayload, signFields, Bun.env.MERCHANT_ID || '');

  return { ...basePayload, sign };
};

// 透過環境變數指定測試的 DepositChannel，產出對應的測試 URL 和 Payload
const createSignedDepositPayload = (
  depositChannel: DepositChannel,
  makeId: (prefix: string) => string,
) => {
  const basePayload = createDepositPayload(depositChannel, makeId);
  const signFields = ['amount.amount', 'amount.currency_code', 'merchant_ref', 'product_no'];
  const sign = generateSign(basePayload, signFields, Bun.env.MERCHANT_ID || '');

  return { ...basePayload, sign };
};

export const apiTests: ApiTestCase[] = [
  {
    name: `💰 儲值測試 (Deposit:${DEPOSIT_TEST_CHANNEL})`,
    url: `${BASE_URL}${CHANNELS.DEPOSIT}`,
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${TOKENS.DEPOSIT}`,
      'Content-Type': 'application/json',
    },
    generatePayload: ({ makeId }) => createSignedDepositPayload(DEPOSIT_TEST_CHANNEL, makeId),
  },
  {
    name: '🥩 訂閱測試 (Subscription)',
    url: `${BASE_URL}${CHANNELS.SUBSCRIPTION}`,
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${TOKENS.SUBSCRIPTION}`,
      'Content-Type': 'application/json',
    },
    generatePayload: ({ makeId }) => {
      const basePayload = {
        subs_plan_id: Bun.env.SUBSCRIPTION_PLAN || '01KKTEEJCJ5W12EMC01469Z4ZJ',
        amount: {
          amount: '111.00',
          currency_code: 'USD',
        },
        interval_unit: 'month',
        interval_count: 1,
        times: 12,
        product_detail: '測試訂閱商品描述加簽',
        product_name: '測試訂閱方案加簽',
        merchant_ref: makeId('TEST_ORDER_'),
        consumer_id: 'user_999',
        consumer_profile: {
          name: '測試用戶加簽',
          phone: '0912345678',
          email: 'test@example.com',
          country_code: 'ZA',
        },
        origin: 'https://www.amazon.com/',
        payment_instrument: {
          os_type: 'WEB',
          terminal_type: 'WEB',
        },
        return_url: Bun.env.CALLBACK_URL_SUBSCRIPTION,
      };

      const signFields = ['merchant_no', 'merchant_ref', 'order_id', 'status'];
      const sign = generateSign(basePayload, signFields, Bun.env.MERCHANT_ID || '');

      return { ...basePayload, sign };
    },
  },
  {
    name: `💸 撥款測試 (Payout:${PAYOUT_TEST_CHANNEL})`,
    url: payoutTestUrl,
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${TOKENS.PAYOUT}`,
      'Content-Type': 'application/json',
    },
    generatePayload: ({ makeId }) => createSignedPayoutPayload(PAYOUT_TEST_CHANNEL, makeId),
  },
];
