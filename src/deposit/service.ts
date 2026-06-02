import { DEPOSIT_CHANNELS, type CliEnv, type DepositChannel } from '../core/env';
import { createPresetBackedService } from '../core/createPresetBackedService';
import type { TargetEnvironment } from '../core/targetEnvironment';
import type { Logger } from '../runner';
import {
  buildDepositCreateResponse,
  buildDepositMerchantRefResponse,
  buildDepositPreviewResponse,
  buildDepositRequestFromForm,
  type DepositCreateResponse,
  type DepositDefaultsResponse,
  type DepositFormValues,
  type DepositMerchantRefResponse,
  type DepositRequestValues,
} from './web';
import { loadDepositPresets, toDepositDefaultsResponse, updateDepositPreset } from './presets';

export type DepositServiceDeps = {
  getEnvForTarget: (target: TargetEnvironment) => CliEnv;
  presetDirPath: string;
  makeId: (prefix: string) => string;
  logger: Logger;
};

/**
 * Resolves the requested deposit channel from the query string.
 *
 * @param url Request URL carrying the optional `channel` search param.
 * @returns A valid deposit channel, defaulting to `southafrica_cards`.
 */
export const getRequestedDepositChannel = (url: URL): DepositChannel => {
  const channel = (url.searchParams.get('channel') || 'southafrica_cards') as DepositChannel;
  return DEPOSIT_CHANNELS.includes(channel) ? channel : 'southafrica_cards';
};

/**
 * Creates the deposit application service used by HTTP routes.
 *
 * @param deps Runtime dependencies for preset IO and outbound execution.
 * @returns The deposit service API used by the HTTP layer.
 */
export const createDepositService = (deps: DepositServiceDeps) => {
  const loadPresets = () =>
    loadDepositPresets({
      dirPath: deps.presetDirPath,
      env: deps.getEnvForTarget('local'),
      makeId: deps.makeId,
    });

  const service = createPresetBackedService<
    DepositChannel,
    DepositRequestValues,
    Awaited<ReturnType<typeof loadDepositPresets>>,
    DepositDefaultsResponse,
    ReturnType<typeof buildDepositPreviewResponse>,
    DepositCreateResponse,
    TargetEnvironment
  >({
    loadPresets,
    toDefaultsResponse: (channel, presets) =>
      toDepositDefaultsResponse(channel, deps.getEnvForTarget('local'), presets),
    updatePreset: (channel, values) =>
      updateDepositPreset({
        dirPath: deps.presetDirPath,
        channel,
        values,
        env: deps.getEnvForTarget('local'),
        makeId: deps.makeId,
      }),
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
    const presets = await loadPresets();
    return toDepositDefaultsResponse(channel, deps.getEnvForTarget(target), presets);
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
    const presets = await updateDepositPreset({
      dirPath: deps.presetDirPath,
      channel,
      values,
      env: deps.getEnvForTarget('local'),
      makeId: deps.makeId,
    });

    return {
      ok: true,
      ...toDepositDefaultsResponse(channel, deps.getEnvForTarget(target), presets),
    };
  };

  return {
    ...service,
    generateMerchantRef,
    getDefaultsForTarget,
    saveDefaultsForTarget,
  };
};
