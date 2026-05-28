type ValidationSchemaBase = {
  required?: boolean;
};

type ValidationScalarSchema = ValidationSchemaBase & {
  kind: 'text' | 'textarea' | 'select';
};

type ValidationNumberSchema = ValidationSchemaBase & {
  kind: 'number';
};

type ValidationBooleanSchema = ValidationSchemaBase & {
  kind: 'boolean';
};

export type ValidationSchemaMap = Record<string, ValidationSchema>;

export type ValidationObjectSchema = ValidationSchemaBase & {
  kind: 'object';
  fields: ValidationSchemaMap;
};

export type ValidationArraySchema = ValidationSchemaBase & {
  kind: 'array';
  itemSchema: ValidationSchema;
};

export type ValidationSchema =
  | ValidationScalarSchema
  | ValidationNumberSchema
  | ValidationBooleanSchema
  | ValidationObjectSchema
  | ValidationArraySchema;

const isBlank = (value: unknown): boolean => typeof value === 'string' && !value.trim();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateField = (
  schema: ValidationSchema,
  value: unknown,
  path: string,
): string | undefined => {
  if (schema.kind === 'object') {
    const record = isRecord(value) ? value : {};

    for (const [key, childSchema] of Object.entries(schema.fields)) {
      const childError = validateField(childSchema, record[key], `${path}.${key}`);
      if (childError) {
        return childError;
      }
    }

    return undefined;
  }

  if (schema.kind === 'array') {
    if (!Array.isArray(value)) {
      return schema.required ? `${path} is required` : undefined;
    }

    for (const [index, item] of value.entries()) {
      const itemError = validateField(schema.itemSchema, item, `${path}[${index}]`);
      if (itemError) {
        return itemError;
      }
    }

    return undefined;
  }

  if (schema.kind === 'boolean') {
    if (schema.required && typeof value !== 'boolean') {
      return `${path} is required`;
    }

    return undefined;
  }

  if (schema.kind === 'number') {
    if (value === undefined || value === null || isBlank(value)) {
      return schema.required ? `${path} is required` : undefined;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `${path} must be a number`;
    }

    return undefined;
  }

  if (schema.required && (value === undefined || value === null || isBlank(value))) {
    return `${path} is required`;
  }

  return undefined;
};

/**
 * Validates a flat schema map against a record of values.
 *
 * @param schemaMap Field schema keyed by form field name.
 * @param values Submitted values for the schema map.
 * @returns The first validation error encountered, or `undefined` when valid.
 */
export const validateSchemaMap = <TSchema extends ValidationSchema>(
  schemaMap: Record<string, TSchema>,
  values: Record<string, unknown>,
): string | undefined => {
  for (const [key, schema] of Object.entries(schemaMap)) {
    const error = validateField(schema, values[key], key);
    if (error) {
      return error;
    }
  }

  return undefined;
};

/**
 * Validates shared and channel-specific form sections using the same recursive rules.
 *
 * @param formValues Form payload containing `commonValues` and `channelValues`.
 * @param commonSchema Schema for the shared form section.
 * @param channelSchema Schema for the channel-specific form section.
 * @returns The first validation error encountered, or `undefined` when valid.
 */
export const validateFormSections = <TSchema extends ValidationSchema>(
  formValues: {
    commonValues: Record<string, unknown>;
    channelValues: Record<string, unknown>;
  },
  commonSchema: Record<string, TSchema>,
  channelSchema: Record<string, TSchema>,
): string | undefined => {
  const commonError = validateSchemaMap(commonSchema, formValues.commonValues);
  if (commonError) {
    return commonError;
  }

  return validateSchemaMap(channelSchema, formValues.channelValues);
};
