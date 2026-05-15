import { PAYOUT_CHANNELS, type CliEnv, type PayoutChannel } from '../core/env';
import { createPresetBackedService } from '../core/createPresetBackedService';
import type { Logger } from '../runner';
import {
  buildPayoutCreateResponse,
  buildPayoutPreviewResponse,
  buildPayoutRequestFromForm,
  type PayoutCreateResponse,
  type PayoutDefaultsResponse,
  type PayoutFormValues,
} from './web';
import { loadPayoutPresets, toPayoutDefaultsResponse, updatePayoutPreset } from './presets';

export type PayoutServiceDeps = {
  env: CliEnv;
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
  return createPresetBackedService<
    PayoutChannel,
    PayoutFormValues,
    Awaited<ReturnType<typeof loadPayoutPresets>>,
    PayoutDefaultsResponse,
    ReturnType<typeof buildPayoutPreviewResponse>,
    PayoutCreateResponse
  >({
    loadPresets: () =>
      loadPayoutPresets({
        dirPath: deps.presetDirPath,
        makeId: deps.makeId,
      }),
    toDefaultsResponse: toPayoutDefaultsResponse,
    updatePreset: (channel, values) =>
      updatePayoutPreset({
        dirPath: deps.presetDirPath,
        channel,
        values,
        makeId: deps.makeId,
      }),
    buildPreviewResponse: (values) => buildPayoutPreviewResponse(deps.env, values, deps.makeId),
    buildRequestFromForm: (values) => buildPayoutRequestFromForm(deps.env, values, deps.makeId),
    buildCreateResponse: buildPayoutCreateResponse,
    logger: deps.logger,
    makeId: deps.makeId,
  });
};
