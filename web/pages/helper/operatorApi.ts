import type {
  DepositCreateResponse,
  DepositDefaultsResponse,
  DepositMerchantRefResponse,
  DepositPreviewResponse,
  DepositRequestValues,
} from '../../../src/deposit/web';
import type {
  PayoutDefaultsResponse,
  PayoutMerchantReferenceResponse,
  PayoutPreviewResponse,
  PayoutRequestValues,
} from '../../../src/payout/web';
import type {
  SubscriptionDefaultsResponse,
  SubscriptionMerchantRefResponse,
  SubscriptionPreviewResponse,
  SubscriptionRequestValues,
} from '../../../src/subscription/web';
import type { OperatorEnvironmentMode } from './operatorShared';
import {
  buildChannelQuery,
  fetchOperatorJson,
  postOperatorJson,
  sendOperatorRequest,
} from './operatorRequest';

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
  fetchOperatorJson<DepositDefaultsResponse>(`${depositDefaultsEndpoint}${buildChannelQuery(channel)}`, mode);

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
  postOperatorJson<DepositPreviewResponse>(depositPreviewEndpoint, mode, form);

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
  postOperatorJson<DepositCreateResponse>(depositCreateEndpoint, mode, form);

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
  postOperatorJson<DepositMerchantRefResponse>(depositMerchantRefEndpoint, mode, {});

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
  fetchOperatorJson<PayoutDefaultsResponse>(`${payoutDefaultsEndpoint}${buildChannelQuery(channel)}`, mode);

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
  postOperatorJson<PayoutPreviewResponse>(payoutPreviewEndpoint, mode, form);

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
  sendOperatorRequest(payoutCreateEndpoint, mode, form);

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
  postOperatorJson<PayoutMerchantReferenceResponse>(payoutMerchantReferenceEndpoint, mode, {});

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
  fetchOperatorJson<SubscriptionDefaultsResponse>(
    `${subscriptionDefaultsEndpoint}${buildChannelQuery(channel)}`,
    mode,
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
  postOperatorJson<SubscriptionPreviewResponse>(subscriptionPreviewEndpoint, mode, form);

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
  sendOperatorRequest(subscriptionCreateEndpoint, mode, form);

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
  postOperatorJson<SubscriptionMerchantRefResponse>(subscriptionMerchantRefEndpoint, mode, {});
