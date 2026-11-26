import { describe, expect, test } from 'bun:test';
import { auditPresetData } from './presetAudit';
import { DEPOSIT_CHANNEL_MANIFEST, PAYOUT_CHANNEL_MANIFEST, SUBSCRIPTION_CHANNEL_MANIFEST } from './env';

describe('preset audit', () => {
  test('reports known JCB sources as deferred instead of hiding their parse failure', async () => {
    expect.hasAssertions();
    const manifests = [
      ...DEPOSIT_CHANNEL_MANIFEST,
      ...PAYOUT_CHANNEL_MANIFEST,
      ...SUBSCRIPTION_CHANNEL_MANIFEST,
    ];
    const deferredCount = manifests.filter((entry) => entry.deferred === true).length;
    const commonPresetFileCount = 3;

    const report = await auditPresetData({
      dataDirPath: '/tmp/examine-api-audit',
      readFileText: async (filePath) => {
        if (filePath.endsWith('JCB-JPY.json') || filePath.endsWith('JCB-USD.json')) {
          throw new SyntaxError('JSON Parse error: Expected }');
        }

        return '{}';
      },
    });

    expect(report.summary).toEqual({
      ready: commonPresetFileCount + manifests.length - deferredCount,
      deferred: deferredCount,
      invalid: 0,
    });
    expect(report.complete).toBe(false);
    expect(report.entries.filter((entry) => entry.status === 'deferred')).toEqual([
      expect.objectContaining({
        sourceFile: 'deposit/channels/JCB-USD.json',
        targetRow: 'preset_channels:deposit:JCB-USD',
        status: 'deferred',
      }),
      expect.objectContaining({
        sourceFile: 'deposit/channels/JCB-JPY.json',
        targetRow: 'preset_channels:deposit:JCB-JPY',
        status: 'deferred',
      }),
    ]);
  });

  test('marks non-deferred unreadable sources as invalid', async () => {
    expect.hasAssertions();

    const report = await auditPresetData({
      dataDirPath: '/tmp/examine-api-audit',
      readFileText: async (filePath) => {
        if (filePath.endsWith('deposit/common.json')) {
          throw new SyntaxError('invalid preset');
        }

        return '{}';
      },
    });

    expect(report.complete).toBe(false);
    expect(report.summary.invalid).toBe(1);
    expect(report.entries).toContainEqual({
      feature: 'deposit',
      sourceFile: 'deposit/common.json',
      targetRow: 'preset_sets:deposit',
      status: 'invalid',
      error: 'invalid preset',
    });
  });

  test('marks non-object JSON sources as invalid', async () => {
    expect.hasAssertions();

    for (const rawText of ['[]', 'null', '"preset"']) {
      const report = await auditPresetData({
        dataDirPath: '/tmp/examine-api-audit',
        readFileText: async (filePath) =>
          filePath.endsWith('deposit/common.json') ? rawText : '{}',
      });

      expect(report.complete).toBe(false);
      expect(report.summary.invalid).toBe(1);
      expect(report.entries).toContainEqual({
        feature: 'deposit',
        sourceFile: 'deposit/common.json',
        targetRow: 'preset_sets:deposit',
        status: 'invalid',
        error: 'Preset JSON must be a top-level object',
      });
    }
  });
});
