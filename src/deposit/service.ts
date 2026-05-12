import { DEPOSIT_CHANNELS, type CliEnv, type DepositChannel } from '../core/env';
import { createRunner, type CommandResult, type Logger } from '../runner';
import {
  buildDepositCreateResponse,
  buildDepositPreviewResponse,
  type DepositCreateResponse,
  type DepositDefaultsResponse,
  type DepositDefaultsSavedResponse,
  type DepositFormValues,
} from './web';
import { loadDepositPresets, toDepositDefaultsResponse, updateDepositPreset } from './presets';
import { buildDepositRequestFromForm } from './web';

export type DepositServiceDeps = {
  env: CliEnv;
  presetDirPath: string;
  makeId: (prefix: string) => string;
  logger: Logger;
};

export const getRequestedDepositChannel = (url: URL): DepositChannel => {
  const channel = (url.searchParams.get('channel') || 'southafrica_cards') as DepositChannel;
  return DEPOSIT_CHANNELS.includes(channel) ? channel : 'southafrica_cards';
};

export const createDepositService = (deps: DepositServiceDeps) => {
  const runner = createRunner({
    httpClient: fetch,
    logger: deps.logger,
    now: () => new Date(),
    makeId: deps.makeId,
  });

  const getDefaults = async (channel: DepositChannel): Promise<DepositDefaultsResponse> => {
    const presets = await loadDepositPresets({
      dirPath: deps.presetDirPath,
      env: deps.env,
      makeId: deps.makeId,
    });

    return toDepositDefaultsResponse(channel, presets);
  };

  const saveDefaults = async (
    channel: DepositChannel,
    values: DepositFormValues,
  ): Promise<DepositDefaultsSavedResponse> => {
    const presets = await updateDepositPreset({
      dirPath: deps.presetDirPath,
      channel,
      values,
      env: deps.env,
      makeId: deps.makeId,
    });

    return {
      ok: true,
      ...toDepositDefaultsResponse(channel, presets),
    };
  };

  const preview = (values: DepositFormValues) =>
    buildDepositPreviewResponse(deps.env, values, deps.makeId);

  const execute = async (values: DepositFormValues): Promise<DepositCreateResponse> => {
    const request = buildDepositRequestFromForm(deps.env, values, deps.makeId);
    const result: CommandResult = await runner.run(request);
    return buildDepositCreateResponse(result);
  };

  return {
    getDefaults,
    saveDefaults,
    preview,
    execute,
  };
};
