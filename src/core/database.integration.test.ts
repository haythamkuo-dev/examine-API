import type { SQL } from 'bun';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { DEPOSIT_CHANNELS, getCliEnv } from './env';
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
import { createDepositService } from '../deposit/service';
import {
  createSeedDepositPresets,
  toDepositDefaultsResponse,
  toDepositPersistentProjection,
  type DepositPresetStore,
} from '../deposit/presets';
import type { DepositFormValues } from '../domains/deposit';
import { resetAndMigrateIntegrationDatabase } from './integrationDatabase';
import {
  createPostgresPresetRepository,
  createPostgresPresetStorage,
  PresetStorageConflictError,
  PresetStorageDataError,
} from './postgresPresetStorage';

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

  test('reads and saves a persistent projection with row timestamps', async () => {
    expect.hasAssertions();
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }

    const repository = createPostgresPresetRepository({
      client: database.sql,
      feature: 'deposit',
      channels: ['primary'] as const,
    });
    const initial = await repository.load();

    expect(initial.projection).toEqual({
      commonValues: {},
      channels: {
        primary: {
          channelCommonValues: {},
          channelValues: {},
        },
      },
    });
    expect(initial.timestamps.feature).toBeNull();
    expect(initial.timestamps.channels.primary).toBeNull();

    const saved = await repository.save({
      channel: 'primary',
      projection: {
        commonValues: {
          returnUrl: 'https://merchant.example/return',
        },
        channels: {
          primary: {
            channelCommonValues: {
              productNo: 'DEP-PRIMARY-USD',
            },
            channelValues: {
              payment_order: {
                merchant_ref: 'fixed-provider-template',
              },
            },
          },
        },
      },
      expected: {
        channel: 'primary',
        featureUpdatedAt: null,
        channelUpdatedAt: null,
      },
    });

    expect(saved.projection.commonValues).toEqual({
      returnUrl: 'https://merchant.example/return',
    });
    expect(saved.projection.channels.primary.channelCommonValues).toEqual({
      productNo: 'DEP-PRIMARY-USD',
    });
    expect(saved.timestamps.feature).not.toBeNull();
    expect(saved.timestamps.channels.primary).not.toBeNull();
  });

  test('returns the committed save snapshot without a post-commit reload', async () => {
    expect.hasAssertions();
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }
    const initializedDatabase = database;

    let beginCalls = 0;
    const unavailableAfterCommitClient = {
      begin: <T>(
        callback: SQL.TransactionContextCallback<T>,
      ): Promise<SQL.ContextCallbackResult<T>> => {
        beginCalls += 1;
        if (beginCalls > 1) {
          return Promise.reject(new Error('Simulated post-commit database outage.'));
        }

        return initializedDatabase.sql.begin(callback);
      },
    } as unknown as SQL;
    const repository = createPostgresPresetRepository({
      client: unavailableAfterCommitClient,
      feature: 'deposit',
      channels: ['primary'] as const,
    });

    const saved = await repository.save({
      channel: 'primary',
      projection: {
        commonValues: {
          returnUrl: 'https://merchant.example/return',
        },
        channels: {
          primary: {
            channelCommonValues: {
              productNo: 'DEP-PRIMARY-USD',
            },
            channelValues: {
              payment_order: {
                merchant_ref: 'fixed-provider-template',
              },
            },
          },
        },
      },
      expected: {
        channel: 'primary',
        featureUpdatedAt: null,
        channelUpdatedAt: null,
      },
    });

    expect(beginCalls).toBe(1);
    expect(saved.projection).toEqual({
      commonValues: {
        returnUrl: 'https://merchant.example/return',
      },
      channels: {
        primary: {
          channelCommonValues: {
            productNo: 'DEP-PRIMARY-USD',
          },
          channelValues: {
            payment_order: {
              merchant_ref: 'fixed-provider-template',
            },
          },
        },
      },
    });

    const persisted = await createPostgresPresetRepository({
      client: database.sql,
      feature: 'deposit',
      channels: ['primary'] as const,
    }).load();
    expect(persisted.projection).toEqual(saved.projection);
  });

  test('loads a consistent snapshot when a concurrent writer commits between row reads', async () => {
    expect.hasAssertions();
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }
    const initializedDatabase = database;

    await database.sql.unsafe(
      'insert into preset_store.preset_sets (feature, common_values) values ($1, $2::jsonb)',
      ['deposit', { returnUrl: 'https://merchant.example/before' }],
    );
    await database.sql.unsafe(
      'insert into preset_store.preset_channels (feature, channel, channel_common_values, channel_values) values ($1, $2, $3::jsonb, $4::jsonb)',
      ['deposit', 'primary', {}, { productNo: 'BEFORE' }],
    );

    let writerCommitted = false;
    const controlledClient = {
      begin: <T>(
        callback: SQL.TransactionContextCallback<T>,
      ): Promise<SQL.ContextCallbackResult<T>> =>
        initializedDatabase.sql.begin(async (transaction) => {
          const controlledTransaction = new Proxy(transaction, {
            get(target, property, receiver) {
              if (property !== 'unsafe') {
                return Reflect.get(target, property, receiver);
              }

              return async (query: string, values?: unknown[]) => {
                const rows = await target.unsafe(query, values);
                if (!writerCommitted && query.includes('from preset_store.preset_sets')) {
                  writerCommitted = true;
                  await initializedDatabase.sql.begin(async (writer) => {
                    await writer.unsafe(
                      'update preset_store.preset_sets set common_values = $1::jsonb where feature = $2',
                      [{ returnUrl: 'https://merchant.example/after' }, 'deposit'],
                    );
                    await writer.unsafe(
                      'update preset_store.preset_channels set channel_values = $1::jsonb where feature = $2 and channel = $3',
                      [{ productNo: 'AFTER' }, 'deposit', 'primary'],
                    );
                  });
                }
                return rows;
              };
            },
          });

          return callback(controlledTransaction);
        }),
    } as unknown as SQL;

    const repository = createPostgresPresetRepository({
      client: controlledClient,
      feature: 'deposit',
      channels: ['primary'] as const,
    });
    const snapshot = await repository.load();

    expect(writerCommitted).toBe(true);
    expect(snapshot.projection).toEqual({
      commonValues: {
        returnUrl: 'https://merchant.example/before',
      },
      channels: {
        primary: {
          channelCommonValues: {},
          channelValues: {
            productNo: 'BEFORE',
          },
        },
      },
    });

    const latest = await createPostgresPresetRepository({
      client: database.sql,
      feature: 'deposit',
      channels: ['primary'] as const,
    }).load();
    expect(latest.projection).toEqual({
      commonValues: {
        returnUrl: 'https://merchant.example/after',
      },
      channels: {
        primary: {
          channelCommonValues: {},
          channelValues: {
            productNo: 'AFTER',
          },
        },
      },
    });
  });

  test('rejects a stale save and keeps the latest projection intact', async () => {
    expect.hasAssertions();
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }

    const repository = createPostgresPresetRepository({
      client: database.sql,
      feature: 'deposit',
      channels: ['primary'] as const,
    });
    const first = await repository.save({
      channel: 'primary',
      projection: {
        commonValues: { returnUrl: 'https://merchant.example/first' },
        channels: {
          primary: {
            channelCommonValues: {},
            channelValues: { productNo: 'FIRST' },
          },
        },
      },
      expected: {
        channel: 'primary',
        featureUpdatedAt: null,
        channelUpdatedAt: null,
      },
    });
    const staleSnapshot = await repository.load();

    const latest = await repository.save({
      channel: 'primary',
      projection: {
        commonValues: { returnUrl: 'https://merchant.example/latest' },
        channels: {
          primary: {
            channelCommonValues: {},
            channelValues: { productNo: 'LATEST' },
          },
        },
      },
      expected: {
        channel: 'primary',
        featureUpdatedAt: first.timestamps.feature?.updatedAt || null,
        channelUpdatedAt: first.timestamps.channels.primary?.updatedAt || null,
      },
    });

    await expect(
      repository.save({
        channel: 'primary',
        projection: {
          commonValues: { returnUrl: 'https://merchant.example/stale' },
          channels: {
            primary: {
              channelCommonValues: {},
              channelValues: { productNo: 'STALE' },
            },
          },
        },
        expected: {
          channel: 'primary',
          featureUpdatedAt: staleSnapshot.timestamps.feature?.updatedAt || null,
          channelUpdatedAt: staleSnapshot.timestamps.channels.primary?.updatedAt || null,
        },
      }),
    ).rejects.toBeInstanceOf(PresetStorageConflictError);

    const afterConflict = await repository.load();
    expect(afterConflict.projection).toEqual(latest.projection);
    expect(afterConflict.timestamps.feature?.createdAt).toBe(
      latest.timestamps.feature?.createdAt,
    );
  });

  test('rolls back the feature row when the channel write conflicts', async () => {
    expect.hasAssertions();
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }

    const repository = createPostgresPresetRepository({
      client: database.sql,
      feature: 'deposit',
      channels: ['primary'] as const,
    });
    const current = await repository.save({
      channel: 'primary',
      projection: {
        commonValues: { returnUrl: 'https://merchant.example/original' },
        channels: {
          primary: {
            channelCommonValues: {},
            channelValues: { productNo: 'ORIGINAL' },
          },
        },
      },
      expected: {
        channel: 'primary',
        featureUpdatedAt: null,
        channelUpdatedAt: null,
      },
    });

    await expect(
      repository.save({
        channel: 'primary',
        projection: {
          commonValues: { returnUrl: 'https://merchant.example/should-rollback' },
          channels: {
            primary: {
              channelCommonValues: {},
              channelValues: { productNo: 'SHOULD-ROLLBACK' },
            },
          },
        },
        expected: {
          channel: 'primary',
          featureUpdatedAt: current.timestamps.feature?.updatedAt || null,
          channelUpdatedAt: null,
        },
      }),
    ).rejects.toBeInstanceOf(PresetStorageConflictError);

    const afterRollback = await repository.load();
    expect(afterRollback.projection).toEqual(current.projection);
    expect(afterRollback.timestamps.feature?.updatedAt).toBe(
      current.timestamps.feature?.updatedAt,
    );
  });

  test('keeps merchant references out of the PostgreSQL projection', async () => {
    expect.hasAssertions();
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }

    type TestChannel = 'primary';
    type TestValues = {
      merchantRef?: string;
      returnUrl: string;
      channelValue: string;
    };
    type TestPresets = {
      common: { values: { returnUrl: string; merchantRef?: string } };
      channels: { primary: { value: string } };
    };

    const storage = createPostgresPresetStorage<TestChannel, TestValues, TestPresets>({
      client: database.sql,
      feature: 'deposit',
      channels: ['primary'],
      loadSeed: async () => ({
        common: { values: { returnUrl: 'https://merchant.example/seed' } },
        channels: { primary: { value: 'seed' } },
      }),
      fromPersistentProjection: (projection, seed) => ({
        common: {
          values: {
            ...seed.common.values,
            ...(projection.commonValues as { returnUrl?: string }),
          },
        },
        channels: {
          primary: {
            value: String(
              projection.channels.primary.channelValues.value || seed.channels.primary.value,
            ),
          },
        },
      }),
      applyInput: (current, input) => ({
        common: {
          values: {
            ...current.common.values,
            returnUrl: input.values.returnUrl,
            merchantRef: input.values.merchantRef,
          },
        },
        channels: {
          primary: {
            value: input.values.channelValue,
          },
        },
      }),
      toPersistentProjection: (presets) => ({
        commonValues: {
          returnUrl: presets.common.values.returnUrl,
          merchantRef: presets.common.values.merchantRef,
        },
        channels: {
          primary: {
            channelCommonValues: {},
            channelValues: {
              merchantRef: 'top-level-transient',
              payment_order: { merchant_ref: 'fixed-template' },
              value: presets.channels.primary.value,
            },
          },
        },
      }),
    });

    const initial = await storage.load();
    const missingExpectedInput = {
      channel: 'primary' as const,
      values: {
        merchantRef: 'transient',
        returnUrl: 'https://merchant.example/return',
        channelValue: 'saved',
      },
    } as unknown as Parameters<typeof storage.save>[0];
    await expect(
      storage.save(missingExpectedInput),
    ).rejects.toBeInstanceOf(PresetStorageDataError);

    const saved = await storage.save({
      channel: 'primary',
      values: {
        merchantRef: 'transient',
        returnUrl: 'https://merchant.example/return',
        channelValue: 'saved',
      },
      expected: {
        channel: 'primary',
        featureUpdatedAt: initial.timestamps.feature?.updatedAt || null,
        channelUpdatedAt: initial.timestamps.channels.primary?.updatedAt || null,
      },
    });

    expect(saved.projection.commonValues).not.toHaveProperty('merchantRef');
    expect(saved.projection.channels.primary.channelValues).not.toHaveProperty(
      'merchantRef',
    );
    expect(saved.projection.channels.primary.channelValues).toHaveProperty(
      'payment_order.merchant_ref',
    );
  });

  test('passes the PostgreSQL snapshot timestamps through the deposit service save contract', async () => {
    expect.hasAssertions();
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }

    const env = getCliEnv(process.env);
    const makeId = (prefix: string): string => `${prefix}integration-test`;
    const storage = createPostgresPresetStorage<
      (typeof DEPOSIT_CHANNELS)[number],
      DepositFormValues,
      DepositPresetStore
    >({
      client: database.sql,
      feature: 'deposit',
      channels: DEPOSIT_CHANNELS,
      loadSeed: async () => createSeedDepositPresets(env, makeId),
      fromPersistentProjection: (projection, seed) => ({
        common: {
          ...seed.common,
          values: {
            ...seed.common.values,
            ...projection.commonValues,
          },
        },
        channels: Object.fromEntries(
          DEPOSIT_CHANNELS.map((channel) => [
            channel,
            {
              ...seed.channels[channel],
              commonValues: {
                ...seed.channels[channel].commonValues,
                ...projection.channels[channel].channelCommonValues,
              },
              values: {
                ...seed.channels[channel].values,
                ...projection.channels[channel].channelValues,
              },
            },
          ]),
        ) as DepositPresetStore['channels'],
      }),
      applyInput: (current, input) => {
        const currentChannel = current.channels[input.channel];

        return {
          ...current,
          common: {
            ...current.common,
            values: {
              ...current.common.values,
              returnUrl: input.values.commonValues.returnUrl,
            },
          },
          channels: {
            ...current.channels,
            [input.channel]: {
              ...currentChannel,
              commonValues: {
                ...currentChannel.commonValues,
                productNo: input.values.commonValues.productNo,
                amount: input.values.commonValues.amount,
                currencyCode: input.values.commonValues.currencyCode,
              },
              values: input.values.channelValues,
            },
          },
        };
      },
      toPersistentProjection: toDepositPersistentProjection,
    });

    const service = createDepositService({
      getEnvForTarget: () => env,
      storage,
      makeId,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    });
    const seed = createSeedDepositPresets(env, makeId);
    const initialForm = toDepositDefaultsResponse(
      'southafrica_cards',
      env,
      seed,
    ).form;
    const firstValues: DepositFormValues = {
      ...initialForm,
      commonValues: {
        ...initialForm.commonValues,
        returnUrl: 'https://merchant.example/first',
      },
    };
    const secondValues: DepositFormValues = {
      ...firstValues,
      commonValues: {
        ...firstValues.commonValues,
        returnUrl: 'https://merchant.example/second',
      },
    };

    await expect(
      service.saveDefaultsForTarget('southafrica_cards', firstValues, 'local'),
    ).resolves.toMatchObject({
      ok: true,
      form: { commonValues: { returnUrl: 'https://merchant.example/first' } },
    });
    await expect(
      service.saveDefaultsForTarget('southafrica_cards', secondValues, 'local'),
    ).resolves.toMatchObject({
      ok: true,
      form: { commonValues: { returnUrl: 'https://merchant.example/second' } },
    });

    const persisted = await createPostgresPresetRepository({
      client: database.sql,
      feature: 'deposit',
      channels: DEPOSIT_CHANNELS,
    }).load();
    expect(persisted.projection.commonValues).toEqual({
      returnUrl: 'https://merchant.example/second',
    });
  });

  test('does not run seed loading after a storage save commits', async () => {
    expect.hasAssertions();
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }

    type TestChannel = 'primary';
    type TestValues = {
      returnUrl: string;
      channelValue: string;
    };
    type TestPresets = {
      common: { values: { returnUrl: string } };
      channels: { primary: { value: string } };
    };

    let seedLoads = 0;
    const storage = createPostgresPresetStorage<TestChannel, TestValues, TestPresets>({
      client: database.sql,
      feature: 'deposit',
      channels: ['primary'],
      loadSeed: async () => {
        seedLoads += 1;
        if (seedLoads > 2) {
          throw new Error('Simulated post-commit seed loading failure.');
        }

        return {
          common: { values: { returnUrl: 'https://merchant.example/seed' } },
          channels: { primary: { value: 'seed' } },
        };
      },
      fromPersistentProjection: (projection, seed) => ({
        common: {
          values: {
            ...seed.common.values,
            ...(projection.commonValues as { returnUrl?: string }),
          },
        },
        channels: {
          primary: {
            value: String(
              projection.channels.primary.channelValues.value || seed.channels.primary.value,
            ),
          },
        },
      }),
      applyInput: (current, input) => ({
        common: {
          values: {
            ...current.common.values,
            returnUrl: input.values.returnUrl,
          },
        },
        channels: {
          primary: {
            value: input.values.channelValue,
          },
        },
      }),
      toPersistentProjection: (presets) => ({
        commonValues: {
          returnUrl: presets.common.values.returnUrl,
        },
        channels: {
          primary: {
            channelCommonValues: {},
            channelValues: { value: presets.channels.primary.value },
          },
        },
      }),
    });

    const initial = await storage.load();
    const saved = await storage.save({
      channel: 'primary',
      values: {
        returnUrl: 'https://merchant.example/return',
        channelValue: 'saved',
      },
      expected: {
        channel: 'primary',
        featureUpdatedAt: initial.timestamps.feature?.updatedAt || null,
        channelUpdatedAt: initial.timestamps.channels.primary?.updatedAt || null,
      },
    });

    expect(seedLoads).toBe(2);
    expect(saved.presets).toEqual({
      common: {
        values: { returnUrl: 'https://merchant.example/return' },
      },
      channels: {
        primary: { value: 'saved' },
      },
    });

    const persisted = await createPostgresPresetRepository({
      client: database.sql,
      feature: 'deposit',
      channels: ['primary'] as const,
    }).load();
    expect(persisted.projection).toEqual(saved.projection);
  });

  test('hydrates the storage result before repository commit', async () => {
    expect.hasAssertions();
    expect(database).not.toBeNull();
    if (!database) {
      throw new Error('Integration database was not initialized.');
    }
    const initializedDatabase = database;

    type TestChannel = 'primary';
    type TestValues = {
      returnUrl: string;
      channelValue: string;
    };
    type TestPresets = {
      common: { values: { returnUrl: string } };
      channels: { primary: { value: string } };
    };

    let transactionCalls = 0;
    let writeCommitted = false;
    const controlledClient = {
      begin: <T>(
        callback: SQL.TransactionContextCallback<T>,
      ): Promise<SQL.ContextCallbackResult<T>> => {
        transactionCalls += 1;
        return initializedDatabase.sql.begin(callback).then((result) => {
          if (transactionCalls === 2) {
            writeCommitted = true;
          }
          return result;
        });
      },
    } as unknown as SQL;
    const storage = createPostgresPresetStorage<TestChannel, TestValues, TestPresets>({
      client: controlledClient,
      feature: 'deposit',
      channels: ['primary'],
      loadSeed: async () => ({
        common: { values: { returnUrl: 'https://merchant.example/seed' } },
        channels: { primary: { value: 'seed' } },
      }),
      fromPersistentProjection: (projection, seed) => {
        if (writeCommitted) {
          throw new Error('Simulated post-commit hydration failure.');
        }

        return {
          common: {
            values: {
              ...seed.common.values,
              ...(projection.commonValues as { returnUrl?: string }),
            },
          },
          channels: {
            primary: {
              value: String(
                projection.channels.primary.channelValues.value || seed.channels.primary.value,
              ),
            },
          },
        };
      },
      applyInput: (current, input) => ({
        common: {
          values: {
            ...current.common.values,
            returnUrl: input.values.returnUrl,
          },
        },
        channels: {
          primary: {
            value: input.values.channelValue,
          },
        },
      }),
      toPersistentProjection: (presets) => ({
        commonValues: {
          returnUrl: presets.common.values.returnUrl,
        },
        channels: {
          primary: {
            channelCommonValues: {},
            channelValues: { value: presets.channels.primary.value },
          },
        },
      }),
    });

    await storage.load();
    transactionCalls = 0;
    writeCommitted = false;

    const saved = await storage.save({
      channel: 'primary',
      values: {
        returnUrl: 'https://merchant.example/return',
        channelValue: 'saved',
      },
      expected: {
        channel: 'primary',
        featureUpdatedAt: null,
        channelUpdatedAt: null,
      },
    });

    expect(writeCommitted).toBe(true);
    expect(saved.presets).toEqual({
      common: {
        values: { returnUrl: 'https://merchant.example/return' },
      },
      channels: {
        primary: { value: 'saved' },
      },
    });
  });

  test('closes the pool after repository use and rejects later repository queries', async () => {
    expect.hasAssertions();
    let lifecycleDatabase: PostgresDatabase | null = null;

    try {
      lifecycleDatabase = await createPostgresDatabase({
        url: requireIntegrationDatabaseUrl(),
        max: 1,
      });
      const repository = createPostgresPresetRepository({
        client: lifecycleDatabase.sql,
        feature: 'deposit',
        channels: ['primary'] as const,
      });

      const initial = await repository.load();
      expect(initial.projection).toEqual({
        commonValues: {},
        channels: {
          primary: {
            channelCommonValues: {},
            channelValues: {},
          },
        },
      });

      await lifecycleDatabase.close();
      await lifecycleDatabase.close();
      await expectDatabaseOperationToReject(repository.load());
    } finally {
      await lifecycleDatabase?.close();
    }
  });
});
