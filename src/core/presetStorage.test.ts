import { describe, expect, test } from 'bun:test';
import {
  createJsonPresetStorage,
  PresetStorageInvalidError,
  PresetStorageNotFoundError,
  PresetStorageUnavailableError,
  readPresetJsonObject,
  stripTransientMerchantReferenceKeys,
} from './presetStorage';

type TestChannel = 'primary';

type TestFormValues = {
  merchantRef?: string;
  returnUrl: string;
};

type TestPersistentFormValues = Omit<TestFormValues, 'merchantRef'>;

type TestPresets = {
  common: {
    values: TestFormValues;
  };
  channels: {
    primary: {
      productNo: string;
    };
  };
};

describe('createJsonPresetStorage', () => {
  test('maps operation values before writing and exposes a merchant-free persistent projection', async () => {
    expect.hasAssertions();

    const savedInputs: Array<{
      channel: TestChannel;
      values: TestPersistentFormValues;
      expected: {
        channel: TestChannel;
        featureUpdatedAt: string | null;
        channelUpdatedAt: string | null;
      };
    }> = [];
    let presets: TestPresets = {
      common: {
        values: {
          merchantRef: 'legacy-runtime-value',
          returnUrl: 'https://merchant.example.com/return',
        },
      },
      channels: {
        primary: {
          productNo: 'TEST-PRODUCT-001',
        },
      },
    };

    const storage = createJsonPresetStorage<
      TestChannel,
      TestFormValues,
      TestPresets,
      TestPersistentFormValues
    >({
      load: async () => presets,
      toPersistentInput: ({ channel, values, expected }) => {
        const { merchantRef: _merchantRef, ...persistentValues } = values;
        return { channel, values: persistentValues, expected };
      },
      save: async (input) => {
        savedInputs.push(input);
        presets = {
          ...presets,
          common: {
            values: input.values,
          },
        };
        return presets;
      },
      toPersistentProjection: (nextPresets) => ({
        commonValues: {
          returnUrl: nextPresets.common.values.returnUrl,
        },
        channels: {
          primary: {
            channelCommonValues: {},
            channelValues: {
              productNo: nextPresets.channels.primary.productNo,
            },
          },
        },
      }),
    });

    const loaded = await storage.load();
    expect(loaded.presets).toEqual(presets);
    expect(loaded.updatedAt).toBeNull();
    expect(loaded.projection.commonValues).toEqual({
      returnUrl: 'https://merchant.example.com/return',
    });
    expect(loaded.projection.commonValues).not.toHaveProperty('merchantRef');

    const saved = await storage.save({
      channel: 'primary',
      values: {
        merchantRef: 'transient-operation-value',
        returnUrl: 'https://merchant.example.com/updated',
      },
      expected: {
        channel: 'primary',
        featureUpdatedAt: null,
        channelUpdatedAt: null,
      },
    });

    expect(savedInputs).toEqual([
      {
        channel: 'primary',
        values: {
          returnUrl: 'https://merchant.example.com/updated',
        },
        expected: {
          channel: 'primary',
          featureUpdatedAt: null,
          channelUpdatedAt: null,
        },
      },
    ]);
    expect(saved.projection.commonValues).toEqual({
      returnUrl: 'https://merchant.example.com/updated',
    });
    expect(saved.projection.commonValues).not.toHaveProperty('merchantRef');
  });

  test('removes top-level merchant reference keys without changing nested provider templates', () => {
    expect.hasAssertions();

    const persistentValues = stripTransientMerchantReferenceKeys({
      merchantRef: 'transient-camel-case',
      merchantReference: 'transient-camel-case-long',
      merchant_ref: 'transient-snake-case',
      merchant_reference: 'transient-snake-case-long',
      payment_order: {
        merchant_ref: 'fixed-provider-template',
      },
      product_no: 'TEST-PRODUCT-001',
    });

    expect(persistentValues).toEqual({
      payment_order: {
        merchant_ref: 'fixed-provider-template',
      },
      product_no: 'TEST-PRODUCT-001',
    });
  });

  test('classifies missing, invalid, and unavailable JSON sources independently', async () => {
    expect.hasAssertions();

    const missingFileError = Object.assign(new Error('missing'), { code: 'ENOENT' });
    const permissionError = Object.assign(new Error('permission denied'), { code: 'EACCES' });

    await expect(
      readPresetJsonObject('/preset/missing.json', async () => {
        throw missingFileError;
      }),
    ).rejects.toBeInstanceOf(PresetStorageNotFoundError);

    await expect(
      readPresetJsonObject('/preset/invalid.json', async () => '{invalid-json'),
    ).rejects.toBeInstanceOf(PresetStorageInvalidError);

    await expect(
      readPresetJsonObject('/preset/forbidden.json', async () => {
        throw permissionError;
      }),
    ).rejects.toBeInstanceOf(PresetStorageUnavailableError);
  });
});
