import crypto from 'crypto';
import { resolve } from 'path';
import {
  getCliEnvForTarget,
  getCliEnvRegistry,
  type CliEnv,
  type CliEnvRegistry,
} from '../core/env';
import { keepAlive } from '../utils';
import type { Logger } from '../runner';
import { corsHeaders, json, notFound } from './http';
import { buildErrorEnvelope, unknownErrorMessage } from './errors';
import { handleDepositRoute } from './routes/deposit';
import { handlePayoutRoute } from './routes/payout';
import { handleSubscriptionRoute } from './routes/subscription';

const DEFAULT_PORT = Number(process.env.API_SERVER_PORT || 3000);
const DEFAULT_DEPOSIT_PRESET_DIR_PATH = resolve(process.cwd(), 'data/deposit');
const DEFAULT_PAYOUT_PRESET_DIR_PATH = resolve(process.cwd(), 'data/payout');
const DEFAULT_SUBSCRIPTION_PRESET_DIR_PATH = resolve(process.cwd(), 'data/subscription');
const defaultMakeId = (prefix: string): string => `${prefix}${crypto.randomUUID()}`;

export type ApiServerOptions = {
  envRegistry: CliEnvRegistry;
  depositPresetDirPath: string;
  payoutPresetDirPath: string;
  subscriptionPresetDirPath: string;
  logger: Logger;
  makeId: (prefix: string) => string;
  port?: number;
};

/**
 * Creates the request handler shared by the Bun server and isolated API tests.
 *
 * Expected route failures must be normalized inside their route handlers. This
 * boundary only catches exceptions that escape route-level handling.
 *
 * @param options Runtime dependencies for routing and upstream services.
 * @returns Request handler that always converts unhandled exceptions to a generic 500 envelope.
 */
export const createApiRequestHandler = (
  options: ApiServerOptions,
): ((request: Request) => Promise<Response>) =>
  async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true });
      }

      const depositResponse = await handleDepositRoute({
        request,
        url,
        deps: {
          getEnvForTarget: (target) => getCliEnvForTarget(options.envRegistry, target),
          presetDirPath: options.depositPresetDirPath,
          makeId: options.makeId,
          logger: options.logger,
        },
      });
      if (depositResponse) {
        return depositResponse;
      }

      const payoutResponse = await handlePayoutRoute({
        request,
        url,
        deps: {
          getEnvForTarget: (target) => getCliEnvForTarget(options.envRegistry, target),
          presetDirPath: options.payoutPresetDirPath,
          makeId: options.makeId,
          logger: options.logger,
        },
      });
      if (payoutResponse) {
        return payoutResponse;
      }

      const subscriptionResponse = await handleSubscriptionRoute({
        request,
        url,
        deps: {
          getEnvForTarget: (target) => getCliEnvForTarget(options.envRegistry, target),
          presetDirPath: options.subscriptionPresetDirPath,
          makeId: options.makeId,
          logger: options.logger,
        },
      });
      if (subscriptionResponse) {
        return subscriptionResponse;
      }

      return notFound();
    } catch (error) {
      options.logger.error('Unhandled API request error', error);
      return json(buildErrorEnvelope(500, unknownErrorMessage), { status: 500 });
    }
  };

/**
 * Creates the Bun HTTP server for deposit, payout, and subscription APIs.
 *
 * @param options Runtime dependencies for environment, preset storage, and logging.
 * @returns The started Bun server instance.
 * @throws {Error} When Bun fails to bind the requested port.
 */
export const createApiServer = (options: ApiServerOptions) => {
  const handleRequest = createApiRequestHandler(options);

  return Bun.serve({
    port: options.port ?? DEFAULT_PORT,
    fetch: handleRequest,
  });
};

// #todo Define a structured server-side error log schema, retention policy, and access controls.
// #todo Design an authorized, masked, and audited debug mode.

if (import.meta.main) {
  const server = createApiServer({
    envRegistry: getCliEnvRegistry(),
    depositPresetDirPath: DEFAULT_DEPOSIT_PRESET_DIR_PATH,
    payoutPresetDirPath: DEFAULT_PAYOUT_PRESET_DIR_PATH,
    subscriptionPresetDirPath: DEFAULT_SUBSCRIPTION_PRESET_DIR_PATH,
    logger: console,
    makeId: defaultMakeId,
  });

  const shouldEnableKeepAlive = process.env.NODE_ENV === 'production';
  const stopKeepAlive = shouldEnableKeepAlive ? keepAlive() : null;
  if (shouldEnableKeepAlive) {
    console.log('keepAlive enabled for production server.');
  } else {
    console.log('keepAlive skipped because NODE_ENV is not production.');
  }

  const shutdown = () => {
    stopKeepAlive?.();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`S2S API server listening on http://localhost:${server.port}`);
}
