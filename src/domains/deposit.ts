import { type CliEnv, type DepositChannel, joinUrl } from '../core/env';
import { generateSign } from '../utils';
import type { CommandRequest } from '../runner';
import type { DepositChannelValues, DepositCommonValues } from '../deposit/web';

type Amount = {
  amount: string;
  currency_code: string;
};

type DepositTemplate = {
  product_no: string;
  amount: Amount;
  return_url?: string;
  payment_order?: Record<string, unknown>;
  issue_invoice?: boolean;
  invoice?: Record<string, unknown>;
};

export type DepositPayload = {
  product_no: string;
  merchant_ref: string;
  amount: Amount;
  return_url?: string;
  payment_order?: Record<string, unknown>;
  issue_invoice?: boolean;
  invoice?: Record<string, unknown>;
  sign?: string;
};

export type DepositCollectOverride = {
  country_code: string;
  product_detail: string;
  product_name: string;
  shopper_reference: string;
  origin: string;
};

export type DepositRequestOverrides = {
  apiKey?: string;
  baseUrl?: string;
  depositUrl?: string;
  signKey?: string;
  productNo?: string;
  merchantRef?: string;
  amount?: string;
  currencyCode?: string;
  returnUrl?: string;
  collect?: DepositCollectOverride;
};

export type StructuredDepositRequestOverrides = {
  apiKey?: string;
  baseUrl?: string;
  depositUrl?: string;
  signKey?: string;
  commonValues: DepositCommonValues;
  channelValues: DepositChannelValues;
};

const createDepositTemplates = (env: CliEnv): Record<DepositChannel, DepositTemplate> => ({
  southafrica_cards: {
    product_no: env.depositSouthAfricaCardsProductNo,
    amount: { amount: '99.00', currency_code: 'USD' },
    return_url: env.callbackUrlDeposit,
  },
  linepay: {
    product_no: 'DEP-LINEPAY_ONLINE-ONLINE-TWD',
    amount: { amount: '100', currency_code: 'TWD' },
    return_url: env.callbackUrlDeposit,
    payment_order: {
      linepay_online: {
        confirm_url:
          'https://merchant.example.com/linepay/confirm?merchant_ref=M-ORDER-LINEPAY-000001',
        cancel_url:
          'https://merchant.example.com/linepay/cancel?merchant_ref=M-ORDER-LINEPAY-000001',
        packages: [
          {
            id: 'pkg-1',
            name: 'Default Package',
            amount: 100,
            products: [{ id: 'SKU-001', name: 'Sample Item', quantity: 1, price: 100 }],
          },
        ],
      },
    },
  },
  linepay_invoice: {
    product_no: 'DEP-LINEPAY_ONLINE-ONLINE-TWD',
    amount: { amount: '120', currency_code: 'TWD' },
    return_url: env.callbackUrlDeposit,
    payment_order: {
      linepay_online: {
        confirm_url:
          'https://merchant.example.com/linepay/confirm?merchant_ref=M-ORDER-LINEPAY-INV-000001',
        cancel_url:
          'https://merchant.example.com/linepay/cancel?merchant_ref=M-ORDER-LINEPAY-INV-000001',
        packages: [
          {
            id: 'pkg-1',
            name: 'Default Package',
            amount: 120,
            products: [{ id: 'SKU-001', name: 'Sample Item', quantity: 1, price: 120 }],
          },
        ],
      },
    },
    issue_invoice: true,
    invoice: {
      relate_number: 'INV-20250101-000123',
      print: '0',
      donation: '0',
      tax_type: '1',
      sales_amount: 120,
      inv_type: '07',
      vat: '1',
      customer_email: 'buyer@example.com',
      items: [
        {
          item_seq: 1,
          item_name: 'Sample Item',
          item_count: 1,
          item_word: '件',
          item_price: 120,
          item_amount: 120,
        },
      ],
    },
  },
  inr_upi: {
    product_no: 'DEP-EC-UPI-INR',
    amount: { amount: '100.00', currency_code: 'INR' },
    return_url: env.callbackUrlDeposit,
  },
  bdt_worldpay: {
    product_no: 'DEP-WORLDPAY-bkash-BDT',
    amount: { amount: '100.00', currency_code: 'BDT' },
    return_url: env.callbackUrlDeposit,
    payment_order: {
      worldpay: {
        payer_key: 'PAYER-001',
        payer_name: 'Amy',
      },
    },
  },
  co_bank_transfer: {
    product_no: 'DEP-SINGLEPAYMENT-BANKTRANSFERCO-COP',
    amount: { amount: '1000', currency_code: 'COP' },
    return_url: env.callbackUrlDeposit,
    payment_order: {
      country_code: 'CO',
      product_detail: 'Single Payment Bank Transfer order for %s',
      singlepayment_banktransferco: {
        shopper_email: 'shopper@example.com',
        bank_name: '1234',
        tax_type: 'COL_CC',
        personal_tax_id: '36570630563',
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
      },
    },
  },
  co_cash: {
    product_no: 'DEP-SINGLEPAYMENT-CASHCO-COP',
    amount: { amount: '1000', currency_code: 'COP' },
    return_url: env.callbackUrlDeposit,
    payment_order: {
      country_code: 'CO',
      product_detail: 'Single Payment CASH order for %s',
      singlepayment_cashco: {
        shopper_email: 'shopper@example.com',
        bank_name: '8323',
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
      },
    },
  },
  co_nequi: {
    product_no: 'DEP-SINGLEPAYMENT-NEQUICO-COP',
    amount: { amount: '1000', currency_code: 'COP' },
    return_url: env.callbackUrlDeposit,
    payment_order: {
      country_code: 'CO',
      product_detail: 'Single Payment NEQUI order for %s',
      singlepayment_nequico: {
        shopper_email: 'shopper@example.com',
        holder_name: 'JW L',
        telephone_number: '575555555555',
        tax_type: 'CC',
        personal_tax_id: '36570630563',
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
      },
    },
  },
  co_pse: {
    product_no: 'DEP-SINGLEPAYMENT-PSECO-COP',
    amount: { amount: '1000', currency_code: 'COP' },
    return_url: env.callbackUrlDeposit,
    payment_order: {
      country_code: 'CO',
      product_detail: 'Single Payment PSE order for %s',
      singlepayment_pseco: {
        shopper_email: 'shopper@example.com',
        holder_name: 'JW L',
        telephone_number: '575555555555',
        bank_name: '1001',
        tax_type: 'PPT',
        personal_tax_id: '36570630563',
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
      },
    },
  },
  th_rabbit_linepay: {
    product_no: 'DEP-SINGLEPAYMENT-RABBITLINEPAY-THB',
    amount: { amount: '100.00', currency_code: 'THB' },
    return_url: env.callbackUrlDeposit,
    payment_order: {
      country_code: 'TH',
      product_detail: 'Single Payment Rabbit LINE Pay order for %s',
      singlepayment_rabbitlinepay: {
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
        shopper_email: 'shopper@example.com',
        holder_name: 'Rabbit User',
        browser_info: {
          os_type: 'ANDROID',
          terminal_type: 'APP',
        },
      },
    },
  },
  my_tng: {
    product_no: 'DEP-SINGLEPAYMENT-TNG-MYR',
    amount: { amount: '45.00', currency_code: 'MYR' },
    return_url: env.callbackUrlDeposit,
    payment_order: {
      country_code: 'MY',
      product_detail: 'Single Payment TNG order for %s',
      singlepayment_tng: {
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
        shopper_email: 'shopper@example.com',
        holder_name: 'Test User',
        browser_info: {
          os_type: 'IOS',
          terminal_type: 'APP',
        },
      },
    },
  },
});

