import { cp, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  getCliEnv,
  getCliEnvRegistry,
  type CliEnv,
  type CliEnvRegistry,
} from '../src/core/env';
import { createApiRequestHandler } from '../src/server';
import type { Logger } from '../src/runner';

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
  logger?: Logger;
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

  const handleRequest = createApiRequestHandler({
    envRegistry,
    depositPresetDirPath,
    payoutPresetDirPath,
    subscriptionPresetDirPath,
    logger: options?.logger || console,
    makeId: currentMakeId,
  });

  const requestApi = async (path: string, init?: RequestInit): Promise<Response> => {
    const request = new Request(new URL(path, 'http://127.0.0.1').toString(), init);
    return handleRequest(request);
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
