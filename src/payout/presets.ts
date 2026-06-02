import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import {
  PAYOUT_CHANNELS,
  resolvePayoutApiKey,
  type CliEnv,
  type PayoutChannel,
} from '../core/env';
import type {
  PayoutChannelValues,
  PayoutCommonValues,
  PayoutDefaultsResponse,
  PayoutFieldMap,
  PayoutFieldSchema,
  PayoutFormValues,
} from './web';

const merchantReferenceKey = 'merchant_reference';
const optionalFieldMarker = '非必填';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const textField = (label: string, required = false): PayoutFieldSchema => ({
  kind: 'text',
  label,
  required,
});

const objectField = (label: string, fields: PayoutFieldMap): PayoutFieldSchema => ({
  kind: 'object',
  label,
  fields,
});

const arrayField = (label: string, itemLabel: string, itemSchema: PayoutFieldMap): PayoutFieldSchema => ({
  kind: 'array',
  label,
  itemLabel,
  itemSchema: {
    kind: 'object',
    label: itemLabel,
    fields: itemSchema,
  },
});

export type PayoutCommonConfig = {
  schema: PayoutFieldMap;
  values: Partial<PayoutCommonValues>;
};

export type PayoutChannelConfig = {
  schema: PayoutFieldMap;
  values: PayoutChannelValues;
};

export type PayoutPresetStore = {
  common: PayoutCommonConfig;
  channels: Record<PayoutChannel, PayoutChannelConfig>;
};

export type PayoutPresetSource = {
  common?: Partial<PayoutCommonConfig>;
  channels?: Partial<Record<PayoutChannel, Partial<PayoutChannelConfig>>>;
};

const COMMON_SCHEMA: PayoutFieldMap = {
  merchantReference: textField('Merchant reference', true),
};

const prettifyLabel = (value: string): string =>
  value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const isOptionalPlaceholder = (value: unknown): boolean =>
  typeof value === 'string' && value.includes(optionalFieldMarker);

const inferSchemaFromValue = (
  key: string,
  value: unknown,
): PayoutFieldSchema => {
  const label = prettifyLabel(key);

  if (Array.isArray(value)) {
    const firstItem = value[0];
    const itemSchema =
      firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)
        ? inferSchemaMap(firstItem as Record<string, unknown>)
        : { value: textField('Value', true) };

    return arrayField(label, `${label} item`, itemSchema);
  }

  if (value && typeof value === 'object') {
    return objectField(label, inferSchemaMap(value as Record<string, unknown>));
  }

  return textField(label, !isOptionalPlaceholder(value));
};

const inferSchemaMap = (values: Record<string, unknown>): PayoutFieldMap =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, inferSchemaFromValue(key, value)]),
  );

const getSeedCommonConfig = (
  makeId: (prefix: string) => string,
): PayoutCommonConfig => ({
  schema: clone(COMMON_SCHEMA),
  values: {
    merchantReference: makeId('TEST_ORDER_'),
  },
});

const getChannelPayloadFilePath = (dirPath: string, channel: PayoutChannel): string =>
  join(dirPath, 'channels', `${channel}.json`);

const getCommonFilePath = (dirPath: string): string => join(dirPath, 'common.json');

const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const fromCommonFile = (source: Record<string, unknown> | null): Partial<PayoutCommonConfig> => ({
  values: {
    merchantReference:
      typeof source?.[merchantReferenceKey] === 'string' ? (source[merchantReferenceKey] as string) : undefined,
  },
});

const toCommonFile = (config: PayoutCommonConfig): Record<string, string> => ({
  [merchantReferenceKey]: config.values.merchantReference || '',
});

const getSeedChannelConfig = async (
  dirPath: string,
  channel: PayoutChannel,
): Promise<PayoutChannelConfig> => {
  const payload = (await readJsonFile<Record<string, unknown>>(getChannelPayloadFilePath(dirPath, channel))) || {};
  const { [merchantReferenceKey]: _merchantReference, ...channelValues } = payload;

  return {
    schema: inferSchemaMap(channelValues),
    values: clone(channelValues),
  };
};

/**
 * Creates the in-memory payout preset store from the JSON source of truth.
 *
 * @param dirPath Directory containing payout preset JSON files.
 * @param makeId ID generator used to seed the default merchant reference.
 * @returns The normalized payout preset store.
 */
export const createSeedPayoutPresets = async ({
  dirPath,
  makeId,
}: {
  dirPath: string;
  makeId: (prefix: string) => string;
}): Promise<PayoutPresetStore> => {
  const channels = await Promise.all(
    PAYOUT_CHANNELS.map(async (channel) => [channel, await getSeedChannelConfig(dirPath, channel)] as const),
  );

  return {
    common: getSeedCommonConfig(makeId),
    channels: Object.fromEntries(channels) as Record<PayoutChannel, PayoutChannelConfig>,
  };
};

