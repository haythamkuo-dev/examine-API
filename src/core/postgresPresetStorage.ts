import type { SQL } from 'bun';
import {
  stripTransientMerchantReferenceKeys,
  PresetStorageConflictError as BasePresetStorageConflictError,
  PresetStorageError,
  PresetStorageInvalidError,
  PresetStorageUnavailableError,
  type PersistentPresetProjection,
  type PresetFeature,
  type PresetRowTimestamps,
  type PresetStorage,
  type PresetStorageExpectedTimestamps,
  type PresetStorageInput,
  type PresetStorageSnapshot,
  type PresetStorageTimestamps,
} from './presetStorage';

type SqlExecutor = Pick<SQL, 'unsafe'>;

type PresetSetRow = {
  feature: string;
  common_values: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

type PresetChannelRow = {
  feature: string;
  channel: string;
  channel_common_values: unknown;
  channel_values: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

/**
 * Describes a stale preset write rejected by optimistic concurrency control.
 */
export class PresetStorageConflictError extends BasePresetStorageConflictError {
  /**
   * Creates a preset conflict error.
   *
   * @param feature Feature whose preset was concurrently changed.
   * @param channel Channel whose preset was concurrently changed.
   */
  constructor(feature: PresetFeature, channel: string) {
    super(feature, channel);
  }
}

/**
 * Describes invalid adapter configuration or data returned by PostgreSQL.
 */
export class PresetStorageDataError extends PresetStorageInvalidError {
  /**
   * Creates a preset storage data error.
   *
   * @param message Safe diagnostic message describing the invalid value.
   */
  constructor(message: string) {
    super(message);
    this.name = 'PresetStorageDataError';
  }
}

/**
 * Describes the PostgreSQL-backed persistent projection returned by the repository.
 */
export type PersistentPresetStorageSnapshot<Channel extends string> = {
  projection: PersistentPresetProjection<Channel>;
  updatedAt: string | null;
  timestamps: PresetStorageTimestamps<Channel>;
};

/**
 * Describes the projection and concurrency token for a single preset save.
 */
export type PersistentPresetSaveInput<Channel extends string> = {
  channel: Channel;
  projection: PersistentPresetProjection<Channel>;
  expected: PresetStorageExpectedTimestamps<Channel>;
};

/**
 * Provides canonical PostgreSQL read and save operations for a feature projection.
 */
export type PostgresPresetRepository<Channel extends string> = {
  load: () => Promise<PersistentPresetStorageSnapshot<Channel>>;
  save: (
    input: PersistentPresetSaveInput<Channel>,
  ) => Promise<PersistentPresetStorageSnapshot<Channel>>;
};

/**
 * Configures a PostgreSQL preset repository.
 */
export type PostgresPresetRepositoryOptions<Channel extends string> = {
  client: SQL;
  feature: PresetFeature;
  channels: readonly Channel[];
};

/**
 * Configures a feature-aware PostgreSQL storage adapter.
 */
export type PostgresPresetStorageOptions<Channel extends string, FormValues, Presets> =
  PostgresPresetRepositoryOptions<Channel> & {
    loadSeed: () => Promise<Presets>;
    fromPersistentProjection: (
      projection: PersistentPresetProjection<Channel>,
      seed: Presets,
    ) => Presets;
    applyInput: (
      current: Presets,
      input: PresetStorageInput<Channel, FormValues>,
    ) => Presets;
    toPersistentProjection: (
      presets: Presets,
    ) => PersistentPresetProjection<Channel>;
  };

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneJsonObject = (value: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

const encodeJsonObject = (
  value: unknown,
  fieldName: string,
): Record<string, unknown> => {
  if (!isJsonObject(value)) {
    throw new PresetStorageDataError(fieldName + ' must be a top-level JSON object.');
  }

  return value;
};

const normalizeTimestamp = (value: Date | string, fieldName: string): string => {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new PresetStorageDataError(fieldName + ' returned an invalid timestamp.');
  }

  return value instanceof Date ? value.toISOString() : value;
};

const toRowTimestamps = (
  row: Pick<PresetSetRow, 'created_at' | 'updated_at'>,
  prefix: string,
): PresetRowTimestamps => ({
  createdAt: normalizeTimestamp(row.created_at, prefix + '.created_at'),
  updatedAt: normalizeTimestamp(row.updated_at, prefix + '.updated_at'),
});

const createEmptyProjection = <Channel extends string>(
  channels: readonly Channel[],
): PersistentPresetProjection<Channel> => ({
  commonValues: {},
  channels: Object.fromEntries(
    channels.map((channel) => [
      channel,
      {
        channelCommonValues: {},
        channelValues: {},
      },
    ]),
  ) as Record<Channel, { channelCommonValues: Record<string, unknown>; channelValues: Record<string, unknown> }>,
});

const createEmptyTimestamps = <Channel extends string>(
  channels: readonly Channel[],
): PresetStorageTimestamps<Channel> => ({
  feature: null,
  channels: Object.fromEntries(channels.map((channel) => [channel, null])) as Record<Channel, null>,
});

const assertKnownChannels = <Channel extends string>(
  channels: readonly Channel[],
): Set<string> => {
  if (channels.length === 0) {
    throw new PresetStorageDataError('At least one preset channel is required.');
  }

  const knownChannels = new Set<string>();
  for (const channel of channels) {
    if (!channel.trim() || knownChannels.has(channel)) {
      throw new PresetStorageDataError('Preset channels must be unique and non-empty.');
    }
    knownChannels.add(channel);
  }

  return knownChannels;
};

const readProjection = <Channel extends string>(
  feature: PresetFeature,
  channels: readonly Channel[],
  setRows: PresetSetRow[],
  channelRows: PresetChannelRow[],
): PersistentPresetStorageSnapshot<Channel> => {
  const knownChannels = assertKnownChannels(channels);
  const projection = createEmptyProjection(channels);
  const timestamps = createEmptyTimestamps(channels);

  const setRow = setRows[0];
  if (setRows.length > 1) {
    throw new PresetStorageDataError('PostgreSQL returned duplicate preset set rows.');
  }

  if (setRow) {
    if (setRow.feature !== feature || !isJsonObject(setRow.common_values)) {
      throw new PresetStorageDataError('PostgreSQL returned an invalid preset set row.');
    }

    projection.commonValues = cloneJsonObject(setRow.common_values);
    timestamps.feature = toRowTimestamps(setRow, 'preset_sets');
  }

  for (const row of channelRows) {
    if (row.feature !== feature || !knownChannels.has(row.channel)) {
      throw new PresetStorageDataError(
        'PostgreSQL returned a channel outside the code-owned channel registry.',
      );
    }

    if (!isJsonObject(row.channel_common_values) || !isJsonObject(row.channel_values)) {
      throw new PresetStorageDataError('PostgreSQL returned an invalid preset channel row.');
    }

    projection.channels[row.channel as Channel] = {
      channelCommonValues: cloneJsonObject(row.channel_common_values),
      channelValues: cloneJsonObject(row.channel_values),
    };
    timestamps.channels[row.channel as Channel] = toRowTimestamps(
      row,
      'preset_channels.' + row.channel,
    );
  }

  return {
    projection,
    updatedAt: timestamps.feature?.updatedAt || null,
    timestamps,
  };
};

const readProjectionFromTransaction = async <Channel extends string>(
  transaction: SqlExecutor,
  feature: PresetFeature,
  channels: readonly Channel[],
): Promise<PersistentPresetStorageSnapshot<Channel>> => {
  const setRows = await transaction.unsafe<PresetSetRow[]>(
    `select feature, common_values, created_at::text as created_at, updated_at::text as updated_at
     from preset_store.preset_sets
     where feature = $1`,
    [feature],
  );
  const channelRows = await transaction.unsafe<PresetChannelRow[]>(
    `select feature, channel, channel_common_values, channel_values,
            created_at::text as created_at, updated_at::text as updated_at
     from preset_store.preset_channels
     where feature = $1
     order by channel`,
    [feature],
  );

  return readProjection(feature, channels, setRows, channelRows);
};

const writePresetSet = async (
  transaction: SqlExecutor,
  feature: PresetFeature,
  commonValues: Record<string, unknown>,
  expectedUpdatedAt: string | null,
): Promise<void> => {
  const encodedValues = encodeJsonObject(commonValues, 'common_values');
  const rows = expectedUpdatedAt === null
    ? await transaction.unsafe<PresetSetRow[]>(
        `insert into preset_store.preset_sets (feature, common_values)
         values ($1, $2::jsonb)
         on conflict (feature) do nothing
         returning feature, common_values, created_at, updated_at`,
        [feature, encodedValues],
      )
    : await transaction.unsafe<PresetSetRow[]>(
        `update preset_store.preset_sets
         set common_values = $2::jsonb
         where feature = $1 and updated_at = $3::timestamptz
         returning feature, common_values, created_at, updated_at`,
        [feature, encodedValues, expectedUpdatedAt],
      );

  if (!rows[0]) {
    throw new PresetStorageConflictError(feature, '*');
  }
};

const writePresetChannel = async (
  transaction: SqlExecutor,
  feature: PresetFeature,
  channel: string,
  channelCommonValues: Record<string, unknown>,
  channelValues: Record<string, unknown>,
  expectedUpdatedAt: string | null,
): Promise<void> => {
  const encodedCommonValues = encodeJsonObject(channelCommonValues, 'channel_common_values');
  const encodedValues = encodeJsonObject(channelValues, 'channel_values');
  const rows = expectedUpdatedAt === null
    ? await transaction.unsafe<PresetChannelRow[]>(
        `insert into preset_store.preset_channels
          (feature, channel, channel_common_values, channel_values)
         values ($1, $2, $3::jsonb, $4::jsonb)
         on conflict (feature, channel) do nothing
         returning feature, channel, channel_common_values, channel_values, created_at, updated_at`,
        [feature, channel, encodedCommonValues, encodedValues],
      )
    : await transaction.unsafe<PresetChannelRow[]>(
        `update preset_store.preset_channels
         set channel_common_values = $3::jsonb,
             channel_values = $4::jsonb
         where feature = $1 and channel = $2 and updated_at = $5::timestamptz
         returning feature, channel, channel_common_values, channel_values, created_at, updated_at`,
        [feature, channel, encodedCommonValues, encodedValues, expectedUpdatedAt],
      );

  if (!rows[0]) {
    throw new PresetStorageConflictError(feature, channel);
  }
};

const rethrowPostgresStorageError = (feature: PresetFeature, error: unknown): never => {
  if (error instanceof PresetStorageError) {
    throw error;
  }

  throw new PresetStorageUnavailableError(`postgres:${feature}`, error);
};

/**
 * Creates a PostgreSQL repository for one feature's preset projection.
 *
 * The repository never writes runtime-only merchant references. It updates the
 * feature row and selected channel row in one transaction and requires the
 * caller's expected timestamps for optimistic concurrency control.
 *
 * @param options PostgreSQL client, feature identity, and code-owned channels.
 * @returns A repository with canonical projection load and save operations.
 * @throws {PresetStorageDataError} When the channel registry or database data is invalid.
 */
export const createPostgresPresetRepository = <Channel extends string>(
  options: PostgresPresetRepositoryOptions<Channel>,
): PostgresPresetRepository<Channel> => {
  const knownChannels = assertKnownChannels(options.channels);

  const load = async (): Promise<PersistentPresetStorageSnapshot<Channel>> => {
    try {
      return await options.client.begin(async (transaction) => {
        await transaction.unsafe(
          'set transaction isolation level repeatable read',
        );

        return readProjectionFromTransaction(
          transaction,
          options.feature,
          options.channels,
        );
      });
    } catch (error) {
      return rethrowPostgresStorageError(options.feature, error);
    }
  };

  const save = async (
    input: PersistentPresetSaveInput<Channel>,
  ): Promise<PersistentPresetStorageSnapshot<Channel>> => {
    if (!knownChannels.has(input.channel)) {
      throw new PresetStorageDataError('Preset channel is outside the code-owned channel registry.');
    }

    if (input.expected.channel !== input.channel) {
      throw new PresetStorageDataError('Preset concurrency token channel does not match the save target.');
    }

    const channelProjection = input.projection.channels[input.channel];
    if (!channelProjection) {
      throw new PresetStorageDataError('Preset projection is missing the save target channel.');
    }

    const commonValues = stripTransientMerchantReferenceKeys(input.projection.commonValues);
    const channelCommonValues = stripTransientMerchantReferenceKeys(
      channelProjection.channelCommonValues,
    );
    const channelValues = stripTransientMerchantReferenceKeys(channelProjection.channelValues);

    try {
      return await options.client.begin(async (transaction) => {
        await writePresetSet(
          transaction,
          options.feature,
          commonValues,
          input.expected.featureUpdatedAt,
        );
        await writePresetChannel(
          transaction,
          options.feature,
          input.channel,
          channelCommonValues,
          channelValues,
          input.expected.channelUpdatedAt,
        );

        return readProjectionFromTransaction(
          transaction,
          options.feature,
          options.channels,
        );
      });
    } catch (error) {
      return rethrowPostgresStorageError(options.feature, error);
    }
  };

  return { load, save };
};

const sanitizeProjection = <Channel extends string>(
  projection: PersistentPresetProjection<Channel>,
): PersistentPresetProjection<Channel> => ({
  commonValues: stripTransientMerchantReferenceKeys(projection.commonValues),
  channels: Object.fromEntries(
    Object.entries(projection.channels).map(([channel, values]) => [channel, {
      channelCommonValues: stripTransientMerchantReferenceKeys(values.channelCommonValues),
      channelValues: stripTransientMerchantReferenceKeys(values.channelValues),
    }]),
  ) as Record<Channel, { channelCommonValues: Record<string, unknown>; channelValues: Record<string, unknown> }>,
});

/**
 * Creates a feature-aware PostgreSQL preset storage adapter.
 *
 * The adapter hydrates code-owned schemas from the supplied seed while taking
 * persistent values and concurrency timestamps exclusively from PostgreSQL.
 * A save must include the timestamp pair returned by the previous load.
 *
 * @param options Repository and feature-specific projection/hydration callbacks.
 * @returns A storage adapter compatible with the JSON preset storage boundary.
 * @throws {PresetStorageDataError} When a save omits its expected timestamps.
 */
export const createPostgresPresetStorage = <
  Channel extends string,
  FormValues,
  Presets,
>(
  options: PostgresPresetStorageOptions<Channel, FormValues, Presets>,
): PresetStorage<Channel, FormValues, Presets> => {
  const repository = createPostgresPresetRepository(options);

  const toSnapshot = (
    persistent: PersistentPresetStorageSnapshot<Channel>,
    seed: Presets,
  ): PresetStorageSnapshot<Channel, Presets> => ({
    presets: options.fromPersistentProjection(persistent.projection, seed),
    projection: persistent.projection,
    updatedAt: persistent.updatedAt,
    timestamps: persistent.timestamps,
  });

  const snapshotWithPresets = (
    persistent: PersistentPresetStorageSnapshot<Channel>,
    presets: Presets,
  ): PresetStorageSnapshot<Channel, Presets> => ({
    presets,
    projection: persistent.projection,
    updatedAt: persistent.updatedAt,
    timestamps: persistent.timestamps,
  });

  const load = async (): Promise<PresetStorageSnapshot<Channel, Presets>> => {
    const persistent = await repository.load();
    const seed = await options.loadSeed();
    return toSnapshot(persistent, seed);
  };

  const save = async (
    input: PresetStorageInput<Channel, FormValues>,
  ): Promise<PresetStorageSnapshot<Channel, Presets>> => {
    if (!input.expected) {
      throw new PresetStorageDataError(
        'PostgreSQL preset saves require feature and channel expected timestamps.',
      );
    }

    const currentPersistent = await repository.load();
    const seed = await options.loadSeed();
    const current = toSnapshot(currentPersistent, seed);
    const nextPresets = options.applyInput(current.presets, input);
    const nextProjection = sanitizeProjection(options.toPersistentProjection(nextPresets));
    const hydratedNextPresets = options.fromPersistentProjection(nextProjection, seed);
    const persistent = await repository.save({
      channel: input.channel,
      projection: nextProjection,
      expected: input.expected,
    });

    return snapshotWithPresets(persistent, hydratedNextPresets);
  };

  return {
    load,
    save,
  };
};
