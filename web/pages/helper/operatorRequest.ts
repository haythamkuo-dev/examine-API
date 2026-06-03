import { buildOperatorHeaders, fetchJson, resolveApiUrl, type OperatorEnvironmentMode } from './operatorShared';

/**
 * Builds a query string for channel-scoped operator endpoints.
 *
 * @param channel Optional channel code to append.
 * @returns Query string with a leading `?` when channel is provided, otherwise an empty string.
 */
export const buildChannelQuery = (channel?: string): string =>
  channel ? `?channel=${encodeURIComponent(channel)}` : '';

/**
 * Fetches JSON from an operator API endpoint using the active environment headers.
 *
 * @param path Absolute operator API path starting with `/`.
 * @param mode Operator environment selected in the frontend UI.
 * @param init Optional fetch init overrides.
 * @returns Parsed JSON response payload.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const fetchOperatorJson = <T>(
  path: string,
  mode: OperatorEnvironmentMode,
  init: RequestInit = {},
): Promise<T> =>
  fetchJson<T>(path, {
    ...init,
    headers: buildOperatorHeaders(mode, init.headers),
  });

/**
 * Sends a JSON POST request to an operator API endpoint.
 *
 * @param path Absolute operator API path starting with `/`.
 * @param mode Operator environment selected in the frontend UI.
 * @param body JSON-serializable request body.
 * @returns Parsed JSON response payload.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const postOperatorJson = <T>(
  path: string,
  mode: OperatorEnvironmentMode,
  body: unknown,
): Promise<T> =>
  fetchOperatorJson<T>(path, mode, {
    method: 'POST',
    body: JSON.stringify(body),
  });

/**
 * Sends a JSON PUT request to an operator API endpoint.
 *
 * @param path Absolute operator API path starting with `/`.
 * @param mode Operator environment selected in the frontend UI.
 * @param body JSON-serializable request body.
 * @returns Parsed JSON response payload.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const putOperatorJson = <T>(
  path: string,
  mode: OperatorEnvironmentMode,
  body: unknown,
): Promise<T> =>
  fetchOperatorJson<T>(path, mode, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

/**
 * Sends a raw operator request for flows that normalize the response later.
 *
 * @param path Absolute operator API path starting with `/`.
 * @param mode Operator environment selected in the frontend UI.
 * @param body JSON-serializable request body.
 * @returns Raw fetch response for downstream normalization.
 * @throws {Error} When fetch cannot complete.
 */
export const sendOperatorRequest = (
  path: string,
  mode: OperatorEnvironmentMode,
  body: unknown,
): Promise<Response> =>
  fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: buildOperatorHeaders(mode),
    body: JSON.stringify(body),
  });
