export type PresetJsonObject = Record<string, unknown>;

export type PresetFeature = 'deposit' | 'payout' | 'subscription';

export type PresetRowTimestamps = {
  createdAt: string;
  updatedAt: string;
};

export type PersistentPresetChannelProjection = {
  channelCommonValues: PresetJsonObject;
  channelValues: PresetJsonObject;
};

export type PersistentPresetProjection<Channel extends string> = {
  commonValues: PresetJsonObject;
  channels: Record<Channel, PersistentPresetChannelProjection>;
};

export type PresetStorageTimestamps<Channel extends string> = {
  feature: PresetRowTimestamps | null;
  channels: Record<Channel, PresetRowTimestamps | null>;
};

export type PresetStorageExpectedTimestamps<Channel extends string> = {
  featureUpdatedAt: string | null;
  channelUpdatedAt: string | null;
  channel: Channel;
};

export type PresetStorageSnapshot<Channel extends string, Presets> = {
  presets: Presets;
  projection: PersistentPresetProjection<Channel>;
  updatedAt: string | null;
  timestamps: PresetStorageTimestamps<Channel>;
};

const transientMerchantReferenceKeys = new Set([
  'merchantRef',
  'merchantReference',
  'merchant_ref',
  'merchant_reference',
]);

/**
 * Removes top-level runtime-only merchant reference keys from a channel payload.
 * Nested provider template values are preserved because they are part of the channel payload shape.
 *
 * @param values Channel payload values that may contain a transient merchant reference.
 * @returns A payload without top-level runtime-only merchant reference keys.
 */
export const stripTransientMerchantReferenceKeys = (
  values: object,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(values).filter(([key]) => !transientMerchantReferenceKeys.has(key)),
  );

export type PresetStorageInput<Channel extends string, Values> = {
  channel: Channel;
  values: Values;
  expected?: PresetStorageExpectedTimestamps<Channel>;
};

export type PresetStorage<Channel extends string, FormValues, Presets> = {
  load: () => Promise<PresetStorageSnapshot<Channel, Presets>>;
  save: (
    input: PresetStorageInput<Channel, FormValues>,
  ) => Promise<PresetStorageSnapshot<Channel, Presets>>;
};

type JsonPresetStorageOptions<Channel extends string, FormValues, Presets, PersistentValues> = {
  load: () => Promise<Presets>;
  save: (input: PresetStorageInput<Channel, PersistentValues>) => Promise<Presets>;
  toPersistentInput: (
    input: PresetStorageInput<Channel, FormValues>,
  ) => PresetStorageInput<Channel, PersistentValues>;
  toPersistentProjection: (presets: Presets) => PersistentPresetProjection<Channel>;
};

const emptyTimestamps = <Channel extends string>(
  projection: PersistentPresetProjection<Channel>,
): PresetStorageTimestamps<Channel> => ({
  feature: null,
  channels: Object.fromEntries(
    Object.keys(projection.channels).map((channel) => [channel, null]),
  ) as Record<Channel, null>,
});

/**
 * Creates the transitional JSON-backed preset adapter.
 *
 * The adapter exposes the persistent projection separately from the feature
 * store so a future PostgreSQL adapter can keep schema and operation-only
 * values outside the persistence boundary. The persistent input mapper runs
 * before the saver so feature writers cannot receive raw form values.
 *
 * @param options Loader, persistent input mapper, saver, and projection mapper.
 * @returns A storage adapter that reports JSON snapshots without a database timestamp.
 */
export const createJsonPresetStorage = <Channel extends string, FormValues, Presets, PersistentValues>(
  options: JsonPresetStorageOptions<Channel, FormValues, Presets, PersistentValues>,
): PresetStorage<Channel, FormValues, Presets> => {
  const toSnapshot = (presets: Presets): PresetStorageSnapshot<Channel, Presets> => {
    const projection = options.toPersistentProjection(presets);

    return {
      presets,
      projection,
      updatedAt: null,
      timestamps: emptyTimestamps(projection),
    };
  };

  return {
    load: async () => toSnapshot(await options.load()),
    save: async (input) => toSnapshot(await options.save(options.toPersistentInput(input))),
  };
};
