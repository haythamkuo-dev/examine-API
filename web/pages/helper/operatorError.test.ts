/// <reference lib="dom" />

import '../../../tests/web-setup';
import { describe, expect, test } from 'bun:test';
import {
  normalizeOperatorError,
  parseOperatorError,
  unknownOperatorErrorMessage,
} from './operatorError';

describe('operator error compatibility parser', () => {
  test('prefers the standard backend envelope without truncating its message', () => {
    const message = `Complete upstream context ${'x'.repeat(240)}`;

    expect(
      normalizeOperatorError(
        {
          response: {
            status: 422,
            code: 'binding_missing',
            message,
          },
        },
        500,
      ),
    ).toEqual({
      response: {
        status: 422,
        code: 'binding_missing',
        message,
      },
    });
  });

  test('converts legacy top-level JSON into the standard envelope', () => {
    expect(
      normalizeOperatorError(
        { ok: false, message: 'product_no is required' },
        400,
      ),
    ).toEqual({
      response: {
        status: 400,
        code: 'UNKNOWN_ERROR',
        message: 'product_no is required',
      },
    });
  });

  test('limits plain text to the first non-empty 200-character line', () => {
    const firstLine = 'x'.repeat(240);
    const result = parseOperatorError(`\n${firstLine}\nsecond line`, 502);

    expect(result.response.message).toBe('x'.repeat(200));
    expect(result.response.code).toBe('UNKNOWN_ERROR');
  });

  test('handles malformed JSON and empty bodies with stable fallbacks', () => {
    expect(parseOperatorError('{"broken"', 502).response.message).toBe('{"broken"');
    expect(parseOperatorError('', 500).response.message).toBe(unknownOperatorErrorMessage);
  });
});
