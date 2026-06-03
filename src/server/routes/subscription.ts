import type { SubscriptionServiceDeps } from '../../subscription/service';
import { SubscriptionPlanConfigError } from '../../core/env';
import {
  createSubscriptionService,
  getRequestedSubscriptionChannel,
} from '../../subscription/service';
import { validateSubscriptionForm } from '../../subscription/validation';
import {
  missingSubscriptionPlanCode,
  type SubscriptionFormValues,
  type SubscriptionRequestValues,
} from '../../subscription/web';
import { badRequest, json } from '../http';
import { handlePresetBackedRoute } from './_shared';

const subscriptionPlanBadRequest = (message: string): Response =>
  json({ ok: false, code: missingSubscriptionPlanCode, message }, { status: 400 });

/**
 * Handles subscription API routes for defaults, preview, create, and preset persistence.
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
    SubscriptionFormValues,
    Awaited<ReturnType<ReturnType<typeof createSubscriptionService>['execute']>>,
    Response
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
    saveDefaults: (service, channel, values, targetEnvironment) =>
      service.saveDefaultsForTarget(channel, values, targetEnvironment),
    generateMerchantRef: (service) => service.generateMerchantRef(),
    preview: (service, values, targetEnvironment) => service.preview(values, targetEnvironment),
    execute: (service, values, targetEnvironment) => service.execute(values, targetEnvironment),
    validate: (values, bundle) =>
      validateSubscriptionForm(
        values,
        bundle.commonSchema as Parameters<typeof validateSubscriptionForm>[1],
        bundle.channelSchema as Parameters<typeof validateSubscriptionForm>[2],
      ),
    onRouteError: (error) => {
      if (error instanceof SubscriptionPlanConfigError) {
        return subscriptionPlanBadRequest(error.message);
      }

      throw error;
    },
  });
};
