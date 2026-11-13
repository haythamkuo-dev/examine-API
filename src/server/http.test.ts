import { describe, expect, test } from 'bun:test';
import { readJson } from './http';

const createJsonRequest = (body: unknown): Request =>
  new Request('http://example.test/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('readJson', () => {
  test('rejects a body that exceeds the configured byte limit', async () => {
    await expect(
      readJson(createJsonRequest({ value: 'too-large' }), { maxBytes: 8 }),
    ).rejects.toMatchObject({
      status: 413,
      code: 'REQUEST_BODY_TOO_LARGE',
    });
  });

  test('rejects a body that exceeds the configured nesting limit', async () => {
    let value: unknown = 'leaf';
    for (let depth = 0; depth < 4; depth += 1) {
      value = { child: value };
    }

    await expect(
      readJson(createJsonRequest(value), { maxDepth: 3 }),
    ).rejects.toMatchObject({
      status: 413,
      code: 'REQUEST_BODY_TOO_COMPLEX',
    });
  });

  test('rejects a body that exceeds the configured node limit', async () => {
    await expect(
      readJson(createJsonRequest({ first: 'value', second: 'value' }), { maxNodes: 2 }),
    ).rejects.toMatchObject({
      status: 413,
      code: 'REQUEST_BODY_TOO_COMPLEX',
    });
  });
});
