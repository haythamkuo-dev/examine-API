import { validateCodeFormatRules } from '../core/codeFormatValidation';
import { validateFormSections } from '../core/formValidation';
import type { DepositFieldMap, DepositFormValues } from './web';

const depositValidationRules = [
  {
    path: ['commonValues', 'productNo'],
    pattern: /^DEP-[A-Za-z0-9_-]+$/,
    message: 'commonValues.productNo must be a valid deposit product code',
  },
] as const;

/**
 * Validates a deposit form payload against the active common and channel schemas.
 *
 * @param value Submitted deposit form values.
 * @param commonSchema Shared field schema for all channels.
 * @param channelSchema Channel-specific schema for the selected deposit method.
 * @returns A validation error message when a required field is missing or the deposit product code is invalid; otherwise `undefined`.
 */
export const validateDepositForm = (
  value: DepositFormValues,
  commonSchema: DepositFieldMap,
  channelSchema: DepositFieldMap,
): string | undefined => {
  const schemaError = validateFormSections(
    {
      commonValues: value.commonValues as Record<string, unknown>,
      channelValues: value.channelValues,
    },
    commonSchema,
    channelSchema,
  );

  if (schemaError) {
    return schemaError;
  }

  return validateCodeFormatRules(value as unknown as Record<string, unknown>, depositValidationRules);
};
