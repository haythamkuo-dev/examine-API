import { describe, expect, test } from 'bun:test';
import { createUniqueReference, keepAlive, maskRequestHeaders } from './utils';

type IntervalId = ReturnType<typeof setInterval>;
type IntervalCallback = Parameters<typeof setInterval>[0];
type TestSetIntervalFn = (handler: IntervalCallback, timeout?: number) => IntervalId;

describe('keepAlive', () => {
  test('pings during Taipei working hours', async () => {
    let scheduled: (() => Promise<void>) | undefined;
    const fetchCalls: string[] = [];

    const stop = keepAlive({
      fetchFn: async (input) => {
        fetchCalls.push(String(input));
        return new Response(null, { status: 200 });
      },
      setIntervalFn: ((callback: IntervalCallback) => {
        scheduled = callback as () => Promise<void>;
        return 1 as unknown as IntervalId;
      }) as TestSetIntervalFn,
      clearIntervalFn: () => undefined,
      now: () => new Date('2026-05-21T01:30:00.000Z'),
      logger: { log: () => undefined, error: () => undefined },
    });

    await scheduled?.();
    stop();

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]).toBe('https://examine-api.onrender.com');
  });

  test('does not ping outside Taipei working hours', async () => {
    let scheduled: (() => Promise<void>) | undefined;
    let fetchCallCount = 0;

    const stop = keepAlive({
      fetchFn: async () => {
        fetchCallCount += 1;
        return new Response(null, { status: 200 });
      },
      setIntervalFn: ((callback: IntervalCallback) => {
        scheduled = callback as () => Promise<void>;
        return 1 as unknown as IntervalId;
      }) as TestSetIntervalFn,
      clearIntervalFn: () => undefined,
      now: () => new Date('2026-05-21T15:30:00.000Z'),
      logger: { log: () => undefined, error: () => undefined },
    });

    await scheduled?.();
    stop();

    expect(fetchCallCount).toBe(0);
  });

  test('stop clears the scheduled interval', () => {
    let timerId: IntervalId | undefined;
    let clearedTimerId: IntervalId | undefined;

    const stop = keepAlive({
      fetchFn: async () => new Response(null, { status: 200 }),
      setIntervalFn: ((_: IntervalCallback) => {
        timerId = 42 as unknown as IntervalId;
        return timerId;
      }) as TestSetIntervalFn,
      clearIntervalFn: (id) => {
        clearedTimerId = id;
      },
      now: () => new Date('2026-05-21T01:30:00.000Z'),
      logger: { log: () => undefined, error: () => undefined },
    });

    stop();

    expect(clearedTimerId).toBe(timerId);
  });
});

describe('maskRequestHeaders', () => {
  test('returns undefined when headers are missing', () => {
    expect(maskRequestHeaders()).toBeUndefined();
  });

  test('masks authorization headers and preserves unrelated headers', () => {
    expect(
      maskRequestHeaders({
        Authorization: 'Bearer abcdef123456',
        'X-Trace-Id': 'trace-1',
      }),
    ).toEqual({
      Authorization: 'Bearer ****123456',
      'X-Trace-Id': 'trace-1',
    });
  });

  test('masks lowercase authorization header keys too', () => {
    expect(
      maskRequestHeaders({
        authorization: 'ApiKey secret-token',
      }),
    ).toEqual({
      authorization: 'ApiKey ****-token',
    });
  });
});

describe('createUniqueReference', () => {
  test('preserves a provided merchant reference after trimming whitespace', () => {
    expect(
      createUniqueReference('  TEST-REF-001  ', () => 'generated-value', 'TEST_ORDER_'),
    ).toBe('TEST-REF-001');
  });

  test('generates a fallback merchant reference when the incoming value is blank', () => {
    expect(
      createUniqueReference('   ', (prefix) => `${prefix}fixed-id`, 'TEST_ORDER_'),
    ).toBe('TEST_ORDER_fixed-id');
  });
});
