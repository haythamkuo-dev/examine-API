/** Frontend fallback matching the backend's unknown error code. */
export const unknownOperatorErrorCode = 'UNKNOWN_ERROR';

/** Frontend fallback matching the backend's public unknown error message. */
export const unknownOperatorErrorMessage = '不明錯誤，請聯繫開發者';

const maxPlainTextSummaryLength = 200;

/** Normalized error fields displayed by operator pages. */
export type OperatorErrorDetails = {
  status: number;
  code: string;
  message: string;
};

/** Standard error envelope consumed by operator result panels. */
export type OperatorErrorEnvelope = {
  response: OperatorErrorDetails;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const summarizePlainText = (value: string): string | null => {
  const firstNonEmptyLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstNonEmptyLine
    ? firstNonEmptyLine.slice(0, maxPlainTextSummaryLength)
    : null;
};

/**
 * Converts a failed response body into the frontend's standard error envelope.
 *
 * Standard backend envelopes take precedence. Legacy top-level fields and text
 * bodies remain supported only as deployment compatibility fallbacks.
 *
 * @param body Parsed JSON payload or raw text response.
 * @param httpStatus HTTP status returned by fetch.
 * @param statusText HTTP status text used when the body has no message.
 * @returns Standard error envelope suitable for all operator result panels.
 */
export const normalizeOperatorError = (
  body: unknown,
  httpStatus: number,
  statusText: string = '',
): OperatorErrorEnvelope => {
  const root = isRecord(body) ? body : null;
  const nested = root && isRecord(root.response) ? root.response : null;
  const status =
    typeof nested?.status === 'number'
      ? nested.status
      : typeof root?.status === 'number'
        ? root.status
        : httpStatus;
  const code =
    getText(nested?.code) ||
    getText(root?.code) ||
    unknownOperatorErrorCode;
  const message =
    getText(nested?.message) ||
    getText(nested?.error) ||
    getText(root?.message) ||
    getText(root?.error) ||
    (typeof body === 'string' ? summarizePlainText(body) : null) ||
    getText(statusText) ||
    unknownOperatorErrorMessage;

  return {
    response: {
      status,
      code,
      message,
    },
  };
};

/**
 * Parses a raw failed response and converts it into the standard error envelope.
 *
 * @param rawBody Raw body captured from fetch.
 * @param httpStatus HTTP status returned by fetch.
 * @param statusText HTTP status text used when the body has no message.
 * @returns Standard error envelope with legacy and text fallbacks applied.
 */
export const parseOperatorError = (
  rawBody: string,
  httpStatus: number,
  statusText: string = '',
): OperatorErrorEnvelope => {
  const trimmedBody = rawBody.trim();
  if (!trimmedBody) {
    return normalizeOperatorError(null, httpStatus, statusText);
  }

  try {
    return normalizeOperatorError(JSON.parse(trimmedBody) as unknown, httpStatus, statusText);
  } catch {
    return normalizeOperatorError(rawBody, httpStatus, statusText);
  }
};

/**
 * Produces a bounded transport-level summary without embedding a full JSON body.
 *
 * @param envelope Standard error envelope returned by the compatibility parser.
 * @returns First non-empty message line, limited to 200 characters.
 */
export const getOperatorErrorSummary = (
  envelope: OperatorErrorEnvelope,
): string =>
  summarizePlainText(envelope.response.message) || unknownOperatorErrorMessage;
