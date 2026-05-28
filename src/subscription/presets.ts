import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import {
  resolveSubscriptionPlan,
  SUBSCRIPTION_CHANNELS,
  type CliEnv,
  type SubscriptionChannel,
} from '../core/env';
import type { TargetEnvironment } from '../core/targetEnvironment';
import type {
  SubscriptionChannelValues,
  SubscriptionCommonValues,
  SubscriptionDefaultsResponse,
  SubscriptionFieldMap,
  SubscriptionFieldSchema,
  SubscriptionFormValues,
} from './web';

const merchantReferenceKey = 'merchant_ref';
const returnUrlKey = 'return_url';
const readonlyChannelValueKeys = ['subs_plan_id'] as const;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const textField = (label: string, required = false): SubscriptionFieldSchema => ({
  kind: 'text',
  label,
  required,
});

const numberField = (label: string, required = false): SubscriptionFieldSchema => ({
  kind: 'number',
  label,
  required,
});

const objectField = (label: string, fields: SubscriptionFieldMap): SubscriptionFieldSchema => ({
  kind: 'object',
  label,
  fields,
});

const arrayField = (
  label: string,
  itemLabel: string,
  itemSchema: SubscriptionFieldMap,
): SubscriptionFieldSchema => ({
  kind: 'array',
  label,
  itemLabel,
  itemSchema: {
    kind: 'object',
    label: itemLabel,
    fields: itemSchema,
  },
});

export type SubscriptionCommonConfig = {
  schema: SubscriptionFieldMap;
  values: Partial<SubscriptionCommonValues>;
};

export type SubscriptionChannelConfig = {
  schema: SubscriptionFieldMap;
  values: SubscriptionChannelValues;
};

export type SubscriptionPresetStore = {
  common: SubscriptionCommonConfig;
  channels: Record<SubscriptionChannel, SubscriptionChannelConfig>;
};

export type SubscriptionPresetSource = {
  common?: Partial<SubscriptionCommonConfig>;
  channels?: Partial<Record<SubscriptionChannel, Partial<SubscriptionChannelConfig>>>;
};

const COMMON_SCHEMA: SubscriptionFieldMap = {
  merchantRef: textField('Merchant reference', true),
  returnUrl: textField('Return URL', true),
};

const prettifyLabel = (value: string): string =>
  value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const inferSchemaFromValue = (key: string, value: unknown): SubscriptionFieldSchema => {
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

  if (typeof value === 'number' && Number.isFinite(value)) {
    return numberField(label, true);
  }

  return textField(label, true);
};

const inferSchemaMap = (values: Record<string, unknown>): SubscriptionFieldMap =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => !readonlyChannelValueKeys.includes(key as (typeof readonlyChannelValueKeys)[number]))
      .map(([key, value]) => [key, inferSchemaFromValue(key, value)]),
  );

const stripReadonlyChannelValues = (
  values: Record<string, unknown>,
): SubscriptionChannelValues =>
  Object.fromEntries(
    Object.entries(values).filter(
      ([key]) => !readonlyChannelValueKeys.includes(key as (typeof readonlyChannelValueKeys)[number]),
    ),
  );

const getSeedCommonConfig = (
  env: CliEnv,
  makeId: (prefix: string) => string,
): SubscriptionCommonConfig => ({
  schema: clone(COMMON_SCHEMA),
  values: {
    merchantRef: makeId('TEST_ORDER_'),
    returnUrl: env.callbackUrlSubscription || 'https://merchant.example.com/subscription/callback',
  },
});

const getChannelPayloadFilePath = (dirPath: string, channel: SubscriptionChannel): string =>
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

const fromCommonFile = (source: Record<string, unknown> | null): Partial<SubscriptionCommonConfig> => ({
  values: {
    merchantRef:
      typeof source?.[merchantReferenceKey] === 'string' ? (source[merchantReferenceKey] as string) : undefined,
    returnUrl:
      typeof source?.[returnUrlKey] === 'string' ? (source[returnUrlKey] as string) : undefined,
  },
});

const toCommonFile = (config: SubscriptionCommonConfig): Record<string, string> => ({
  [merchantReferenceKey]: config.values.merchantRef || '',
  [returnUrlKey]: config.values.returnUrl || '',
});

const getSeedChannelConfig = async (
  dirPath: string,
  channel: SubscriptionChannel,
): Promise<SubscriptionChannelConfig> => {
  const payload = (await readJsonFile<Record<string, unknown>>(getChannelPayloadFilePath(dirPath, channel))) || {};

  return {
    schema: inferSchemaMap(payload),
    values: clone(stripReadonlyChannelValues(payload)),
  };
};

/**
 * Creates the in-memory subscription preset store from the JSON source of truth.
 *
 * @param options Seed creation options.
 * @param options.dirPath Directory containing subscription preset JSON files.
 * @param options.env Runtime environment used for default fallback values.
 * @param options.makeId ID generator used to seed the default merchant reference.
 * @returns The normalized subscription preset store.
 */
