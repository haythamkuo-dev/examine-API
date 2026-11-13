import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  DEPOSIT_CHANNEL_MANIFEST,
  PAYOUT_CHANNEL_MANIFEST,
  SUBSCRIPTION_CHANNEL_MANIFEST,
  type BackendChannelManifestEntry,
} from './env';

export type PresetAuditStatus = 'ready' | 'deferred' | 'invalid';

export type PresetAuditEntry = {
  feature: 'deposit' | 'payout' | 'subscription';
  sourceFile: string;
  targetRow: string;
  status: PresetAuditStatus;
  error?: string;
};

export type PresetAuditReport = {
  complete: boolean;
  entries: PresetAuditEntry[];
  summary: Record<PresetAuditStatus, number>;
};

export type PresetAuditOptions = {
  dataDirPath: string;
  readFileText?: (filePath: string) => Promise<string>;
};

type PresetAuditFile = {
  feature: PresetAuditEntry['feature'];
  relativePath: string;
  targetRow: string;
  deferred: boolean;
};

const createFeatureFiles = (
  feature: PresetAuditEntry['feature'],
  channels: readonly BackendChannelManifestEntry[],
): PresetAuditFile[] => [
  {
    feature,
    relativePath: `${feature}/common.json`,
    targetRow: `preset_sets:${feature}`,
    deferred: false,
  },
  ...channels.map((channel) => {
    const relativePath = `${feature}/channels/${channel.presetFile}`;
    return {
      feature,
      relativePath,
      targetRow: channel.auditTarget,
      deferred: channel.deferred === true,
    };
  }),
];

const auditFiles = [
  ...createFeatureFiles('deposit', DEPOSIT_CHANNEL_MANIFEST),
  ...createFeatureFiles('payout', PAYOUT_CHANNEL_MANIFEST),
  ...createFeatureFiles('subscription', SUBSCRIPTION_CHANNEL_MANIFEST),
];

const isTopLevelJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createEntry = async (
  file: PresetAuditFile,
  dataDirPath: string,
  readFileText: (filePath: string) => Promise<string>,
): Promise<PresetAuditEntry> => {
  const filePath = join(dataDirPath, file.relativePath);

  try {
    const parsed: unknown = JSON.parse(await readFileText(filePath));
    if (!isTopLevelJsonObject(parsed)) {
      throw new TypeError('Preset JSON must be a top-level object');
    }

    return {
      feature: file.feature,
      sourceFile: file.relativePath,
      targetRow: file.targetRow,
      status: file.deferred ? 'deferred' : 'ready',
      ...(file.deferred ? { error: 'JCB data owner decision is pending.' } : {}),
    };
  } catch (error) {
    return {
      feature: file.feature,
      sourceFile: file.relativePath,
      targetRow: file.targetRow,
      status: file.deferred ? 'deferred' : 'invalid',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Audits every known preset JSON source without changing any source file.
 *
 * @param options Audit data directory and optional file reader.
 * @returns A deterministic audit report with source, target row, status, and error details.
 * @throws {TypeError} When a required audit option is missing.
 */
export const auditPresetData = async (
  options: PresetAuditOptions,
): Promise<PresetAuditReport> => {
  if (!options.dataDirPath.trim()) {
    throw new TypeError('Preset audit data directory is required');
  }

  const readFileText = options.readFileText || ((filePath: string) => readFile(filePath, 'utf8'));
  const entries = await Promise.all(
    auditFiles.map((file) => createEntry(file, options.dataDirPath, readFileText)),
  );
  const summary: Record<PresetAuditStatus, number> = {
    ready: 0,
    deferred: 0,
    invalid: 0,
  };

  for (const entry of entries) {
    summary[entry.status] += 1;
  }

  return {
    complete: summary.invalid === 0 && summary.deferred === 0,
    entries,
    summary,
  };
};

