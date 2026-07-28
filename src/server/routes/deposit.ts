import type { DepositServiceDeps } from '../../deposit/service';
import { createDepositService, getRequestedDepositChannel } from '../../deposit/service';
import { validateDepositForm } from '../../deposit/validation';
import type { DepositRequestValues } from '../../deposit/web';
import { handlePresetBackedRoute, type CheckoutUrlPolicy } from './_shared';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const depositCheckoutUrlPolicy: CheckoutUrlPolicy = {
  service: 'deposit',
  resolve: (response) => {
    const checkout = isRecord(response) && isRecord(response.checkout) ? response.checkout : null;
    const url = checkout?.checkout_url;
    return typeof url === 'string' && url.trim() ? url.trim() : null;
  },
};

export const handleDepositRoute = async ({
  request,
  url,
  deps,
}: {
  request: Request;
  url: URL;
  deps: DepositServiceDeps;
}): Promise<Response | null> => {
  return handlePresetBackedRoute<
    ReturnType<typeof getRequestedDepositChannel>,
    DepositRequestValues,
    unknown,
    unknown,
    ReturnType<typeof createDepositService>,
    Awaited<ReturnType<ReturnType<typeof createDepositService>['getDefaultsForTarget']>>,
    Awaited<ReturnType<ReturnType<typeof createDepositService>['execute']>>
  >({
    request,
    url,
    defaultsPath: '/api/deposit/defaults',
    previewPath: '/api/deposit/preview',
    createPath: '/api/deposit/create',
    merchantRefPath: '/api/deposit/merchant-ref',
    createService: () => createDepositService(deps),
    resolveChannel: getRequestedDepositChannel,
    resolveChannelFromValues: (values) => values.channel,
    getDefaults: (service, channel, targetEnvironment) => service.getDefaultsForTarget(channel, targetEnvironment),
    generateMerchantRef: (service) => service.generateMerchantRef(),
    preview: (service, values, targetEnvironment) => service.preview(values, targetEnvironment),
    execute: (service, values, targetEnvironment) => service.execute(values, targetEnvironment),
    checkoutUrlPolicy: depositCheckoutUrlPolicy,
    validate: (values, bundle) =>
      validateDepositForm(
        values,
        bundle.commonSchema as Parameters<typeof validateDepositForm>[1],
        bundle.channelSchema as Parameters<typeof validateDepositForm>[2],
      ),
    onRouteError: (error) => {
      throw error;
    },
  });
};
