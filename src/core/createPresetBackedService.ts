import { createRunner, type CommandRequest, type CommandResult, type HttpClient, type Logger } from '../runner';
import type {
  PresetStorageExpectedTimestamps,
  PresetStorageSnapshot,
} from './presetStorage';

export type PresetBackedService<
  Channel extends string,
  FormValues,
  Presets,
  DefaultsResponse,
  PreviewResponse,
  CreateResponse,
  ExecutionContext = void,
> = {
  getDefaults: (channel: Channel, context?: ExecutionContext) => Promise<DefaultsResponse>;
  saveDefaults: (
    channel: Channel,
    values: FormValues,
    context?: ExecutionContext,
  ) => Promise<DefaultsResponse & { ok: true }>;
  prepareOperation: (
    channel: Channel,
    values: FormValues,
    context?: ExecutionContext,
  ) => Promise<PresetOperationContext<Channel, FormValues, Presets, DefaultsResponse, ExecutionContext>>;
  preview: (
    operation: PresetOperationContext<Channel, FormValues, Presets, DefaultsResponse, ExecutionContext>,
  ) => PreviewResponse;
  execute: (
    operation: PresetOperationContext<Channel, FormValues, Presets, DefaultsResponse, ExecutionContext>,
  ) => Promise<CreateResponse>;
};

export type PresetOperationContext<
  Channel extends string,
  FormValues,
  Presets,
  DefaultsResponse,
  ExecutionContext,
> = {
  channel: Channel;
  values: FormValues;
  presets: Presets;
  defaults: DefaultsResponse;
  executionContext: ExecutionContext | undefined;
};

export type CreatePresetBackedServiceOptions<
  Channel extends string,
  FormValues,
  Presets,
  DefaultsResponse,
  PreviewResponse,
  CreateResponse,
  ExecutionContext = void,
> = {
  loadPresets: () => Promise<PresetStorageSnapshot<Channel, Presets>>;
  toDefaultsResponse: (
    channel: Channel,
    presets: Presets,
    context: ExecutionContext | undefined,
  ) => DefaultsResponse;
  hydrateValues?: (
    channel: Channel,
    values: FormValues,
    presets: Presets,
    context: ExecutionContext | undefined,
  ) => FormValues;
  updatePreset: (
    channel: Channel,
    values: FormValues,
    expected: PresetStorageExpectedTimestamps<Channel>,
  ) => Promise<Presets>;
  buildPreviewResponse: (values: FormValues, context: ExecutionContext) => PreviewResponse;
  buildRequestFromForm: (values: FormValues, context: ExecutionContext) => CommandRequest;
  buildCreateResponse: (result: CommandResult) => CreateResponse;
  logger: Logger;
  makeId: (prefix: string) => string;
  now?: () => Date;
  httpClient?: HttpClient;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type CloneTask = {
  value: unknown;
  assign: (value: unknown) => void;
};

const cloneValue = <Value,>(value: Value): Value => {
  let result: unknown;
  const tasks: CloneTask[] = [
    {
      value,
      assign: (clonedValue) => {
        result = clonedValue;
      },
    },
  ];

  while (tasks.length > 0) {
    const task = tasks.pop();
    if (!task) continue;

    if (Array.isArray(task.value)) {
      const clonedArray: unknown[] = new Array(task.value.length);
      task.assign(clonedArray);

      for (let index = task.value.length - 1; index >= 0; index -= 1) {
        if (!(index in task.value)) continue;
        tasks.push({
          value: task.value[index],
          assign: (childValue) => {
            clonedArray[index] = childValue;
          },
        });
      }
      continue;
    }

    if (isRecord(task.value)) {
      const clonedRecord: Record<string, unknown> = {};
      task.assign(clonedRecord);
      const entries = Object.entries(task.value);

      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (!entry) continue;
        const [key, childValue] = entry;
        tasks.push({
          value: childValue,
          assign: (clonedChildValue) => {
            Object.defineProperty(clonedRecord, key, {
              configurable: true,
              enumerable: true,
              value: clonedChildValue,
              writable: true,
            });
          },
        });
      }
      continue;
    }

    task.assign(task.value);
  }

  return result as Value;
};

type MergeTask = {
  base: unknown;
  override: unknown;
  assign: (value: unknown) => void;
};

