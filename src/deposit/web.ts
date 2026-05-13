import type { CliEnv, DepositChannel } from '../core/env';
import {
  createStructuredDepositRequest,
  type DepositCollectOverride,
} from '../domains/deposit';
import type { CommandRequest, CommandResult } from '../runner';
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
  | DepositSelectFieldSchema
  | DepositBooleanFieldSchema
  | DepositObjectFieldSchema
  | DepositArrayFieldSchema;

export type DepositFieldMap = Record<string, DepositFieldSchema>;

export type DepositCommonValues = {
  productNo: string;
  merchantRef: string;
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

export type DepositDefaultsResponse = {
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
};

export type DepositDefaultsSavedResponse = {
  ok: true;
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

export const buildDepositRequestFromForm = (
  env: CliEnv,
  values: DepositFormValues,
  makeId: (prefix: string) => string,
): CommandRequest =>
  createStructuredDepositRequest(env, values.channel, makeId, {
    commonValues: values.commonValues,
    channelValues: values.channelValues,
  });

export const createLegacyDepositFormValues = (
  channel: DepositChannel,
  commonValues: Partial<DepositCommonValues> = {},
  collect: DepositCollectOverride = DEFAULT_DEPOSIT_COLLECT,
): DepositFormValues => ({
  channel,
  commonValues: {
    productNo: commonValues.productNo || '',
    merchantRef: commonValues.merchantRef || '',
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

export const buildDepositPreviewResponse = (
  env: CliEnv,
  values: DepositFormValues,
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
