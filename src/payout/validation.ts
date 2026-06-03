import { validateCodeFormatRules } from '../core/codeFormatValidation';
import { validateFormSections } from '../core/formValidation';
import type { PayoutFieldMap, PayoutFormValues } from './web';

const payoutValidationRules = [
  {
    path: ['channelValues', 'product_no'],
    pattern: /^PAY-[A-Za-z0-9_-]+$/,
    message: 'product_no must be a valid payout product code',
  },
] as const;

/**
 * Validates a payout form payload against the active common and channel schemas.
 *
 * @param value Submitted payout form values.
 * @param commonSchema Shared field schema for all channels.
 * @param channelSchema Channel-specific schema for the selected payout method.
 * @returns A validation error message when a required field is missing or the payout product code is invalid; otherwise `undefined`.
 */
export const validatePayoutForm = (
  value: PayoutFormValues,
  commonSchema: PayoutFieldMap,
  channelSchema: PayoutFieldMap,
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

  return validateCodeFormatRules(value as unknown as Record<string, unknown>, payoutValidationRules);
};
