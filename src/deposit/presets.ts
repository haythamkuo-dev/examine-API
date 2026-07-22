import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import {
  DEPOSIT_CHANNELS,
  resolveDepositApiKey,
  type CliEnv,
  type DepositChannel,
} from '../core/env';
import type {
  DepositChannelValues,
  DepositCommonValues,
  DepositDefaultsResponse,
  DepositFieldMap,
  DepositFormValues,
} from './web';

const textField = (label: string, required = false) => ({
  kind: 'text' as const,
  label,
  required,
});

const textareaField = (label: string, required = false) => ({
  kind: 'textarea' as const,
  label,
  required,
});

const selectField = (
  label: string,
  options: Array<{ label: string; value: string }>,
  required = false,
) => ({
  kind: 'select' as const,
  label,
  options,
  required,
});

const booleanField = (label: string, required = false) => ({
  kind: 'boolean' as const,
  label,
  required,
});

const objectField = (label: string, fields: DepositFieldMap) => ({
  kind: 'object' as const,
  label,
  fields,
});

const arrayField = (label: string, itemLabel: string, itemSchema: DepositFieldMap) => ({
  kind: 'array' as const,
  label,
  itemLabel,
  itemSchema: objectField(itemLabel, itemSchema),
});

export type DepositCommonConfig = {
  schema: DepositFieldMap;
  values: Partial<DepositCommonValues>;
};

export type DepositChannelConfig = {
  commonValues: Partial<DepositCommonValues>;
  schema: DepositFieldMap;
  values: DepositChannelValues;
};

export type DepositPresetStore = {
  common: DepositCommonConfig;
  channels: Record<DepositChannel, DepositChannelConfig>;
};

export type DepositPresetSource = {
  common?: Partial<DepositCommonConfig>;
  channels?: Partial<Record<DepositChannel, Partial<DepositChannelConfig>>>;
};

const COMMON_SCHEMA: DepositFieldMap = {
  productNo: textField('Product number', true),
  merchantRef: textField('Merchant reference', true),
  amount: textField('Amount', true),
  currencyCode: textField('Currency code', true),
  returnUrl: textField('Return URL', true),
};

const SOUTH_AFRICA_SCHEMA: DepositFieldMap = {
  payment_order: objectField('Payment order', {
    collect: objectField('Collect payload', {
      country_code: textField('Country code', true),
      product_detail: textareaField('Product detail', true),
      product_name: textField('Product name', true),
      shopper_reference: textField('Shopper reference', true),
      origin: textField('Origin', true),
    }),
  }),
};

const JCB_SCHEMA = SOUTH_AFRICA_SCHEMA;

const SIMPLE_COLLECT_SCHEMA: DepositFieldMap = {
  payment_order: objectField('Payment order', {
    collect: objectField('Collect payload', {
      country_code: textField('Country code', true),
      product_detail: textareaField('Product detail', true),
      product_name: textField('Product name', true),
    }),
  }),
};

const LINEPAY_PACKAGE_SCHEMA: DepositFieldMap = {
  id: textField('Package ID', true),
  name: textField('Package name', true),
  amount: textField('Package amount', true),
  products: arrayField('Products', 'Product', {
    id: textField('Product ID', true),
    name: textField('Product name', true),
    quantity: textField('Quantity', true),
    price: textField('Price', true),
  }),
};

const LINEPAY_SCHEMA: DepositFieldMap = {
  checkout_url_type: selectField(
    'Checkout URL type',
    [
      { label: 'Direct', value: 'direct' },
      { label: 'LionPage', value: 'lionpage' },
    ],
    false,
  ),
  payment_order: objectField('Payment order', {
    linepay_online: objectField('LINE Pay online', {
      confirm_url: textField('Confirm URL', true),
      cancel_url: textField('Cancel URL', true),
      packages: arrayField('Packages', 'Package', LINEPAY_PACKAGE_SCHEMA),
    }),
  }),
};

