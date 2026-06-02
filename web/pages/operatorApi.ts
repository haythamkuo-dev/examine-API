import type {
  DepositCreateResponse,
  DepositDefaultsResponse,
  DepositDefaultsSavedResponse,
  DepositFormValues,
  DepositMerchantRefResponse,
  DepositPreviewResponse,
  DepositRequestValues,
} from '../../src/deposit/web';
import type {
  PayoutDefaultsResponse,
  PayoutDefaultsSavedResponse,
  PayoutFormValues,
  PayoutMerchantReferenceResponse,
  PayoutPreviewResponse,
  PayoutRequestValues,
} from '../../src/payout/web';
import type {
  SubscriptionDefaultsResponse,
  SubscriptionDefaultsSavedResponse,
  SubscriptionFormValues,
  SubscriptionMerchantRefResponse,
  SubscriptionPreviewResponse,
  SubscriptionRequestValues,
} from '../../src/subscription/web';
import {
  buildOperatorHeaders,
  fetchJson,
  resolveApiUrl,
  type OperatorEnvironmentMode,
} from './operatorShared';

const depositDefaultsEndpoint = '/api/deposit/defaults';
const depositPreviewEndpoint = '/api/deposit/preview';
const depositCreateEndpoint = '/api/deposit/create';
const depositMerchantRefEndpoint = '/api/deposit/merchant-ref';

const payoutDefaultsEndpoint = '/api/payout/defaults';
const payoutPreviewEndpoint = '/api/payout/preview';
const payoutCreateEndpoint = '/api/payout/create';
const payoutMerchantReferenceEndpoint = '/api/payout/merchant-reference';

const subscriptionDefaultsEndpoint = '/api/subscription/defaults';
const subscriptionPreviewEndpoint = '/api/subscription/preview';
const subscriptionCreateEndpoint = '/api/subscription/create';
const subscriptionMerchantRefEndpoint = '/api/subscription/merchant-ref';

const buildChannelQuery = (channel?: string): string =>
  channel ? `?channel=${encodeURIComponent(channel)}` : '';

/**
 * Requests deposit default form data for the selected channel.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param channel Optional channel code to load.
 * @returns Deposit defaults payload from the API.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const fetchDepositDefaults = (
  mode: OperatorEnvironmentMode,
  channel?: string,
): Promise<DepositDefaultsResponse> =>
  fetchJson<DepositDefaultsResponse>(`${depositDefaultsEndpoint}${buildChannelQuery(channel)}`, {
    headers: buildOperatorHeaders(mode),
  });

/**
 * Requests a deposit payload preview for the current form values.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param form Deposit form values to preview.
 * @returns Deposit preview payload from the API.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const previewDepositRequest = (
  mode: OperatorEnvironmentMode,
  form: DepositRequestValues,
): Promise<DepositPreviewResponse> =>
  fetchJson<DepositPreviewResponse>(depositPreviewEndpoint, {
    method: 'POST',
    headers: buildOperatorHeaders(mode),
    body: JSON.stringify(form),
  });

/**
 * Sends a deposit create request for the current form values.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param form Deposit form values to submit.
 * @returns Deposit create response payload from the API.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const createDepositRequest = (
  mode: OperatorEnvironmentMode,
  form: DepositRequestValues,
): Promise<DepositCreateResponse> =>
  fetchJson<DepositCreateResponse>(depositCreateEndpoint, {
    method: 'POST',
    headers: buildOperatorHeaders(mode),
    body: JSON.stringify(form),
  });

/**
 * Requests a fresh deposit merchant reference from the API.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @returns Generated deposit merchant reference payload.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const generateDepositMerchantRef = (
  mode: OperatorEnvironmentMode,
): Promise<DepositMerchantRefResponse> =>
  fetchJson<DepositMerchantRefResponse>(depositMerchantRefEndpoint, {
    method: 'POST',
    headers: buildOperatorHeaders(mode),
  });

/**
 * Saves deposit defaults for the active channel.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param channel Deposit channel being saved.
 * @param form Deposit form payload to persist.
 * @returns Saved deposit defaults payload from the API.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const saveDepositDefaults = (
  mode: OperatorEnvironmentMode,
  channel: string,
  form: DepositFormValues,
): Promise<DepositDefaultsSavedResponse> =>
  fetchJson<DepositDefaultsSavedResponse>(
    `${depositDefaultsEndpoint}?channel=${encodeURIComponent(channel)}`,
    {
      method: 'PUT',
      headers: buildOperatorHeaders(mode),
      body: JSON.stringify(form),
    },
  );

/**
 * Requests payout default form data for the selected channel.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param channel Optional channel code to load.
 * @returns Payout defaults payload from the API.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const fetchPayoutDefaults = (
  mode: OperatorEnvironmentMode,
  channel?: string,
): Promise<PayoutDefaultsResponse> =>
  fetchJson<PayoutDefaultsResponse>(`${payoutDefaultsEndpoint}${buildChannelQuery(channel)}`, {
    headers: buildOperatorHeaders(mode),
  });

/**
 * Requests a payout payload preview for the current form values.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param form Payout form values to preview.
 * @returns Payout preview payload from the API.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const previewPayoutRequest = (
  mode: OperatorEnvironmentMode,
  form: PayoutRequestValues,
): Promise<PayoutPreviewResponse> =>
  fetchJson<PayoutPreviewResponse>(payoutPreviewEndpoint, {
    method: 'POST',
    headers: buildOperatorHeaders(mode),
    body: JSON.stringify(form),
  });

/**
 * Sends a payout create request for the current form values.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param form Payout form values to submit.
 * @returns Raw fetch response for downstream normalization.
 * @throws {Error} When fetch cannot complete.
 */
