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
  test('loads LINE Pay quantity as a numeric field and value', async () => {
    const presets = await loadDepositPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toDepositDefaultsResponse('linepay', env, presets);
    const products = (
      (defaults.form.channelValues.payment_order as Record<string, unknown>).linepay_online as Record<string, unknown>
    ).packages as Array<Record<string, unknown>>;
    const quantity = ((products[0]?.products as Array<Record<string, unknown>>)[0] as Record<string, unknown>).quantity;
    const quantitySchema = (((defaults.channelSchema.payment_order as { fields: Record<string, unknown> }).fields
      .linepay_online as { fields: Record<string, unknown> }).fields.packages as { itemSchema: { fields: Record<string, unknown> } })
      .itemSchema.fields.products as { itemSchema: { fields: Record<string, { kind: string }> } };

    expect(quantity).toBe(1);
    expect(quantitySchema.itemSchema.fields.quantity.kind).toBe('number');
  });

  test('accepts valid deposit defaults for the selected channel', async () => {
    const presets = await loadDepositPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toDepositDefaultsResponse('southafrica_cards', env, presets);

    const error = validateDepositForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBeUndefined();
  });

  test('returns an error when a required common field is blank', async () => {
    const presets = await loadDepositPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toDepositDefaultsResponse('southafrica_cards', env, presets);

    defaults.form.commonValues.merchantRef = '   ';
    const error = validateDepositForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBe('merchantRef is required');
  });

  test('returns a nested error path when a required channel field is blank', async () => {
    const presets = await loadDepositPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toDepositDefaultsResponse('southafrica_cards', env, presets);
    const paymentOrder = defaults.form.channelValues.payment_order as Record<string, unknown>;
    const collect = paymentOrder.collect as Record<string, unknown>;

    collect.product_name = '';
    const error = validateDepositForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBe('payment_order.collect.product_name is required');
  });

  test('returns an error when productNo does not match the deposit product code format', async () => {
    const presets = await loadDepositPresets({ dirPath: presetDirPath, env, makeId });
    const defaults = toDepositDefaultsResponse('southafrica_cards', env, presets);

    defaults.form.commonValues.productNo = 'mk_general_01ksse4ja1th.ksqLSyDPzAQbdZu_DOAvvfPlZythxXGj';
    const error = validateDepositForm(defaults.form, defaults.commonSchema, defaults.channelSchema);

    expect(error).toBe('commonValues.productNo must be a valid deposit product code');
  });
});
