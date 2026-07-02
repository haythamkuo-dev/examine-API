import { badRequest, json, readJson } from '../http';
import { resolveTargetEnvironment, type TargetEnvironment } from '../../core/targetEnvironment';

type RouteResponse = Response | null;

export type PresetBackedRouteConfig<
  Channel,
  RequestValues,
  CommonSchema,
  ChannelSchema,
  Service,
  DefaultsResponse,
  CreateResponse,
  RouteError = never,
> = {
  request: Request;
  url: URL;
  defaultsPath: string;
  previewPath: string;
  createPath: string;
  merchantRefPath?: string;
  createService: () => Service;
  resolveChannel: (url: URL) => Channel;
  resolveChannelFromValues: (values: RequestValues) => Channel;
  getDefaults: (
    service: Service,
    channel: Channel,
    targetEnvironment: TargetEnvironment,
  ) => Promise<{
    commonSchema: CommonSchema;
    channelSchema: ChannelSchema;
  } & DefaultsResponse>;
  generateMerchantRef: (service: Service) => unknown;
  preview: (service: Service, values: RequestValues, targetEnvironment: TargetEnvironment) => unknown;
  execute: (service: Service, values: RequestValues, targetEnvironment: TargetEnvironment) => Promise<CreateResponse>;
  validate: (
    values: RequestValues,
    bundle: {
      commonSchema: CommonSchema;
      channelSchema: ChannelSchema;
    },
  ) => string | undefined;
  onRouteError: (error: unknown) => Response | RouteError | Promise<Response | RouteError>;
};

const handleRouteError = async (
  error: unknown,
  onRouteError: (error: unknown) => Response | unknown | Promise<Response | unknown>,
): Promise<RouteResponse> => {
  const handled = await onRouteError(error);
  if (handled instanceof Response) {
    return handled;
  }

  throw error;
};

/**
 * Handles the shared request pipeline for preset-backed routes.
 *
 * @param options Route configuration and domain-specific callbacks.
 * @param options.request Incoming HTTP request.
 * @param options.url Parsed request URL.
 * @param options.defaultsPath GET path for loading defaults.
 * @param options.previewPath POST path for preview requests.
 * @param options.createPath POST path for create requests.
 * @param options.merchantRefPath Optional POST path for merchant reference generation.
 * @param options.createService Factory that creates the route-specific service instance.
 * @param options.resolveChannel Resolver for the channel query parameter.
 * @param options.resolveChannelFromValues Resolver for the request body channel.
 * @param options.getDefaults Loads the defaults bundle for a channel and target environment.
 * @param options.generateMerchantRef Builds a new merchant reference response payload.
 * @param options.preview Builds a preview response for the request body.
 * @param options.execute Executes the upstream request for the request body.
 * @param options.validate Validates request values against the loaded schema bundle.
 * @param options.onRouteError Converts route-specific errors into HTTP responses when needed.
 * @returns A response when the request matches the route, otherwise `null`.
 * @throws {SyntaxError} When the request body is not valid JSON.
 */
export const handlePresetBackedRoute = async <
  Channel,
  RequestValues,
  CommonSchema,
  ChannelSchema,
  Service,
  DefaultsResponse,
  CreateResponse,
  RouteError = never,
>({
  request,
  url,
  defaultsPath,
  previewPath,
  createPath,
  merchantRefPath,
  createService,
  resolveChannel,
  resolveChannelFromValues,
  getDefaults,
  generateMerchantRef,
  preview,
  execute,
  validate,
  onRouteError,
}: PresetBackedRouteConfig<
  Channel,
  RequestValues,
  CommonSchema,
  ChannelSchema,
  Service,
  DefaultsResponse,
  CreateResponse,
  RouteError
>): Promise<RouteResponse> => {
  const service = createService();

  let targetEnvironment: TargetEnvironment;
  try {
    targetEnvironment = resolveTargetEnvironment(request.headers);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : String(error));
  }

  if (request.method === 'GET' && url.pathname === defaultsPath) {
    try {
      return json(await getDefaults(service, resolveChannel(url), targetEnvironment));
    } catch (error) {
      return handleRouteError(error, onRouteError);
    }
  }

  if (merchantRefPath && request.method === 'POST' && url.pathname === merchantRefPath) {
    return json(generateMerchantRef(service));
  }

  if (request.method === 'POST' && url.pathname === previewPath) {
    const values = await readJson<RequestValues>(request);

    try {
      const bundle = await getDefaults(service, resolveChannelFromValues(values), targetEnvironment);
      const error = validate(values, bundle);
      if (error) return badRequest(error);
      return json(preview(service, values, targetEnvironment));
    } catch (error) {
      return handleRouteError(error, onRouteError);
    }
  }

  if (request.method === 'POST' && url.pathname === createPath) {
    const values = await readJson<RequestValues>(request);

    try {
      const bundle = await getDefaults(service, resolveChannelFromValues(values), targetEnvironment);
      const error = validate(values, bundle);
      if (error) return badRequest(error);
      const result = await execute(service, values, targetEnvironment);
      return json(result, {
        status: (result as { ok?: boolean; status?: number }).ok ? 200 : (result as { status?: number }).status || 500,
      });
    } catch (error) {
      return handleRouteError(error, onRouteError);
    }
  }

  return null;
};
