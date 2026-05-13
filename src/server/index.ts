import crypto from 'crypto';
import { resolve } from 'path';
import { getCliEnv } from '../core/env';
import { corsHeaders, json, notFound } from './http';
import { handleDepositRoute } from './routes/deposit';
import { handlePayoutRoute } from './routes/payout';

const PORT = Number(process.env.API_SERVER_PORT || 3000);
const env = getCliEnv();
const makeId = (prefix: string): string => `${prefix}${crypto.randomUUID()}`;
const DEPOSIT_PRESET_DIR_PATH = resolve(process.cwd(), 'data/deposit');
const PAYOUT_PRESET_DIR_PATH = resolve(process.cwd(), 'data/payout');

const server = Bun.serve({
  port: PORT,
  async fetch(request:Request) {
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
        env,
        presetDirPath: DEPOSIT_PRESET_DIR_PATH,
        makeId,
        logger: console,
      },
    });
    if (depositResponse) {
      return depositResponse;
    }

    const payoutResponse = await handlePayoutRoute({
      request,
      url,
      deps: {
        env,
        presetDirPath: PAYOUT_PRESET_DIR_PATH,
        makeId,
        logger: console,
      },
    });
    if (payoutResponse) {
      return payoutResponse;
    }

    return notFound();
  },
});

console.log(`Deposit API server listening on http://localhost:${server.port}`);
