import { targetEnvironmentHeaderName } from '../core/targetEnvironment';
import {
  buildErrorEnvelope,
  unknownErrorCode,
} from './errors';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': `Content-Type,${targetEnvironmentHeaderName}`,
};

export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });

/**
 * Builds an HTTP response containing the standard backend error envelope.
 *
 * @param status HTTP status for the response.
 * @param message Public error message.
 * @param code Stable error code. Defaults to `UNKNOWN_ERROR`.
 * @returns JSON response containing only `response.status`, `response.code`, and `response.message`.
 */
export const errorResponse = (
  status: number,
  message: string,
  code: string = unknownErrorCode,
): Response => json(buildErrorEnvelope(status, message, code), { status });

/**
 * Builds a standard HTTP 400 error response.
 *
 * @param message Public validation or route error message.
 * @param code Optional stable error code.
 * @returns Standard JSON error response with HTTP status 400.
 */
export const badRequest = (message: string, code?: string): Response =>
  errorResponse(400, message, code);

/**
 * Builds the standard route-not-found response.
 *
 * @returns Standard JSON error response with HTTP status 404.
 */
export const notFound = (): Response => errorResponse(404, 'Not found');

export const readJson = async <T>(request: Request): Promise<T> => {
  return (await request.json()) as T;
};
