import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';

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

export type PresetStorageErrorKind =
  | 'not_found'
  | 'invalid'
  | 'unavailable'
  | 'conflict';

/**
 * Base error emitted by a preset storage adapter.
 *
 * The internal resource and cause are kept for server-side diagnostics. Route
 * boundaries should map `kind` to a safe public application error instead of
 * exposing adapter details.
 */
export class PresetStorageError extends Error {
  readonly kind: PresetStorageErrorKind;
  readonly resource?: string;

  /**
   * Creates a classified preset storage error.
   *
   * @param kind Storage failure classification.
   * @param message Internal diagnostic message.
   * @param options Optional resource and original cause.
   */
  constructor(
    kind: PresetStorageErrorKind,
    message: string,
    options?: { resource?: string; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'PresetStorageError';
    this.kind = kind;
    this.resource = options?.resource;
  }
}

/** Describes a preset source that is not present. */
export class PresetStorageNotFoundError extends PresetStorageError {
  /**
   * Creates a not-found storage error.
   *
   * @param resource Internal source identifier.
   * @param cause Original filesystem or adapter error.
   */
  constructor(resource: string, cause?: unknown) {
    super('not_found', 'Preset source was not found.', { resource, cause });
    this.name = 'PresetStorageNotFoundError';
  }
}

/** Describes malformed or schema-incompatible preset data. */
export class PresetStorageInvalidError extends PresetStorageError {
  /**
   * Creates an invalid-data storage error.
   *
   * @param message Safe internal diagnostic message.
   * @param options Optional source and original cause.
   */
  constructor(message: string, options?: { resource?: string; cause?: unknown }) {
    super('invalid', message, options);
    this.name = 'PresetStorageInvalidError';
  }
}

/** Describes filesystem or database availability failures. */
export class PresetStorageUnavailableError extends PresetStorageError {
  /**
   * Creates an unavailable-storage error.
   *
   * @param resource Internal source identifier.
   * @param cause Original filesystem or adapter error.
   */
  constructor(resource: string, cause?: unknown) {
    super('unavailable', 'Preset storage is unavailable.', { resource, cause });
    this.name = 'PresetStorageUnavailableError';
  }
}

/** Describes an optimistic-concurrency conflict during preset save. */
export class PresetStorageConflictError extends PresetStorageError {
  readonly feature: PresetFeature;
  readonly channel: string;

  /**
   * Creates a preset conflict error.
   *
   * @param feature Feature whose preset was concurrently changed.
   * @param channel Channel whose preset was concurrently changed.
   */
  constructor(feature: PresetFeature, channel: string) {
    super('conflict', `Preset ${feature}/${channel} was changed by another writer.`);
    this.name = 'PresetStorageConflictError';
    this.feature = feature;
    this.channel = channel;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isErrnoError = (error: unknown): error is { code?: unknown } =>
  typeof error === 'object' && error !== null && 'code' in error;

const defaultReadFileText = (filePath: string): Promise<string> => readFile(filePath, 'utf8');

/**
 * Reads and parses a top-level JSON object used by a preset adapter.
 *
 * Missing files, malformed JSON, and other filesystem failures intentionally
 * produce different typed errors so request-time loading cannot silently fall
 * back to code seeds.
 *
 * @param filePath Preset source path.
 * @param readFileText Optional reader used by isolated adapter tests.
 * @returns The parsed JSON object cast to the caller's schema type.
 * @throws {PresetStorageNotFoundError} When the source does not exist.
 * @throws {PresetStorageInvalidError} When the source is not valid JSON object data.
 * @throws {PresetStorageUnavailableError} When the source cannot be read.
 */
export const readPresetJsonObject = async <T>(
  filePath: string,
  readFileText: (path: string) => Promise<string> = defaultReadFileText,
): Promise<T> => {
  let content: string;
  try {
    content = await readFileText(filePath);
  } catch (error) {
    if (isErrnoError(error) && error.code === 'ENOENT') {
      throw new PresetStorageNotFoundError(filePath, error);
    }

    throw new PresetStorageUnavailableError(filePath, error);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new PresetStorageInvalidError('Preset JSON is invalid.', {
      resource: filePath,
      cause: error,
    });
  }

  if (!isRecord(parsed)) {
    throw new PresetStorageInvalidError('Preset JSON must be a top-level object.', {
      resource: filePath,
    });
  }

  return parsed as T;
};

/**
 * Writes a JSON preset source while preserving storage availability semantics.
 *
 * @param filePath Preset source path.
 * @param value JSON-serializable value to write.
 * @returns Resolves after the source is written.
 * @throws {PresetStorageUnavailableError} When the source cannot be created or written.
 */
export const writePresetJsonObject = async (filePath: string, value: unknown): Promise<void> => {
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  } catch (error) {
    throw new PresetStorageUnavailableError(filePath, error);
  }
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

/**
 * Describes a preset write together with the snapshot used for optimistic
 * concurrency control.
 *
 * @param Channel Channel identifier type.
 * @param Values Feature form values accepted by the adapter.
 */
export type PresetStorageInput<Channel extends string, Values> = {
  channel: Channel;
  values: Values;
  expected: PresetStorageExpectedTimestamps<Channel>;
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
