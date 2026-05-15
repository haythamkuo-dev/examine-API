import { createRunner, type CommandRequest, type CommandResult, type HttpClient, type Logger } from '../runner';

export type PresetBackedService<Channel, FormValues, DefaultsResponse, PreviewResponse, CreateResponse> = {
  getDefaults: (channel: Channel) => Promise<DefaultsResponse>;
  saveDefaults: (channel: Channel, values: FormValues) => Promise<DefaultsResponse & { ok: true }>;
  preview: (values: FormValues) => PreviewResponse;
  execute: (values: FormValues) => Promise<CreateResponse>;
};

export type CreatePresetBackedServiceOptions<
  Channel,
  FormValues,
  Presets,
  DefaultsResponse,
  PreviewResponse,
  CreateResponse,
> = {
  loadPresets: () => Promise<Presets>;
  toDefaultsResponse: (channel: Channel, presets: Presets) => DefaultsResponse;
  updatePreset: (channel: Channel, values: FormValues) => Promise<Presets>;
  buildPreviewResponse: (values: FormValues) => PreviewResponse;
  buildRequestFromForm: (values: FormValues) => CommandRequest;
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
>(
  options: CreatePresetBackedServiceOptions<
    Channel,
    FormValues,
    Presets,
    DefaultsResponse,
    PreviewResponse,
    CreateResponse
  >,
): PresetBackedService<Channel, FormValues, DefaultsResponse, PreviewResponse, CreateResponse> => {
  const runner = createRunner({
    httpClient: options.httpClient || fetch,
    logger: options.logger,
    now: options.now || (() => new Date()),
    makeId: options.makeId,
  });

  const getDefaults = async (channel: Channel): Promise<DefaultsResponse> => {
    const presets = await options.loadPresets();
    return options.toDefaultsResponse(channel, presets);
  };

  const saveDefaults = async (
    channel: Channel,
    values: FormValues,
  ): Promise<DefaultsResponse & { ok: true }> => {
    const presets = await options.updatePreset(channel, values);

    return {
      ok: true,
      ...options.toDefaultsResponse(channel, presets),
    };
  };

  const preview = (values: FormValues): PreviewResponse => options.buildPreviewResponse(values);

  const execute = async (values: FormValues): Promise<CreateResponse> => {
    const request = options.buildRequestFromForm(values);
    const result = await runner.run(request);
    return options.buildCreateResponse(result);
  };

  return {
    getDefaults,
    saveDefaults,
    preview,
    execute,
  };
};
