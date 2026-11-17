import { join } from 'path';
import {
  resolveSubscriptionApiKey,
  resolveSubscriptionPlan,
  SUBSCRIPTION_CHANNEL_MANIFEST,
  SUBSCRIPTION_CHANNELS,
  type CliEnv,
  type SubscriptionChannel,
} from '../core/env';
import {
  stripTransientMerchantReferenceKeys,
  type PersistentPresetProjection,
  writePresetJsonObject,
} from '../core/presetStorage';
import {
  isNonBlankPresetString,
  isPresetJsonObject,
  readValidatedPresetJsonObject,
} from '../core/presetValidation';
import type { TargetEnvironment } from '../core/targetEnvironment';
import type {
  SubscriptionChannelValues,
  SubscriptionCommonValues,
  SubscriptionFormValues,
} from '../domains/subscription';
import type {
  SubscriptionDefaultsResponse,
  SubscriptionFieldMap,
  SubscriptionFieldSchema,
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
  merchantRef: textField('Merchant reference'),
  returnUrl: textField('Return URL', true),
};

const REQUIRED_SUBSCRIPTION_STRING_KEYS = [
  'interval_unit',
  'product_detail',
  'product_name',
  'consumer_id',
  'origin',
] as const;

const isFinitePresetNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const validateSubscriptionCommonProjection = (source: Record<string, unknown>): string | undefined => {
  if (!isNonBlankPresetString(source[returnUrlKey])) {
    return 'Subscription common preset return_url must be a non-blank string.';
  }

  const merchantReference = source[merchantReferenceKey];
  if (merchantReference !== undefined && !isNonBlankPresetString(merchantReference)) {
    return 'Subscription common preset merchant_ref must be a non-blank string when provided.';
  }

  return undefined;
};

const validateSubscriptionChannelProjection = (source: Record<string, unknown>): string | undefined => {
  if (!isPresetJsonObject(source.amount)) {
    return 'Subscription channel amount must be an object.';
  }

  if (!isNonBlankPresetString(source.amount.amount)) {
    return 'Subscription channel amount.amount must be a non-blank string.';
  }

  if (!isNonBlankPresetString(source.amount.currency_code)) {
    return 'Subscription channel amount.currency_code must be a non-blank string.';
  }

  for (const key of REQUIRED_SUBSCRIPTION_STRING_KEYS) {
    if (!isNonBlankPresetString(source[key])) {
      return `Subscription channel ${key} must be a non-blank string.`;
    }
  }

  if (!isFinitePresetNumber(source.interval_count)) {
    return 'Subscription channel interval_count must be a finite number.';
  }

  if (!isFinitePresetNumber(source.times)) {
    return 'Subscription channel times must be a finite number.';
  }

  if (!isPresetJsonObject(source.consumer_profile)) {
    return 'Subscription channel consumer_profile must be an object.';
  }

  for (const key of ['name', 'phone', 'email', 'country_code'] as const) {
    if (!isNonBlankPresetString(source.consumer_profile[key])) {
      return `Subscription channel consumer_profile.${key} must be a non-blank string.`;
    }
  }

  if (!isPresetJsonObject(source.payment_instrument)) {
    return 'Subscription channel payment_instrument must be an object.';
  }

  for (const key of ['os_type', 'terminal_type'] as const) {
    if (!isNonBlankPresetString(source.payment_instrument[key])) {
      return `Subscription channel payment_instrument.${key} must be a non-blank string.`;
    }
  }

  return undefined;
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
    returnUrl: env.callbackUrlSubscription || 'https://merchant.example.com/subscription/callback',
  },
});

const getChannelPayloadFilePath = (dirPath: string, channel: SubscriptionChannel): string => {
  const manifestEntry = SUBSCRIPTION_CHANNEL_MANIFEST.find((entry) => entry.channel === channel);
  if (!manifestEntry) {
    throw new TypeError(`Unsupported subscription channel: ${channel}`);
  }

  return join(dirPath, 'channels', manifestEntry.presetFile);
};

const getCommonFilePath = (dirPath: string): string => join(dirPath, 'common.json');