export const createPayoutRequest = (
  mode: OperatorEnvironmentMode,
  form: PayoutRequestValues,
): Promise<Response> =>
  fetch(resolveApiUrl(payoutCreateEndpoint), {
    method: 'POST',
    headers: buildOperatorHeaders(mode),
    body: JSON.stringify(form),
  });

/**
 * Requests a fresh payout merchant reference from the API.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @returns Generated payout merchant reference payload.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const generatePayoutMerchantReference = (
  mode: OperatorEnvironmentMode,
): Promise<PayoutMerchantReferenceResponse> =>
  fetchJson<PayoutMerchantReferenceResponse>(payoutMerchantReferenceEndpoint, {
    method: 'POST',
    headers: buildOperatorHeaders(mode),
  });

/**
 * Saves payout defaults for the active channel.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param channel Payout channel being saved.
 * @param form Payout form payload to persist.
 * @returns Saved payout defaults payload from the API.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const savePayoutDefaults = (
  mode: OperatorEnvironmentMode,
  channel: string,
  form: PayoutFormValues,
): Promise<PayoutDefaultsSavedResponse> =>
  fetchJson<PayoutDefaultsSavedResponse>(
    `${payoutDefaultsEndpoint}?channel=${encodeURIComponent(channel)}`,
    {
      method: 'PUT',
      headers: buildOperatorHeaders(mode),
      body: JSON.stringify(form),
    },
  );

/**
 * Requests subscription default form data for the selected channel.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param channel Optional channel code to load.
 * @returns Subscription defaults payload from the API.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const fetchSubscriptionDefaults = (
  mode: OperatorEnvironmentMode,
  channel?: string,
): Promise<SubscriptionDefaultsResponse> =>
  fetchJson<SubscriptionDefaultsResponse>(
    `${subscriptionDefaultsEndpoint}${buildChannelQuery(channel)}`,
    {
      headers: buildOperatorHeaders(mode),
    },
  );

/**
 * Requests a subscription payload preview for the current form values.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param form Subscription form values to preview.
 * @returns Subscription preview payload from the API.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const previewSubscriptionRequest = (
  mode: OperatorEnvironmentMode,
  form: SubscriptionRequestValues,
): Promise<SubscriptionPreviewResponse> =>
  fetchJson<SubscriptionPreviewResponse>(subscriptionPreviewEndpoint, {
    method: 'POST',
    headers: buildOperatorHeaders(mode),
    body: JSON.stringify(form),
  });

/**
 * Sends a subscription create request for the current form values.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param form Subscription form values to submit.
 * @returns Raw fetch response for downstream normalization.
 * @throws {Error} When fetch cannot complete.
 */
export const createSubscriptionRequest = (
  mode: OperatorEnvironmentMode,
  form: SubscriptionRequestValues,
): Promise<Response> =>
  fetch(resolveApiUrl(subscriptionCreateEndpoint), {
    method: 'POST',
    headers: buildOperatorHeaders(mode),
    body: JSON.stringify(form),
  });

/**
 * Requests a fresh subscription merchant reference from the API.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @returns Generated subscription merchant reference payload.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const generateSubscriptionMerchantRef = (
  mode: OperatorEnvironmentMode,
): Promise<SubscriptionMerchantRefResponse> =>
  fetchJson<SubscriptionMerchantRefResponse>(subscriptionMerchantRefEndpoint, {
    method: 'POST',
    headers: buildOperatorHeaders(mode),
  });

/**
 * Saves subscription defaults for the active channel.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @param channel Subscription channel being saved.
 * @param form Subscription form payload to persist.
 * @returns Saved subscription defaults payload from the API.
 * @throws {ApiRequestError} When the API response is non-OK, empty, non-JSON, or malformed.
 */
export const saveSubscriptionDefaults = (
  mode: OperatorEnvironmentMode,
  channel: string,
  form: SubscriptionFormValues,
): Promise<SubscriptionDefaultsSavedResponse> =>
  fetchJson<SubscriptionDefaultsSavedResponse>(
    `${subscriptionDefaultsEndpoint}?channel=${encodeURIComponent(channel)}`,
    {
      method: 'PUT',
      headers: buildOperatorHeaders(mode),
      body: JSON.stringify(form),
    },
  );
