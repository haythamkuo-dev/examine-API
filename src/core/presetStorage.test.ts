import { describe, expect, test } from 'bun:test';
import { createJsonPresetStorage } from './presetStorage';

type TestChannel = 'primary';

type TestFormValues = {
  merchantRef?: string;
  returnUrl: string;
};

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
  test('round-trips the JSON store while exposing a merchant-free persistent projection', async () => {
    expect.hasAssertions();

    const savedInputs: Array<{ channel: TestChannel; values: TestFormValues }> = [];
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

    const storage = createJsonPresetStorage<TestChannel, TestFormValues, TestPresets>({
      load: async () => presets,
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
    });

    expect(savedInputs).toEqual([
      {
        channel: 'primary',
        values: {
          merchantRef: 'transient-operation-value',
          returnUrl: 'https://merchant.example.com/updated',
        },
      },
    ]);
    expect(saved.projection.commonValues).toEqual({
      returnUrl: 'https://merchant.example.com/updated',
    });
    expect(saved.projection.commonValues).not.toHaveProperty('merchantRef');
  });
});
