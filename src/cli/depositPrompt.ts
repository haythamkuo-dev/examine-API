import { createInterface } from 'readline/promises';
import { readFile, writeFile } from 'fs/promises';
import type { CliEnv, DepositChannel } from '../core/env';
import { DEPOSIT_CHANNELS } from '../core/env';
import type { DepositCollectOverride, DepositRequestOverrides } from '../domains/deposit';

const TEST_DEPOSIT_DEFAULTS = {
  channel: DEPOSIT_CHANNELS[0] as DepositChannel,
  baseUrl: 'https://stage.sidediff.com',
  productNo: 'DEP-FUTUREPAY_COLLECT-COLLECT-USD',
  amount: '99.00',
  currencyCode: 'USD',
  collect: {
    country_code: 'US',
    product_detail: 'Collect order for %s',
    product_name: 'Hugo industry',
    shopper_reference: 'CUSTOMER_001',
    origin: 'https://www.amazon.com/',
  } satisfies DepositCollectOverride,
};

export type DepositPromptSeed = {
  channel?: DepositChannel;
  apiBaseUrl?: string;
  apiKey?: string;
  signKey?: string;
  productNo?: string;
  merchantRef?: string;
  amount?: string;
  currencyCode?: string;
  returnUrl?: string;
  countryCode?: string;
  productDetail?: string;
  productName?: string;
  shopperReference?: string;
  origin?: string;
};

export type DepositPromptResult = {
  channel: DepositChannel;
  overrides: DepositRequestOverrides;
};

type DepositPromptDeps = {
  env: CliEnv;
  seed?: DepositPromptSeed;
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  makeId: (prefix: string) => string;
  envFilePath?: string;
};

const isNonEmpty = (value: string): boolean => value.trim().length > 0;

const isValidUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const isValidAmount = (value: string): boolean => /^\d+(\.\d+)?$/.test(value);

const isValidCurrencyCode = (value: string): boolean => /^[A-Za-z]{3}$/.test(value);

const ask = async (
  rl: ReturnType<typeof createInterface>,
  label: string,
  options: {
    defaultValue?: string;
    validate?: (value: string) => boolean;
    errorMessage?: string;
    transform?: (value: string) => string;
  } = {},
): Promise<string> => {
  while (true) {
    const suffix = options.defaultValue ? ` [${options.defaultValue}]` : '';
    const raw = await rl.question(`${label}${suffix}: `);
    const value = (raw.trim() || options.defaultValue || '').trim();
    const transformed = options.transform ? options.transform(value) : value;

    if (!options.validate || options.validate(transformed)) {
      return transformed;
    }

    rl.write(`${options.errorMessage || 'Invalid value'}\n`);
  }
};

const askYesNo = async (
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: boolean,
): Promise<boolean> => {
  const defaultLabel = defaultValue ? 'Y/n' : 'y/N';

  while (true) {
    const raw = await rl.question(`${label} [${defaultLabel}]: `);
    const normalized = raw.trim().toLowerCase();

    if (!normalized) {
      return defaultValue;
    }

    if (['y', 'yes'].includes(normalized)) {
      return true;
    }

    if (['n', 'no'].includes(normalized)) {
      return false;
    }

    rl.write('Please answer y or n.\n');
  }
};

const getDefaultCollect = (seed?: DepositPromptSeed): DepositCollectOverride => {
  if (
    seed?.countryCode &&
    seed.productDetail &&
    seed.productName &&
    seed.shopperReference &&
    seed.origin
  ) {
    return {
      country_code: seed.countryCode,
      product_detail: seed.productDetail,
      product_name: seed.productName,
      shopper_reference: seed.shopperReference,
      origin: seed.origin,
    };
  }

  return TEST_DEPOSIT_DEFAULTS.collect;
};

export const upsertEnvValue = async (envFilePath: string, key: string, value: string): Promise<void> => {
  let content = '';

  try {
    content = await readFile(envFilePath, 'utf8');
  } catch {
    content = '';
  }

  const line = `${key}=${value}`;
  const lines = content ? content.split('\n') : [];
  const index = lines.findIndex((entry) => entry.startsWith(`${key}=`));

  if (index >= 0) {
    lines[index] = line;
  } else {
    if (lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push('');
    }
    lines.push(line);
  }

  await writeFile(envFilePath, lines.join('\n'));
};

export const promptDepositFlow = async ({
  env,
  seed,
  input,
  output,
  makeId,
  envFilePath = '.env',
}: DepositPromptDeps): Promise<DepositPromptResult> => {
  const rl = createInterface({ input, output });

  try {
    output.write('Deposit setup (press Enter to use test defaults)\n');

    const channel = seed?.channel || TEST_DEPOSIT_DEFAULTS.channel;
    const baseUrl = seed?.apiBaseUrl || env.baseUrl || TEST_DEPOSIT_DEFAULTS.baseUrl;

    let apiKey = seed?.apiKey || env.tokens.deposit;
    if (!apiKey) {
      apiKey = await ask(rl, 'Deposit API key', {
        validate: isNonEmpty,
        errorMessage: 'API key is required.',
      });
      await upsertEnvValue(envFilePath, 'NORMAL_MERCHANT_API_TOKEN', apiKey);
    }

    let signKey = seed?.signKey || env.signKey;
    if (!signKey) {
      signKey = await ask(rl, 'Sign key', {
        validate: isNonEmpty,
        errorMessage: 'Sign key is required.',
      });
      await upsertEnvValue(envFilePath, 'MERCHANT_SIGN', signKey);
    }

    const productNo = seed?.productNo || TEST_DEPOSIT_DEFAULTS.productNo || env.depositSouthAfricaCardsProductNo;
    const merchantRef = seed?.merchantRef || makeId('TEST_ORDER_');
    const amount = seed?.amount || TEST_DEPOSIT_DEFAULTS.amount;
    const currencyCode = (seed?.currencyCode || TEST_DEPOSIT_DEFAULTS.currencyCode).toUpperCase();

    let returnUrl = seed?.returnUrl || env.callbackUrlDeposit || '';
    if (!returnUrl) {
      returnUrl = await ask(rl, 'Return URL', {
        validate: isValidUrl,
        errorMessage: 'Enter a valid URL.',
      });
      await upsertEnvValue(envFilePath, 'CALLBACK_URL_DEPOSIT', returnUrl);
    }

    const defaultCollect = getDefaultCollect(seed);

    return {
      channel,
      overrides: {
        apiKey,
        baseUrl,
        signKey,
        productNo,
        merchantRef,
        amount,
        currencyCode,
        returnUrl,
        collect: defaultCollect,
      },
    };
  } finally {
    rl.close();
  }
};

export const confirmPrompt = async ({
  input,
  output,
  message,
}: {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  message: string;
}): Promise<boolean> => {
  const rl = createInterface({ input, output });

  try {
    return askYesNo(rl, message, false);
  } finally {
    rl.close();
  }
};
