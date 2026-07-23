import { describe, expect, test } from 'bun:test';
import {
  buildErrorEnvelope,
  normalizeRouteError,
  sanitizeErrorMessage,
  unknownErrorMessage,
} from './errors';

describe('server error normalization', () => {
  test('normalizes nested upstream fields without exposing command metadata', () => {
    const result = normalizeRouteError({
      ok: false,
      status: 502,
      request: {
        method: 'POST',
        url: 'https://upstream.example.test/private',
        payload: { password: 'do-not-expose' },
      },
      response: {
        status: 422,
        code: 'binding_missing',
        message: 'Required binding is missing',
        internal_trace: 'do-not-expose',
      },
      durationMs: 123,
    });

    expect(result).toEqual({
      response: {
        status: 502,
        code: 'binding_missing',
        message: 'Required binding is missing',
      },
    });
  });

  test('uses the unknown code while preserving a plain-text upstream response', () => {
    expect(
      normalizeRouteError({
        ok: false,
        status: 502,
        response: 'gateway failed',
      }),
    ).toEqual({
      response: {
        status: 502,
        code: 'UNKNOWN_ERROR',
        message: 'gateway failed',
      },
    });
  });

  test('uses the Chinese fallback when no upstream message is available', () => {
    expect(normalizeRouteError({ ok: false, status: 500 })).toEqual(
      buildErrorEnvelope(500, unknownErrorMessage),
    );
  });

  test('redacts credential secrets without truncating surrounding context', () => {
    const message = [
      'Authorization: Bearer auth-secret',
      'api_key="api-secret"',
      'access_token=access-secret',
      'token: token-secret',
      'secret=client-secret',
      'password: password-secret',
      'upstream validation context remains complete',
    ].join('; ');

    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).toContain('Authorization: [REDACTED]');
    expect(sanitized).toContain('api_key="[REDACTED]"');
    expect(sanitized).toContain('access_token=[REDACTED]');
    expect(sanitized).toContain('token: [REDACTED]');
    expect(sanitized).toContain('secret=[REDACTED]');
    expect(sanitized).toContain('password: [REDACTED]');
    expect(sanitized).toContain('upstream validation context remains complete');
    expect(sanitized).not.toContain('auth-secret');
    expect(sanitized).not.toContain('api-secret');
  });
});
