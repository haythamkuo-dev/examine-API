import {
  defaultTargetEnvironment,
  targetEnvironmentHeaderName,
  type TargetEnvironment,
} from '../../../src/core/targetEnvironment';

const jsonContentTypeHeader = 'Content-Type';
const jsonContentTypeValue = 'application/json';
const unknownContentTypeLabel = 'unknown';
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '';
const isLocalBrowserHost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);
const apiBaseUrl =
  import.meta.env.DEV || isLocalBrowserHost ? '' : configuredApiBaseUrl;

export const jsonHeaders = { [jsonContentTypeHeader]: jsonContentTypeValue };

export type OperatorEnvironmentMode = TargetEnvironment;

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
