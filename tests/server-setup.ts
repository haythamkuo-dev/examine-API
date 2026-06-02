import { cp, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  getCliEnv,
  getCliEnvForTarget,
  getCliEnvRegistry,
  type CliEnv,
  type CliEnvRegistry,
} from '../src/core/env';
import { handleDepositRoute } from '../src/server/routes/deposit';
import { handlePayoutRoute } from '../src/server/routes/payout';
import { handleSubscriptionRoute } from '../src/server/routes/subscription';

const dataRootDirPath = resolve(process.cwd(), 'data');
const depositSourceDirPath = join(dataRootDirPath, 'deposit');
const payoutSourceDirPath = join(dataRootDirPath, 'payout');
const subscriptionSourceDirPath = join(dataRootDirPath, 'subscription');
const makeId = (prefix: string): string => `${prefix}fixed-id`;

export type ApiTestServerContext = {
  baseUrl: string;
  envRegistry: CliEnvRegistry;
  depositPresetDirPath: string;
  payoutPresetDirPath: string;
  subscriptionPresetDirPath: string;
  requestApi: (path: string, init?: RequestInit) => Promise<Response>;
  resetDepositFixtures: () => Promise<void>;
  resetPayoutFixtures: () => Promise<void>;
  resetSubscriptionFixtures: () => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * Creates the CLI environment registry used by backend API tests from `.env.test`.
 *
 * @returns A normalized environment registry for route and server tests.
 * @throws {TypeError} When the environment shape cannot be read from `process.env`.
 */
export const createTestCliEnvRegistry = (): CliEnvRegistry => getCliEnvRegistry(process.env);

/**
 * Creates the local CLI environment used by legacy backend tests from `.env.test`.
 *
 * @returns A normalized local environment object for route and service tests.
 * @throws {TypeError} When the environment shape cannot be read from `process.env`.
 */
export const createTestCliEnv = (): CliEnv => getCliEnv(process.env);

/**
 * Starts an isolated API server backed by temp copies of the preset fixtures.
 *
 * @returns A running server context with base URL, env, reset hook, and shutdown hook.
 * @throws {Error} When Bun fails to start the HTTP server or fixture copies cannot be created.
 */
export const startApiTestServer = async (options?: {
  envRegistry?: CliEnvRegistry;
  makeId?: (prefix: string) => string;
}): Promise<ApiTestServerContext> => {
  const tempRootDirPath = await mkdtemp(join(tmpdir(), 'api-server-test-'));
  const depositPresetDirPath = join(tempRootDirPath, 'deposit');
  const payoutPresetDirPath = join(tempRootDirPath, 'payout');
  const subscriptionPresetDirPath = join(tempRootDirPath, 'subscription');
  const envRegistry = options?.envRegistry || createTestCliEnvRegistry();
  const currentMakeId = options?.makeId || makeId;

  const resetDepositFixtures = async (): Promise<void> => {
    await rm(depositPresetDirPath, { recursive: true, force: true });
    await cp(depositSourceDirPath, depositPresetDirPath, { recursive: true });
  };

  const resetPayoutFixtures = async (): Promise<void> => {
    await rm(payoutPresetDirPath, { recursive: true, force: true });
    await cp(payoutSourceDirPath, payoutPresetDirPath, { recursive: true });
  };

  const resetSubscriptionFixtures = async (): Promise<void> => {
    await rm(subscriptionPresetDirPath, { recursive: true, force: true });
    await cp(subscriptionSourceDirPath, subscriptionPresetDirPath, { recursive: true });
  };

  await resetDepositFixtures();
  await resetPayoutFixtures();
  await resetSubscriptionFixtures();

  const requestApi = async (path: string, init?: RequestInit): Promise<Response> => {
    const request = new Request(new URL(path, 'http://127.0.0.1').toString(), init);
    const url = new URL(request.url);

    const depositResponse = await handleDepositRoute({
      request,
      url,
      deps: {
        getEnvForTarget: (target) => getCliEnvForTarget(envRegistry, target),
        presetDirPath: depositPresetDirPath,
        makeId: currentMakeId,
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
        getEnvForTarget: (target) => getCliEnvForTarget(envRegistry, target),
        presetDirPath: payoutPresetDirPath,
        makeId: currentMakeId,
        logger: console,
      },
    });
    if (payoutResponse) {
      return payoutResponse;
    }

    const subscriptionResponse = await handleSubscriptionRoute({
      request,
      url,
      deps: {
        getEnvForTarget: (target) => getCliEnvForTarget(envRegistry, target),
        presetDirPath: subscriptionPresetDirPath,
        makeId: currentMakeId,
        logger: console,
      },
    });
    if (subscriptionResponse) {
      return subscriptionResponse;
    }

    return new Response(null, { status: 404 });
  };

  return {
    baseUrl: 'http://127.0.0.1',
    envRegistry,
    depositPresetDirPath,
    payoutPresetDirPath,
    subscriptionPresetDirPath,
    requestApi,
    resetDepositFixtures,
    resetPayoutFixtures,
    resetSubscriptionFixtures,
    stop: async (): Promise<void> => {
      await rm(tempRootDirPath, { recursive: true, force: true });
    },
  };
};
