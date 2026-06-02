import { PAYOUT_CHANNELS, type CliEnv, type PayoutChannel } from '../core/env';
import { createPresetBackedService } from '../core/createPresetBackedService';
import type { TargetEnvironment } from '../core/targetEnvironment';
import type { Logger } from '../runner';
import {
  buildPayoutCreateResponse,
  buildPayoutMerchantReferenceResponse,
  buildPayoutPreviewResponse,
  buildPayoutRequestFromForm,
  type PayoutCreateResponse,
  type PayoutDefaultsResponse,
  type PayoutFormValues,
  type PayoutMerchantReferenceResponse,
  type PayoutRequestValues,
} from './web';
import { loadPayoutPresets, toPayoutDefaultsResponse, updatePayoutPreset } from './presets';

export type PayoutServiceDeps = {
  getEnvForTarget: (target: TargetEnvironment) => CliEnv;
  presetDirPath: string;
  makeId: (prefix: string) => string;
  logger: Logger;
};

/**
 * Resolves the requested payout channel from the query string.
 *
 * @param url Request URL carrying the optional `channel` search param.
 * @returns A valid payout channel, defaulting to `co_bank`.
 */
export const getRequestedPayoutChannel = (url: URL): PayoutChannel => {
  const channel = (url.searchParams.get('channel') || 'co_bank') as PayoutChannel;
  return PAYOUT_CHANNELS.includes(channel) ? channel : 'co_bank';
};

/**
 * Creates the payout application service used by HTTP routes.
 *
 * @param deps Runtime dependencies for preset IO and outbound execution.
 * @returns The payout service API used by the HTTP layer.
 */
export const createPayoutService = (deps: PayoutServiceDeps) => {
  const loadPresets = () =>
    loadPayoutPresets({
      dirPath: deps.presetDirPath,
      makeId: deps.makeId,
    });

  const service = createPresetBackedService<
    PayoutChannel,
    PayoutRequestValues,
    Awaited<ReturnType<typeof loadPayoutPresets>>,
    PayoutDefaultsResponse,
    ReturnType<typeof buildPayoutPreviewResponse>,
    PayoutCreateResponse,
    TargetEnvironment
  >({
    loadPresets,
    toDefaultsResponse: (channel, presets) =>
      toPayoutDefaultsResponse(channel, deps.getEnvForTarget('local'), presets),
    updatePreset: (channel, values) =>
      updatePayoutPreset({
        dirPath: deps.presetDirPath,
        channel,
        values,
        makeId: deps.makeId,
      }),
    buildPreviewResponse: (values, target) =>
      buildPayoutPreviewResponse(deps.getEnvForTarget(target), values, deps.makeId),
    buildRequestFromForm: (values, target) =>
      buildPayoutRequestFromForm(deps.getEnvForTarget(target), values, deps.makeId),
    buildCreateResponse: buildPayoutCreateResponse,
    logger: deps.logger,
    makeId: deps.makeId,
  });

  /**
   * Generates a fresh payout merchant reference using the shared ID factory.
   *
   * @returns Response payload containing the generated merchant reference.
   */
  const generateMerchantReference = (): PayoutMerchantReferenceResponse =>
    buildPayoutMerchantReferenceResponse(deps.makeId('TEST_ORDER_'));

  /**
   * Loads target-aware defaults for the selected payout channel.
   *
   * @param channel Payout channel selected by the caller.
   * @param target Target operator environment whose default API key should be surfaced.
   * @returns Defaults payload containing the environment-specific API key for the active channel.
   */
  const getDefaultsForTarget = async (
    channel: PayoutChannel,
    target: TargetEnvironment,
  ): Promise<PayoutDefaultsResponse> => {
    const presets = await loadPresets();
    return toPayoutDefaultsResponse(channel, deps.getEnvForTarget(target), presets);
  };

  /**
   * Saves defaults for a channel and returns a target-aware defaults response.
   *
   * @param channel Payout channel being updated.
   * @param values Form values to persist.
   * @param target Target operator environment whose default API key should be surfaced.
   * @returns Saved defaults payload containing the environment-specific API key for the active channel.
   */
  const saveDefaultsForTarget = async (
    channel: PayoutChannel,
    values: PayoutFormValues,
    target: TargetEnvironment,
  ): Promise<PayoutDefaultsResponse & { ok: true }> => {
    const presets = await updatePayoutPreset({
      dirPath: deps.presetDirPath,
      channel,
      values,
      makeId: deps.makeId,
    });

    return {
      ok: true,
      ...toPayoutDefaultsResponse(channel, deps.getEnvForTarget(target), presets),
    };
  };

  return {
    ...service,
    generateMerchantReference,
    getDefaultsForTarget,
    saveDefaultsForTarget,
  };
};