const mergeValue = (base: unknown, override: unknown): unknown => {
  let result: unknown;
  const tasks: MergeTask[] = [
    {
      base,
      override,
      assign: (mergedValue) => {
        result = mergedValue;
      },
    },
  ];

  while (tasks.length > 0) {
    const task = tasks.pop();
    if (!task) continue;

    if (task.override === undefined) {
      task.assign(cloneValue(task.base));
      continue;
    }

    if (isRecord(task.base) && isRecord(task.override)) {
      const mergedRecord: Record<string, unknown> = {};
      task.assign(mergedRecord);
      const keys = [...new Set([...Object.keys(task.base), ...Object.keys(task.override)])];

      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index];
        if (key === undefined) continue;
        tasks.push({
          base: task.base[key],
          override: task.override[key],
          assign: (mergedChildValue) => {
            Object.defineProperty(mergedRecord, key, {
              configurable: true,
              enumerable: true,
              value: mergedChildValue,
              writable: true,
            });
          },
        });
      }
      continue;
    }

    task.assign(cloneValue(task.override));
  }

  return result;
};

/**
 * Merges request-owned form values over a persistent preset without mutating
 * either input. Nested object values are merged so a partial request can keep
 * the remaining fields from the loaded preset; arrays are request-owned values.
 *
 * @param defaults Persistent form values loaded for the selected channel.
 * @param overrides Request values allowed to override the persistent form.
 * @returns A new operation form containing the merged values.
 * @throws {Error} When reading or cloning an input property fails during the merge.
 */
export const mergePresetFormValues = <FormValues extends object>(
  defaults: FormValues,
  overrides: Partial<FormValues>,
): FormValues => mergeValue(defaults, overrides) as FormValues;

/**
 * Creates a preset-backed application service that shares the standard
 * defaults -> save -> preview -> execute flow used by multiple domains.
 *
 * @param options Service-specific persistence and request-mapping callbacks.
 * @returns A service with stable defaults, preview, and execute operations.
 * @throws {PresetStorageError} When a preset load or update callback raises a classified storage failure.
 * @throws {Error} When a supplied mapping, hydration, or response callback raises an unclassified error.
 */
export const createPresetBackedService = <
  Channel extends string,
  FormValues,
  Presets,
  DefaultsResponse,
  PreviewResponse,
  CreateResponse,
  ExecutionContext = void,
  >(
  options: CreatePresetBackedServiceOptions<
    Channel,
    FormValues,
    Presets,
    DefaultsResponse,
    PreviewResponse,
    CreateResponse,
    ExecutionContext
  >,
  ): PresetBackedService<
  Channel,
  FormValues,
  Presets,
  DefaultsResponse,
  PreviewResponse,
  CreateResponse,
  ExecutionContext
> => {
  const { loadPresets, toDefaultsResponse, updatePreset, buildPreviewResponse, buildRequestFromForm, buildCreateResponse } =
    options;
  const runner = createRunner({
    httpClient: options.httpClient || fetch,
    logger: options.logger,
    now: options.now || (() => new Date()),
    makeId: options.makeId,
  });

  const getDefaults = async (
    channel: Channel,
    context?: ExecutionContext,
  ): Promise<DefaultsResponse> => {
    const snapshot = await loadPresets();
    return toDefaultsResponse(channel, snapshot.presets, context);
  };

  const saveDefaults = async (
    channel: Channel,
    values: FormValues,
    context?: ExecutionContext,
  ): Promise<DefaultsResponse & { ok: true }> => {
    const snapshot = await loadPresets();
    const expected: PresetStorageExpectedTimestamps<Channel> = {
      channel,
      featureUpdatedAt: snapshot.timestamps.feature?.updatedAt || null,
      channelUpdatedAt: snapshot.timestamps.channels[channel]?.updatedAt || null,
    };
    const presets = await updatePreset(channel, values, expected);

    return {
      ok: true,
      ...toDefaultsResponse(channel, presets, context),
    };
  };

  const prepareOperation = async (
    channel: Channel,
    values: FormValues,
    context?: ExecutionContext,
  ): Promise<PresetOperationContext<Channel, FormValues, Presets, DefaultsResponse, ExecutionContext>> => {
    const snapshot = await loadPresets();
    const defaults = toDefaultsResponse(channel, snapshot.presets, context);
    const hydratedValues = options.hydrateValues
      ? options.hydrateValues(channel, values, snapshot.presets, context)
      : values;

    return {
      channel,
      values: hydratedValues,
      presets: snapshot.presets,
      defaults,
      executionContext: context,
    };
  };

  const preview = (
    operation: PresetOperationContext<Channel, FormValues, Presets, DefaultsResponse, ExecutionContext>,
  ): PreviewResponse =>
    buildPreviewResponse(operation.values, operation.executionContext as ExecutionContext);

  const execute = async (
    operation: PresetOperationContext<Channel, FormValues, Presets, DefaultsResponse, ExecutionContext>,
  ): Promise<CreateResponse> => {
    const request = buildRequestFromForm(
      operation.values,
      operation.executionContext as ExecutionContext,
    );
    const result = await runner.run(request);
    return buildCreateResponse(result);
  };

  return {
    getDefaults,
    saveDefaults,
    prepareOperation,
    preview,
    execute,
  };
};
