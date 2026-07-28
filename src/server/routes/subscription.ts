import type { SubscriptionServiceDeps } from '../../subscription/service';
import { SubscriptionPlanConfigError } from '../../core/env';
import {
  createSubscriptionService,
  getRequestedSubscriptionChannel,
} from '../../subscription/service';
import { validateSubscriptionForm } from '../../subscription/validation';
import {
  missingSubscriptionPlanCode,
  type SubscriptionRequestValues,
} from '../../subscription/web';
import { AppError } from '../errors';
import { handlePresetBackedRoute, type CheckoutUrlPolicy } from './_shared';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const subscriptionCheckoutUrlPolicy: CheckoutUrlPolicy = {
  resolve: (response) => {
    const checkout = isRecord(response) && isRecord(response.checkout) ? response.checkout : null;
    const url = checkout?.cashier_url;
    return typeof url === 'string' && url.trim() ? url.trim() : null;
  },
};

const subscriptionPlanError = (message: string): AppError =>
  new AppError({
    status: 400,
    code: missingSubscriptionPlanCode,
    message,
  });

/**
 * Handles subscription API routes for defaults, preview, and create requests.
 *
 * @param options Route invocation options.
 * @param options.request Incoming HTTP request.
 * @param options.url Parsed request URL.
 * @param options.deps Runtime subscription service dependencies.
 * @returns A response when the route matches, otherwise `null`.
 * @throws {SyntaxError} When the request body is not valid JSON.
 */
export const handleSubscriptionRoute = async ({
  request,
  url,
  deps,
}: {
  request: Request;
  url: URL;
  deps: SubscriptionServiceDeps;
}): Promise<Response | null> => {
  return handlePresetBackedRoute<
    ReturnType<typeof getRequestedSubscriptionChannel>,
    SubscriptionRequestValues,
    unknown,
    unknown,
    ReturnType<typeof createSubscriptionService>,
    Awaited<ReturnType<ReturnType<typeof createSubscriptionService>['getDefaultsForTarget']>>,
    Awaited<ReturnType<ReturnType<typeof createSubscriptionService>['execute']>>,
    AppError
  >({
    request,
    url,
    defaultsPath: '/api/subscription/defaults',
    previewPath: '/api/subscription/preview',
    createPath: '/api/subscription/create',
    merchantRefPath: '/api/subscription/merchant-ref',
    createService: () => createSubscriptionService(deps),
    resolveChannel: getRequestedSubscriptionChannel,
    resolveChannelFromValues: (values) => values.channel,
    getDefaults: (service, channel, targetEnvironment) => service.getDefaultsForTarget(channel, targetEnvironment),
    generateMerchantRef: (service) => service.generateMerchantRef(),
    preview: (service, values, targetEnvironment) => service.preview(values, targetEnvironment),
    execute: (service, values, targetEnvironment) => service.execute(values, targetEnvironment),
    checkoutUrlPolicy: subscriptionCheckoutUrlPolicy,
    validate: (values, bundle) =>
      validateSubscriptionForm(
        values,
        bundle.commonSchema as Parameters<typeof validateSubscriptionForm>[1],
        bundle.channelSchema as Parameters<typeof validateSubscriptionForm>[2],
      ),
    onRouteError: (error) => {
      if (error instanceof SubscriptionPlanConfigError) {
        return subscriptionPlanError(error.message);
      }

      throw error;
    },
  });
};
