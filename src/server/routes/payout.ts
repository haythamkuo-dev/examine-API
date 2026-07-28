import type { PayoutServiceDeps } from '../../payout/service';
import { createPayoutService, getRequestedPayoutChannel } from '../../payout/service';
import { validatePayoutForm } from '../../payout/validation';
import type { PayoutRequestValues } from '../../payout/web';
import { handlePresetBackedRoute, type CheckoutUrlPolicy } from './_shared';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const payoutCheckoutUrlPolicy = (warn: (...args: unknown[]) => void): CheckoutUrlPolicy => ({
  service: 'payout',
  resolve: () => null,
  onUnexpected: (response) => {
    if (!isRecord(response) || !isRecord(response.checkout)) return;
    warn('Payout response contains unsupported checkout fields:', Object.keys(response.checkout));
  },
});

/**
 * Handles payout API routes for defaults, preview, and create requests.
 *
 * @param options Route invocation options.
 * @param options.request Incoming HTTP request.
 * @param options.url Parsed request URL.
 * @param options.deps Runtime payout service dependencies.
 * @returns A response when the route matches, otherwise `null`.
 * @throws {SyntaxError} When the request body is not valid JSON.
 */
export const handlePayoutRoute = async ({
  request,
  url,
  deps,
}: {
  request: Request;
  url: URL;
  deps: PayoutServiceDeps;
}): Promise<Response | null> => {
  return handlePresetBackedRoute<
    ReturnType<typeof getRequestedPayoutChannel>,
    PayoutRequestValues,
    unknown,
    unknown,
    ReturnType<typeof createPayoutService>,
    Awaited<ReturnType<ReturnType<typeof createPayoutService>['getDefaultsForTarget']>>,
    Awaited<ReturnType<ReturnType<typeof createPayoutService>['execute']>>
  >({
    request,
    url,
    defaultsPath: '/api/payout/defaults',
    previewPath: '/api/payout/preview',
    createPath: '/api/payout/create',
    merchantRefPath: '/api/payout/merchant-reference',
    createService: () => createPayoutService(deps),
    resolveChannel: getRequestedPayoutChannel,
    resolveChannelFromValues: (values) => values.channel,
    getDefaults: (service, channel, targetEnvironment) => service.getDefaultsForTarget(channel, targetEnvironment),
    generateMerchantRef: (service) => service.generateMerchantReference(),
    preview: (service, values, targetEnvironment) => service.preview(values, targetEnvironment),
    execute: (service, values, targetEnvironment) => service.execute(values, targetEnvironment),
    checkoutUrlPolicy: payoutCheckoutUrlPolicy((...args) => deps.logger.warn(...args)),
    validate: (values, bundle) =>
      validatePayoutForm(
        values,
        bundle.commonSchema as Parameters<typeof validatePayoutForm>[1],
        bundle.channelSchema as Parameters<typeof validatePayoutForm>[2],
      ),
    onRouteError: (error) => {
      throw error;
    },
  });
};