const normalizeCommonConfig = (
  source: Partial<PayoutCommonConfig>,
  seed: PayoutCommonConfig,
): PayoutCommonConfig => ({
  schema: (source.schema as PayoutFieldMap) || seed.schema,
  values: {
    merchantReference: source.values?.merchantReference || seed.values.merchantReference,
  },
});

const normalizeChannelConfig = (
  source: Partial<PayoutChannelConfig>,
  seed: PayoutChannelConfig,
): PayoutChannelConfig => ({
  schema: (source.schema as PayoutFieldMap) || seed.schema,
  values: source.values ? clone(source.values) : clone(seed.values),
});

/**
 * Normalizes payout preset data against the inferred schema and fallback values.
 *
 * @param source Partially loaded preset source.
 * @param seed Seed preset store derived from the payout JSON files.
 * @returns A normalized preset store for all payout channels.
 */
export const normalizePayoutPresets = (
  source: PayoutPresetSource,
  seed: PayoutPresetStore,
): PayoutPresetStore => ({
  common: normalizeCommonConfig(source.common || {}, seed.common),
  channels: PAYOUT_CHANNELS.reduce((accumulator, channel) => {
    accumulator[channel] = normalizeChannelConfig(source.channels?.[channel] || {}, seed.channels[channel]);
    return accumulator;
  }, {} as Record<PayoutChannel, PayoutChannelConfig>),
});

const buildFormValues = (
  channel: PayoutChannel,
  store: PayoutPresetStore,
): PayoutFormValues => ({
  channel,
  commonValues: {
    merchantReference: store.common.values.merchantReference || '',
  },
  channelValues: clone(store.channels[channel].values),
});

/**
 * Converts the preset store into the defaults response consumed by the payout UI.
 *
 * @param channel Selected payout channel.
 * @param store Normalized preset store.
 * @returns The defaults response payload for the frontend.
 */
export const toPayoutDefaultsResponse = (
  channel: PayoutChannel,
  env: CliEnv,
  store: PayoutPresetStore,
): PayoutDefaultsResponse => ({
  apiKey: resolvePayoutApiKey(env, channel),
  availableChannels: [...PAYOUT_CHANNELS],
  channel,
  commonSchema: clone(store.common.schema),
  channelSchema: clone(store.channels[channel].schema),
  form: buildFormValues(channel, store),
});

/**
 * Loads payout presets from disk and normalizes them against the channel source data.
 *
 * @param options Load options including directory and ID generator.
 * @param options.dirPath Directory containing payout preset JSON files.
 * @param options.makeId ID generator used to seed merchant references when missing.
 * @returns The normalized payout preset store.
 */
export const loadPayoutPresets = async ({
  dirPath,
  makeId,
}: {
  dirPath: string;
  makeId: (prefix: string) => string;
}): Promise<PayoutPresetStore> => {
  const seed = await createSeedPayoutPresets({ dirPath, makeId });
  const commonSource = fromCommonFile(
    await readJsonFile<Record<string, unknown>>(getCommonFilePath(dirPath)),
  );

  return normalizePayoutPresets(
    {
      common: commonSource,
      channels: seed.channels,
    },
    seed,
  );
};

/**
 * Persists the payout preset store back to disk.
 *
 * @param options Save options.
 * @param options.dirPath Directory containing payout preset JSON files.
 * @param options.presets Preset store to write.
 * @returns Resolves when all payout preset files are written.
 */
export const savePayoutPresets = async ({
  dirPath,
  presets,
}: {
  dirPath: string;
  presets: PayoutPresetStore;
}): Promise<void> => {
  await writeJson(getCommonFilePath(dirPath), toCommonFile(presets.common));

  await Promise.all(
    PAYOUT_CHANNELS.map((channel) => writeJson(getChannelPayloadFilePath(dirPath, channel), presets.channels[channel].values)),
  );
};

/**
 * Updates a single payout channel preset and writes the result to disk.
 *
 * @param options Update options.
 * @param options.dirPath Directory containing payout preset JSON files.
 * @param options.channel Channel being updated.
 * @param options.values Submitted form values to persist.
 * @param options.makeId ID generator used to seed merchant references when missing.
 * @returns The updated payout preset store.
 */
export const updatePayoutPreset = async ({
  dirPath,
  channel,
  values,
  makeId,
}: {
  dirPath: string;
  channel: PayoutChannel;
  values: PayoutFormValues;
  makeId: (prefix: string) => string;
}): Promise<PayoutPresetStore> => {
  const presets = await loadPayoutPresets({ dirPath, makeId });

  presets.common.values = {
    ...presets.common.values,
    merchantReference: values.commonValues.merchantReference,
  };
  presets.channels[channel] = {
    ...presets.channels[channel],
    values: clone(values.channelValues),
  };

  await writeJson(getCommonFilePath(dirPath), toCommonFile(presets.common));
  await writeJson(getChannelPayloadFilePath(dirPath, channel), presets.channels[channel].values);

  return presets;
};