const fromCommonFile = (source: Record<string, unknown> | null): Partial<SubscriptionCommonConfig> => ({
  values: {
    merchantRef:
      typeof source?.[merchantReferenceKey] === 'string' ? (source[merchantReferenceKey] as string) : undefined,
    returnUrl:
      typeof source?.[returnUrlKey] === 'string' ? (source[returnUrlKey] as string) : undefined,
  },
});

const toCommonFile = (config: SubscriptionCommonConfig): Record<string, string> => ({
  [returnUrlKey]: config.values.returnUrl || '',
});

const getSeedChannelConfig = async (
  dirPath: string,
  channel: SubscriptionChannel,
): Promise<SubscriptionChannelConfig> => {
  const payload = await readValidatedPresetJsonObject<Record<string, unknown>>(
    getChannelPayloadFilePath(dirPath, channel),
    validateSubscriptionChannelProjection,
  );
  const channelValues = stripTransientMerchantReferenceKeys(stripReadonlyChannelValues(payload));

  return {
    schema: inferSchemaMap(channelValues),
    values: clone(channelValues),
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
    returnUrl: source.values?.returnUrl || seed.values.returnUrl,
  },
});

const normalizeChannelConfig = (
  source: Partial<SubscriptionChannelConfig>,
  seed: SubscriptionChannelConfig,
): SubscriptionChannelConfig => ({
  schema: (source.schema as SubscriptionFieldMap) || seed.schema,
  values: source.values
    ? clone(stripTransientMerchantReferenceKeys(source.values))
    : clone(seed.values),
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
  resolvedPlanId: string,
  store: SubscriptionPresetStore,
): SubscriptionFormValues => ({
  channel,
  commonValues: {
    returnUrl: store.common.values.returnUrl || '',
  },
  channelValues: {
    ...clone(store.channels[channel].values),
    subs_plan_id: resolvedPlanId,
  },
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
): SubscriptionDefaultsResponse => {
  const resolvedPlanId = resolveSubscriptionPlan(env, channel, target);

  return {
    apiKey: resolveSubscriptionApiKey(env),
    availableChannels: [...SUBSCRIPTION_CHANNELS],
    channel,
    resolvedPlanId,
    commonSchema: clone(store.common.schema),
    channelSchema: clone(store.channels[channel].schema),
    form: buildFormValues(channel, resolvedPlanId, store),
  };
};

/**
 * Maps a normalized subscription store to the persistent projection used by storage adapters.
 *
 * @param store Normalized subscription preset store, including legacy compatibility values.
 * @returns Persistent subscription values without the runtime-only merchant reference.
 */
export const toSubscriptionPersistentProjection = (
  store: SubscriptionPresetStore,
): PersistentPresetProjection<SubscriptionChannel> => ({
  commonValues: Object.fromEntries(
    Object.entries(store.common.values).filter(([key]) => key !== 'merchantRef'),
  ),
  channels: Object.fromEntries(
    SUBSCRIPTION_CHANNELS.map((channel) => [
      channel,
      {
        channelCommonValues: {},
        channelValues: clone(
          stripTransientMerchantReferenceKeys(stripReadonlyChannelValues(store.channels[channel].values)),
        ),
      },
    ]),
  ) as Record<SubscriptionChannel, { channelCommonValues: Record<string, unknown>; channelValues: Record<string, unknown> }>,
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
  const commonFilePath = getCommonFilePath(dirPath);
  const commonSource = fromCommonFile(
    await readValidatedPresetJsonObject<Record<string, unknown>>(
      commonFilePath,
      validateSubscriptionCommonProjection,
    ),
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
  const persistentChannelValues = clone(
    stripTransientMerchantReferenceKeys(stripReadonlyChannelValues(values.channelValues)),
  );
  const source: SubscriptionPresetSource = {
    common: {
      values: {
        returnUrl: values.commonValues.returnUrl,
      },
    },
    channels: {
      [channel]: {
        values: persistentChannelValues,
      },
    },
  };

  const seed = await createSeedSubscriptionPresets({ dirPath, env, makeId });
  const normalized = normalizeSubscriptionPresets(source, seed);

  await writePresetJsonObject(getCommonFilePath(dirPath), toCommonFile(normalized.common));
  await writePresetJsonObject(getChannelPayloadFilePath(dirPath, channel), persistentChannelValues);

  return normalized;
};
