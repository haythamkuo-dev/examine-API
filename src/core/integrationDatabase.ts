import type { SQL } from 'bun';
import {
  createPostgresDatabase,
  DatabaseConfigurationError,
  INTEGRATION_DATABASE_URL_ENV_NAME,
  type PostgresDatabase,
  validatePostgresUrl,
} from './database';
import {
  DEFAULT_MIGRATIONS_DIRECTORY,
  runMigrations,
  type MigrationRunResult,
} from './databaseMigrations';

export const DATABASE_ADMIN_URL_ENV_NAME = 'DATABASE_ADMIN_URL';
export const INTEGRATION_DATABASE_NAME_ENV_NAME = 'INTEGRATION_DATABASE_NAME';

/**
 * Configures disposable integration database provisioning.
 */
export type IntegrationDatabaseOptions = {
  adminUrl: string;
  databaseName: string;
  /** Optional integration-role URL used to apply migrations and own the schema. */
  integrationDatabaseUrl?: string;
  migrationsDirectoryPath?: string;
};

/**
 * Summarizes a provisioned and migrated integration database.
 */
export type ProvisionedIntegrationDatabase = {
  databaseUrl: string;
  migrations: MigrationRunResult;
};

const integrationDatabaseNamePattern = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

const quoteIdentifier = (identifier: string): string => '"' + identifier.replaceAll('"', '""') + '"';

const getDatabaseNameFromUrl = (url: string): string =>
  decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''));

const getDatabaseRoleFromUrl = (url: string): string | undefined => {
  const role = decodeURIComponent(new URL(url).username);
  return role || undefined;
};

const validateIntegrationDatabaseUrl = (
  integrationDatabaseUrl: string,
  adminUrl: string,
  databaseName: string,
): string => {
  const validatedUrl = validatePostgresUrl(
    integrationDatabaseUrl,
    INTEGRATION_DATABASE_URL_ENV_NAME,
  );
  const targetUrl = new URL(validatedUrl);
  const validatedAdminUrl = new URL(validatePostgresUrl(adminUrl, DATABASE_ADMIN_URL_ENV_NAME));
  const targetDatabaseName = getDatabaseNameFromUrl(validatedUrl);
  const targetEndpoint = targetUrl.hostname + '|' + (targetUrl.port || '5432');
  const adminEndpoint =
    validatedAdminUrl.hostname + '|' + (validatedAdminUrl.port || '5432');

  if (targetDatabaseName !== databaseName || targetEndpoint !== adminEndpoint) {
    throw new DatabaseConfigurationError(
      INTEGRATION_DATABASE_URL_ENV_NAME +
        ' must point to the provisioned database on the same PostgreSQL server as ' +
        DATABASE_ADMIN_URL_ENV_NAME + '.',
    );
  }

  return validatedUrl;
};

const grantIntegrationDatabaseAccess = async (
  adminUrl: string,
  databaseName: string,
  integrationDatabaseUrl: string,
): Promise<void> => {
  const adminRole = getDatabaseRoleFromUrl(adminUrl);
  const integrationRole = getDatabaseRoleFromUrl(integrationDatabaseUrl);
  if (!integrationRole || integrationRole === adminRole) {
    return;
  }

  const adminDatabase = await createPostgresDatabase({ url: adminUrl });
  try {
    await adminDatabase.sql.unsafe(
      'grant connect, create on database ' +
        quoteIdentifier(databaseName) +
        ' to ' +
        quoteIdentifier(integrationRole),
    );
  } finally {
    await adminDatabase.close();
  }
};

const assertAdministrativeDatabase = (adminUrl: string, databaseName: string): void => {
  const adminDatabaseName = getDatabaseNameFromUrl(adminUrl);
  if (!adminDatabaseName || adminDatabaseName === databaseName) {
    throw new DatabaseConfigurationError(
      DATABASE_ADMIN_URL_ENV_NAME +
        ' must include an administrative database different from the integration database.',
    );
  }
};

/**
 * Validates the fixed database name used by the integration provisioner.
 *
 * @param value Candidate PostgreSQL database name.
 * @returns A validated database name safe for identifier interpolation.
 * @throws {DatabaseConfigurationError} When the name is empty or invalid.
 */
export const validateIntegrationDatabaseName = (value: string | undefined): string => {
  const databaseName = value?.trim();
  if (!databaseName || !integrationDatabaseNamePattern.test(databaseName)) {
    throw new DatabaseConfigurationError(
      INTEGRATION_DATABASE_NAME_ENV_NAME +
        ' must be a PostgreSQL identifier containing only letters, numbers, and underscores.',
    );
  }

  return databaseName;
};

/**
 * Resolves the administrative PostgreSQL URL used only by database provisioners.
 *
 * @param environment Environment values to inspect.
 * @returns A validated admin PostgreSQL URL.
 * @throws {DatabaseConfigurationError} When the URL is missing or invalid.
 */
export const requireDatabaseAdminUrl = (
  environment: NodeJS.ProcessEnv = process.env,
): string =>
  validatePostgresUrl(
    environment[DATABASE_ADMIN_URL_ENV_NAME],
    DATABASE_ADMIN_URL_ENV_NAME,
  );

/**
 * Resolves the explicit integration database name used by provision and teardown commands.
 *
 * @param environment Environment values to inspect.
 * @returns A validated integration database name.
 * @throws {DatabaseConfigurationError} When the name is missing or invalid.
 */
export const requireIntegrationDatabaseName = (
  environment: NodeJS.ProcessEnv = process.env,
): string => validateIntegrationDatabaseName(environment[INTEGRATION_DATABASE_NAME_ENV_NAME]);