export const createSeedSubscriptionPresets = async ({
  dirPath,
  env,
  makeId,
}: {
  dirPath: string;
  env: CliEnv;
  makeId: (prefix: string) => string;
}): Promise<SubscriptionPresetStore> => {
  const channels = await Promise.all(
    SUBSCRIPTION_CHANNELS.map(async (channel) => [channel, await getSeedChannelConfig(dirPath, channel)] as const),
  );

  return {
    common: getSeedCommonConfig(env, makeId),
    channels: Object.fromEntries(channels) as Record<SubscriptionChannel, SubscriptionChannelConfig>,
  };
};

const normalizeCommonConfig = (
  source: Partial<SubscriptionCommonConfig>,
  seed: SubscriptionCommonConfig,
): SubscriptionCommonConfig => ({
  schema: (source.schema as SubscriptionFieldMap) || seed.schema,
  values: {
    merchantRef: source.values?.merchantRef || seed.values.merchantRef,
    returnUrl: source.values?.returnUrl || seed.values.returnUrl,
  },
});

const normalizeChannelConfig = (
  source: Partial<SubscriptionChannelConfig>,
  seed: SubscriptionChannelConfig,
): SubscriptionChannelConfig => ({
  schema: (source.schema as SubscriptionFieldMap) || seed.schema,
  values: source.values ? clone(source.values) : clone(seed.values),
});

/**
 * Normalizes subscription preset data against the inferred schema and fallback values.
 *
 * @param source Partially loaded preset source.
 * @param seed Seed preset store derived from the subscription JSON files.
 * @returns A normalized preset store for all subscription channels.
 */
export const normalizeSubscriptionPresets = (
  source: SubscriptionPresetSource,
  seed: SubscriptionPresetStore,
): SubscriptionPresetStore => ({
  common: normalizeCommonConfig(source.common || {}, seed.common),
  channels: SUBSCRIPTION_CHANNELS.reduce((accumulator, channel) => {
    accumulator[channel] = normalizeChannelConfig(source.channels?.[channel] || {}, seed.channels[channel]);
    return accumulator;
  }, {} as Record<SubscriptionChannel, SubscriptionChannelConfig>),
});

const buildFormValues = (
  channel: SubscriptionChannel,
  store: SubscriptionPresetStore,
): SubscriptionFormValues => ({
  channel,
  commonValues: {
    merchantRef: store.common.values.merchantRef || '',
    returnUrl: store.common.values.returnUrl || '',
  },
  channelValues: clone(store.channels[channel].values),
});

/**
 * Converts the preset store into the defaults response consumed by the subscription UI.
 *
 * @param channel Selected subscription channel.
 * @param store Normalized preset store.
 * @returns The defaults response payload for the frontend.
 */
export const toSubscriptionDefaultsResponse = (
  channel: SubscriptionChannel,
  env: CliEnv,
  target: TargetEnvironment,
  store: SubscriptionPresetStore,
): SubscriptionDefaultsResponse => ({
  availableChannels: [...SUBSCRIPTION_CHANNELS],
  channel,
  resolvedPlanId: resolveSubscriptionPlan(env, channel, target),
  commonSchema: clone(store.common.schema),
  channelSchema: clone(store.channels[channel].schema),
  form: buildFormValues(channel, store),
});

/**
 * Loads subscription presets from disk and normalizes them against the channel source data.
 *
 * @param options Load options including directory, environment, and ID generator.
 * @param options.dirPath Directory containing subscription preset JSON files.
 * @param options.env Runtime environment used for fallback values.
 * @param options.makeId ID generator used to seed merchant references when missing.
 * @returns The normalized subscription preset store.
 */
export const loadSubscriptionPresets = async ({
  dirPath,
  env,
  makeId,
}: {
  dirPath: string;
  env: CliEnv;
  makeId: (prefix: string) => string;
}): Promise<SubscriptionPresetStore> => {
  const seed = await createSeedSubscriptionPresets({ dirPath, env, makeId });
  const commonSource = fromCommonFile(
    await readJsonFile<Record<string, unknown>>(getCommonFilePath(dirPath)),
  );

  return normalizeSubscriptionPresets(
    {
      common: commonSource,
    },
    seed,
  );
};

/**
 * Persists the subscription defaults for a single channel.
 *
 * @param options Update options.
 * @param options.dirPath Directory containing subscription preset JSON files.
 * @param options.channel Channel being updated.
 * @param options.values Form values to persist.
 * @param options.env Runtime environment used for fallback values.
 * @param options.makeId ID generator used when rebuilding normalized defaults.
 * @returns The updated normalized preset store.
 */
export const updateSubscriptionPreset = async ({
  dirPath,
  channel,
  values,
  env,
  makeId,
}: {
  dirPath: string;
  channel: SubscriptionChannel;
  values: SubscriptionFormValues;
  env: CliEnv;
  makeId: (prefix: string) => string;
}): Promise<SubscriptionPresetStore> => {
  const source: SubscriptionPresetSource = {
    common: {
      values: {
        merchantRef: values.commonValues.merchantRef,
        returnUrl: values.commonValues.returnUrl,
      },
    },
    channels: {
      [channel]: {
        values: clone(values.channelValues),
      },
    },
  };

  const seed = await createSeedSubscriptionPresets({ dirPath, env, makeId });
  const normalized = normalizeSubscriptionPresets(source, seed);

  await writeJson(getCommonFilePath(dirPath), toCommonFile(normalized.common));
  await writeJson(getChannelPayloadFilePath(dirPath, channel), normalized.channels[channel].values);

  return normalized;
};
