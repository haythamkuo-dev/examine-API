import { beforeEach, describe, expect, test } from 'bun:test';
import { cp, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { createTestCliEnv } from '../../tests/server-setup';
import { loadSubscriptionPresets, toSubscriptionDefaultsResponse } from './presets';
import { validateSubscriptionForm } from './validation';

const env = createTestCliEnv();
const makeId = (prefix: string) => `${prefix}fixed-id`;
const sourceDirPath = resolve(process.cwd(), 'data/subscription');

let presetDirPath = sourceDirPath;

const copySubscriptionFixtures = async (): Promise<string> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'subscription-validation-'));
  const dirPath = join(tempDir, 'subscription');
  await cp(sourceDirPath, dirPath, { recursive: true });
  return dirPath;
};

beforeEach(async () => {
  presetDirPath = await copySubscriptionFixtures();
});

describe('validateSubscriptionForm', () => {
  test('accepts valid subscription defaults for the selected channel', async () => {
    const presets = await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toSubscriptionDefaultsResponse('default', env, 'local', presets);

    const error = validateSubscriptionForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBeUndefined();
  });

  test('returns an error when a required common field is blank', async () => {
    const presets = await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toSubscriptionDefaultsResponse('default', env, 'local', presets);

    defaults.form.commonValues.merchantRef = '   ';
    const error = validateSubscriptionForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBe('merchantRef is required');
  });

  test('accepts non-empty draft subs_plan_id values without enforcing a prefix format', async () => {
    const presets = await loadSubscriptionPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toSubscriptionDefaultsResponse('default', env, 'local', presets);

    defaults.form.channelValues.subs_plan_id = 'mk_general_01ksse4ja1th.ksqLSyDPzAQbdZu_DOAvvfPlZythxXGj';
    const error = validateSubscriptionForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBeUndefined();
  });
});
