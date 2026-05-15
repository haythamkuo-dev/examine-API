import { validateFormSections } from '../core/formValidation';
import type { SubscriptionFieldMap, SubscriptionFormValues } from './web';

/**
 * Validates a subscription form payload against the active common and channel schemas.
 *
 * @param value Submitted subscription form values.
 * @param commonSchema Shared field schema for all channels.
 * @param channelSchema Channel-specific schema for the selected subscription flow.
 * @returns A validation error message when a required field is missing; otherwise `undefined`.
 */
export const validateSubscriptionForm = (
  value: SubscriptionFormValues,
  commonSchema: SubscriptionFieldMap,
  channelSchema: SubscriptionFieldMap,
): string | undefined =>
  validateFormSections(
    {
      commonValues: value.commonValues as Record<string, unknown>,
      channelValues: value.channelValues,
    },
    commonSchema,
    channelSchema,
  );
