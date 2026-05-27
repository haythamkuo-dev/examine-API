import {
  defaultTargetEnvironment,
  targetEnvironmentHeaderName,
  type TargetEnvironment,
} from '../../src/core/targetEnvironment';

const jsonContentTypeHeader = 'Content-Type';
const jsonContentTypeValue = 'application/json';
const unknownContentTypeLabel = 'unknown';
const localEnvironmentLabel = '本地';
const productEnvironmentLabel = '產品';
const localTargetLabel = '本地代理';
const remoteTargetLabel = '線上 API';
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '';
const isLocalBrowserHost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);
const apiBaseUrl =
  import.meta.env.DEV || isLocalBrowserHost ? '' : configuredApiBaseUrl;

export const jsonHeaders = { [jsonContentTypeHeader]: jsonContentTypeValue };

export type OperatorEnvironmentMode = TargetEnvironment;

export const loadingLabels = {
  defaults: 'Loading defaults',
  preview: 'Preparing preview',
  create: 'Sending request',
  generate: 'Generating reference',
  save: 'Saving defaults',
} as const;

export type ApiAction = 'preview' | 'create' | 'generate' | 'save';

export type ApiLogContext = {
  environmentLabel: typeof localEnvironmentLabel | typeof productEnvironmentLabel;
  requestUrl: string;
  targetLabel: typeof localTargetLabel | typeof remoteTargetLabel;
};

export type ApiResultView = {
  ok: boolean;
  action: ApiAction;
  status: number | null;
  message: string;
  details?: string;
  logContext?: ApiLogContext;
  raw: unknown;
};

export type MerchantReferencePayloadKey = 'merchant_ref' | 'merchant_reference';

/**
 * Returns the localized environment label for the active operator theme mode.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @returns `本地` for local mode or `產品` for product mode.
 */
export const getOperatorEnvironmentLabel = (
  mode: OperatorEnvironmentMode,
): ApiLogContext['environmentLabel'] =>
  mode === 'product' ? productEnvironmentLabel : localEnvironmentLabel;

/**
 * Merges standard JSON and target-environment headers for operator requests.
 *
 * @param targetEnvironment Operator environment selected in the frontend UI.
 * @param headers Optional request headers to merge with the operator metadata.
 * @returns Headers object carrying both JSON and target-environment metadata.
 */
export const buildOperatorHeaders = (
  targetEnvironment: OperatorEnvironmentMode,
  headers?: HeadersInit,
): Headers => {
  const mergedHeaders = new Headers(headers);

  mergedHeaders.set(jsonContentTypeHeader, jsonContentTypeValue);
  mergedHeaders.set(targetEnvironmentHeaderName, targetEnvironment);

  return mergedHeaders;
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
 * Resolves an API path against the active frontend runtime.
 *
 * Development keeps relative `/api` requests so Vite can proxy them locally.
 * Production builds use `VITE_API_BASE_URL` when provided.
 *
 * @param path Absolute API path starting with `/`.
 * @returns Relative path in development or fully qualified production URL.
 * @throws {Error} When the provided path is not rooted.
 */
export const resolveApiUrl = (path: string): string => {
  if (!path.startsWith('/')) {
    throw new Error(`Expected rooted API path, received: ${path}`);
  }

  return apiBaseUrl ? new URL(path, apiBaseUrl).toString() : path;
};

/**
 * Builds the environment and target metadata shown alongside operator request logs.
 *
 * @param path Absolute API path starting with `/`.
 * @param mode Operator environment selected in the frontend UI.
 * @returns Display metadata describing the selected UI environment and resolved API target.
 * @throws {Error} When the provided path is not rooted.
 */
export const buildApiLogContext = (
  path: string,
  mode: OperatorEnvironmentMode,
): ApiLogContext => {
  const requestUrl = resolveApiUrl(path);

  return {
    environmentLabel: getOperatorEnvironmentLabel(mode),
    requestUrl,
    targetLabel: requestUrl.startsWith('http') ? remoteTargetLabel : localTargetLabel,
  };
};

/**
 * Fetches a JSON API endpoint and validates the response envelope.
 *
 * @param url Endpoint URL to request.
 * @param init Optional fetch configuration.
 * @returns Parsed JSON response body.
 * @throws {ApiRequestError} When the response is non-OK, empty, non-JSON, or malformed.
 */
export const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const targetEnvironment = init?.headers instanceof Headers
    ? init.headers.get(targetEnvironmentHeaderName) || defaultTargetEnvironment
    : defaultTargetEnvironment;
  const requestUrl = resolveApiUrl(url);
  const response = await fetch(requestUrl, {
    ...init,
    headers: buildOperatorHeaders(targetEnvironment, init?.headers),
  });
  const rawBody = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    const summary = rawBody.trim() || response.statusText || 'Empty response body';
    throw new ApiRequestError({
      message: `API ${response.status} from ${requestUrl}: ${summary}`,
      status: response.status,
      url: requestUrl,
      rawBody,
      contentType,
    });
  }

  if (!rawBody.trim()) {
    throw new ApiRequestError({
      message: `Empty response from ${requestUrl}`,
      status: response.status,
      url: requestUrl,
      rawBody,
      contentType,
    });
  }

  if (!contentType.includes(jsonContentTypeValue)) {
    throw new ApiRequestError({
      message: `Expected JSON from ${requestUrl} but received ${contentType || `${unknownContentTypeLabel} content type`}`,
      status: response.status,
      url: requestUrl,
      rawBody,
      contentType,
    });
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new ApiRequestError({
      message: `Invalid JSON from ${requestUrl}`,
      status: response.status,
      url: requestUrl,
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
 * Extracts a merchant reference field from an operator preview payload.
 *
 * @param payload Unknown preview payload object returned by the backend.
 * @param fieldKey Payload key to read, such as `merchant_ref` or `merchant_reference`.
 * @returns Trimmed merchant reference value when present; otherwise `null`.
 */
export const extractMerchantReferenceValue = (
  payload: unknown,
  fieldKey: MerchantReferencePayloadKey,
): string | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[fieldKey];
  return typeof value === 'string' && value.trim() ? value : null;
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
  logContext?: ApiLogContext,
): ApiResultView => {
  if (caught instanceof ApiRequestError) {
    return {
      ok: false,
      action,
      status: caught.status,
      message: caught.message,
      details: caught.rawBody.trim() || undefined,
      logContext,
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
    logContext,
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
