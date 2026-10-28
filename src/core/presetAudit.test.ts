import { describe, expect, test } from 'bun:test';
import { auditPresetData } from './presetAudit';

describe('preset audit', () => {
  test('reports known JCB sources as deferred instead of hiding their parse failure', async () => {
    expect.hasAssertions();

    const report = await auditPresetData({
      dataDirPath: '/tmp/examine-api-audit',
      readFileText: async (filePath) => {
        if (filePath.endsWith('JCB-JPY.json') || filePath.endsWith('JCB-USD.json')) {
          throw new SyntaxError('JSON Parse error: Expected }');
        }

        return '{}';
      },
    });

    expect(report.summary).toEqual({ ready: 53, deferred: 2, invalid: 0 });
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
});