const LINEPAY_INVOICE_SCHEMA: DepositFieldMap = {
  ...LINEPAY_SCHEMA,
  issue_invoice: booleanField('Issue invoice', true),
  invoice: objectField('Invoice', {
    relate_number: textField('Relate number', true),
    print: textField('Print', true),
    donation: textField('Donation', true),
    tax_type: textField('Tax type', true),
    sales_amount: textField('Sales amount', true),
    inv_type: textField('Invoice type', true),
    vat: textField('VAT', true),
    customer_email: textField('Customer email', true),
    items: arrayField('Invoice items', 'Invoice item', {
      item_seq: textField('Item sequence', true),
      item_name: textField('Item name', true),
      item_count: textField('Item count', true),
      item_word: textField('Item unit', true),
      item_price: textField('Item price', true),
      item_amount: textField('Item amount', true),
    }),
  }),
};

const UPI_SCHEMA: DepositFieldMap = {
  checkout_url_type: selectField(
    'Checkout URL type',
    [
      { label: 'Direct', value: 'direct' },
      { label: 'LionPage', value: 'lionpage' },
    ],
    false,
  ),
};

const WORLDPAY_SCHEMA: DepositFieldMap = {
  payment_order: objectField('Payment order', {
    worldpay: objectField('Worldpay', {
      payer_key: textField('Payer key', true),
      payer_name: textField('Payer name', true),
    }),
  }),
};

const CO_BASE_FIELDS: DepositFieldMap = {
  country_code: textField('Country code', true),
  product_detail: textareaField('Product detail', true),
};

const CO_BANK_TRANSFER_SCHEMA: DepositFieldMap = {
  payment_order: objectField('Payment order', {
    ...CO_BASE_FIELDS,
    singlepayment_banktransferco: objectField('Bank transfer', {
      shopper_email: textField('Shopper email', true),
      bank_name: textField('Bank name', true),
      tax_type: textField('Tax type', true),
      personal_tax_id: textField('Personal tax ID', true),
      origin: textField('Origin', true),
      shopper_reference: textField('Shopper reference', true),
    }),
  }),
};

const CO_CASH_SCHEMA: DepositFieldMap = {
  payment_order: objectField('Payment order', {
    ...CO_BASE_FIELDS,
    singlepayment_cashco: objectField('Cash payment', {
      shopper_email: textField('Shopper email', true),
      bank_name: textField('Bank name', true),
      origin: textField('Origin', true),
      shopper_reference: textField('Shopper reference', true),
    }),
  }),
};

const CO_NEQUI_SCHEMA: DepositFieldMap = {
  payment_order: objectField('Payment order', {
    ...CO_BASE_FIELDS,
    singlepayment_nequico: objectField('Nequi', {
      shopper_email: textField('Shopper email', true),
      holder_name: textField('Holder name', true),
      telephone_number: textField('Telephone number', true),
      tax_type: textField('Tax type', true),
      personal_tax_id: textField('Personal tax ID', true),
      origin: textField('Origin', true),
      shopper_reference: textField('Shopper reference', true),
    }),
  }),
};

const CO_PSE_SCHEMA: DepositFieldMap = {
  payment_order: objectField('Payment order', {
    ...CO_BASE_FIELDS,
    singlepayment_pseco: objectField('PSE', {
      shopper_email: textField('Shopper email', true),
      holder_name: textField('Holder name', true),
      telephone_number: textField('Telephone number', true),
      bank_name: textField('Bank name', true),
      tax_type: textField('Tax type', true),
      personal_tax_id: textField('Personal tax ID', true),
      origin: textField('Origin', true),
      shopper_reference: textField('Shopper reference', true),
    }),
  }),
};

const TH_RABBIT_SCHEMA: DepositFieldMap = {
  payment_order: objectField('Payment order', {
    country_code: textField('Country code', true),
    product_detail: textareaField('Product detail', true),
    singlepayment_rabbitlinepay: objectField('Rabbit LINE Pay', {
      origin: textField('Origin', true),
      shopper_reference: textField('Shopper reference', true),
      shopper_email: textField('Shopper email', true),
      holder_name: textField('Holder name', true),
      browser_info: objectField('Browser info', {
        os_type: textField('OS type', true),
        terminal_type: textField('Terminal type', true),
      }),
    }),
  }),
};

