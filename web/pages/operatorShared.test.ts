/// <reference lib="dom" />

import '../../tests/web-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  buildOperatorHeaders,
  extractMerchantReferenceValue,
  fetchJson,
  getOperatorEnvironmentLabel,
} from './operatorShared';
import { targetEnvironmentHeaderName } from '../../src/core/targetEnvironment';

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
