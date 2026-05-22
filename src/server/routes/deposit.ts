import type { DepositServiceDeps } from '../../deposit/service';
import { resolveTargetEnvironment } from '../../core/targetEnvironment';
import { createDepositService, getRequestedDepositChannel } from '../../deposit/service';
import { validateDepositForm } from '../../deposit/validation';
import type { DepositFormValues } from '../../deposit/web';
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

  if (request.method === 'GET' && url.pathname === '/api/deposit/defaults') {
    return json(await service.getDefaults(getRequestedDepositChannel(url)));
  }

  if (request.method === 'PUT' && url.pathname === '/api/deposit/defaults') {
    const channel = getRequestedDepositChannel(url);
    const values = await readJson<DepositFormValues>(request);
    const bundle = await service.getDefaults(channel);
    const error = validateDepositForm(values, bundle.commonSchema, bundle.channelSchema);
    if (error) return badRequest(error);
    return json(await service.saveDefaults(channel, values));
  }

  if (request.method === 'POST' && url.pathname === '/api/deposit/merchant-ref') {
    return json(service.generateMerchantRef());
  }

  if (request.method === 'POST' && url.pathname === '/api/deposit/preview') {
    let targetEnvironment;
    try {
      targetEnvironment = resolveTargetEnvironment(request.headers);
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : String(error));
    }

    const values = await readJson<DepositFormValues>(request);
    const bundle = await service.getDefaults(values.channel);
    const error = validateDepositForm(values, bundle.commonSchema, bundle.channelSchema);
    if (error) return badRequest(error);
    return json(service.preview(values, targetEnvironment));
  }

  if (request.method === 'POST' && url.pathname === '/api/deposit/create') {
    let targetEnvironment;
    try {
      targetEnvironment = resolveTargetEnvironment(request.headers);
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : String(error));
    }

    const values = await readJson<DepositFormValues>(request);
    const bundle = await service.getDefaults(values.channel);
    const error = validateDepositForm(values, bundle.commonSchema, bundle.channelSchema);
    if (error) return badRequest(error);
    const result = await service.execute(values, targetEnvironment);
    return json(result, { status: result.ok ? 200 : result.status || 500 });
  }

  return null;
};
