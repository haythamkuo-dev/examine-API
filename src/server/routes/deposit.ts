import type { DepositServiceDeps } from '../../deposit/service';
import { resolveTargetEnvironment } from '../../core/targetEnvironment';
import { createDepositService, getRequestedDepositChannel } from '../../deposit/service';
import { validateDepositForm } from '../../deposit/validation';
import type { DepositFormValues, DepositRequestValues } from '../../deposit/web';
import { badRequest, json, readJson } from '../http';

export const handleDepositRoute = async ({
  request,
  url,
  deps,
}: {
  request: Request;
  url: URL;
  deps: DepositServiceDeps;
}): Promise<Response | null> => {
  const service = createDepositService(deps);
  let targetEnvironment;
  try {
    targetEnvironment = resolveTargetEnvironment(request.headers);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : String(error));
  }

  if (request.method === 'GET' && url.pathname === '/api/deposit/defaults') {
    return json(await service.getDefaultsForTarget(getRequestedDepositChannel(url), targetEnvironment));
  }

  if (request.method === 'PUT' && url.pathname === '/api/deposit/defaults') {
    const channel = getRequestedDepositChannel(url);
    const values = await readJson<DepositRequestValues>(request);
    const bundle = await service.getDefaultsForTarget(channel, targetEnvironment);
    const error = validateDepositForm(values, bundle.commonSchema, bundle.channelSchema);
    if (error) return badRequest(error);
    return json(await service.saveDefaultsForTarget(channel, values as DepositFormValues, targetEnvironment));
  }

  if (request.method === 'POST' && url.pathname === '/api/deposit/merchant-ref') {
    return json(service.generateMerchantRef());
  }

  if (request.method === 'POST' && url.pathname === '/api/deposit/preview') {
    const values = await readJson<DepositRequestValues>(request);
    const bundle = await service.getDefaultsForTarget(values.channel, targetEnvironment);
    const error = validateDepositForm(values, bundle.commonSchema, bundle.channelSchema);
    if (error) return badRequest(error);
    return json(service.preview(values, targetEnvironment));
  }

  if (request.method === 'POST' && url.pathname === '/api/deposit/create') {
    const values = await readJson<DepositRequestValues>(request);
    const bundle = await service.getDefaultsForTarget(values.channel, targetEnvironment);
    const error = validateDepositForm(values, bundle.commonSchema, bundle.channelSchema);
    if (error) return badRequest(error);
    const result = await service.execute(values, targetEnvironment);
    return json(result, { status: result.ok ? 200 : result.status || 500 });
  }

  return null;
};
