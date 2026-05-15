import { SUBSCRIPTION_CHANNELS, type CliEnv, type SubscriptionChannel } from '../core/env';
import { createRunner, type CommandResult, type Logger } from '../runner';
import {
  buildSubscriptionCreateResponse,
  buildSubscriptionPreviewResponse,
  buildSubscriptionRequestFromForm,
  type SubscriptionCreateResponse,
  type SubscriptionDefaultsResponse,
  type SubscriptionDefaultsSavedResponse,
  type SubscriptionFormValues,
} from './web';
import {
  loadSubscriptionPresets,
  toSubscriptionDefaultsResponse,
  updateSubscriptionPreset,
} from './presets';

export type SubscriptionServiceDeps = {
  env: CliEnv;
  presetDirPath: string;
  makeId: (prefix: string) => string;
  logger: Logger;
};

/**
 * Resolves the requested subscription channel from the query string.
 *
 * @param url Request URL carrying the optional `channel` search param.
 * @returns A valid subscription channel, defaulting to `default`.
 */
export const getRequestedSubscriptionChannel = (url: URL): SubscriptionChannel => {
  const channel = (url.searchParams.get('channel') || 'default') as SubscriptionChannel;
  return SUBSCRIPTION_CHANNELS.includes(channel) ? channel : 'default';
};

/**
 * Creates the subscription application service used by HTTP routes.
 *
 * @param deps Runtime dependencies for preset IO and outbound execution.
 * @returns The subscription service API used by the HTTP layer.
 */
export const createSubscriptionService = (deps: SubscriptionServiceDeps) => {
  const runner = createRunner({
    httpClient: fetch,
    logger: deps.logger,
    now: () => new Date(),
    makeId: deps.makeId,
  });

  const getDefaults = async (channel: SubscriptionChannel): Promise<SubscriptionDefaultsResponse> => {
    const presets = await loadSubscriptionPresets({
      dirPath: deps.presetDirPath,
      env: deps.env,
      makeId: deps.makeId,
    });

    return toSubscriptionDefaultsResponse(channel, presets);
  };

  const saveDefaults = async (
    channel: SubscriptionChannel,
    values: SubscriptionFormValues,
  ): Promise<SubscriptionDefaultsSavedResponse> => {
    const presets = await updateSubscriptionPreset({
      dirPath: deps.presetDirPath,
      channel,
      values,
      env: deps.env,
      makeId: deps.makeId,
    });

    return {
      ok: true,
      ...toSubscriptionDefaultsResponse(channel, presets),
    };
  };

  const preview = (values: SubscriptionFormValues) =>
    buildSubscriptionPreviewResponse(deps.env, values, deps.makeId);

  const execute = async (values: SubscriptionFormValues): Promise<SubscriptionCreateResponse> => {
    const request = buildSubscriptionRequestFromForm(deps.env, values, deps.makeId);
    const result: CommandResult = await runner.run(request);
    return buildSubscriptionCreateResponse(result);
  };

  return {
    getDefaults,
    saveDefaults,
    preview,
    execute,
  };
};
