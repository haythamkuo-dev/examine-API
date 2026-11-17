import { join } from 'path';

import {
  createJsonPresetStorage,
  stripTransientMerchantReferenceKeys,
  type PresetStorage,
} from '../core/presetStorage';
import type { DepositChannel, CliEnv } from '../core/env';
import type { DepositFormValues } from '../domains/deposit';
import {
  loadDepositPresets,
  toDepositPersistentProjection,
  updateDepositPreset,
  type DepositPresetStore,
} from './presets';

type DepositPersistentFormValues = Omit<DepositFormValues, 'commonValues'> & {
  commonValues: Omit<DepositFormValues['commonValues'], 'merchantRef'>;
};

export type DepositPresetStorage = PresetStorage<
  DepositChannel,
  DepositFormValues,
  DepositPresetStore
>;

/**
 * Creates the JSON adapter used by the deposit composition root.
 *
 * @param options Preset directory, local environment, and runtime ID factory.
 * @returns A deposit storage implementation with merchant references removed before persistence.
 * @throws {PresetStorageNotFoundError} When a required deposit preset source is missing.
 * @throws {PresetStorageInvalidError} When a deposit preset source contains malformed or invalid data.
 * @throws {PresetStorageUnavailableError} When a deposit preset source cannot be read or written.
 * @throws {PresetStorageConflictError} When a save is based on a stale JSON snapshot.
 */
export const createDepositJsonPresetStorage = (options: {
  dirPath: string;
  env: CliEnv;
  makeId: (prefix: string) => string;
}): DepositPresetStorage =>
  createJsonPresetStorage<
    DepositChannel,
    DepositFormValues,
    DepositPresetStore,
    DepositPersistentFormValues
  >({
    feature: 'deposit',
    lockPath: join(options.dirPath, '.preset-storage.lock'),
    load: () => loadDepositPresets({ dirPath: options.dirPath, env: options.env, makeId: options.makeId }),
    toPersistentInput: ({ channel, values, expected }) => {
      const { merchantRef: _merchantRef, ...commonValues } = values.commonValues;
      return {
        channel,
        expected,
        values: {
          channel: values.channel,
          commonValues,
          channelValues: stripTransientMerchantReferenceKeys(values.channelValues),
        },
      };
    },
    save: ({ channel, values }) =>
      updateDepositPreset({
        dirPath: options.dirPath,
        channel,
        values,
        env: options.env,
        makeId: options.makeId,
      }),
    toPersistentProjection: toDepositPersistentProjection,
  });
