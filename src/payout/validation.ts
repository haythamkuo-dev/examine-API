import { validateFormSections } from '../core/formValidation';
import type { PayoutFieldMap, PayoutFormValues } from './web';

const payoutProductNoPattern = /^PAY-[A-Za-z0-9_-]+$/;

const validatePayoutProductNo = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  return payoutProductNoPattern.test(value.trim())
    ? undefined
    : 'product_no must be a valid payout product code';
};

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

  return validatePayoutProductNo(value.channelValues.product_no);
};
