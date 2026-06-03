import { createRunner, type CommandRequest, type CommandResult, type HttpClient, type Logger } from '../runner';

export type PresetBackedService<
  Channel,
  FormValues,
  DefaultsResponse,
  PreviewResponse,
  CreateResponse,
  ExecutionContext = void,
> = {
  getDefaults: (channel: Channel) => Promise<DefaultsResponse>;
  saveDefaults: (channel: Channel, values: FormValues) => Promise<DefaultsResponse & { ok: true }>;
  preview: (values: FormValues, context: ExecutionContext) => PreviewResponse;
  execute: (values: FormValues, context: ExecutionContext) => Promise<CreateResponse>;
};

export type CreatePresetBackedServiceOptions<
  Channel,
  FormValues,
  Presets,
  DefaultsResponse,
  PreviewResponse,
  CreateResponse,
  ExecutionContext = void,
> = {
  loadPresets: () => Promise<Presets>;
  toDefaultsResponse: (channel: Channel, presets: Presets) => DefaultsResponse;
  updatePreset: (channel: Channel, values: FormValues) => Promise<Presets>;
  buildPreviewResponse: (values: FormValues, context: ExecutionContext) => PreviewResponse;
  buildRequestFromForm: (values: FormValues, context: ExecutionContext) => CommandRequest;
  buildCreateResponse: (result: CommandResult) => CreateResponse;
  logger: Logger;
  makeId: (prefix: string) => string;
  now?: () => Date;
  httpClient?: HttpClient;
};

/**
 * Creates a preset-backed application service that shares the standard
 * defaults -> save -> preview -> execute flow used by multiple domains.
 *
 * @param options Service-specific persistence and request-mapping callbacks.
 * @returns A service with stable defaults, preview, and execute operations.
 */
export const createPresetBackedService = <
  Channel,
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

  const getDefaults = async (channel: Channel): Promise<DefaultsResponse> => {
    const presets = await loadPresets();
    return toDefaultsResponse(channel, presets);
  };

  const saveDefaults = async (
    channel: Channel,
    values: FormValues,
  ): Promise<DefaultsResponse & { ok: true }> => {
    const presets = await updatePreset(channel, values);

    return {
      ok: true,
      ...toDefaultsResponse(channel, presets),
    };
  };

  const preview = (values: FormValues, context: ExecutionContext): PreviewResponse =>
    buildPreviewResponse(values, context);

  const execute = async (values: FormValues, context: ExecutionContext): Promise<CreateResponse> => {
    const request = buildRequestFromForm(values, context);
    const result = await runner.run(request);
    return buildCreateResponse(result);
  };

  return {
    getDefaults,
    saveDefaults,
    preview,
    execute,
  };
};
