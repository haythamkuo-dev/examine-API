import type { CliEnv, SubscriptionChannel } from '../core/env';
import { createUniqueReference, generateSign } from '../utils';
import {
  createSubscriptionPayload,
  createSubscriptionRequest,
  type SubscriptionPayload,
} from '../domains/subscription';
import type { CommandRequest, CommandResult } from '../runner';

type SubscriptionFieldSchemaBase = {
  label: string;
  required?: boolean;
  helperText?: string;
};

export type SubscriptionTextFieldSchema = SubscriptionFieldSchemaBase & {
  kind: 'text' | 'textarea';
  placeholder?: string;
};

export type SubscriptionSelectFieldSchema = SubscriptionFieldSchemaBase & {
  kind: 'select';
  options: Array<{ label: string; value: string }>;
};

export type SubscriptionBooleanFieldSchema = SubscriptionFieldSchemaBase & {
  kind: 'boolean';
};

export type SubscriptionObjectFieldSchema = SubscriptionFieldSchemaBase & {
  kind: 'object';
  fields: SubscriptionFieldMap;
};

export type SubscriptionArrayFieldSchema = SubscriptionFieldSchemaBase & {
  kind: 'array';
  itemLabel: string;
  itemSchema: SubscriptionObjectFieldSchema;
};

export type SubscriptionFieldSchema =
  | SubscriptionTextFieldSchema
  | SubscriptionSelectFieldSchema
  | SubscriptionBooleanFieldSchema
  | SubscriptionObjectFieldSchema
  | SubscriptionArrayFieldSchema;

export type SubscriptionFieldMap = Record<string, SubscriptionFieldSchema>;

export type SubscriptionCommonValues = {
  merchantRef: string;
  returnUrl: string;
};

export type SubscriptionChannelValues = Record<string, unknown>;

export type SubscriptionFormValues = {
  channel: SubscriptionChannel;
  commonValues: SubscriptionCommonValues;
  channelValues: SubscriptionChannelValues;
};

export type SubscriptionDefaultsResponse = {
  availableChannels: SubscriptionChannel[];
  channel: SubscriptionChannel;
  commonSchema: SubscriptionFieldMap;
  channelSchema: SubscriptionFieldMap;
  form: SubscriptionFormValues;
};

export type SubscriptionPreviewResponse = {
  request: {
    name: string;
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload: unknown;
  };
};

export type SubscriptionCreateResponse = CommandResult;

export type SubscriptionDefaultsSavedResponse = {
  ok: true;
  availableChannels: SubscriptionChannel[];
  channel: SubscriptionChannel;
  commonSchema: SubscriptionFieldMap;
  channelSchema: SubscriptionFieldMap;
  form: SubscriptionFormValues;
};

const subscriptionSignFields = ['merchant_no', 'merchant_ref', 'order_id', 'status'];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const sanitizeMerchantReference = (
  merchantReference: string,
  makeId: (prefix: string) => string,
): string => {
  return createUniqueReference(merchantReference, makeId, 'TEST_ORDER_');
};

const buildPayloadFromForm = (
  env: CliEnv,
  values: SubscriptionFormValues,
  makeId: (prefix: string) => string,
): SubscriptionPayload => {
  const payload = clone(
    createSubscriptionPayload(env, values.channel, {
      commonValues: values.commonValues,
      channelValues: values.channelValues,
    }, makeId),
  );

  payload.merchant_ref = sanitizeMerchantReference(values.commonValues.merchantRef, makeId);
  payload.return_url = values.commonValues.returnUrl;

  const { sign: _existingSign, ...payloadWithoutSign } = payload;

  return {
    ...payloadWithoutSign,
    sign: generateSign(payloadWithoutSign, subscriptionSignFields, env.signKey),
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
 * Builds the outbound subscription command from editable form values.
 *
 * @param env Runtime environment containing endpoint and credential settings.
 * @param values Subscription form values from the web UI.
 * @param makeId ID generator used to build unique merchant references.
 * @returns The runner-compatible command request.
 */
export const buildSubscriptionRequestFromForm = (
  env: CliEnv,
  values: SubscriptionFormValues,
  makeId: (prefix: string) => string,
): CommandRequest => {
  const request = createSubscriptionRequest(env, values.channel, {
    commonValues: values.commonValues,
    channelValues: values.channelValues,
  }, makeId);

  return {
    ...request,
    payload: buildPayloadFromForm(env, values, makeId),
  };
};

/**
 * Builds a masked preview payload for the subscription UI.
 *
 * @param env Runtime environment containing endpoint and credential settings.
 * @param values Subscription form values from the web UI.
 * @param makeId ID generator used to build unique merchant references.
 * @returns A preview-safe representation of the outbound request.
 */
export const buildSubscriptionPreviewResponse = (
  env: CliEnv,
  values: SubscriptionFormValues,
  makeId: (prefix: string) => string,
): SubscriptionPreviewResponse => {
  const request = buildSubscriptionRequestFromForm(env, values, makeId);

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
 * Normalizes runner output for the subscription create API.
 *
 * @param result Raw runner output.
 * @returns The API response body returned to the frontend.
 */
export const buildSubscriptionCreateResponse = (
  result: CommandResult,
): SubscriptionCreateResponse => result;
