import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cp, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { createTestCliEnv } from '../../tests/server-setup';
import { createDepositService, getRequestedDepositChannel } from './service';

const env = createTestCliEnv();
const makeId = (prefix: string) => `${prefix}fixed-id`;
const sourceDirPath = resolve(process.cwd(), 'data/deposit');

let presetDirPath = sourceDirPath;
const originalFetch = globalThis.fetch;

const copyDepositFixtures = async (): Promise<string> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'deposit-service-'));
  const dirPath = join(tempDir, 'deposit');
  await cp(sourceDirPath, dirPath, { recursive: true });
  return dirPath;
};

beforeEach(async () => {
  presetDirPath = await copyDepositFixtures();
  globalThis.fetch = originalFetch;
  mock.restore();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe('deposit service', () => {
  test('returns requested deposit channel and falls back for unsupported values', () => {
    expect(getRequestedDepositChannel(new URL('https://example.test/api/deposit/defaults?channel=inr_upi'))).toBe(
      'inr_upi',
    );
    expect(getRequestedDepositChannel(new URL('https://example.test/api/deposit/defaults?channel=unknown'))).toBe(
      'southafrica_cards',
    );
    expect(getRequestedDepositChannel(new URL('https://example.test/api/deposit/defaults'))).toBe(
      'southafrica_cards',
    );
  });

  test('loads deposit defaults from the fixture bundle', async () => {
    const service = createDepositService({
      env,
      presetDirPath,
      makeId,
      logger: console,
    });

    const defaults = await service.getDefaults('southafrica_cards');

    expect(defaults.channel).toBe('southafrica_cards');
    expect(defaults.availableChannels).toContain('linepay');
    expect(defaults.form.commonValues.merchantRef).toBe('TEST_ORDER_000001');
    expect(defaults.form.commonValues.productNo).toBe('DEP-FUTUREPAY_COLLECT-ZASOUTHAFRICACARDS-USD');
  });

  test('builds a masked preview response from deposit form values', async () => {
    const service = createDepositService({
      env,
      presetDirPath,
      makeId,
      logger: console,
    });
    const defaults = await service.getDefaults('southafrica_cards');

    defaults.form.commonValues.merchantRef = 'TEST_SERVICE_PREVIEW_001';
    const preview = service.preview(defaults.form);
    const payload = preview.request.payload as Record<string, unknown>;

    expect(preview.request.headers?.Authorization).toBe('ApiKey ****-token');
    expect(payload.merchant_ref).toBe('TEST_SERVICE_PREVIEW_001_fixed-id');
  });

  test('returns create results with deposit failure hints', async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ code: 'binding_missing', message: 'merchant product not bound' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const service = createDepositService({
      env,
      presetDirPath,
      makeId,
      logger: console,
    });
    const defaults = await service.getDefaults('southafrica_cards');

    const result = await service.execute(defaults.form);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.code).toBe('binding_missing');
    expect(result.hint).toContain('not bound to this product_no');
  });
});
