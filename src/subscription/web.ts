import type { CliEnv, SubscriptionChannel } from '../core/env';
import { createUniqueReference, generateSign, maskRequestHeaders } from '../utils';
import {
  createSubscriptionPayload,
  createSubscriptionRequest,
  type SubscriptionPayload,
} from '../domains/subscription';
import type { CommandRequest, CommandResult } from '../runner';

/**
 * Stable API error code returned when the selected subscription channel is missing its required plan env var.
 */
export const missingSubscriptionPlanCode = 'MISSING_SUBSCRIPTION_PLAN';

type SubscriptionFieldSchemaBase = {
  label: string;
  required?: boolean;
  helperText?: string;
};

export type SubscriptionTextFieldSchema = SubscriptionFieldSchemaBase & {
  kind: 'text' | 'textarea';
  placeholder?: string;
};

export type SubscriptionNumberFieldSchema = SubscriptionFieldSchemaBase & {
  kind: 'number';
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
  | SubscriptionNumberFieldSchema
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
  resolvedPlanId: string;
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

export type SubscriptionMerchantRefResponse = {
  ok: true;
  merchantRef: string;
};

export type SubscriptionDefaultsSavedResponse = {
  ok: true;
  availableChannels: SubscriptionChannel[];
  channel: SubscriptionChannel;
  resolvedPlanId: string;
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
  merchantRef: string,
): SubscriptionPayload => {
  const normalizedValues: SubscriptionFormValues = {
    ...values,
    commonValues: {
      ...values.commonValues,
      merchantRef,
    },
  };
  const payload = clone(
    createSubscriptionPayload(env, values.channel, {
      commonValues: normalizedValues.commonValues,
      channelValues: normalizedValues.channelValues,
    }, () => merchantRef),
  );

  payload.merchant_ref = merchantRef;
  payload.return_url = values.commonValues.returnUrl;

  const { sign: _existingSign, ...payloadWithoutSign } = payload;

  return {
    ...payloadWithoutSign,
    sign: generateSign(payloadWithoutSign, subscriptionSignFields, env.signKey),
  };
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
  const merchantRef = sanitizeMerchantReference(values.commonValues.merchantRef, makeId);
  const normalizedValues: SubscriptionFormValues = {
    ...values,
    commonValues: {
      ...values.commonValues,
      merchantRef,
    },
  };
  const request = createSubscriptionRequest(env, values.channel, {
    commonValues: normalizedValues.commonValues,
    channelValues: normalizedValues.channelValues,
  }, () => merchantRef);

  return {
    ...request,
    payload: buildPayloadFromForm(env, normalizedValues, merchantRef),
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
  const previewValues: SubscriptionFormValues = {
    ...values,
    commonValues: {
      ...values.commonValues,
      merchantRef: makeId('TEST_ORDER_'),
    },
  };
  const request = buildSubscriptionRequestFromForm(env, previewValues, makeId);

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

/**
 * Builds the API response returned when the backend generates a new subscription merchant reference.
 *
 * @param merchantRef Newly generated merchant reference.
 * @returns Response payload consumed by the operator UI.
 */
export const buildSubscriptionMerchantRefResponse = (
  merchantRef: string,
): SubscriptionMerchantRefResponse => ({
  ok: true,
  merchantRef,
});
