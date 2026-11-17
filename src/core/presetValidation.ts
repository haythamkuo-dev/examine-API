import {
  PresetStorageInvalidError,
  readPresetJsonObject,
  type PresetJsonObject,
} from './presetStorage';

const fieldKinds = new Set(['text', 'textarea', 'select', 'number', 'boolean', 'object', 'array']);

/**
 * Checks whether a value is a non-array JSON object.
 *
 * @param value Value to inspect.
 * @returns `true` when the value can be used as a JSON object projection.
 */
export const isPresetJsonObject = (value: unknown): value is PresetJsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Checks whether a value is a non-empty string suitable for a required preset field.
 *
 * @param value Value to inspect.
 * @returns `true` when the value is a non-blank string.
 */
export const isNonBlankPresetString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isPresetFieldSchema = (value: unknown): boolean => {
  if (!isPresetJsonObject(value) || typeof value.kind !== 'string' || !fieldKinds.has(value.kind)) {
    return false;
  }

  if (typeof value.label !== 'string') {
    return false;
  }

  if (value.required !== undefined && typeof value.required !== 'boolean') {
    return false;
  }

  if (value.kind === 'object') {
    return isPresetFieldMap(value.fields);
  }

  if (value.kind === 'array') {
    return typeof value.itemLabel === 'string' && isPresetFieldSchema(value.itemSchema);
  }

  if (value.kind === 'select') {
    return (
      Array.isArray(value.options) &&
      value.options.every(
        (option) =>
          isPresetJsonObject(option) &&
          typeof option.label === 'string' &&
          typeof option.value === 'string',
      )
    );
  }

  return true;
};

/**
 * Checks whether a value is a recursively valid form field schema map.
 *
 * @param value Value to inspect.
 * @returns `true` when every schema entry has a supported field shape.
 */
export const isPresetFieldMap = (value: unknown): value is PresetJsonObject =>
  isPresetJsonObject(value) && Object.values(value).every(isPresetFieldSchema);

/**
 * Reads a JSON preset and applies a domain-specific projection validator.
 *
 * The generic JSON reader deliberately only validates syntax and the top-level
 * object. This helper keeps semantic validation at the domain boundary so a
 * malformed present file cannot be mistaken for an optional seed override.
 *
 * @param filePath Preset source path.
 * @param validate Projection validator returning an internal diagnostic when invalid.
 * @returns The parsed preset after semantic validation.
 * @throws {PresetStorageInvalidError} When the projection is not valid for its domain.
 */
export const readValidatedPresetJsonObject = async <T>(
  filePath: string,
  validate: (value: PresetJsonObject) => string | undefined,
): Promise<T> => {
  const value = await readPresetJsonObject<PresetJsonObject>(filePath);
  const validationError = validate(value);

  if (validationError) {
    throw new PresetStorageInvalidError(validationError, {
      resource: filePath,
    });
  }

  return value as T;
};
