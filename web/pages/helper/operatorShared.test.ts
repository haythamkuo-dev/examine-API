/// <reference lib="dom" />

import '../../../tests/web-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  ApiRequestError,
  buildOperatorHeaders,
  buildFailureResult,
  extractMerchantReferenceValue,
  fetchJson,
  getOperatorEnvironmentLabel,
} from './operatorShared';
import { targetEnvironmentHeaderName } from '../../../src/core/targetEnvironment';

describe('operatorShared', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  test('buildOperatorHeaders includes content type and target environment', () => {
    const headers = buildOperatorHeaders('product');

    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get(targetEnvironmentHeaderName)).toBe('product');
  });

  test('fetchJson forwards the target-environment header', async () => {
    globalThis.fetch = mock(async (_input, init) => {
      const headers = new Headers(init?.headers);

      expect(headers.get(targetEnvironmentHeaderName)).toBe('product');

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    await expect(
      fetchJson<{ ok: boolean }>('/api/test', {
        headers: buildOperatorHeaders('product'),
      }),
    ).resolves.toEqual({ ok: true });
  });

  test('fetchJson preserves target environment when headers are passed as a plain object', async () => {
    globalThis.fetch = mock(async (_input, init) => {
      const headers = new Headers(init?.headers);

      expect(headers.get(targetEnvironmentHeaderName)).toBe('product');
      expect(headers.get('X-Custom-Header')).toBe('present');

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    await expect(
      fetchJson<{ ok: boolean }>('/api/test', {
        headers: {
          ...Object.fromEntries(buildOperatorHeaders('product').entries()),
          'X-Custom-Header': 'present',
        },
      }),
    ).resolves.toEqual({ ok: true });
  });

  test('fetchJson keeps raw compatibility data without embedding JSON in its message', async () => {
    const rawBody = JSON.stringify({
      response: {
        status: 400,
        code: 'binding_missing',
        message: 'product_no is required',
      },
    });
    globalThis.fetch = mock(async () =>
      new Response(rawBody, {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    try {
      await fetchJson('/api/test');
      throw new Error('Expected fetchJson to reject');
    } catch (caught) {
      expect(caught).toBeInstanceOf(ApiRequestError);
      const error = caught as ApiRequestError;
      expect(error.message).toBe('API 400 from /api/test: product_no is required');
      expect(error.message).not.toContain(rawBody);
      expect(error.rawBody).toBe(rawBody);
    }
  });

  test('buildFailureResult exposes one normalized response without details', () => {
    const error = new ApiRequestError({
      message: 'transport summary',
      status: 400,
      url: '/api/test',
      rawBody: JSON.stringify({ ok: false, message: 'product_no is required' }),
      contentType: 'application/json',
    });

    expect(buildFailureResult('preview', error)).toEqual({
      ok: false,
      action: 'preview',
      status: 400,
      message: 'product_no is required',
      raw: {
        response: {
          status: 400,
          code: 'UNKNOWN_ERROR',
          message: 'product_no is required',
        },
      },
    });
  });

  test('returns the localized label for the product environment', () => {
    expect(getOperatorEnvironmentLabel('product')).toBe('產品');
  });

  test('extracts merchant_ref from a preview payload object', () => {
    expect(
      extractMerchantReferenceValue(
        { merchant_ref: 'TEST_ORDER_123' },
        'merchant_ref',
      ),
    ).toBe('TEST_ORDER_123');
  });

  test('extracts merchant_reference from a preview payload object', () => {
    expect(
      extractMerchantReferenceValue(
        { merchant_reference: 'TEST_ORDER_456' },
        'merchant_reference',
      ),
    ).toBe('TEST_ORDER_456');
  });

  test('returns null for missing or invalid merchant reference payloads', () => {
    expect(extractMerchantReferenceValue(null, 'merchant_ref')).toBeNull();
    expect(extractMerchantReferenceValue([], 'merchant_reference')).toBeNull();
    expect(extractMerchantReferenceValue({ merchant_ref: '   ' }, 'merchant_ref')).toBeNull();
  });
});
