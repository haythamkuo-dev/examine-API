import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { DEPOSIT_CHANNELS } from './env';
import {
  createPostgresDatabase,
  requireIntegrationDatabaseUrl,
  type PostgresDatabase,
} from './database';
import {
  listMigrations,
  runMigrations,
  type MigrationRunResult,
} from './databaseMigrations';
import { resetAndMigrateIntegrationDatabase } from './integrationDatabase';

const describeIntegration = process.env.INTEGRATION_DATABASE_URL ? describe : describe.skip;

type TimestampRow = {
  created_at: Date | string;
  updated_at: Date | string;
};

const timestampToMillis = (value: Date | string): number =>
  value instanceof Date ? value.getTime() : Date.parse(value);

const expectDatabaseOperationToReject = async (operation: Promise<unknown>): Promise<void> => {
  let rejected = false;
  try {
    await operation;
  } catch {
    rejected = true;
  }

  expect(rejected).toBe(true);
};

describeIntegration('PostgreSQL migration lifecycle', () => {
  let database: PostgresDatabase | null = null;
  let initialMigration: MigrationRunResult | null = null;

  beforeAll(async () => {
    database = await createPostgresDatabase({
      url: requireIntegrationDatabaseUrl(),
    });
    initialMigration = await resetAndMigrateIntegrationDatabase(database);
  });

  beforeEach(async () => {
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }

    await database.sql.unsafe(
      'truncate table preset_store.preset_channels, preset_store.preset_sets',
    );
  });

  afterAll(async () => {
    await database?.close();
    database = null;
  });

  test('records fresh migration history and makes repeated application a no-op', async () => {
    expect(database).not.toBeNull();
    expect(initialMigration).not.toBeNull();
    if (!database || !initialMigration) {
      throw new Error('Integration database was not initialized.');
    }

    const migrations = await listMigrations();
    const repeated = await runMigrations(database.sql);
    const historyRows = await database.sql.unsafe<{ version: string }[]>(
      'select version from preset_store.schema_migrations order by version',
    );

    expect(initialMigration.applied).toEqual(migrations.map((migration) => migration.version));
    expect(repeated.applied).toEqual([]);
    expect(repeated.skipped).toEqual(migrations.map((migration) => migration.version));
    expect(historyRows.map((row) => row.version)).toEqual(initialMigration.history);
  });

  test('enforces feature, foreign-key, and top-level JSON object constraints', async () => {
    expect.hasAssertions();
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }

    const representativeChannel = DEPOSIT_CHANNELS[0];
    await database.sql.unsafe(
      'insert into preset_store.preset_sets (feature, common_values) values ($1, $2::jsonb)',
      ['deposit', {}],
    );
    await database.sql.unsafe(
      'insert into preset_store.preset_channels (feature, channel, channel_common_values, channel_values) values ($1, $2, $3::jsonb, $4::jsonb)',
      ['deposit', representativeChannel, {}, {}],
    );

    await expectDatabaseOperationToReject(
      database.sql.unsafe(
        'insert into preset_store.preset_sets (feature, common_values) values ($1, $2::jsonb)',
        ['unknown-feature', {}],
      ),
    );
    await expectDatabaseOperationToReject(
      database.sql.unsafe(
        'insert into preset_store.preset_sets (feature, common_values) values ($1, $2::jsonb)',
        ['payout', []],
      ),
    );
    await expectDatabaseOperationToReject(
      database.sql.unsafe(
        'insert into preset_store.preset_channels (feature, channel, channel_common_values, channel_values) values ($1, $2, $3::jsonb, $4::jsonb)',
        ['subscription', 'orphan', {}, {}],
      ),
    );
  });

  test('keeps created_at immutable and refreshes updated_at on database updates', async () => {
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }

    const insertedRows = await database.sql.unsafe<TimestampRow[]>(
      'insert into preset_store.preset_sets (feature, common_values) values ($1, $2::jsonb) returning created_at, updated_at',
      ['deposit', {}],
    );
    const inserted = insertedRows[0];
    if (!inserted) {
      throw new Error('Timestamp insert did not return a row.');
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const updatedRows = await database.sql.unsafe<TimestampRow[]>(
      'update preset_store.preset_sets set common_values = $1::jsonb, created_at = $2::timestamptz where feature = $3 returning created_at, updated_at',
      [{ returnUrl: 'https://example.invalid' }, '2000-01-01T00:00:00.000Z', 'deposit'],
    );
    const updated = updatedRows[0];
    if (!updated) {
      throw new Error('Timestamp update did not return a row.');
    }

    expect(timestampToMillis(updated.created_at)).toBe(timestampToMillis(inserted.created_at));
    expect(timestampToMillis(updated.updated_at)).toBeGreaterThan(
      timestampToMillis(inserted.updated_at),
    );
  });
});
