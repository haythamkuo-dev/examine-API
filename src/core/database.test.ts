import { describe, expect, test } from 'bun:test';
import {
  assertSupportedBunVersion,
  createPostgresDatabase,
  DatabaseConfigurationError,
  isSupportedBunVersion,
  requireIntegrationDatabaseUrl,
  validatePostgresUrl,
} from './database';

const getTestDatabaseUrls = (): { runtime: string; integration: string } => {
  const runtime = process.env.TEST_RUNTIME_DATABASE_URL;
  const integration = process.env.TEST_INTEGRATION_DATABASE_URL;
  if (!runtime || !integration) {
    throw new Error('Database URL parser test fixtures are missing from .env.test.');
  }

  return { runtime, integration };
};

describe('database configuration', () => {
  test('enforces the minimum supported Bun version', () => {
    expect(isSupportedBunVersion('1.4.3')).toBe(true);
    expect(isSupportedBunVersion('1.5.0')).toBe(true);
    expect(isSupportedBunVersion('1.4.2')).toBe(false);
    expect(isSupportedBunVersion('not-a-version')).toBe(false);
    expect(() => assertSupportedBunVersion('1.4.2')).toThrow(DatabaseConfigurationError);
  });

  test('accepts only PostgreSQL URLs and does not require a live connection', () => {
    const { runtime } = getTestDatabaseUrls();
    expect(validatePostgresUrl('  ' + runtime + '  ')).toBe(runtime);
    expect(() => validatePostgresUrl(undefined)).toThrow(DatabaseConfigurationError);
    expect(() => validatePostgresUrl('https://example.invalid/database')).toThrow(
      DatabaseConfigurationError,
    );
  });

  test('keeps the integration URL separate from the runtime URL', () => {
    const { runtime, integration } = getTestDatabaseUrls();
    expect(
      requireIntegrationDatabaseUrl({
        DATABASE_URL: runtime,
        INTEGRATION_DATABASE_URL: integration,
      }),
    ).toBe(integration);
    expect(() =>
      requireIntegrationDatabaseUrl({
        DATABASE_URL: runtime,
        INTEGRATION_DATABASE_URL: runtime,
      }),
    ).toThrow(DatabaseConfigurationError);
  });

  test('fails before creating a pool when DATABASE_URL is absent', async () => {
    await expect(createPostgresDatabase({ env: {} })).rejects.toBeInstanceOf(
      DatabaseConfigurationError,
    );
  });
});
