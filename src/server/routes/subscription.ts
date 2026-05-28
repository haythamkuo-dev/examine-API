import type { SubscriptionServiceDeps } from '../../subscription/service';
import { resolveTargetEnvironment } from '../../core/targetEnvironment';
import { SubscriptionPlanConfigError } from '../../core/env';
import {
  createSubscriptionService,
  getRequestedSubscriptionChannel,
} from '../../subscription/service';
import { validateSubscriptionForm } from '../../subscription/validation';
import { missingSubscriptionPlanCode, type SubscriptionFormValues } from '../../subscription/web';
import { badRequest, json, readJson } from '../http';

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
  const service = createSubscriptionService(deps);
  let targetEnvironment;
  try {
    targetEnvironment = resolveTargetEnvironment(request.headers);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : String(error));
  }

  if (request.method === 'GET' && url.pathname === '/api/subscription/defaults') {
    try {
      return json(
        await service.getDefaultsForTarget(getRequestedSubscriptionChannel(url), targetEnvironment),
      );
    } catch (routeError) {
      if (routeError instanceof SubscriptionPlanConfigError) {
        return subscriptionPlanBadRequest(routeError.message);
      }

      throw routeError;
    }
  }

  if (request.method === 'PUT' && url.pathname === '/api/subscription/defaults') {
    const channel = getRequestedSubscriptionChannel(url);
    const values = await readJson<SubscriptionFormValues>(request);
    try {
      const bundle = await service.getDefaultsForTarget(channel, targetEnvironment);
      const error = validateSubscriptionForm(values, bundle.commonSchema, bundle.channelSchema);
      if (error) return badRequest(error);
      return json(await service.saveDefaultsForTarget(channel, values, targetEnvironment));
    } catch (routeError) {
      if (routeError instanceof SubscriptionPlanConfigError) {
        return subscriptionPlanBadRequest(routeError.message);
      }

      throw routeError;
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/subscription/merchant-ref') {
    return json(service.generateMerchantRef());
  }

  if (request.method === 'POST' && url.pathname === '/api/subscription/preview') {
    const values = await readJson<SubscriptionFormValues>(request);
    try {
      const bundle = await service.getDefaultsForTarget(values.channel, targetEnvironment);
      const error = validateSubscriptionForm(values, bundle.commonSchema, bundle.channelSchema);
      if (error) return badRequest(error);
      return json(service.preview(values, targetEnvironment));
    } catch (routeError) {
      if (routeError instanceof SubscriptionPlanConfigError) {
        return subscriptionPlanBadRequest(routeError.message);
      }

      throw routeError;
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/subscription/create') {
    const values = await readJson<SubscriptionFormValues>(request);
    try {
      const bundle = await service.getDefaultsForTarget(values.channel, targetEnvironment);
      const error = validateSubscriptionForm(values, bundle.commonSchema, bundle.channelSchema);
      if (error) return badRequest(error);
      const result = await service.execute(values, targetEnvironment);
      return json(result, { status: result.ok ? 200 : result.status || 500 });
    } catch (routeError) {
      if (routeError instanceof SubscriptionPlanConfigError) {
        return subscriptionPlanBadRequest(routeError.message);
      }

      throw routeError;
    }
  }

  return null;
};
