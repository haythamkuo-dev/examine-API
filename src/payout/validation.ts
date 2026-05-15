import { validateFormSections } from '../core/formValidation';
import type { PayoutFieldMap, PayoutFormValues } from './web';

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
  return validateFormSections(
    {
      commonValues: value.commonValues as Record<string, unknown>,
      channelValues: value.channelValues,
    },
    commonSchema,
    channelSchema,
  );
};
