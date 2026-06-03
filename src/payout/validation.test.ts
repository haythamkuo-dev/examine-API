import { beforeEach, describe, expect, test } from 'bun:test';
import { cp, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { createTestCliEnv } from '../../tests/server-setup';
import { loadPayoutPresets, toPayoutDefaultsResponse } from './presets';
import { validatePayoutForm } from './validation';

const env = createTestCliEnv();
const makeId = (prefix: string) => `${prefix}fixed-id`;
const sourceDirPath = resolve(process.cwd(), 'data/payout');

let presetDirPath = sourceDirPath;

const copyPayoutFixtures = async (): Promise<string> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'payout-validation-'));
  const dirPath = join(tempDir, 'payout');
  await cp(sourceDirPath, dirPath, { recursive: true });
  return dirPath;
};

beforeEach(async () => {
  presetDirPath = await copyPayoutFixtures();
});

describe('validatePayoutForm', () => {
  test('accepts valid payout defaults for the selected channel', async () => {
    const presets = await loadPayoutPresets({ dirPath: presetDirPath, makeId });
    const defaults = toPayoutDefaultsResponse('co_bank', env, presets);

    const error = validatePayoutForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBeUndefined();
  });

  test('returns an error when a required common field is blank', async () => {
    const presets = await loadPayoutPresets({ dirPath: presetDirPath, makeId });
    const defaults = toPayoutDefaultsResponse('co_bank', env, presets);

    defaults.form.commonValues.merchantReference = '   ';
    const error = validatePayoutForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBe('merchantReference is required');
  });

  test('returns an error when product_no does not match the payout product code format', async () => {
    const presets = await loadPayoutPresets({ dirPath: presetDirPath, makeId });
    const defaults = toPayoutDefaultsResponse('co_bank', env, presets);

    defaults.form.channelValues.product_no = 'mk_general_01ksse4ja1th.ksqLSyDPzAQbdZu_DOAvvfPlZythxXGj';
    const error = validatePayoutForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBe('product_no must be a valid payout product code');
  });
});
