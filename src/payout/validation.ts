import type { PayoutFieldMap, PayoutFieldSchema, PayoutFormValues } from './web';

const getRecordValue = (
  source: Record<string, unknown>,
  key: string,
): unknown => source[key];

const isBlank = (value: unknown): boolean => typeof value === 'string' && !value.trim();

const validateField = (
  schema: PayoutFieldSchema,
  value: unknown,
  path: string,
): string | undefined => {
  if (schema.kind === 'object') {
    const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

    for (const [key, childSchema] of Object.entries(schema.fields)) {
      const childError = validateField(childSchema, getRecordValue(record, key), `${path}.${key}`);
      if (childError) return childError;
    }

    return undefined;
  }

  if (schema.kind === 'array') {
    if (!Array.isArray(value)) {
      return schema.required ? `${path} is required` : undefined;
    }

    for (const [index, item] of value.entries()) {
      const itemError = validateField(schema.itemSchema, item, `${path}[${index}]`);
      if (itemError) return itemError;
    }

    return undefined;
  }

  if (schema.kind === 'boolean') {
    if (schema.required && typeof value !== 'boolean') {
      return `${path} is required`;
    }

    return undefined;
  }

  if (schema.required && (value === undefined || value === null || isBlank(value))) {
    return `${path} is required`;
  }

  return undefined;
};

const validateMap = (
  schemaMap: PayoutFieldMap,
  values: Record<string, unknown>,
): string | undefined => {
  for (const [key, schema] of Object.entries(schemaMap)) {
    const error = validateField(schema, values[key], key);
    if (error) return error;
  }

  return undefined;
};

/**
 * Validates a payout form payload against the active common and channel schemas.
 *
 * @param value Submitted payout form values.
 * @param commonSchema Shared field schema for all channels.
 * @param channelSchema Channel-specific schema for the selected payout method.
 * @returns A validation error message when a required field is missing; otherwise `undefined`.
 */
export const validatePayoutForm = (
  value: PayoutFormValues,
  commonSchema: PayoutFieldMap,
  channelSchema: PayoutFieldMap,
): string | undefined => {
  const commonError = validateMap(commonSchema, value.commonValues as Record<string, unknown>);
  if (commonError) return commonError;

  return validateMap(channelSchema, value.channelValues);
};
