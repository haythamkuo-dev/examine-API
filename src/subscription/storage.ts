import {
  createJsonPresetStorage,
  stripTransientMerchantReferenceKeys,
  type PresetStorage,
} from '../core/presetStorage';
import type { CliEnv, SubscriptionChannel } from '../core/env';
import type { SubscriptionFormValues } from '../domains/subscription';
import {
  loadSubscriptionPresets,
  toSubscriptionPersistentProjection,
  updateSubscriptionPreset,
  type SubscriptionPresetStore,
} from './presets';

type SubscriptionPersistentFormValues = Omit<SubscriptionFormValues, 'commonValues'> & {
  commonValues: Omit<SubscriptionFormValues['commonValues'], 'merchantRef'>;
};

export type SubscriptionPresetStorage = PresetStorage<
  SubscriptionChannel,
  SubscriptionFormValues,
  SubscriptionPresetStore
>;

/**
 * Creates the JSON adapter used by the subscription composition root.
 *
 * @param options Preset directory, local environment, and runtime ID factory.
 * @returns A subscription storage implementation with merchant references removed before persistence.
 */
export const createSubscriptionJsonPresetStorage = (options: {
  dirPath: string;
  env: CliEnv;
  makeId: (prefix: string) => string;
}): SubscriptionPresetStorage =>
  createJsonPresetStorage<
    SubscriptionChannel,
    SubscriptionFormValues,
    SubscriptionPresetStore,
    SubscriptionPersistentFormValues
  >({
    load: () =>
      loadSubscriptionPresets({ dirPath: options.dirPath, env: options.env, makeId: options.makeId }),
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
      updateSubscriptionPreset({
        dirPath: options.dirPath,
        channel,
        values,
        env: options.env,
        makeId: options.makeId,
      }),
    toPersistentProjection: toSubscriptionPersistentProjection,
  });
