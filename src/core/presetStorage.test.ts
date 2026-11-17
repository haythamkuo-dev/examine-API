import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createJsonPresetStorage,
  PresetStorageConflictError,
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

const createLockPath = (): string => join(tmpdir(), `preset-storage-${randomUUID()}.lock`);

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
      feature: 'deposit',
      lockPath: createLockPath(),
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
    expect(loaded.updatedAt).toMatch(/^json:[a-f0-9]{64}$/);
    expect(loaded.projection.commonValues).toEqual({
      returnUrl: 'https://merchant.example.com/return',
    });
    expect(loaded.projection.commonValues).not.toHaveProperty('merchantRef');

    const expected = {
      channel: 'primary' as const,
      featureUpdatedAt: loaded.timestamps.feature?.updatedAt || null,
      channelUpdatedAt: loaded.timestamps.channels.primary?.updatedAt || null,
    };

    const saved = await storage.save({
      channel: 'primary',
      values: {
        merchantRef: 'transient-operation-value',
        returnUrl: 'https://merchant.example.com/updated',
      },
      expected,
    });

    expect(savedInputs).toEqual([
      {
        channel: 'primary',
        values: {
          returnUrl: 'https://merchant.example.com/updated',
        },
        expected,
      },
    ]);
    expect(saved.projection.commonValues).toEqual({
      returnUrl: 'https://merchant.example.com/updated',
    });
    expect(saved.projection.commonValues).not.toHaveProperty('merchantRef');
  });

  test('rejects a stale JSON save instead of overwriting the latest preset', async () => {
    expect.hasAssertions();

    let returnUrl = 'https://merchant.example.com/initial';
    const makePresets = (): TestPresets => ({
      common: {
        values: { returnUrl },
      },
      channels: {
        primary: {
          productNo: 'TEST-PRODUCT-001',
        },
      },
    });
    const storage = createJsonPresetStorage<
      TestChannel,
      TestFormValues,
      TestPresets,
      TestPersistentFormValues
    >({
      feature: 'deposit',
      lockPath: createLockPath(),
      load: async () => makePresets(),
      toPersistentInput: ({ channel, values, expected }) => ({
        channel,
        expected,
        values: { returnUrl: values.returnUrl },
      }),
      save: async ({ values }) => {
        returnUrl = values.returnUrl;
        return makePresets();
      },
      toPersistentProjection: (presets) => ({
        commonValues: {
          returnUrl: presets.common.values.returnUrl,
        },
        channels: {
          primary: {
            channelCommonValues: {},
            channelValues: {
              productNo: presets.channels.primary.productNo,
            },
          },
        },
      }),
    });

    const initial = await storage.load();
    const expected = {
      channel: 'primary' as const,
      featureUpdatedAt: initial.timestamps.feature?.updatedAt || null,
      channelUpdatedAt: initial.timestamps.channels.primary?.updatedAt || null,
    };

    const latestSave = storage.save({
      channel: 'primary',
      values: { returnUrl: 'https://merchant.example.com/latest' },
      expected,
    });

    const staleSave = storage.save({
      channel: 'primary',
      values: { returnUrl: 'https://merchant.example.com/stale' },
      expected,
    });

    await expect(latestSave).resolves.toBeDefined();
    await expect(staleSave).rejects.toBeInstanceOf(PresetStorageConflictError);

    await expect(storage.load()).resolves.toMatchObject({
      presets: {
        common: {
          values: { returnUrl: 'https://merchant.example.com/latest' },
        },
      },
    });
  });

  test('serializes saves from separate JSON adapter instances before checking stale tokens', async () => {
    expect.hasAssertions();

    let returnUrl = 'https://merchant.example.com/initial';
    let saveCalls = 0;
    let secondLoadCalls = 0;
    let signalFirstWriteStarted: () => void = () => undefined;
    let releaseFirstWrite: () => void = () => undefined;
    const firstWriteStarted = new Promise<void>((resolve) => {
      signalFirstWriteStarted = resolve;
    });
    const allowFirstWriteToFinish = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const makePresets = (): TestPresets => ({
      common: {
        values: { returnUrl },
      },
      channels: {
        primary: {
          productNo: 'TEST-PRODUCT-001',
        },
      },
    });
    const lockPath = createLockPath();
    const makeStorage = (isSecondInstance: boolean) =>
      createJsonPresetStorage<
        TestChannel,
        TestFormValues,
        TestPresets,
        TestPersistentFormValues
      >({
        feature: 'deposit',
        lockPath,
        load: async () => {
          if (isSecondInstance) {
            secondLoadCalls += 1;
          }
          return makePresets();
        },
        toPersistentInput: ({ channel, values, expected }) => ({
          channel,
          expected,
          values: { returnUrl: values.returnUrl },
        }),
        save: async ({ values }) => {
          saveCalls += 1;
          if (saveCalls === 1) {
            signalFirstWriteStarted();
            await allowFirstWriteToFinish;
          }
          returnUrl = values.returnUrl;
          return makePresets();
        },
        toPersistentProjection: (presets) => ({
          commonValues: {
            returnUrl: presets.common.values.returnUrl,
          },
          channels: {
            primary: {
              channelCommonValues: {},
              channelValues: {
                productNo: presets.channels.primary.productNo,
              },
            },
          },
        }),
      });

    const firstStorage = makeStorage(false);
    const secondStorage = makeStorage(true);
    const initial = await firstStorage.load();
    const expected = {
      channel: 'primary' as const,
      featureUpdatedAt: initial.timestamps.feature?.updatedAt || null,
      channelUpdatedAt: initial.timestamps.channels.primary?.updatedAt || null,
    };

    const latestSave = firstStorage.save({
      channel: 'primary',
      values: { returnUrl: 'https://merchant.example.com/latest' },
      expected,
    });
    await firstWriteStarted;

    const staleSave = secondStorage.save({
      channel: 'primary',
      values: { returnUrl: 'https://merchant.example.com/stale' },
      expected,
    });

    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      expect(secondLoadCalls).toBe(0);
    } finally {
      releaseFirstWrite();
    }

    await expect(latestSave).resolves.toBeDefined();
    await expect(staleSave).rejects.toBeInstanceOf(PresetStorageConflictError);
    expect(saveCalls).toBe(1);
    await expect(firstStorage.load()).resolves.toMatchObject({
      presets: {
        common: {
          values: { returnUrl: 'https://merchant.example.com/latest' },
        },
      },
    });
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