export const createDepositPayload = (
  env: CliEnv,
  channel: DepositChannel,
  makeId: (prefix: string) => string,
  overrides: DepositRequestOverrides = {},
): DepositPayload => {
  const template = createDepositTemplates(env)[channel];
  const payload: DepositPayload = {
    product_no: overrides.productNo || template.product_no,
    merchant_ref: overrides.merchantRef || makeId('TEST_ORDER_'),
    amount: {
      amount: overrides.amount || template.amount.amount,
      currency_code: overrides.currencyCode || template.amount.currency_code,
    },
  };
  const signFields = ['amount.amount', 'amount.currency_code', 'merchant_ref', 'product_no'];

  if (overrides.returnUrl ?? template.return_url) {
    payload.return_url = overrides.returnUrl ?? template.return_url;
  }

  if (overrides.collect) {
    payload.payment_order = {
      collect: overrides.collect,
    };
  } else if (template.payment_order) {
    payload.payment_order = template.payment_order;
  }

  if (template.issue_invoice !== undefined && !overrides.collect) {
    payload.issue_invoice = template.issue_invoice;
  }

  if (template.invoice && !overrides.collect) {
    payload.invoice = template.invoice;
  }

  return {
    ...payload,
    sign: generateSign(payload, signFields, overrides.signKey || env.signKey),
  };
};

export const createDepositRequest = (
  env: CliEnv,
  channel: DepositChannel,
  makeId: (prefix: string) => string,
  overrides: DepositRequestOverrides = {},
): CommandRequest => ({
  name: `deposit:create:${channel}`,
  method: 'POST',
  url: joinUrl(overrides.baseUrl || env.baseUrl, overrides.depositUrl || env.depositUrl),
  headers: {
    Authorization: `ApiKey ${overrides.apiKey || env.tokens.deposit}`,
    'Content-Type': 'application/json',
  },
  payload: createDepositPayload(env, channel, makeId, overrides),
});

const cloneUnknown = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const createStructuredDepositPayload = (
  env: CliEnv,
  channel: DepositChannel,
  makeId: (prefix: string) => string,
  overrides: StructuredDepositRequestOverrides,
): DepositPayload => {
  const template = createDepositTemplates(env)[channel];
  const channelValues = cloneUnknown(overrides.channelValues || {});
  const payload = {
    product_no: overrides.commonValues.productNo || template.product_no,
    merchant_ref: overrides.commonValues.merchantRef || makeId('TEST_ORDER_'),
    amount: {
      amount: overrides.commonValues.amount || template.amount.amount,
      currency_code: overrides.commonValues.currencyCode || template.amount.currency_code,
    },
    ...(channelValues as Record<string, unknown>),
  } as DepositPayload;
  const signFields = ['amount.amount', 'amount.currency_code', 'merchant_ref', 'product_no'];

  if (overrides.commonValues.returnUrl || template.return_url) {
    payload.return_url = overrides.commonValues.returnUrl || template.return_url;
  }

  return {
    ...payload,
    sign: generateSign(payload, signFields, overrides.signKey || env.signKey),
  };
};

export const createStructuredDepositRequest = (
  env: CliEnv,
  channel: DepositChannel,
  makeId: (prefix: string) => string,
  overrides: StructuredDepositRequestOverrides,
): CommandRequest => ({
  name: `deposit:create:${channel}`,
  method: 'POST',
  url: joinUrl(overrides.baseUrl || env.baseUrl, overrides.depositUrl || env.depositUrl),
  headers: {
    Authorization: `ApiKey ${overrides.apiKey || env.tokens.deposit}`,
    'Content-Type': 'application/json',
  },
  payload: createStructuredDepositPayload(env, channel, makeId, overrides),
});
