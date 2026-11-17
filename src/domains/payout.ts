import {
  getMerchantToken,
  resolvePayoutMerchantTokenKey,
  type CliEnv,
  type PayoutChannel,
  joinUrl,
} from '../core/env';
import { generateSign } from '../utils';
import type { CommandRequest } from '../runner';

export type PayoutCommonValues = {
  merchantReference?: string;
};

export type PayoutChannelValues = Record<string, unknown>;

export type PayoutFormValues = {
  channel: PayoutChannel;
  commonValues: PayoutCommonValues;
  channelValues: PayoutChannelValues;
};

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

export type PayoutRequestOverrides = {
  apiKey?: string;
  baseUrl?: string;
  payoutUrl?: string;
};

export type StructuredPayoutRequestOverrides = {
  apiKey?: string;
  baseUrl?: string;
  payoutUrl?: string;
  commonValues: PayoutCommonValues;
  channelValues: PayoutChannelValues;
};

const cloneUnknown = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

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

/**
 * Builds a payout payload from values already hydrated by the preset operation.
 *
 * The structured path intentionally does not consult the legacy code-owned
 * sample templates. Persistent values and request overrides must be resolved
 * by the service before this domain function is called.
 *
 * @param env Runtime environment containing signing configuration.
 * @param channel Payout channel selected by the caller.
 * @param makeId ID factory used to create the final merchant reference.
 * @param overrides Hydrated common and channel form values.
 * @returns A signed payout payload built only from the supplied values.
 * @throws {TypeError} When the supplied payload cannot be signed.
 */
export const createStructuredPayoutPayload = (
  env: CliEnv,
  channel: PayoutChannel,
  makeId: (prefix: string) => string,
  overrides: StructuredPayoutRequestOverrides,
): PayoutPayload => {
  void channel;
  void overrides.commonValues;

  const payload = {
    ...(cloneUnknown(overrides.channelValues) as Omit<PayoutPayload, 'merchant_reference' | 'sign'>),
    merchant_reference: makeId('TEST_ORDER_'),
  } as PayoutPayload;
  const signFields = ['amount.amount', 'amount.currency_code', 'merchant_reference', 'product_no'];

  return {
    ...payload,
    sign: generateSign(payload, signFields, env.signKey),
  };
};

/**
 * Builds a payout command request and resolves the correct merchant token from the selected channel.
 *
 * @param env Runtime environment containing endpoints, signing config, and merchant tokens.
 * @param channel Payout channel selected by the caller.
 * @param makeId ID factory used to create unique merchant references.
 * @param overrides Optional request overrides for operator-driven testing.
 * @returns A runner-compatible payout request with channel-scoped authorization.
 * @throws {TypeError} When the configured base URL or payout URL cannot be composed into a valid request URL.
 */
export const createPayoutRequest = (
  env: CliEnv,
  channel: PayoutChannel,
  makeId: (prefix: string) => string,
  overrides: PayoutRequestOverrides = {},
): CommandRequest => ({
  name: `payout:create:${channel}`,
  method: 'POST',
  url: joinUrl(overrides.baseUrl || env.baseUrl, overrides.payoutUrl || env.payoutUrls[channel]),
  headers: {
    Authorization:
      `ApiKey ${overrides.apiKey?.trim() || getMerchantToken(env, resolvePayoutMerchantTokenKey(channel))}`,
    'Content-Type': 'application/json',
  },
  payload: createPayoutPayload(env, channel, makeId),
});

/**
 * Builds a payout command request from hydrated form values.
 *
 * This request path does not invoke the legacy sample payload builder. The
 * operation context owns preset loading and merging before the domain builds
 * the outbound request.
 *
 * @param env Runtime environment containing endpoints and credential settings.
 * @param channel Payout channel selected by the caller.
 * @param makeId ID factory used to create the final merchant reference.
 * @param overrides Hydrated form values and optional transport overrides.
 * @returns A runner-compatible payout request with channel-scoped authorization.
 * @throws {TypeError} When the configured base URL or payout URL cannot be composed into a valid request URL.
 */
export const createStructuredPayoutRequest = (
  env: CliEnv,
  channel: PayoutChannel,
  makeId: (prefix: string) => string,
  overrides: StructuredPayoutRequestOverrides,
): CommandRequest => ({
  name: `payout:create:${channel}`,
  method: 'POST',
  url: joinUrl(overrides.baseUrl || env.baseUrl, overrides.payoutUrl || env.payoutUrls[channel]),
  headers: {
    Authorization:
      `ApiKey ${overrides.apiKey?.trim() || getMerchantToken(env, resolvePayoutMerchantTokenKey(channel))}`,
    'Content-Type': 'application/json',
  },
  payload: createStructuredPayoutPayload(env, channel, makeId, overrides),
});
