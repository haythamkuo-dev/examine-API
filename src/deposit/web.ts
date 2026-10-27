import {
  resolveDepositApiKey,
  type CliEnv,
  type DepositChannel,
} from '../core/env';
import {
  createStructuredDepositRequest,
  type DepositCollectOverride,
} from '../domains/deposit';
import type { CommandRequest, CommandResult } from '../runner';
import { maskRequestHeaders } from '../utils';
import { getRequestFailureHint } from './failureHint';

export type DepositFieldOption = {
  label: string;
  value: string;
};

type DepositFieldSchemaBase = {
  label: string;
  required?: boolean;
  helperText?: string;
};

export type DepositTextFieldSchema = DepositFieldSchemaBase & {
  kind: 'text' | 'textarea';
  placeholder?: string;
};

export type DepositNumberFieldSchema = DepositFieldSchemaBase & {
  kind: 'number';
  placeholder?: string;
};

export type DepositSelectFieldSchema = DepositFieldSchemaBase & {
  kind: 'select';
  options: DepositFieldOption[];
};

export type DepositBooleanFieldSchema = DepositFieldSchemaBase & {
  kind: 'boolean';
};

export type DepositObjectFieldSchema = DepositFieldSchemaBase & {
  kind: 'object';
  fields: DepositFieldMap;
};

export type DepositArrayFieldSchema = DepositFieldSchemaBase & {
  kind: 'array';
  itemLabel: string;
  itemSchema: DepositObjectFieldSchema;
};

export type DepositFieldSchema =
  | DepositTextFieldSchema
  | DepositNumberFieldSchema
  | DepositSelectFieldSchema
  | DepositBooleanFieldSchema
  | DepositObjectFieldSchema
  | DepositArrayFieldSchema;

export type DepositFieldMap = Record<string, DepositFieldSchema>;

export type DepositCommonValues = {
  productNo: string;
  merchantRef?: string;
  amount: string;
  currencyCode: string;
  returnUrl: string;
};

export type DepositChannelValues = Record<string, unknown>;

export type DepositFormValues = {
  channel: DepositChannel;
  commonValues: DepositCommonValues;
  channelValues: DepositChannelValues;
};

export type DepositRequestValues = DepositFormValues & {
  apiKey?: string;
};

export type DepositDefaultsResponse = {
  apiKey: string;
  availableChannels: DepositChannel[];
  channel: DepositChannel;
  commonSchema: DepositFieldMap;
  channelSchema: DepositFieldMap;
  form: DepositFormValues;
};

export type DepositPreviewResponse = {
  request: {
    name: string;
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload: unknown;
  };
};

export type DepositCreateResponse = CommandResult & {
  hint?: string;
  checkoutUrl?: string | null;
};

export type DepositMerchantRefResponse = {
  ok: true;
  merchantRef: string;
};

export type DepositDefaultsSavedResponse = {
  ok: true;
  apiKey: string;
  availableChannels: DepositChannel[];
  channel: DepositChannel;
  commonSchema: DepositFieldMap;
  channelSchema: DepositFieldMap;
  form: DepositFormValues;
};

export const DEFAULT_DEPOSIT_COLLECT: DepositCollectOverride = {
  country_code: 'US',
  product_detail: 'Collect order for %s',
  product_name: 'Hugo industry',
  shopper_reference: 'CUSTOMER_001',
  origin: 'https://www.amazon.com/',
};

/**
 * Builds a structured deposit request from editable form values.
 *
 * @param env Runtime environment containing endpoint and credential settings.
 * @param values Deposit form values from the web UI.
 * @param makeId ID factory used by the domain to create the final merchant reference.
 * @returns The runner-compatible deposit request.
 * @throws {TypeError} When the form payload shape cannot be composed into a deposit request.
 */
export const buildDepositRequestFromForm = (
  env: CliEnv,
  values: DepositRequestValues,
  makeId: (prefix: string) => string,
): CommandRequest =>
  createStructuredDepositRequest(env, values.channel, makeId, {
    apiKey: values.apiKey?.trim() || undefined,
    commonValues: values.commonValues,
    channelValues: values.channelValues,
  });

/**
 * Creates legacy deposit form values for CLI compatibility.
 *
 * @param channel Deposit channel selected by the caller.
 * @param commonValues Optional legacy common values; merchant reference is ignored as runtime-only input.
 * @param collect Optional collect payload template.
 * @returns A deposit form with compatible channel values and no persisted merchant reference.
 * @throws {TypeError} When the supplied collect value cannot be represented as form data.
 */
export const createLegacyDepositFormValues = (
  channel: DepositChannel,
  commonValues: Partial<DepositCommonValues> = {},
  collect: DepositCollectOverride = DEFAULT_DEPOSIT_COLLECT,
): DepositFormValues => ({
  channel,
  commonValues: {
    productNo: commonValues.productNo || '',
    amount: commonValues.amount || '',
    currencyCode: commonValues.currencyCode || '',
    returnUrl: commonValues.returnUrl || '',
  },
  channelValues: {
    payment_order: {
      collect,
    },
  },
});

/**
 * Builds a masked deposit preview without sending a third-party request.
 *
 * @param env Runtime environment containing endpoint and credential settings.
 * @param values Deposit form values from the web UI.
 * @param makeId ID factory used by the domain to create the final merchant reference.
 * @returns A preview-safe representation of the outbound request.
 * @throws {TypeError} When the form payload shape cannot be composed into a deposit request.
 */
export const buildDepositPreviewResponse = (
  env: CliEnv,
  values: DepositRequestValues,
  makeId: (prefix: string) => string,
): DepositPreviewResponse => {
  const request = buildDepositRequestFromForm(env, values, makeId);

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

export const buildDepositCreateResponse = (result: CommandResult): DepositCreateResponse => ({
  ...result,
  hint: getRequestFailureHint(result),
});

/**
 * Builds the API response returned when the backend generates a new deposit merchant reference.
 *
 * @param merchantRef Newly generated merchant reference.
 * @returns Response payload consumed by the operator UI.
 */
export const buildDepositMerchantRefResponse = (
  merchantRef: string,
): DepositMerchantRefResponse => ({
  ok: true,
  merchantRef,
});

/**
 * Builds the target-aware deposit defaults response API key for the selected channel.
 *
 * @param env Runtime environment containing channel-scoped deposit credentials.
 * @param channel Deposit channel selected by the caller.
 * @returns The default API key that should populate the operator form.
 */
export const getDepositDefaultsApiKey = (env: CliEnv, channel: DepositChannel): string =>
  resolveDepositApiKey(env, channel);
