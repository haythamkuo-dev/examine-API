import crypto from 'crypto';
import { resolve } from 'path';
import { getCliEnv, type CliEnv } from '../core/env';
import { corsHeaders, json, notFound } from './http';
import { handleDepositRoute } from './routes/deposit';
import { handlePayoutRoute } from './routes/payout';

const DEFAULT_PORT = Number(process.env.API_SERVER_PORT || 3000);
const DEFAULT_DEPOSIT_PRESET_DIR_PATH = resolve(process.cwd(), 'data/deposit');
const DEFAULT_PAYOUT_PRESET_DIR_PATH = resolve(process.cwd(), 'data/payout');
const defaultMakeId = (prefix: string): string => `${prefix}${crypto.randomUUID()}`;

export type ApiServerOptions = {
  env: CliEnv;
  depositPresetDirPath: string;
  payoutPresetDirPath: string;
  logger: Console;
  makeId: (prefix: string) => string;
  port?: number;
};

/**
 * Creates the Bun HTTP server for deposit and payout APIs.
 *
 * @param options Runtime dependencies for environment, preset storage, and logging.
 * @param options.env Application environment used by route services.
 * @param options.depositPresetDirPath Directory containing deposit preset fixtures.
 * @param options.payoutPresetDirPath Directory containing payout preset fixtures.
 * @param options.logger Logger used by the underlying runner and startup output.
 * @param options.makeId Factory for merchant reference identifiers.
 * @param options.port Port to bind. Uses `API_SERVER_PORT` or `3000` when omitted.
 * @returns The started Bun server instance.
 * @throws {Error} When Bun fails to bind the requested port.
 */
export const createApiServer = (options: ApiServerOptions) =>
  Bun.serve({
    port: options.port ?? DEFAULT_PORT,
    async fetch(request: Request) {
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
          env: options.env,
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
          env: options.env,
          presetDirPath: options.payoutPresetDirPath,
          makeId: options.makeId,
          logger: options.logger,
        },
      });
      if (payoutResponse) {
        return payoutResponse;
      }

      return notFound();
    },
  });

if (import.meta.main) {
  const server = createApiServer({
    env: getCliEnv(),
    depositPresetDirPath: DEFAULT_DEPOSIT_PRESET_DIR_PATH,
    payoutPresetDirPath: DEFAULT_PAYOUT_PRESET_DIR_PATH,
    logger: console,
    makeId: defaultMakeId,
  });

  console.log(`Deposit API server listening on http://localhost:${server.port}`);
}