/**
 * Builds a target database URL while preserving the admin URL's credentials and options.
 *
 * @param adminUrl PostgreSQL URL with credentials permitted to manage databases.
 * @param databaseName Target database name.
 * @returns A PostgreSQL URL pointing to the target database.
 * @throws {DatabaseConfigurationError} When the URL or database name is invalid.
 */
export const buildIntegrationDatabaseUrl = (adminUrl: string, databaseName: string): string => {
  const validatedAdminUrl = validatePostgresUrl(adminUrl, DATABASE_ADMIN_URL_ENV_NAME);
  const validatedDatabaseName = validateIntegrationDatabaseName(databaseName);
  const targetUrl = new URL(validatedAdminUrl);
  targetUrl.pathname = '/' + encodeURIComponent(validatedDatabaseName);
  return targetUrl.toString();
};

/**
 * Creates the disposable integration database when it does not already exist.
 *
 * The administrative connection is closed before this function resolves. The
 * test role only needs access to the returned database and does not need
 * CREATEDB.
 *
 * @param options Admin URL and fixed database name.
 * @returns A validated URL for the provisioned database.
 * @throws {DatabaseConfigurationError} When the admin URL targets the database being provisioned.
 * @throws {DatabaseConnectionError} When the admin database cannot be reached.
 */
export const createIntegrationDatabase = async (
  options: Pick<IntegrationDatabaseOptions, 'adminUrl' | 'databaseName'>,
): Promise<string> => {
  const adminUrl = validatePostgresUrl(options.adminUrl, DATABASE_ADMIN_URL_ENV_NAME);
  const databaseName = validateIntegrationDatabaseName(options.databaseName);

  assertAdministrativeDatabase(adminUrl, databaseName);

  const adminDatabase = await createPostgresDatabase({ url: adminUrl });
  try {
    const rows = await adminDatabase.sql.unsafe<{ exists: boolean }[]>(
      'select exists(select 1 from pg_database where datname = $1) as exists',
      [databaseName],
    );

    if (!rows[0]?.exists) {
      await adminDatabase.sql.unsafe('create database ' + quoteIdentifier(databaseName));
    }
  } finally {
    await adminDatabase.close();
  }

  return buildIntegrationDatabaseUrl(adminUrl, databaseName);
};

/**
 * Drops the disposable integration database after all test pools are closed.
 *
 * @param options Admin URL and exact integration database name.
 * @throws {DatabaseConfigurationError} When the admin URL targets the database being dropped.
 * @throws {DatabaseConnectionError} When the admin database cannot be reached.
 */
export const dropIntegrationDatabase = async (
  options: Pick<IntegrationDatabaseOptions, 'adminUrl' | 'databaseName'>,
): Promise<void> => {
  const adminUrl = validatePostgresUrl(options.adminUrl, DATABASE_ADMIN_URL_ENV_NAME);
  const databaseName = validateIntegrationDatabaseName(options.databaseName);

  assertAdministrativeDatabase(adminUrl, databaseName);

  const adminDatabase = await createPostgresDatabase({ url: adminUrl });
  try {
    await adminDatabase.sql.unsafe(
      'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
      [databaseName],
    );
    await adminDatabase.sql.unsafe('drop database if exists ' + quoteIdentifier(databaseName));
  } finally {
    await adminDatabase.close();
  }
};

/**
 * Resets only the fixed preset schema in a disposable integration database.
 *
 * @param client PostgreSQL client connected to the integration database.
 * @returns A promise resolved after the schema is removed.
 * @throws {Error} When PostgreSQL cannot drop the schema.
 */
export const resetPresetStoreSchema = async (client: SQL): Promise<void> => {
  await client.unsafe('drop schema if exists preset_store cascade');
};

/**
 * Resets and migrates the disposable integration database.
 *
 * @param database Open integration database pool.
 * @param migrationsDirectoryPath Optional canonical migration directory.
 * @returns The migration result after the schema reset.
 * @throws {Error} When reset or migration execution fails.
 */
export const resetAndMigrateIntegrationDatabase = async (
  database: PostgresDatabase,
  migrationsDirectoryPath: string = DEFAULT_MIGRATIONS_DIRECTORY,
): Promise<MigrationRunResult> => {
  await resetPresetStoreSchema(database.sql);
  return runMigrations(database.sql, { directoryPath: migrationsDirectoryPath });
};

/**
 * Provisions, resets, migrates, and closes a disposable integration database.
 *
 * @param options Admin URL, database name, optional integration-role URL, and migration directory.
 * @returns The target URL and migration result; no pool remains open.
 * @throws {Error} When provisioning, migration, or cleanup fails.
 */
export const provisionIntegrationDatabase = async (
  options: IntegrationDatabaseOptions,
): Promise<ProvisionedIntegrationDatabase> => {
  const integrationDatabaseUrl = options.integrationDatabaseUrl
    ? validateIntegrationDatabaseUrl(
        options.integrationDatabaseUrl,
        options.adminUrl,
        options.databaseName,
      )
    : undefined;
  const adminDatabaseUrl = await createIntegrationDatabase(options);
  const databaseUrl = integrationDatabaseUrl ?? adminDatabaseUrl;

  if (integrationDatabaseUrl) {
    await grantIntegrationDatabaseAccess(
      options.adminUrl,
      options.databaseName,
      integrationDatabaseUrl,
    );
  }

  const adminDatabase = await createPostgresDatabase({ url: adminDatabaseUrl });
  try {
    await resetPresetStoreSchema(adminDatabase.sql);
  } finally {
    await adminDatabase.close();
  }

  const database = await createPostgresDatabase({ url: databaseUrl });

  try {
    const migrations = await resetAndMigrateIntegrationDatabase(
      database,
      options.migrationsDirectoryPath,
    );
    return { databaseUrl, migrations };
  } finally {
    await database.close();
  }
};
