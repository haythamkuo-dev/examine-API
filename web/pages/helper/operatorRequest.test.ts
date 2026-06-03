/// <reference lib="dom" />

import '../../../tests/web-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  buildChannelQuery,
  fetchOperatorJson,
  postOperatorJson,
  putOperatorJson,
  sendOperatorRequest,
} from './operatorRequest';

afterEach(() => {
  mock.restore();
});

describe('operatorRequest', () => {
  test('buildChannelQuery encodes channel names', () => {
    expect(buildChannelQuery()).toBe('');
    expect(buildChannelQuery('co bank')).toBe('?channel=co%20bank');
  });

  test('fetchOperatorJson forwards operator headers and parses JSON', async () => {
    const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input).toBe('/api/deposit/defaults?channel=alpha');
      expect(init?.headers instanceof Headers).toBe(true);
      expect((init?.headers as Headers).get('Content-Type')).toBe('application/json');
      expect((init?.headers as Headers).get('X-Target-Environment')).toBe('local');

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchOperatorJson<{ ok: boolean }>('/api/deposit/defaults?channel=alpha', 'local')).resolves.toEqual({
      ok: true,
    });
  });

  test('postOperatorJson sends a JSON body', async () => {
    const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input).toBe('/api/deposit/preview');
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(JSON.stringify({ channel: 'alpha' }));

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(postOperatorJson<{ ok: boolean }>('/api/deposit/preview', 'local', { channel: 'alpha' })).resolves.toEqual({
      ok: true,
    });
  });

  test('putOperatorJson sends a JSON body with PUT', async () => {
    const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input).toBe('/api/deposit/defaults?channel=alpha');
      expect(init?.method).toBe('PUT');
      expect(init?.body).toBe(JSON.stringify({ channel: 'alpha' }));

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(putOperatorJson<{ ok: boolean }>('/api/deposit/defaults?channel=alpha', 'local', { channel: 'alpha' })).resolves.toEqual({
      ok: true,
    });
  });

  test('sendOperatorRequest returns the raw fetch response', async () => {
    const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input).toBe('/api/payout/create');
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(JSON.stringify({ channel: 'alpha' }));

      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await sendOperatorRequest('/api/payout/create', 'local', { channel: 'alpha' });
    expect(response.status).toBe(201);
  });
});
