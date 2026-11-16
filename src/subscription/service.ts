import {
  getDefaultChannel,
  SUBSCRIPTION_CHANNEL_MANIFEST,
  SUBSCRIPTION_CHANNELS,
  type CliEnv,
  type SubscriptionChannel,
} from '../core/env';
import { createPresetBackedService, mergePresetFormValues } from '../core/createPresetBackedService';
import type { PresetStorage } from '../core/presetStorage';
import type { TargetEnvironment } from '../core/targetEnvironment';
import type { Logger } from '../runner';
import type { SubscriptionFormValues } from '../domains/subscription';
import {
  buildSubscriptionCreateResponse,
  buildSubscriptionMerchantRefResponse,
  buildSubscriptionPreviewResponse,
  buildSubscriptionRequestFromForm,
  type SubscriptionCreateResponse,
  type SubscriptionDefaultsResponse,
  type SubscriptionMerchantRefResponse,
  type SubscriptionRequestValues,
} from './web';
import {
  toSubscriptionDefaultsResponse,
  type SubscriptionPresetStore,
} from './presets';

export type SubscriptionServiceDeps = {
  getEnvForTarget: (target: TargetEnvironment) => CliEnv;
  storage: PresetStorage<SubscriptionChannel, SubscriptionFormValues, SubscriptionPresetStore>;
  makeId: (prefix: string) => string;
  logger: Logger;
};

const defaultSubscriptionChannel = getDefaultChannel(SUBSCRIPTION_CHANNEL_MANIFEST);

/**
 * Resolves the requested subscription channel from the query string.
 *
 * @param url Request URL carrying the optional `channel` search param.
 * @returns A valid subscription channel, defaulting to the manifest default.
 */
export const getRequestedSubscriptionChannel = (url: URL): SubscriptionChannel => {
  const channel = (url.searchParams.get('channel') || defaultSubscriptionChannel) as SubscriptionChannel;
  return SUBSCRIPTION_CHANNELS.includes(channel) ? channel : defaultSubscriptionChannel;
};

/**
 * Creates the subscription application service used by HTTP routes.
 *
 * @param deps Runtime dependencies for preset IO and outbound execution.
 * @returns The subscription service API used by the HTTP layer.
 */
export const createSubscriptionService = (deps: SubscriptionServiceDeps) => {
  const loadPresets = async () => deps.storage.load();
  const toDefaultsResponse = (
    channel: SubscriptionChannel,
    presets: SubscriptionPresetStore,
    target: TargetEnvironment | undefined,
  ): SubscriptionDefaultsResponse => {
    const resolvedTarget = target || 'local';
    const env = deps.getEnvForTarget(resolvedTarget);
    return toSubscriptionDefaultsResponse(channel, env, resolvedTarget, presets);
  };

  const service = createPresetBackedService<
    SubscriptionChannel,
    SubscriptionRequestValues,
    SubscriptionPresetStore,
    SubscriptionDefaultsResponse,
    ReturnType<typeof buildSubscriptionPreviewResponse>,
    SubscriptionCreateResponse,
    TargetEnvironment
  >({
    loadPresets,
    toDefaultsResponse,
    hydrateValues: (channel, values, presets, target) =>
      mergePresetFormValues(
        toDefaultsResponse(channel, presets, target).form as SubscriptionRequestValues,
        values,
      ),
    updatePreset: async (channel, values, expected) =>
      (await deps.storage.save({ channel, values, expected })).presets,
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
    return service.getDefaults(channel, target);
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
    return service.saveDefaults(channel, values, target);
  };

  return {
    ...service,
    generateMerchantRef,
    getDefaultsForTarget,
    saveDefaultsForTarget,
  };
};
