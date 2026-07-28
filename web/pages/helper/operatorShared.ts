import {
  ApiRequestError,
  buildOperatorHeaders,
  fetchJson,
  resolveApiUrl,
  type OperatorEnvironmentMode,
} from './operatorTransport';
import {
  normalizeOperatorError,
  parseOperatorError,
} from './operatorError';
import { toast } from 'react-toastify';

export { ApiRequestError, buildOperatorHeaders, fetchJson, resolveApiUrl };
export type { OperatorEnvironmentMode } from './operatorTransport';

const localEnvironmentLabel = '沙盒';
const productEnvironmentLabel = '產品';
const localTargetLabel = '沙盒代理';
const remoteTargetLabel = '線上 API';
export const apiKeyResetToastMessage = 'API key reset to the selected environment default.';

export const loadingLabels = {
  defaults: 'Loading defaults',
  preview: 'Preparing preview',
  create: 'Sending request',
  generate: 'Generating reference',
} as const;

export type ApiAction = 'preview' | 'create' | 'generate';

export type ApiLogContext = {
  environmentLabel: typeof localEnvironmentLabel | typeof productEnvironmentLabel;
  requestUrl: string;
  targetLabel: typeof localTargetLabel | typeof remoteTargetLabel;
};

export type ApiSuccessResult = {
  ok: true;
  action: ApiAction;
  status: number | null;
  message: string;
  details?: string;
  logContext?: ApiLogContext;
  raw: unknown;
  checkoutUrl: string | null;
};

export type ApiFailureResult = {
  ok: false;
  action: ApiAction;
  status: number | null;
  message: string;
  details?: string;
  logContext?: ApiLogContext;
  raw: unknown;
  checkoutUrl: null;
};

export type ApiResultView = ApiSuccessResult | ApiFailureResult;

export type MerchantReferencePayloadKey = 'merchant_ref' | 'merchant_reference';

/**
 * Returns the localized environment label for the active operator theme mode.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @returns `沙盒` for local mode or `產品` for product mode.
 */
export const getOperatorEnvironmentLabel = (
  mode: OperatorEnvironmentMode,
): ApiLogContext['environmentLabel'] =>
  mode === 'product' ? productEnvironmentLabel : localEnvironmentLabel;

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
    const envelope = parseOperatorError(caught.rawBody, caught.status);

    return {
      ok: false,
      action,
      status: envelope.response.status,
      message: envelope.response.message,
      logContext,
      raw: envelope,
      checkoutUrl: null,
    };
  }

  const message = caught instanceof Error ? caught.message : String(caught);
  const envelope = normalizeOperatorError(message, 500);
  return {
    ok: false,
    action,
    status: envelope.response.status,
    message: envelope.response.message,
    logContext,
    raw: envelope,
    checkoutUrl: null,
  };
};

/**
 * Shows the shared toast that explains the API key has been reset to the backend default.
 *
 * @returns Nothing.
 */
export const showApiKeyResetToast = (): void => {
  toast.info(apiKeyResetToastMessage, {
    autoClose: 2600,
    closeOnClick: true,
  });
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
