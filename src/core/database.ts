import { SQL } from 'bun';

export const DATABASE_URL_ENV_NAME = 'DATABASE_URL';
export const INTEGRATION_DATABASE_URL_ENV_NAME = 'INTEGRATION_DATABASE_URL';
export const MIN_SUPPORTED_BUN_VERSION = '1.4.3';

type DatabaseEnvironment = Pick<
  NodeJS.ProcessEnv,
  'DATABASE_URL' | 'INTEGRATION_DATABASE_URL'
>;

/**
 * Describes invalid server-only database configuration.
 */
export class DatabaseConfigurationError extends Error {
  /**
   * Creates a configuration error.
   *
   * @param message Safe diagnostic message without credentials.
   */
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

/**
 * Describes a failed PostgreSQL connectivity probe.
 */
export class DatabaseConnectionError extends Error {
  readonly cause: unknown;

  /**
   * Creates a connection error while retaining the original cause for diagnostics.
   *
   * @param message Safe diagnostic message without credentials.
   * @param cause Original connection error.
   */
  constructor(message: string, cause: unknown) {
    super(message);
    this.name = 'DatabaseConnectionError';
    this.cause = cause;
  }
}

/**
 * Configures a Bun PostgreSQL pool.
 */
export type PostgresPoolOptions = {
  url?: string;
  env?: NodeJS.ProcessEnv;
  connectionTimeout?: number;
  max?: number;
};

/**
 * Owns a reusable PostgreSQL pool and its shutdown lifecycle.
 */
export type PostgresDatabase = {
  sql: SQL;
  close: () => Promise<void>;
};

const parseVersion = (version: string): [number, number, number] | null => {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const compareVersions = (left: [number, number, number], right: [number, number, number]): number => {
  for (const index of [0, 1, 2] as const) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  return 0;
};

const databaseIdentity = (url: URL): string =>
  [
    'postgres',
    url.hostname.toLowerCase(),
    url.port || '5432',
    url.pathname,
  ].join('|');

/**
 * Checks whether a Bun version meets the database lifecycle minimum.
 *
 * @param version Bun version string to compare.
 * @returns true when the version is at least the supported minimum.
 */
export const isSupportedBunVersion = (version: string): boolean => {
  const actual = parseVersion(version);
  const minimum = parseVersion(MIN_SUPPORTED_BUN_VERSION);
  return actual !== null && minimum !== null && compareVersions(actual, minimum) >= 0;
};

/**
 * Verifies the Bun runtime used by a database operation.
 *
 * @param version Bun version to verify; defaults to the running Bun version.
 * @throws {DatabaseConfigurationError} When Bun is older than the supported minimum.
 */
export const assertSupportedBunVersion = (version: string = Bun.version): void => {
  if (!isSupportedBunVersion(version)) {
    throw new DatabaseConfigurationError(
      'Bun ' + MIN_SUPPORTED_BUN_VERSION + ' or newer is required for PostgreSQL lifecycle operations.',
    );
  }
};

/**
 * Validates and normalizes a PostgreSQL connection URL without exposing credentials.
 *
 * @param value Candidate connection URL.
 * @param environmentVariable Name used in configuration error messages.
 * @returns A trimmed PostgreSQL connection URL.
 * @throws {DatabaseConfigurationError} When the value is empty or not a PostgreSQL URL.
 */
export const validatePostgresUrl = (
  value: string | undefined,
  environmentVariable: string = DATABASE_URL_ENV_NAME,
): string => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    throw new DatabaseConfigurationError(environmentVariable + ' must be set for PostgreSQL operations.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new DatabaseConfigurationError(
      environmentVariable + ' must be a valid postgres:// or postgresql:// URL.',
    );
  }

  if (
    (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') ||
    !parsedUrl.hostname
  ) {
    throw new DatabaseConfigurationError(
      environmentVariable + ' must be a valid postgres:// or postgresql:// URL.',
    );
  }

  return normalizedValue;
};

/**
 * Reads an optional PostgreSQL URL from an environment object.
 *
 * @param environment Environment values to inspect.
 * @param environmentVariable Environment key containing the URL.
 * @returns A validated URL, or undefined when the key is absent.
 * @throws {DatabaseConfigurationError} When the key exists but contains an invalid URL.
 */
export const getOptionalPostgresUrl = (
  environment: NodeJS.ProcessEnv,
  environmentVariable: string,
): string | undefined => {
  const value = environment[environmentVariable];
  return value === undefined ? undefined : validatePostgresUrl(value, environmentVariable);
};

/**
 * Resolves the required runtime database URL.
 *
 * @param environment Environment values to inspect.
 * @returns A validated runtime PostgreSQL URL.
 * @throws {DatabaseConfigurationError} When DATABASE_URL is missing or invalid.
 */
export const requireDatabaseUrl = (
  environment: NodeJS.ProcessEnv = process.env,
): string => validatePostgresUrl(environment[DATABASE_URL_ENV_NAME], DATABASE_URL_ENV_NAME);

/**
 * Resolves the disposable integration database URL and prevents accidental runtime reuse.
 *
 * @param environment Environment values to inspect.
 * @returns A validated integration PostgreSQL URL.
 * @throws {DatabaseConfigurationError} When the integration URL is missing, invalid, or points to the runtime database.
 */
export const requireIntegrationDatabaseUrl = (
  environment: DatabaseEnvironment = process.env,
): string => {
  const integrationUrl = validatePostgresUrl(
    environment[INTEGRATION_DATABASE_URL_ENV_NAME],
    INTEGRATION_DATABASE_URL_ENV_NAME,
  );
  const runtimeUrl = getOptionalPostgresUrl(environment, DATABASE_URL_ENV_NAME);

  if (runtimeUrl && databaseIdentity(new URL(runtimeUrl)) === databaseIdentity(new URL(integrationUrl))) {
    throw new DatabaseConfigurationError(
      INTEGRATION_DATABASE_URL_ENV_NAME +
        ' must point to a database separate from ' +
        DATABASE_URL_ENV_NAME +
        '.',
    );
  }

  return integrationUrl;
};

/**
 * Opens a reusable Bun SQL pool and probes it with SELECT 1.
 *
 * @param options Pool URL and connection options.
 * @returns A PostgreSQL client and idempotent close lifecycle function.
 * @throws {DatabaseConfigurationError} When Bun or the URL configuration is invalid.
 * @throws {DatabaseConnectionError} When the pool cannot complete the connectivity probe.
 */
export const createPostgresDatabase = async (
  options: PostgresPoolOptions = {},
): Promise<PostgresDatabase> => {
  assertSupportedBunVersion();
  const url = validatePostgresUrl(
    options.url ?? options.env?.[DATABASE_URL_ENV_NAME] ?? process.env[DATABASE_URL_ENV_NAME],
    DATABASE_URL_ENV_NAME,
  );

  const client = new SQL(url, {
    adapter: 'postgres',
    connectionTimeout: options.connectionTimeout ?? 5,
    max: options.max ?? 10,
  });

  try {
    await client`SELECT 1`;
  } catch (error) {
    await client.close({ timeout: 0 }).catch(() => undefined);
    throw new DatabaseConnectionError(
      'PostgreSQL connectivity probe failed for the configured database URL.',
      error,
    );
  }

  let closed = false;
  return {
    sql: client,
    close: async (): Promise<void> => {
      if (closed) {
        return;
      }

      closed = true;
      await client.close();
    },
  };
};
