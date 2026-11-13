import { targetEnvironmentHeaderName } from '../core/targetEnvironment';
import {
  AppError,
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

/** Limits applied while reading and inspecting a JSON request body. */
export type ReadJsonOptions = {
  maxBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
};

const defaultReadJsonOptions: Required<ReadJsonOptions> = {
  maxBytes: 1024 * 1024,
  maxDepth: 64,
  maxNodes: 10_000,
};

const requestBodyTooLarge = (message: string): AppError =>
  new AppError({
    status: 413,
    code: 'REQUEST_BODY_TOO_LARGE',
    message,
  });

const requestBodyTooComplex = (): AppError =>
  new AppError({
    status: 413,
    code: 'REQUEST_BODY_TOO_COMPLEX',
    message: 'Request JSON is too deeply nested or contains too many values.',
  });

const isJsonRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const resolveReadJsonOptions = (options: ReadJsonOptions): Required<ReadJsonOptions> => {
  const resolved = {
    maxBytes: options.maxBytes ?? defaultReadJsonOptions.maxBytes,
    maxDepth: options.maxDepth ?? defaultReadJsonOptions.maxDepth,
    maxNodes: options.maxNodes ?? defaultReadJsonOptions.maxNodes,
  };

  if (
    !Number.isSafeInteger(resolved.maxBytes) ||
    resolved.maxBytes < 1 ||
    !Number.isSafeInteger(resolved.maxDepth) ||
    resolved.maxDepth < 1 ||
    !Number.isSafeInteger(resolved.maxNodes) ||
    resolved.maxNodes < 1
  ) {
    throw new RangeError('JSON request limits must be positive safe integers.');
  }

  return resolved;
};

const assertJsonTextDepth = (text: string, maxDepth: number): void => {
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (const character of text) {
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === '\\') {
        isEscaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{' || character === '[') {
      depth += 1;
      if (depth > maxDepth) throw requestBodyTooComplex();
    } else if (character === '}' || character === ']') {
      depth = Math.max(0, depth - 1);
    }
  }
};

const assertJsonComplexity = (
  value: unknown,
  options: Required<ReadJsonOptions>,
): void => {
  const stack: Array<{ value: unknown; depth: number }> = [
    {
      value,
      depth: Array.isArray(value) || isJsonRecord(value) ? 1 : 0,
    },
  ];
  let nodeCount = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    nodeCount += 1;
    if (nodeCount > options.maxNodes) throw requestBodyTooComplex();

    if (Array.isArray(current.value)) {
      if (current.depth > options.maxDepth) throw requestBodyTooComplex();
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: current.value[index], depth: current.depth + 1 });
      }
      continue;
    }

    if (!isJsonRecord(current.value)) continue;
    if (current.depth > options.maxDepth) throw requestBodyTooComplex();

    const entries = Object.entries(current.value);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (!entry) continue;
      stack.push({ value: entry[1], depth: current.depth + 1 });
    }
  }
};

const readRequestBodyText = async (request: Request, maxBytes: number): Promise<string> => {
  const declaredLength = request.headers.get('content-length');
  const contentLength = declaredLength === null ? null : Number(declaredLength);
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw requestBodyTooLarge('Request body exceeds the maximum allowed size.');
  }

  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Keep the stable payload-limit error even when the stream is already closed.
        }
        throw requestBodyTooLarge('Request body exceeds the maximum allowed size.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
};

/**
 * Reads, parses, and bounds a JSON request body before route processing.
 *
 * @param request Incoming request containing a JSON body.
 * @param options Optional byte, nesting-depth, and node-count limits.
 * @returns The parsed JSON value cast to the caller's requested type.
 * @throws {AppError} When the body exceeds a configured size or complexity limit.
 * @throws {SyntaxError} When the body is not valid JSON.
 */
export const readJson = async <T>(request: Request, options: ReadJsonOptions = {}): Promise<T> => {
  const limits = resolveReadJsonOptions(options);
  const bodyText = await readRequestBodyText(request, limits.maxBytes);
  assertJsonTextDepth(bodyText, limits.maxDepth);
  const parsed: unknown = JSON.parse(bodyText);
  assertJsonComplexity(parsed, limits);
  return parsed as T;
};
