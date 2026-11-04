import { describe, expect, test } from 'bun:test';
import {
  buildIntegrationDatabaseUrl,
  createIntegrationDatabase,
  validateIntegrationDatabaseName,
} from './integrationDatabase';
import { DatabaseConfigurationError } from './database';

const getProvisioningFixtures = (): { adminUrl: string; databaseName: string } => {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
  const databaseName = process.env.TEST_INTEGRATION_DATABASE_NAME;
  if (!adminUrl || !databaseName) {
    throw new Error('Integration database provisioner fixtures are missing from .env.test.');
  }

  return { adminUrl, databaseName };
};

describe('integration database lifecycle configuration', () => {
  test('builds a target URL without changing admin credentials or options', () => {
    const { adminUrl, databaseName } = getProvisioningFixtures();
    const targetUrl = new URL(buildIntegrationDatabaseUrl(adminUrl, databaseName));
    const sourceUrl = new URL(adminUrl);

    expect(targetUrl.protocol).toBe(sourceUrl.protocol);
    expect(targetUrl.hostname).toBe(sourceUrl.hostname);
    expect(targetUrl.pathname).toBe('/' + databaseName);
  });

  test('rejects unsafe database identifiers before administrative SQL runs', async () => {
    const { adminUrl, databaseName } = getProvisioningFixtures();
    expect(validateIntegrationDatabaseName(databaseName)).toBe(databaseName);
    expect(() => validateIntegrationDatabaseName('integration-db')).toThrow(
      DatabaseConfigurationError,
    );
    await expect(
      createIntegrationDatabase({
        adminUrl: buildIntegrationDatabaseUrl(adminUrl, databaseName),
        databaseName,
      }),
    ).rejects.toThrow(DatabaseConfigurationError);
  });
});
