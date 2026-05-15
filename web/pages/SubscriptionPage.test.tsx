import { describe, expect, test } from 'bun:test';
import { normalizeCreateResult } from './SubscriptionPage';

describe('normalizeCreateResult', () => {
  test('keeps JSON object response as structured success output', async () => {
    const response = new Response(
      JSON.stringify({
        requestName: 'subscription:create:default',
        ok: true,
        status: 200,
        request: { method: 'POST', url: 'https://example.test', payload: { value: 1 } },
        response: { ok: true },
        durationMs: 10,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

    const result = await normalizeCreateResult(response);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.message).toBe('Request sent successfully.');
    expect((result.raw as { data: { requestName: string } }).data.requestName).toBe('subscription:create:default');
  });

  test('builds fallback error result for non-JSON failure response', async () => {
    const response = new Response('gateway failed', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/plain' },
    });

    const result = await normalizeCreateResult(response);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.message).toBe('gateway failed');
    expect((result.raw as { body: string }).body).toBe('gateway failed');
  });
});
