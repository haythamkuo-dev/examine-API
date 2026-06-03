import type { PayoutServiceDeps } from '../../payout/service';
import { createPayoutService, getRequestedPayoutChannel } from '../../payout/service';
import { validatePayoutForm } from '../../payout/validation';
import type { PayoutFormValues, PayoutRequestValues } from '../../payout/web';
import { handlePresetBackedRoute } from './_shared';

/**
 * Handles payout API routes for defaults, preview, create, and preset persistence.
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
    PayoutFormValues,
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
    saveDefaults: (service, channel, values, targetEnvironment) =>
      service.saveDefaultsForTarget(channel, values, targetEnvironment),
    generateMerchantRef: (service) => service.generateMerchantReference(),
    preview: (service, values, targetEnvironment) => service.preview(values, targetEnvironment),
    execute: (service, values, targetEnvironment) => service.execute(values, targetEnvironment),
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
