import type { PayoutServiceDeps } from '../../payout/service';
import { resolveTargetEnvironment } from '../../core/targetEnvironment';
import { createPayoutService, getRequestedPayoutChannel } from '../../payout/service';
import { validatePayoutForm } from '../../payout/validation';
import type { PayoutFormValues } from '../../payout/web';
import { badRequest, json, readJson } from '../http';

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
  const service = createPayoutService(deps);

  if (request.method === 'GET' && url.pathname === '/api/payout/defaults') {
    return json(await service.getDefaults(getRequestedPayoutChannel(url)));
  }

  if (request.method === 'PUT' && url.pathname === '/api/payout/defaults') {
    const channel = getRequestedPayoutChannel(url);
    const values = await readJson<PayoutFormValues>(request);
    const bundle = await service.getDefaults(channel);
    const error = validatePayoutForm(values, bundle.commonSchema, bundle.channelSchema);
    if (error) return badRequest(error);
    return json(await service.saveDefaults(channel, values));
  }

  if (request.method === 'POST' && url.pathname === '/api/payout/preview') {
    let targetEnvironment;
    try {
      targetEnvironment = resolveTargetEnvironment(request.headers);
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : String(error));
    }

    const values = await readJson<PayoutFormValues>(request);
    const bundle = await service.getDefaults(values.channel);
    const error = validatePayoutForm(values, bundle.commonSchema, bundle.channelSchema);
    if (error) return badRequest(error);
    return json(service.preview(values, targetEnvironment));
  }

  if (request.method === 'POST' && url.pathname === '/api/payout/create') {
    let targetEnvironment;
    try {
      targetEnvironment = resolveTargetEnvironment(request.headers);
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : String(error));
    }

    const values = await readJson<PayoutFormValues>(request);
    const bundle = await service.getDefaults(values.channel);
    const error = validatePayoutForm(values, bundle.commonSchema, bundle.channelSchema);
    if (error) return badRequest(error);
    const result = await service.execute(values, targetEnvironment);
    return json(result, { status: result.ok ? 200 : result.status || 500 });
  }

  return null;
};
