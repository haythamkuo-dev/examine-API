import {
  assertSupportedBunVersion,
  createPostgresDatabase,
  getOptionalPostgresUrl,
  INTEGRATION_DATABASE_URL_ENV_NAME,
  requireDatabaseUrl,
  requireIntegrationDatabaseUrl,
} from '../src/core/database';
import {
  DEFAULT_MIGRATIONS_DIRECTORY,
  runMigrations,
} from '../src/core/databaseMigrations';
import {
  provisionIntegrationDatabase,
  requireDatabaseAdminUrl,
  requireIntegrationDatabaseName,
  resetAndMigrateIntegrationDatabase,
  dropIntegrationDatabase,
} from '../src/core/integrationDatabase';

const printMigrationResult = (label: string, result: {
  applied: string[];
  skipped: string[];
  history: string[];
}): void => {
  console.log(label);
  console.log('Applied: ' + (result.applied.join(', ') || 'none'));
  console.log('Skipped: ' + (result.skipped.join(', ') || 'none'));
  console.log('History: ' + (result.history.join(', ') || 'empty'));
};

const migrateRuntimeDatabase = async (): Promise<void> => {
  const database = await createPostgresDatabase({ url: requireDatabaseUrl() });
  try {
    const result = await runMigrations(database.sql, {
      directoryPath: DEFAULT_MIGRATIONS_DIRECTORY,
    });
    printMigrationResult('Runtime database migrations completed.', result);
  } finally {
    await database.close();
  }
};

const resetIntegrationDatabase = async (): Promise<void> => {
  const database = await createPostgresDatabase({
    url: requireIntegrationDatabaseUrl(),
  });
  try {
    const result = await resetAndMigrateIntegrationDatabase(
      database,
      DEFAULT_MIGRATIONS_DIRECTORY,
    );
    printMigrationResult('Integration database reset and migrations completed.', result);
  } finally {
    await database.close();
  }
};

const provisionDatabase = async (): Promise<void> => {
  const integrationDatabaseUrl = getOptionalPostgresUrl(
    process.env,
    INTEGRATION_DATABASE_URL_ENV_NAME,
  );
  const result = await provisionIntegrationDatabase({
    adminUrl: requireDatabaseAdminUrl(),
    databaseName: requireIntegrationDatabaseName(),
    integrationDatabaseUrl,
    migrationsDirectoryPath: DEFAULT_MIGRATIONS_DIRECTORY,
  });
  printMigrationResult('Integration database provisioned and migrated.', result.migrations);
  console.log('Database URL is ready for INTEGRATION_DATABASE_URL configuration.');
};

const teardownDatabase = async (): Promise<void> => {
  await dropIntegrationDatabase({
    adminUrl: requireDatabaseAdminUrl(),
    databaseName: requireIntegrationDatabaseName(),
  });
  console.log('Integration database teardown completed.');
};

const main = async (): Promise<void> => {
  assertSupportedBunVersion();
  const command = process.argv[2];

  switch (command) {
    case 'migrate':
      await migrateRuntimeDatabase();
      return;
    case 'integration-reset':
      await resetIntegrationDatabase();
      return;
    case 'integration-provision':
      await provisionDatabase();
      return;
    case 'integration-teardown':
      await teardownDatabase();
      return;
    default:
      throw new Error(
        'Usage: bun run scripts/database.ts <migrate|integration-reset|integration-provision|integration-teardown>',
      );
  }
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Database command failed.';
    console.error(message);
    process.exitCode = 1;
  });
}
