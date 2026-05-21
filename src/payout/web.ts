import type { CliEnv, PayoutChannel } from '../core/env';
import { createUniqueReference, generateSign } from '../utils';
import type { PayoutPayload } from '../domains/payout';
import { createPayoutPayload, createPayoutRequest } from '../domains/payout';
import type { CommandRequest, CommandResult } from '../runner';

type PayoutFieldSchemaBase = {
  label: string;
  required?: boolean;
  helperText?: string;
};

export type PayoutTextFieldSchema = PayoutFieldSchemaBase & {
  kind: 'text' | 'textarea';
  placeholder?: string;
};

export type PayoutSelectFieldSchema = PayoutFieldSchemaBase & {
  kind: 'select';
  options: Array<{ label: string; value: string }>;
};

export type PayoutBooleanFieldSchema = PayoutFieldSchemaBase & {
  kind: 'boolean';
};

export type PayoutObjectFieldSchema = PayoutFieldSchemaBase & {
  kind: 'object';
  fields: PayoutFieldMap;
};

export type PayoutArrayFieldSchema = PayoutFieldSchemaBase & {
  kind: 'array';
  itemLabel: string;
  itemSchema: PayoutObjectFieldSchema;
};

export type PayoutFieldSchema =
  | PayoutTextFieldSchema
  | PayoutSelectFieldSchema
  | PayoutBooleanFieldSchema
  | PayoutObjectFieldSchema
  | PayoutArrayFieldSchema;

export type PayoutFieldMap = Record<string, PayoutFieldSchema>;

export type PayoutCommonValues = {
  merchantReference: string;
};

export type PayoutChannelValues = Record<string, unknown>;

export type PayoutFormValues = {
  channel: PayoutChannel;
  commonValues: PayoutCommonValues;
  channelValues: PayoutChannelValues;
};

export type PayoutDefaultsResponse = {
  availableChannels: PayoutChannel[];
  channel: PayoutChannel;
  commonSchema: PayoutFieldMap;
  channelSchema: PayoutFieldMap;
  form: PayoutFormValues;
};

export type PayoutPreviewResponse = {
  request: {
    name: string;
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload: unknown;
  };
};

export type PayoutCreateResponse = CommandResult;

export type PayoutDefaultsSavedResponse = {
  ok: true;
  availableChannels: PayoutChannel[];
  channel: PayoutChannel;
  commonSchema: PayoutFieldMap;
  channelSchema: PayoutFieldMap;
  form: PayoutFormValues;
};

const merchantReferenceKey = 'merchant_reference';
const optionalFieldMarker = '非必填';
const payoutSignFields = ['amount.amount', 'amount.currency_code', 'merchant_reference', 'product_no'];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const shouldPruneValue = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && (!value.trim() || value.includes(optionalFieldMarker)));

const pruneOptionalFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => pruneOptionalFields(item))
      .filter((item) => item !== undefined);

    return items.length > 0 ? items : undefined;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .map(([key, childValue]) => [key, pruneOptionalFields(childValue)] as const)
      .filter((entry): entry is readonly [string, unknown] => entry[1] !== undefined);

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  return shouldPruneValue(value) ? undefined : value;
};

const sanitizeMerchantReference = (
  merchantReference: string,
  makeId: (prefix: string) => string,
): string => {
  return createUniqueReference(merchantReference, makeId, 'TEST_ORDER_');
};

const buildPayloadFromForm = (
  env: CliEnv,
  values: PayoutFormValues,
  makeId: (prefix: string) => string,
): PayoutPayload => {
  const payload = clone(
    createPayoutPayload(env, values.channel, makeId),
  );

  payload[merchantReferenceKey] = sanitizeMerchantReference(
    values.commonValues.merchantReference,
    makeId,
  );

  const mergedPayload = {
    ...payload,
    ...(clone(values.channelValues) as Omit<PayoutPayload, 'merchant_reference'>),
  };

  const { sign: _existingSign, ...payloadWithoutSign } = mergedPayload;
  const prunedPayload = pruneOptionalFields(payloadWithoutSign);

  if (!isPlainObject(prunedPayload)) {
    throw new TypeError('Payout payload must remain an object after pruning');
  }

  return {
    ...(prunedPayload as Omit<PayoutPayload, 'sign'>),
    sign: generateSign(prunedPayload, payoutSignFields, env.signKey),
  };
};

/**
 * Masks sensitive request headers before returning them to the UI.
 *
 * @param headers Headers generated for the proxied request.
 * @returns The same headers with authorization token redacted.
 */
export const maskRequestHeaders = (
  headers?: Record<string, string>,
): Record<string, string> | undefined => {
  if (!headers) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      if (key.toLowerCase() === 'authorization') {
        const [scheme, token] = value.split(' ');
        const suffix = token ? token.slice(-6) : '';
        return [key, `${scheme || 'ApiKey'} ****${suffix}`];
      }

      return [key, value];
    }),
  );
};

/**
 * Builds the outbound payout command from editable form values.
 *
 * @param env Runtime environment containing endpoint and credential settings.
 * @param values Payout form values from the web UI.
 * @param makeId ID generator used to build unique merchant references.
 * @returns The runner-compatible command request.
 * @throws {TypeError} When the form payload shape cannot be merged into a payout payload.
 */
export const buildPayoutRequestFromForm = (
  env: CliEnv,
  values: PayoutFormValues,
  makeId: (prefix: string) => string,
): CommandRequest => {
  const request = createPayoutRequest(env, values.channel, makeId);

  return {
    ...request,
    payload: buildPayloadFromForm(env, values, makeId),
  };
};

/**
 * Builds a masked preview payload for the payout UI.
 *
 * @param env Runtime environment containing endpoint and credential settings.
 * @param values Payout form values from the web UI.
 * @param makeId ID generator used to build unique merchant references.
 * @returns A preview-safe representation of the outbound request.
 * @throws {TypeError} When the form payload shape cannot be merged into a payout payload.
 */
export const buildPayoutPreviewResponse = (
  env: CliEnv,
  values: PayoutFormValues,
  makeId: (prefix: string) => string,
): PayoutPreviewResponse => {
  const request = buildPayoutRequestFromForm(env, values, makeId);

  return {
    request: {
      name: request.name,
      method: request.method,
      url: request.url,
      headers: maskRequestHeaders(request.headers),
      payload: request.payload,
    },
  };
};

/**
 * Normalizes runner output for the payout create API.
 *
 * @param result Raw runner output.
 * @returns The API response body returned to the frontend.
 */
export const buildPayoutCreateResponse = (result: CommandResult): PayoutCreateResponse => result;
