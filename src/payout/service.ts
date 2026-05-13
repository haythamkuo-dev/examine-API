import { PAYOUT_CHANNELS, type CliEnv, type PayoutChannel } from '../core/env';
import { createRunner, type CommandResult, type Logger } from '../runner';
import {
  buildPayoutCreateResponse,
  buildPayoutPreviewResponse,
  buildPayoutRequestFromForm,
  type PayoutCreateResponse,
  type PayoutDefaultsResponse,
  type PayoutDefaultsSavedResponse,
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
  const runner = createRunner({
    httpClient: fetch,
    logger: deps.logger,
    now: () => new Date(),
    makeId: deps.makeId,
  });

  const getDefaults = async (channel: PayoutChannel): Promise<PayoutDefaultsResponse> => {
    const presets = await loadPayoutPresets({
      dirPath: deps.presetDirPath,
      makeId: deps.makeId,
    });

    return toPayoutDefaultsResponse(channel, presets);
  };

  const saveDefaults = async (
    channel: PayoutChannel,
    values: PayoutFormValues,
  ): Promise<PayoutDefaultsSavedResponse> => {
    const presets = await updatePayoutPreset({
      dirPath: deps.presetDirPath,
      channel,
      values,
      makeId: deps.makeId,
    });

    return {
      ok: true,
      ...toPayoutDefaultsResponse(channel, presets),
    };
  };

  const preview = (values: PayoutFormValues) =>
    buildPayoutPreviewResponse(deps.env, values, deps.makeId);

  const execute = async (values: PayoutFormValues): Promise<PayoutCreateResponse> => {
    const request = buildPayoutRequestFromForm(deps.env, values, deps.makeId);
    const result: CommandResult = await runner.run(request);
    return buildPayoutCreateResponse(result);
  };

  return {
    getDefaults,
    saveDefaults,
    preview,
    execute,
  };
};
