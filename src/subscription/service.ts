import { SUBSCRIPTION_CHANNELS, type CliEnv, type SubscriptionChannel } from '../core/env';
import { createPresetBackedService } from '../core/createPresetBackedService';
import type { TargetEnvironment } from '../core/targetEnvironment';
import type { Logger } from '../runner';
import {
  buildSubscriptionCreateResponse,
  buildSubscriptionMerchantRefResponse,
  buildSubscriptionPreviewResponse,
  buildSubscriptionRequestFromForm,
  type SubscriptionCreateResponse,
  type SubscriptionDefaultsResponse,
  type SubscriptionFormValues,
  type SubscriptionMerchantRefResponse,
} from './web';
import {
  loadSubscriptionPresets,
  toSubscriptionDefaultsResponse,
  updateSubscriptionPreset,
} from './presets';

export type SubscriptionServiceDeps = {
  getEnvForTarget: (target: TargetEnvironment) => CliEnv;
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
  const loadPresets = () =>
    loadSubscriptionPresets({
      dirPath: deps.presetDirPath,
      env: deps.getEnvForTarget('local'),
      makeId: deps.makeId,
    });

  const service = createPresetBackedService<
    SubscriptionChannel,
    SubscriptionFormValues,
    Awaited<ReturnType<typeof loadSubscriptionPresets>>,
    SubscriptionDefaultsResponse,
    ReturnType<typeof buildSubscriptionPreviewResponse>,
    SubscriptionCreateResponse,
    TargetEnvironment
  >({
    loadPresets,
    toDefaultsResponse: (channel, presets) =>
      toSubscriptionDefaultsResponse(channel, deps.getEnvForTarget('local'), 'local', presets),
    updatePreset: (channel, values) =>
      updateSubscriptionPreset({
        dirPath: deps.presetDirPath,
        channel,
        values,
        env: deps.getEnvForTarget('local'),
        makeId: deps.makeId,
      }),
    buildPreviewResponse: (values, target) =>
      buildSubscriptionPreviewResponse(deps.getEnvForTarget(target), values, deps.makeId),
    buildRequestFromForm: (values, target) =>
      buildSubscriptionRequestFromForm(deps.getEnvForTarget(target), values, deps.makeId),
    buildCreateResponse: buildSubscriptionCreateResponse,
    logger: deps.logger,
    makeId: deps.makeId,
  });

  /**
   * Generates a fresh subscription merchant reference using the shared ID factory.
   *
   * @returns Response payload containing the generated merchant reference.
   */
  const generateMerchantRef = (): SubscriptionMerchantRefResponse =>
    buildSubscriptionMerchantRefResponse(deps.makeId('TEST_ORDER_'));

  /**
   * Loads target-aware defaults for the selected subscription channel.
   *
   * @param channel Subscription channel selected by the caller.
   * @param target Target operator environment whose plan id should be surfaced.
   * @returns Defaults payload containing the resolved plan id for the active channel and environment.
   */
  const getDefaultsForTarget = async (
    channel: SubscriptionChannel,
    target: TargetEnvironment,
  ): Promise<SubscriptionDefaultsResponse> => {
    const presets = await loadPresets();
    return toSubscriptionDefaultsResponse(channel, deps.getEnvForTarget(target), target, presets);
  };

  /**
   * Saves defaults for a channel and returns a target-aware defaults response.
   *
   * @param channel Subscription channel being updated.
   * @param values Form values to persist.
   * @param target Target operator environment whose plan id should be surfaced.
   * @returns Saved defaults payload containing the resolved plan id for the active channel and environment.
   */
  const saveDefaultsForTarget = async (
    channel: SubscriptionChannel,
    values: SubscriptionFormValues,
    target: TargetEnvironment,
  ): Promise<SubscriptionDefaultsResponse & { ok: true }> => {
    const presets = await updateSubscriptionPreset({
      dirPath: deps.presetDirPath,
      channel,
      values,
      env: deps.getEnvForTarget('local'),
      makeId: deps.makeId,
    });

    return {
      ok: true,
      ...toSubscriptionDefaultsResponse(channel, deps.getEnvForTarget(target), target, presets),
    };
  };

  return {
    ...service,
    generateMerchantRef,
    getDefaultsForTarget,
    saveDefaultsForTarget,
  };
};