const TNG_SCHEMA: DepositFieldMap = {
  payment_order: objectField('Payment order', {
    country_code: textField('Country code', true),
    product_detail: textareaField('Product detail', true),
    singlepayment_tng: objectField('Touch n Go', {
      origin: textField('Origin', true),
      shopper_reference: textField('Shopper reference', true),
      shopper_email: textField('Shopper email', true),
      holder_name: textField('Holder name', true),
      browser_info: objectField('Browser info', {
        os_type: textField('OS type', true),
        terminal_type: textField('Terminal type', true),
      }),
    }),
  }),
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const getSeedCommonConfig = (env: CliEnv, makeId: (prefix: string) => string): DepositCommonConfig => ({
  schema: clone(COMMON_SCHEMA),
  values: {
    merchantRef: makeId('TEST_ORDER_'),
    returnUrl: env.callbackUrlDeposit || 'https://example.com/deposit-return',
  },
});

const getSeedChannelConfigs = (env: CliEnv): Record<DepositChannel, DepositChannelConfig> => ({
  southafrica_cards: {
    commonValues: {
      productNo: env.depositSouthAfricaCardsProductNo,
      amount: '99.00',
      currencyCode: 'USD',
    },
    schema: clone(SOUTH_AFRICA_SCHEMA),
    values: {
      payment_order: {
        collect: {
          country_code: 'US',
          product_detail: 'Collect order for %s',
          product_name: 'Hugo industry',
          shopper_reference: 'CUSTOMER_001',
          origin: 'https://www.amazon.com/',
        },
      },
    },
  },
  linepay: {
    commonValues: {
      productNo: 'DEP-LINEPAY_ONLINE-ONLINE-TWD',
      amount: '100',
      currencyCode: 'TWD',
    },
    schema: clone(LINEPAY_SCHEMA),
    values: {
      checkout_url_type: 'direct',
      payment_order: {
        linepay_online: {
          confirm_url: 'https://merchant.example.com/linepay/confirm?merchant_ref=M-ORDER-LINEPAY-000001',
          cancel_url: 'https://merchant.example.com/linepay/cancel?merchant_ref=M-ORDER-LINEPAY-000001',
          packages: [
            {
              id: 'pkg-1',
              name: 'Default Package',
              amount: '100',
              products: [{ id: 'SKU-001', name: 'Sample Item', quantity: '1', price: '100' }],
            },
          ],
        },
      },
    },
  },
  linepay_invoice: {
    commonValues: {
      productNo: 'DEP-LINEPAY_ONLINE-ONLINE-TWD',
      amount: '120',
      currencyCode: 'TWD',
    },
    schema: clone(LINEPAY_INVOICE_SCHEMA),
    values: {
      checkout_url_type: 'direct',
      issue_invoice: true,
      payment_order: {
        linepay_online: {
          confirm_url: 'https://merchant.example.com/linepay/confirm?merchant_ref=M-ORDER-LINEPAY-INV-000001',
          cancel_url: 'https://merchant.example.com/linepay/cancel?merchant_ref=M-ORDER-LINEPAY-INV-000001',
          packages: [
            {
              id: 'pkg-1',
              name: 'Default Package',
              amount: '120',
              products: [{ id: 'SKU-001', name: 'Sample Item', quantity: '1', price: '120' }],
            },
          ],
        },
      },
      invoice: {
        relate_number: 'INV-20250101-000123',
        print: '0',
        donation: '0',
        tax_type: '1',
        sales_amount: '120',
        inv_type: '07',
        vat: '1',
        customer_email: 'buyer@example.com',
        items: [
          {
            item_seq: '1',
            item_name: 'Sample Item',
            item_count: '1',
            item_word: '件',
            item_price: '120',
            item_amount: '120',
          },
        ],
      },
    },
  },
  inr_upi: {
    commonValues: {
      productNo: 'DEP-EC-UPI-INR',
      amount: '100.00',
      currencyCode: 'INR',
    },
    schema: clone(UPI_SCHEMA),
    values: {
      checkout_url_type: 'direct',
    },
  },
  bdt_worldpay: {
    commonValues: {
      productNo: 'DEP-WORLDPAY-bkash-BDT',
      amount: '100.00',
      currencyCode: 'BDT',
    },
    schema: clone(WORLDPAY_SCHEMA),
    values: {
      payment_order: {
        worldpay: {
          payer_key: 'PAYER-001',
          payer_name: 'Amy',
        },
      },
    },
  },
  co_bank_transfer: {
    commonValues: {
      productNo: 'DEP-SINGLEPAYMENT-BANKTRANSFERCO-COP',
      amount: '1000',
      currencyCode: 'COP',
    },
    schema: clone(CO_BANK_TRANSFER_SCHEMA),
    values: {
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
  },
  co_cash: {
    commonValues: {
      productNo: 'DEP-SINGLEPAYMENT-CASHCO-COP',
      amount: '1000',
      currencyCode: 'COP',
    },
    schema: clone(CO_CASH_SCHEMA),
    values: {
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
  },
  co_nequi: {
    commonValues: {
      productNo: 'DEP-SINGLEPAYMENT-NEQUICO-COP',
      amount: '1000',
      currencyCode: 'COP',
    },
    schema: clone(CO_NEQUI_SCHEMA),
    values: {
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
  },
  co_pse: {
    commonValues: {
      productNo: 'DEP-SINGLEPAYMENT-PSECO-COP',
      amount: '1000',
      currencyCode: 'COP',
    },
    schema: clone(CO_PSE_SCHEMA),
    values: {
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
  },
  th_rabbit_linepay: {
    commonValues: {
      productNo: 'DEP-SINGLEPAYMENT-RABBITLINEPAY-THB',
      amount: '100.00',
      currencyCode: 'THB',
    },
    schema: clone(TH_RABBIT_SCHEMA),
    values: {
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
  },
  my_tng: {
    commonValues: {
      productNo: 'DEP-SINGLEPAYMENT-TNG-MYR',
      amount: '45.00',
      currencyCode: 'MYR',
    },
    schema: clone(TNG_SCHEMA),
    values: {
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
  },
  international_credit_cards: {
    commonValues: {
      productNo: 'DEP-FUTUREPAY_COLLECT-COLLECT-USD',
      amount: '99.99',
      currencyCode: 'USD',
    },
    schema: clone(SOUTH_AFRICA_SCHEMA),
    values: {
      payment_order: {
        collect: {
          country_code: 'US',
          product_detail: 'Collect order for %s',
          product_name: 'Collect Checkout',
          shopper_reference: 'CUSTOMER_001',
          origin: 'merchant.example.com',
        },
      },
    },
  },
  'JCB-USD': {
    commonValues: { productNo: 'DEP-FUTUREPAY_COLLECT-GENERALJCBCOLLECT-USD', amount: '99.99', currencyCode: 'USD' },
    schema: clone(JCB_SCHEMA),
    values: { payment_order: { collect: { country_code: 'US', product_detail: 'Collect order for %s', product_name: 'JCB for USD', shopper_reference: 'CUSTOMER_001', origin: 'merchant.example.com' } } },
  },
  'JCB-JPY': {
    commonValues: { productNo: 'DEP-FUTUREPAY_COLLECT-GENERALJCBCOLLECT-JPY', amount: '1000', currencyCode: 'JPY' },
    schema: clone(JCB_SCHEMA),
    values: { payment_order: { collect: { country_code: 'JP', product_detail: 'Collect order for %s', product_name: 'JCB for JPY', shopper_reference: 'CUSTOMER_001', origin: 'merchant.example.com' } } },
  },
  'ALIPAY-CNY': {
    commonValues: { productNo: 'DEP-FUTUREPAY_COLLECT-ALIPAYCN-CNY', amount: '188.00', currencyCode: 'CNY' },
    schema: clone(SIMPLE_COLLECT_SCHEMA),
    values: { payment_order: { collect: { country_code: 'CN', product_detail: 'Collect order for %s', product_name: 'aliPay for CNY' } } },
  },
  'ALIPAY-HKD': {
    commonValues: { productNo: 'DEP-FUTUREPAY_COLLECT-ALIPAYHK-HKD', amount: '188.00', currencyCode: 'HKD' },
    schema: clone(SIMPLE_COLLECT_SCHEMA),
    values: { payment_order: { collect: { country_code: 'HK', product_detail: 'Collect order for %s', product_name: 'aliPay for HKD' } } },
  },
  'WECHAT-HKD': {
    commonValues: { productNo: 'DEP-FUTUREPAY_COLLECT-HKWECHATPAYST-HKD', amount: '188.00', currencyCode: 'HKD' },
    schema: clone(SIMPLE_COLLECT_SCHEMA),
    values: { payment_order: { collect: { country_code: 'HK', product_detail: 'Collect order for %s', product_name: 'wechat for HKD' } } },
  },
  'ALIPAY-8000': { commonValues: { productNo: 'DEP-HONGYUNPAY-ALIPAY8000-CNY', amount: '100.00', currencyCode: 'CNY' }, schema: {}, values: {} },
  'ALIPAY-6014': { commonValues: { productNo: 'DEP-HONGYUNPAY-ALIPAY6014-CNY', amount: '120.00', currencyCode: 'CNY' }, schema: {}, values: {} },
  'WECHAT-6016': { commonValues: { productNo: 'DEP-HONGYUNPAY-WECHAT6016-CNY', amount: '150.00', currencyCode: 'CNY' }, schema: {}, values: {} },
});

export const createSeedDepositPresets = (
  env: CliEnv,
  makeId: (prefix: string) => string,
): DepositPresetStore => ({
  common: getSeedCommonConfig(env, makeId),
  channels: getSeedChannelConfigs(env),
});

const COMMON_VALUE_KEYS = ['merchantRef', 'returnUrl'] as const;
const CHANNEL_COMMON_KEYS = ['productNo', 'amount', 'currencyCode'] as const;

const normalizeCommonValues = (
  source: Partial<DepositCommonValues>,
  fallback: Partial<DepositCommonValues>,
): Partial<DepositCommonValues> => ({
  merchantRef: source.merchantRef || fallback.merchantRef,
  returnUrl: source.returnUrl || fallback.returnUrl,
});

const normalizeChannelCommonValues = (
  source: Partial<DepositCommonValues>,
  fallback: Partial<DepositCommonValues>,
): Partial<DepositCommonValues> => ({
  productNo: source.productNo || fallback.productNo,
  amount: source.amount || fallback.amount,
  currencyCode: source.currencyCode || fallback.currencyCode,
});

const normalizeCommonConfig = (
  source: Partial<DepositCommonConfig>,
  seed: DepositCommonConfig,
): DepositCommonConfig => ({
  schema: (source.schema as DepositFieldMap) || seed.schema,
  values: normalizeCommonValues(source.values || {}, seed.values),
});

const normalizeChannelConfig = (
  source: Partial<DepositChannelConfig>,
  seed: DepositChannelConfig,
): DepositChannelConfig => ({
  commonValues: normalizeChannelCommonValues(source.commonValues || {}, seed.commonValues),
  schema: (source.schema as DepositFieldMap) || seed.schema,
  values: source.values ? clone(source.values) : clone(seed.values),
});

export const normalizeDepositPresets = (
  source: DepositPresetSource,
  env: CliEnv,
  makeId: (prefix: string) => string,
): DepositPresetStore => {
  const seed = createSeedDepositPresets(env, makeId);

  return {
    common: normalizeCommonConfig(source.common || {}, seed.common),
    channels: DEPOSIT_CHANNELS.reduce((accumulator, channel) => {
      accumulator[channel] = normalizeChannelConfig(source.channels?.[channel] || {}, seed.channels[channel]);
      return accumulator;
    }, {} as Record<DepositChannel, DepositChannelConfig>),
  };
};

const buildFormValues = (
  channel: DepositChannel,
  store: DepositPresetStore,
): DepositFormValues => ({
  channel,
  commonValues: {
    productNo: store.channels[channel].commonValues.productNo || '',
    merchantRef: store.common.values.merchantRef || '',
    amount: store.channels[channel].commonValues.amount || '',
    currencyCode: store.channels[channel].commonValues.currencyCode || '',
    returnUrl: store.common.values.returnUrl || '',
  },
  channelValues: clone(store.channels[channel].values),
});

export const toDepositDefaultsResponse = (
  channel: DepositChannel,
  env: CliEnv,
  store: DepositPresetStore,
): DepositDefaultsResponse => ({
  apiKey: resolveDepositApiKey(env, channel),
  availableChannels: [...DEPOSIT_CHANNELS],
  channel,
  commonSchema: clone(store.common.schema),
  channelSchema: clone(store.channels[channel].schema),
  form: buildFormValues(channel, store),
});

const getCommonFilePath = (dirPath: string) => join(dirPath, 'common.json');
const getChannelFilePath = (dirPath: string, channel: DepositChannel) =>
  join(dirPath, 'channels', `${channel}.json`);

const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

export const loadDepositPresets = async ({
  dirPath,
  env,
  makeId,
}: {
  dirPath: string;
  env: CliEnv;
  makeId: (prefix: string) => string;
}): Promise<DepositPresetStore> => {
  const seed = createSeedDepositPresets(env, makeId);
  const commonSource = await readJsonFile<DepositCommonConfig>(getCommonFilePath(dirPath));
  const channels = await Promise.all(
    DEPOSIT_CHANNELS.map(async (channel) => [channel, await readJsonFile<DepositChannelConfig>(getChannelFilePath(dirPath, channel))] as const),
  );

  return normalizeDepositPresets(
    {
      common: commonSource || seed.common,
      // channels: Object.fromEntries(channels) as Partial<Record<DepositChannel, DepositChannelConfig>>,
      channels: Object.fromEntries(channels) as Record<DepositChannel, DepositChannelConfig>,

    },
    env,
    makeId,
  );
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

export const saveDepositPresets = async ({
  dirPath,
  presets,
}: {
  dirPath: string;
  presets: DepositPresetStore;
}): Promise<void> => {
  await writeJson(getCommonFilePath(dirPath), presets.common);

  await Promise.all(
    DEPOSIT_CHANNELS.map((channel) => writeJson(getChannelFilePath(dirPath, channel), presets.channels[channel])),
  );
};

const splitCommonValues = (
  values: DepositCommonValues,
): {
  shared: Partial<DepositCommonValues>;
  channelOwned: Partial<DepositCommonValues>;
} => ({
  shared: Object.fromEntries(COMMON_VALUE_KEYS.map((key) => [key, values[key]])) as Partial<DepositCommonValues>,
  channelOwned: Object.fromEntries(CHANNEL_COMMON_KEYS.map((key) => [key, values[key]])) as Partial<DepositCommonValues>,
});

export const updateDepositPreset = async ({
  dirPath,
  channel,
  values,
  env,
  makeId,
}: {
  dirPath: string;
  channel: DepositChannel;
  values: DepositFormValues;
  env: CliEnv;
  makeId: (prefix: string) => string;
}): Promise<DepositPresetStore> => {
  const presets = await loadDepositPresets({ dirPath, env, makeId });
  const splitValues = splitCommonValues(values.commonValues);

  presets.common.values = {
    ...presets.common.values,
    ...splitValues.shared,
  };
  presets.channels[channel] = {
    ...presets.channels[channel],
    commonValues: {
      ...presets.channels[channel].commonValues,
      ...splitValues.channelOwned,
    },
    values: clone(values.channelValues),
  };

  await writeJson(getCommonFilePath(dirPath), presets.common);
  await writeJson(getChannelFilePath(dirPath, channel), presets.channels[channel]);

  return presets;
};
