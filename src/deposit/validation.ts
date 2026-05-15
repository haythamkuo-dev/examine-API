import { validateFormSections } from '../core/formValidation';
import type { DepositFieldMap, DepositFormValues } from './web';

/**
 * Validates a deposit form payload against the active common and channel schemas.
 *
 * @param value Submitted deposit form values.
 * @param commonSchema Shared field schema for all channels.
 * @param channelSchema Channel-specific schema for the selected deposit method.
 * @returns A validation error message when a required field is missing; otherwise `undefined`.
 */
export const validateDepositForm = (
  value: DepositFormValues,
  commonSchema: DepositFieldMap,
  channelSchema: DepositFieldMap,
): string | undefined =>
  validateFormSections(
    {
      commonValues: value.commonValues as Record<string, unknown>,
      channelValues: value.channelValues,
    },
    commonSchema,
    channelSchema,
  );
