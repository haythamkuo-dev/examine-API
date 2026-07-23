import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  startApiTestServer,
  type ApiTestServerContext,
} from '../../tests/server-setup';
import {
  unknownErrorCode,
  unknownErrorMessage,
  type StandardErrorResponse,
} from './errors';

describe('API server exception boundary', () => {
  let context: ApiTestServerContext;
  const errorLog = mock((_message: unknown, _error?: unknown): void => undefined);
  const logger = {
    info: mock((..._args: unknown[]): void => undefined),
    warn: mock((..._args: unknown[]): void => undefined),
    error: errorLog,
  };

  beforeAll(async () => {
    context = await startApiTestServer({ logger });
  });

  beforeEach(async () => {
    errorLog.mockClear();
    await context.resetDepositFixtures();
    await context.resetPayoutFixtures();
    await context.resetSubscriptionFixtures();
  });

  afterAll(async () => {
    await context.stop();
    mock.restore();
  });

  test('returns route-level 404 envelopes without invoking the exception logger', async () => {
    const response = await context.requestApi('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect((await response.json()) as StandardErrorResponse).toEqual({
      response: {
        status: 404,
        code: unknownErrorCode,
        message: 'Not found',
      },
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  test('logs escaped exceptions and exposes only the generic 500 envelope', async () => {
    expect.hasAssertions();

    const response = await context.requestApi('/api/deposit/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalidJson"',
    });

    expect(response.status).toBe(500);
    expect((await response.json()) as StandardErrorResponse).toEqual({
      response: {
        status: 500,
        code: unknownErrorCode,
        message: unknownErrorMessage,
      },
    });
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0]?.[1])).toContain('SyntaxError');
  });
});
