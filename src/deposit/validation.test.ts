import { beforeEach, describe, expect, test } from 'bun:test';
import { cp, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { createTestCliEnv } from '../../tests/server-setup';
import { loadDepositPresets, toDepositDefaultsResponse } from './presets';
import { validateDepositForm } from './validation';

const env = createTestCliEnv();
const makeId = (prefix: string) => `${prefix}fixed-id`;
const sourceDirPath = resolve(process.cwd(), 'data/deposit');

let presetDirPath = sourceDirPath;

const copyDepositFixtures = async (): Promise<string> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'deposit-validation-'));
  const dirPath = join(tempDir, 'deposit');
  await cp(sourceDirPath, dirPath, { recursive: true });
  return dirPath;
};

beforeEach(async () => {
  presetDirPath = await copyDepositFixtures();
});

describe('validateDepositForm', () => {
  test('accepts valid deposit defaults for the selected channel', async () => {
    const presets = await loadDepositPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toDepositDefaultsResponse('southafrica_cards', presets);

    const error = validateDepositForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBeUndefined();
  });

  test('returns an error when a required common field is blank', async () => {
    const presets = await loadDepositPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toDepositDefaultsResponse('southafrica_cards', presets);

    defaults.form.commonValues.merchantRef = '   ';
    const error = validateDepositForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBe('merchantRef is required');
  });

  test('returns a nested error path when a required channel field is blank', async () => {
    const presets = await loadDepositPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toDepositDefaultsResponse('southafrica_cards', presets);
    const paymentOrder = defaults.form.channelValues.payment_order as Record<string, unknown>;
    const collect = paymentOrder.collect as Record<string, unknown>;

    collect.product_name = '';
    const error = validateDepositForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBe('payment_order.collect.product_name is required');
  });
});
