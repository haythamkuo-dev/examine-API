import {
  DEPOSIT_CHANNEL_MANIFEST,
  DEPOSIT_CHANNELS,
  getDefaultChannel,
  type CliEnv,
  type DepositChannel,
} from '../core/env';
import {
  createPresetBackedService,
  mergePresetFormValues,
} from '../core/createPresetBackedService';
import type { PresetStorage } from '../core/presetStorage';
import type { TargetEnvironment } from '../core/targetEnvironment';
import type { Logger } from '../runner';
import type { DepositFormValues } from '../domains/deposit';
import {
  buildDepositCreateResponse,
  buildDepositMerchantRefResponse,
  buildDepositPreviewResponse,
  buildDepositRequestFromForm,
  type DepositCreateResponse,
  type DepositDefaultsResponse,
  type DepositMerchantRefResponse,
  type DepositRequestValues,
} from './web';
import {
  toDepositDefaultsResponse,
  type DepositPresetStore,
} from './presets';

export type DepositServiceDeps = {
  getEnvForTarget: (target: TargetEnvironment) => CliEnv;
  storage: PresetStorage<DepositChannel, DepositFormValues, DepositPresetStore>;
  makeId: (prefix: string) => string;
  logger: Logger;
};

const defaultDepositChannel = getDefaultChannel(DEPOSIT_CHANNEL_MANIFEST);

/**
 * Resolves the requested deposit channel from the query string.
 *
 * @param url Request URL carrying the optional `channel` search param.
 * @returns A valid deposit channel, defaulting to the manifest default.
 */
export const getRequestedDepositChannel = (url: URL): DepositChannel => {
  const channel = (url.searchParams.get('channel') || defaultDepositChannel) as DepositChannel;
  return DEPOSIT_CHANNELS.includes(channel) ? channel : defaultDepositChannel;
};

/**
 * Creates the deposit application service used by HTTP routes.
 *
 * @param deps Runtime dependencies for preset IO and outbound execution.
 * @returns The deposit service API used by the HTTP layer.
 */
export const createDepositService = (deps: DepositServiceDeps) => {
  const loadPresets = async () => deps.storage.load();
  const toDefaultsResponse = (
    channel: DepositChannel,
    presets: DepositPresetStore,
    target: TargetEnvironment | undefined,
  ): DepositDefaultsResponse =>
    toDepositDefaultsResponse(channel, deps.getEnvForTarget(target || 'local'), presets);

  const service = createPresetBackedService<
    DepositChannel,
    DepositRequestValues,
    DepositPresetStore,
    DepositDefaultsResponse,
    ReturnType<typeof buildDepositPreviewResponse>,
    DepositCreateResponse,
    TargetEnvironment
  >({
    loadPresets,
    toDefaultsResponse,
    hydrateValues: (channel, values, presets, target) =>
      mergePresetFormValues(
        toDefaultsResponse(channel, presets, target).form as DepositRequestValues,
        values,
      ),
    updatePreset: async (channel, values, expected) =>
      (await deps.storage.save({ channel, values, expected })).presets,
    buildPreviewResponse: (values, target) =>
      buildDepositPreviewResponse(deps.getEnvForTarget(target), values, deps.makeId),
    buildRequestFromForm: (values, target) =>
      buildDepositRequestFromForm(deps.getEnvForTarget(target), values, deps.makeId),
    buildCreateResponse: buildDepositCreateResponse,
    logger: deps.logger,
    makeId: deps.makeId,
  });

  /**
   * Generates a fresh deposit merchant reference using the shared ID factory.
   *
   * @returns Response payload containing the generated merchant reference.
   */
  const generateMerchantRef = (): DepositMerchantRefResponse =>
    buildDepositMerchantRefResponse(deps.makeId('TEST_ORDER_'));

  /**
   * Loads target-aware defaults for the selected deposit channel.
   *
   * @param channel Deposit channel selected by the caller.
   * @param target Target operator environment whose default API key should be surfaced.
   * @returns Defaults payload containing the environment-specific API key for the active channel.
   */
  const getDefaultsForTarget = async (
    channel: DepositChannel,
    target: TargetEnvironment,
  ): Promise<DepositDefaultsResponse> => {
    return service.getDefaults(channel, target);
  };

  /**
   * Saves defaults for a channel and returns a target-aware defaults response.
   *
   * @param channel Deposit channel being updated.
   * @param values Form values to persist.
   * @param target Target operator environment whose default API key should be surfaced.
   * @returns Saved defaults payload containing the environment-specific API key for the active channel.
   */
  const saveDefaultsForTarget = async (
    channel: DepositChannel,
    values: DepositFormValues,
    target: TargetEnvironment,
  ): Promise<DepositDefaultsResponse & { ok: true }> => {
    return service.saveDefaults(channel, values, target);
  };

  return {
    ...service,
    generateMerchantRef,
    getDefaultsForTarget,
    saveDefaultsForTarget,
  };
};
