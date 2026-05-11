import { type CliEnv, type PayoutChannel, joinUrl } from '../core/env';
import { generateSign } from '../utils';
import type { CommandRequest } from '../runner';

type Amount = {
  amount: string;
  currency_code: string;
};

type PayoutBeneficiary = {
  name: string;
  first_name?: string;
  last_name?: string;
  identification_type?: string;
  id_number?: string;
  account_number: string;
  bank_account_type?: string;
  bank_code?: string;
  bank_name?: string;
  email?: string;
};

type PayoutInfo = {
  account_type?: string;
  narration?: string;
  client_ip?: string;
  beneficiary: PayoutBeneficiary;
};

type PayoutTemplate = {
  productNo: string;
  amount: Amount;
  payoutInfo: PayoutInfo;
};

export type PayoutPayload = {
  product_no: string;
  merchant_reference: string;
  amount: Amount;
  payout_info: PayoutInfo;
  sign?: string;
};

const createPayoutTemplates = (env: CliEnv): Record<PayoutChannel, PayoutTemplate> => ({
  co_bank: {
    productNo: env.payoutProductNos.co_bank,
    amount: { amount: '10.00', currency_code: 'COP' },
    payoutInfo: {
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
      },
    },
  },
  co_wallet: {
    productNo: env.payoutProductNos.co_wallet,
    amount: { amount: '10.00', currency_code: 'COP' },
    payoutInfo: {
      account_type: 'individual',
      narration: 'E2E payout order',
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
  imps: {
    productNo: env.payoutProductNos.imps,
    amount: { amount: '100.00', currency_code: 'INR' },
    payoutInfo: {
      beneficiary: {
        name: 'Rahul Kumar',
        account_number: '1234567890',
        bank_name: 'BENEFICIARY BANK',
        bank_code: 'BANK0001234',
      },
    },
  },
  bd_wallet: {
    productNo: env.payoutProductNos.bd_wallet,
    amount: { amount: '100.00', currency_code: 'BDT' },
    payoutInfo: {
      narration: 'payout remark',
      beneficiary: {
        name: 'Md. Rahim',
        account_number: '8801712345678',
      },
    },
  },
});

export const createPayoutPayload = (
  env: CliEnv,
  channel: PayoutChannel,
  makeId: (prefix: string) => string,
): PayoutPayload => {
  const template = createPayoutTemplates(env)[channel];
  const payload: PayoutPayload = {
    product_no: template.productNo,
    merchant_reference: makeId('TEST_ORDER_'),
    amount: {
      ...template.amount,
    },
    payout_info: {
      ...template.payoutInfo,
      beneficiary: {
        ...template.payoutInfo.beneficiary,
      },
    },
  };
  const signFields = ['amount.amount', 'amount.currency_code', 'merchant_reference', 'product_no'];

  return {
    ...payload,
    sign: generateSign(payload, signFields, env.signKey),
  };
};

export const createPayoutRequest = (
  env: CliEnv,
  channel: PayoutChannel,
  makeId: (prefix: string) => string,
): CommandRequest => ({
  name: `payout:create:${channel}`,
  method: 'POST',
  url: joinUrl(env.baseUrl, env.payoutUrls[channel]),
  headers: {
    Authorization: `ApiKey ${env.tokens.payout}`,
    'Content-Type': 'application/json',
  },
  payload: createPayoutPayload(env, channel, makeId),
});
