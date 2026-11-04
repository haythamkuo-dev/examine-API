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

type PresetInput<Channel extends string, Values> = {
  channel: Channel;
  values: Values;
};

export type PresetStorage<Channel extends string, FormValues, Presets> = {
  load: () => Promise<PresetStorageSnapshot<Channel, Presets>>;
  save: (input: PresetInput<Channel, FormValues>) => Promise<PresetStorageSnapshot<Channel, Presets>>;
};

type JsonPresetStorageOptions<Channel extends string, FormValues, Presets, PersistentValues> = {
  load: () => Promise<Presets>;
  save: (input: PresetInput<Channel, PersistentValues>) => Promise<Presets>;
  toPersistentInput: (
    input: PresetInput<Channel, FormValues>,
  ) => PresetInput<Channel, PersistentValues>;
  toPersistentProjection: (presets: Presets) => PersistentPresetProjection<Channel>;
};

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
  const toSnapshot = (presets: Presets): PresetStorageSnapshot<Channel, Presets> => ({
    presets,
    projection: options.toPersistentProjection(presets),
    updatedAt: null,
  });

  return {
    load: async () => toSnapshot(await options.load()),
    save: async (input) => toSnapshot(await options.save(options.toPersistentInput(input))),
  };
};
