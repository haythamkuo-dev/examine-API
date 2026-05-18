const jsonContentTypeHeader = 'Content-Type';
const jsonContentTypeValue = 'application/json';
const unknownContentTypeLabel = 'unknown';

export const jsonHeaders = { [jsonContentTypeHeader]: jsonContentTypeValue };

export const loadingLabels = {
  defaults: 'Loading defaults',
  preview: 'Preparing preview',
  create: 'Sending request',
  save: 'Saving defaults',
} as const;

export type ApiAction = 'preview' | 'create' | 'save';

export type ApiResultView = {
  ok: boolean;
  action: ApiAction;
  status: number | null;
  message: string;
  details?: string;
  raw: unknown;
};

/**
 * Represents a structured API request failure from the operator pages.
 *
 * @param params Error metadata captured from the failed HTTP response.
 * @throws {Error} Always via the parent `Error` constructor.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly url: string;
  readonly rawBody: string;
  readonly contentType: string;

  constructor(params: {
    message: string;
    status: number;
    url: string;
    rawBody: string;
    contentType: string;
  }) {
    super(params.message);
    this.name = 'ApiRequestError';
    this.status = params.status;
    this.url = params.url;
    this.rawBody = params.rawBody;
    this.contentType = params.contentType;
  }
}

/**
 * Fetches a JSON API endpoint and validates the response envelope.
 *
 * @param url Endpoint URL to request.
 * @param init Optional fetch configuration.
 * @returns Parsed JSON response body.
 * @throws {ApiRequestError} When the response is non-OK, empty, non-JSON, or malformed.
 */
export const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const rawBody = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    const summary = rawBody.trim() || response.statusText || 'Empty response body';
    throw new ApiRequestError({
      message: `API ${response.status} from ${url}: ${summary}`,
      status: response.status,
      url,
      rawBody,
      contentType,
    });
  }

  if (!rawBody.trim()) {
    throw new ApiRequestError({
      message: `Empty response from ${url}`,
      status: response.status,
      url,
      rawBody,
      contentType,
    });
  }

  if (!contentType.includes(jsonContentTypeValue)) {
    throw new ApiRequestError({
      message: `Expected JSON from ${url} but received ${contentType || `${unknownContentTypeLabel} content type`}`,
      status: response.status,
      url,
      rawBody,
      contentType,
    });
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new ApiRequestError({
      message: `Invalid JSON from ${url}`,
      status: response.status,
      url,
      rawBody,
      contentType,
    });
  }
};

/**
 * Reads a numeric `status` field from an unknown API payload.
 *
 * @param value API payload or result object.
 * @returns Numeric status when present, otherwise `null`.
 */
export const getNumericStatus = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = (value as { status?: unknown }).status;
  return typeof candidate === 'number' ? candidate : null;
};

/**
 * Converts an unknown error into a result-model payload for the shared result panel.
 *
 * @param action UI action associated with the failed request.
 * @param caught Thrown error value.
 * @returns Structured failure result for `ResultPanel`.
 */
export const buildFailureResult = (
  action: ApiAction,
  caught: unknown,
): ApiResultView => {
  if (caught instanceof ApiRequestError) {
    return {
      ok: false,
      action,
      status: caught.status,
      message: caught.message,
      details: caught.rawBody.trim() || undefined,
      raw: {
        ok: false,
        action,
        status: caught.status,
        url: caught.url,
        message: caught.message,
        contentType: caught.contentType || unknownContentTypeLabel,
        body: caught.rawBody,
      },
    };
  }

  const message = caught instanceof Error ? caught.message : String(caught);
  return {
    ok: false,
    action,
    status: null,
    message,
    raw: {
      ok: false,
      action,
      status: null,
      message,
    },
  };
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/**
 * Returns a cloned object with one nested path updated to a new value.
 *
 * @param source Source object to clone before mutation.
 * @param path Nested key path made of object keys and array indexes.
 * @param nextValue Value to assign at the target path.
 * @returns Cloned object with the updated nested value.
 * @throws {Error} When the provided path does not match the current object shape.
 */
export const updatePathValue = (
  source: Record<string, unknown>,
  path: Array<string | number>,
  nextValue: unknown,
): Record<string, unknown> => {
  const draft = clone(source);
  if (path.length === 0) {
    return draft;
  }

  let cursor: Record<string, unknown> | unknown[] = draft;

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    const nextSegment = path[index + 1];
    if (segment === undefined) {
      throw new Error('Invalid path segment');
    }

    const nextContainer = typeof nextSegment === 'number' ? [] : {};

    if (typeof segment === 'number') {
      if (!Array.isArray(cursor)) {
        throw new Error('Invalid array path');
      }

      const currentValue = cursor[segment];
      const normalized =
        currentValue === undefined || currentValue === null ? nextContainer : clone(currentValue);
      cursor[segment] = normalized;
      cursor = normalized as Record<string, unknown> | unknown[];
      continue;
    }

    if (Array.isArray(cursor)) {
      throw new Error('Invalid object path');
    }

    const currentValue = cursor[segment];
    if (currentValue === undefined || currentValue === null) {
      cursor[segment] = nextContainer;
    } else {
      cursor[segment] = clone(currentValue);
    }
    cursor = cursor[segment] as Record<string, unknown> | unknown[];
  }

  const lastSegment = path[path.length - 1];
  if (lastSegment === undefined) {
    throw new Error('Invalid final path segment');
  }

  if (typeof lastSegment === 'number') {
    if (!Array.isArray(cursor)) {
      throw new Error('Invalid final array path');
    }
    cursor[lastSegment] = nextValue;
    return draft;
  }

  if (Array.isArray(cursor)) {
    throw new Error('Invalid final object path');
  }

  cursor[lastSegment] = nextValue;
  return draft;
};
