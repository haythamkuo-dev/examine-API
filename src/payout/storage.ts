import {
  createJsonPresetStorage,
  stripTransientMerchantReferenceKeys,
  type PresetStorage,
} from '../core/presetStorage';
import type { PayoutChannel } from '../core/env';
import type { PayoutFormValues } from '../domains/payout';
import {
  loadPayoutPresets,
  toPayoutPersistentProjection,
  updatePayoutPreset,
  type PayoutPresetStore,
} from './presets';

type PayoutPersistentFormValues = Omit<PayoutFormValues, 'commonValues'> & {
  commonValues: Omit<PayoutFormValues['commonValues'], 'merchantReference'>;
};

export type PayoutPresetStorage = PresetStorage<
  PayoutChannel,
  PayoutFormValues,
  PayoutPresetStore
>;

/**
 * Creates the JSON adapter used by the payout composition root.
 *
 * @param options Preset directory and runtime ID factory.
 * @returns A payout storage implementation with merchant references removed before persistence.
 * @throws {PresetStorageNotFoundError} When a required payout preset source is missing.
 * @throws {PresetStorageInvalidError} When a payout preset source contains malformed or invalid data.
 * @throws {PresetStorageUnavailableError} When a payout preset source cannot be read or written.
 */
export const createPayoutJsonPresetStorage = (options: {
  dirPath: string;
  makeId: (prefix: string) => string;
}): PayoutPresetStorage =>
  createJsonPresetStorage<
    PayoutChannel,
    PayoutFormValues,
    PayoutPresetStore,
    PayoutPersistentFormValues
  >({
    load: () => loadPayoutPresets({ dirPath: options.dirPath, makeId: options.makeId }),
    toPersistentInput: ({ channel, values, expected }) => {
      const { merchantReference: _merchantReference, ...commonValues } = values.commonValues;
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
      updatePayoutPreset({
        dirPath: options.dirPath,
        channel,
        values,
        makeId: options.makeId,
      }),
    toPersistentProjection: toPayoutPersistentProjection,
  });
