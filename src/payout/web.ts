import type { CliEnv, PayoutChannel } from '../core/env';
import { createUniqueReference } from '../utils';
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

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const sanitizeMerchantReference = (
  merchantReference: string,
  makeId: (prefix: string) => string,
): string => {
  if (merchantReference.trim()) {
    return createUniqueReference(merchantReference, makeId, 'TEST_ORDER_');
  }

  return makeId('TEST_ORDER_');
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

  return {
    ...payload,
    ...(clone(values.channelValues) as Omit<PayoutPayload, 'merchant_reference'>),
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
