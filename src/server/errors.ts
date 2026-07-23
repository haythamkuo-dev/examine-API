/** Stable fallback code used when an error has no recognized classification. */
export const unknownErrorCode = 'UNKNOWN_ERROR';

/** Public fallback message used when no safe error message is available. */
export const unknownErrorMessage = '不明錯誤，請聯繫開發者';

/** Public fields allowed inside the backend error response. */
export type StandardErrorDetails = {
  status: number;
  code: string;
  message: string;
};

/** Standard envelope returned by every failed backend HTTP request. */
export type StandardErrorResponse = {
  response: StandardErrorDetails;
};

/**
 * Represents an expected application error that may be converted at the route boundary.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  /**
   * Creates an expected application error.
   *
   * @param params Error status, stable code, public message, and optional internal cause.
   */
  constructor(params: {
    status: number;
    code?: string;
    message: string;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'AppError';
    this.status = params.status;
    this.code = params.code || unknownErrorCode;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * Removes credential secrets from a message while retaining its remaining text.
 *
 * @param message Upstream or local error message to make safe for clients.
 * @returns Complete message text with credential values replaced by `[REDACTED]`.
 */
export const sanitizeErrorMessage = (message: string): string => {
  const redactedAuthorization = message.replace(
    /(\bauthorization\b\s*[:=]\s*)(?:(?:Bearer|ApiKey)\s+)?[^\s,;}"'\]]+/gi,
    '$1[REDACTED]',
  );
  const redactedSchemes = redactedAuthorization.replace(
    /\b(Bearer|ApiKey)\s+[^\s,;"'}\]]+/gi,
    '$1 [REDACTED]',
  );
  const redactedQuotedValues = redactedSchemes.replace(
    /(["']?(?:authorization|api[_-]?key|access[_-]?token|token|secret|password)["']?\s*[:=]\s*)(["'])(.*?)\2/gi,
    '$1$2[REDACTED]$2',
  );
  return redactedQuotedValues.replace(
    /(\b(?:authorization|api[_-]?key|access[_-]?token|token|secret|password)\b\s*[:=]\s*)(?!["'\[])[^\s,;}\]]+/gi,
    '$1[REDACTED]',
  );
};

/**
 * Creates the only error envelope exposed by backend HTTP routes.
 *
 * @param status HTTP status represented by the error.
 * @param message Public error message, filtered for credential secrets.
 * @param code Stable error code. Defaults to `UNKNOWN_ERROR`.
 * @returns Standard response envelope containing status, code, and safe message.
 */
export const buildErrorEnvelope = (
  status: number,
  message: string = unknownErrorMessage,
  code: string = unknownErrorCode,
): StandardErrorResponse => ({
  response: {
    status,
    code: getText(code) || unknownErrorCode,
    message: sanitizeErrorMessage(getText(message) || unknownErrorMessage),
  },
});

/**
 * Normalizes an expected failed command result at the route boundary.
 *
 * @param result Unknown command result returned by an upstream service.
 * @returns A standard error envelope when `result.ok` is false, otherwise `null`.
 */
export const normalizeRouteError = (result: unknown): StandardErrorResponse | null => {
  if (!isRecord(result) || result.ok !== false) {
    return null;
  }

  const upstreamResponse = isRecord(result.response) ? result.response : null;
  const status =
    typeof result.status === 'number'
      ? result.status
      : typeof upstreamResponse?.status === 'number'
        ? upstreamResponse.status
        : 500;
  const code = getText(upstreamResponse?.code) || getText(result.code) || unknownErrorCode;
  const message =
    getText(upstreamResponse?.message) ||
    getText(upstreamResponse?.error) ||
    getText(result.message) ||
    getText(result.error) ||
    getText(typeof result.response === 'string' ? result.response : null) ||
    unknownErrorMessage;

  return buildErrorEnvelope(status, message, code);
};

// #todo Extend message redaction to financial data and personally identifiable information.
// #todo Add evidence-based upstream error-code mapping and incomplete-message classification.
