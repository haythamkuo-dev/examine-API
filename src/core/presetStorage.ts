export type PresetJsonObject = Record<string, unknown>;

export type PersistentPresetChannelProjection = {
  channelCommonValues: PresetJsonObject;
  channelValues: PresetJsonObject;
};

export type PersistentPresetProjection<Channel extends string> = {
  commonValues: PresetJsonObject;
  channels: Record<Channel, PersistentPresetChannelProjection>;
};

export type PresetStorageSnapshot<Channel extends string, Presets> = {
  presets: Presets;
  projection: PersistentPresetProjection<Channel>;
  updatedAt: string | null;
};

export type PresetStorage<Channel extends string, FormValues, Presets> = {
  load: () => Promise<PresetStorageSnapshot<Channel, Presets>>;
  save: (input: {
    channel: Channel;
    values: FormValues;
  }) => Promise<PresetStorageSnapshot<Channel, Presets>>;
};

type JsonPresetStorageOptions<Channel extends string, FormValues, Presets> = {
  load: () => Promise<Presets>;
  save: (input: { channel: Channel; values: FormValues }) => Promise<Presets>;
  toPersistentProjection: (presets: Presets) => PersistentPresetProjection<Channel>;
};

/**
 * Creates the transitional JSON-backed preset adapter.
 *
 * The adapter exposes the persistent projection separately from the feature
 * store so a future PostgreSQL adapter can keep schema and operation-only
 * values outside the persistence boundary.
 *
 * @param options Loader, saver, and persistent projection mapper.
 * @returns A storage adapter that reports JSON snapshots without a database timestamp.
 */
export const createJsonPresetStorage = <Channel extends string, FormValues, Presets>(
  options: JsonPresetStorageOptions<Channel, FormValues, Presets>,
): PresetStorage<Channel, FormValues, Presets> => {
  const toSnapshot = (presets: Presets): PresetStorageSnapshot<Channel, Presets> => ({
    presets,
    projection: options.toPersistentProjection(presets),
    updatedAt: null,
  });

  return {
    load: async () => toSnapshot(await options.load()),
    save: async (input) => toSnapshot(await options.save(input)),
  };
};
