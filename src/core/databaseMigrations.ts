import { readdir } from 'fs/promises';
import { join, resolve } from 'path';
import type { SQL } from 'bun';

export const DEFAULT_MIGRATIONS_DIRECTORY = resolve(process.cwd(), 'supabase/migrations');
export const MIGRATION_HISTORY_TABLE_NAME = 'preset_store.schema_migrations';

/**
 * Describes an invalid or inconsistent migration set.
 */
export class MigrationError extends Error {
  /**
   * Creates a migration error.
   *
   * @param message Safe diagnostic message describing the migration mismatch.
   */
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Identifies a canonical SQL migration file.
 */
export type MigrationFile = {
  version: string;
  fileName: string;
  filePath: string;
};

/**
 * Summarizes a migration runner execution.
 */
export type MigrationRunResult = {
  applied: string[];
  skipped: string[];
  history: string[];
};

const migrationFilePattern = /^(\d{14})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/i;
const migrationLockKey = 'examine_api:preset_store:migrations';
const migrationHistorySelectQuery =
  'select version from ' + MIGRATION_HISTORY_TABLE_NAME + ' order by version';
const migrationHistoryInsertQuery =
  'insert into ' +
  MIGRATION_HISTORY_TABLE_NAME +
  ' (version) values ($1) on conflict (version) do nothing';
const ensureMigrationHistorySchemaQuery = 'create schema if not exists preset_store';
const ensureMigrationHistoryTableQuery =
  'create table if not exists ' +
  MIGRATION_HISTORY_TABLE_NAME +
  ' (version text primary key, applied_at timestamptz not null default clock_timestamp())';

type MigrationHistoryRow = {
  version: string;
};

const isUndefinedTableError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as { code?: unknown; errno?: unknown };
  return databaseError.code === '42P01' || databaseError.errno === '42P01';
};

const readMigrationHistory = async (client: SQL): Promise<Set<string>> => {
  try {
    const rows = await client.unsafe<MigrationHistoryRow[]>(migrationHistorySelectQuery);
    return new Set(rows.map((row) => row.version));
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return new Set();
    }

    throw error;
  }
};

const ensureMigrationHistoryTable = async (client: SQL): Promise<void> => {
  await client.unsafe(ensureMigrationHistorySchemaQuery);
  await client.unsafe(ensureMigrationHistoryTableQuery);
};

/**
 * Finds and validates canonical SQL migration files.
 *
 * @param directoryPath Directory containing versioned SQL files.
 * @returns Migrations sorted by their numeric version.
 * @throws {MigrationError} When a SQL file has an invalid name or duplicate version.
 */
export const listMigrations = async (
  directoryPath: string = DEFAULT_MIGRATIONS_DIRECTORY,
): Promise<MigrationFile[]> => {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const migrations: MigrationFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.sql')) {
      continue;
    }

    const match = migrationFilePattern.exec(entry.name);
    if (!match) {
      throw new MigrationError(
        'Migration file name must use YYYYMMDDHHMMSS_description.sql: ' + entry.name,
      );
    }

    migrations.push({
      version: match[1],
      fileName: entry.name,
      filePath: join(directoryPath, entry.name),
    });
  }

  migrations.sort((left, right) => left.version.localeCompare(right.version));
  const versions = new Set<string>();
  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      throw new MigrationError('Duplicate migration version: ' + migration.version);
    }
    versions.add(migration.version);
  }

  return migrations;
};

/**
 * Applies canonical SQL migrations using the database-owned migration history.
 *
 * Each migration is applied in its own Bun SQL transaction. The advisory lock
 * serializes concurrent runners, while a failed migration rolls back all of
 * its schema changes.
 *
 * @param client Reusable Bun PostgreSQL client.
 * @param options Optional migration directory override.
 * @returns Applied, skipped, and final migration history versions.
 * @throws {MigrationError} When migration files and database history disagree.
 */
export const runMigrations = async (
  client: SQL,
  options: { directoryPath?: string } = {},
): Promise<MigrationRunResult> => {
  const migrations = await listMigrations(options.directoryPath);
  await ensureMigrationHistoryTable(client);
  const knownVersions = new Set(migrations.map((migration) => migration.version));
  const appliedVersions = await readMigrationHistory(client);
  const unknownVersions = [...appliedVersions].filter((version) => !knownVersions.has(version));

  if (unknownVersions.length > 0) {
    throw new MigrationError(
      'Database migration history contains versions missing from the repository: ' +
        unknownVersions.join(', '),
    );
  }

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      skipped.push(migration.version);
      continue;
    }

    let appliedByThisRunner = false;
    await client.begin(async (transaction) => {
      await transaction.unsafe(
        'select pg_advisory_xact_lock(hashtext($1))',
        [migrationLockKey],
      );
      const currentHistory = await readMigrationHistory(transaction);

      if (currentHistory.has(migration.version)) {
        return;
      }

      await transaction.file(migration.filePath);
      await transaction.unsafe(migrationHistoryInsertQuery, [migration.version]);
      appliedByThisRunner = true;
    });

    appliedVersions.add(migration.version);
    if (appliedByThisRunner) {
      applied.push(migration.version);
    } else {
      skipped.push(migration.version);
    }
  }

  const finalHistory = await readMigrationHistory(client);
  const missingVersions = migrations
    .map((migration) => migration.version)
    .filter((version) => !finalHistory.has(version));

  if (missingVersions.length > 0) {
    throw new MigrationError(
      'Migration transaction completed without recording versions: ' + missingVersions.join(', '),
    );
  }

  return {
    applied,
    skipped,
    history: [...finalHistory].sort(),
  };
};
