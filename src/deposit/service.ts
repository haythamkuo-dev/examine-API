import { DEPOSIT_CHANNELS, type CliEnv, type DepositChannel } from '../core/env';
import { createPresetBackedService } from '../core/createPresetBackedService';
import type { Logger } from '../runner';
import {
  buildDepositCreateResponse,
  buildDepositPreviewResponse,
  buildDepositRequestFromForm,
  type DepositCreateResponse,
  type DepositDefaultsResponse,
  type DepositFormValues,
} from './web';
import { loadDepositPresets, toDepositDefaultsResponse, updateDepositPreset } from './presets';

export type DepositServiceDeps = {
  env: CliEnv;
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
  return createPresetBackedService<
    DepositChannel,
    DepositFormValues,
    Awaited<ReturnType<typeof loadDepositPresets>>,
    DepositDefaultsResponse,
    ReturnType<typeof buildDepositPreviewResponse>,
    DepositCreateResponse
  >({
    loadPresets: () =>
      loadDepositPresets({
        dirPath: deps.presetDirPath,
        env: deps.env,
        makeId: deps.makeId,
      }),
    toDefaultsResponse: toDepositDefaultsResponse,
    updatePreset: (channel, values) =>
      updateDepositPreset({
        dirPath: deps.presetDirPath,
        channel,
        values,
        env: deps.env,
        makeId: deps.makeId,
      }),
    buildPreviewResponse: (values) => buildDepositPreviewResponse(deps.env, values, deps.makeId),
    buildRequestFromForm: (values) => buildDepositRequestFromForm(deps.env, values, deps.makeId),
    buildCreateResponse: buildDepositCreateResponse,
    logger: deps.logger,
    makeId: deps.makeId,
  });
};
