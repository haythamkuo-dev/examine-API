import { describe, expect, test } from 'bun:test';
import { DEFAULT_MIGRATIONS_DIRECTORY, listMigrations } from './databaseMigrations';

describe('canonical database migrations', () => {
  test('discovers versioned migrations in ascending order', async () => {
    const migrations = await listMigrations(DEFAULT_MIGRATIONS_DIRECTORY);
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations).toEqual(
      [...migrations].sort((left, right) => left.version.localeCompare(right.version)),
    );
    expect(migrations.every((migration) => migration.filePath.endsWith('.sql'))).toBe(true);
  });
});
