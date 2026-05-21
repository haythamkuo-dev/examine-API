import { describe, expect, test } from 'bun:test';
import { keepAlive } from './utils';

describe('keepAlive', () => {
  test('pings during Taipei working hours', async () => {
    let scheduled: (() => Promise<void>) | undefined;
    const fetchCalls: string[] = [];

    const stop = keepAlive({
      fetchFn: async (input) => {
        fetchCalls.push(String(input));
        return new Response(null, { status: 200 });
      },
      setIntervalFn: ((callback: TimerHandler) => {
        scheduled = callback as () => Promise<void>;
        return 1 as unknown as Timer;
      }) as typeof setInterval,
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
      setIntervalFn: ((callback: TimerHandler) => {
        scheduled = callback as () => Promise<void>;
        return 1 as unknown as Timer;
      }) as typeof setInterval,
      clearIntervalFn: () => undefined,
      now: () => new Date('2026-05-21T15:30:00.000Z'),
      logger: { log: () => undefined, error: () => undefined },
    });

    await scheduled?.();
    stop();

    expect(fetchCallCount).toBe(0);
  });

  test('stop clears the scheduled interval', () => {
    let timerId: Timer | undefined;
    let clearedTimerId: Timer | undefined;

    const stop = keepAlive({
      fetchFn: async () => new Response(null, { status: 200 }),
      setIntervalFn: ((_: TimerHandler) => {
        timerId = 42 as unknown as Timer;
        return timerId;
      }) as typeof setInterval,
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
