import { cp, mkdtemp, rm } from 'fs/promises';
import net from 'net';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { getCliEnv, type CliEnv } from '../src/core/env';
import { createApiServer } from '../src/server/index';

const dataRootDirPath = resolve(process.cwd(), 'data');
const depositSourceDirPath = join(dataRootDirPath, 'deposit');
const payoutSourceDirPath = join(dataRootDirPath, 'payout');
const subscriptionSourceDirPath = join(dataRootDirPath, 'subscription');
const makeId = (prefix: string): string => `${prefix}fixed-id`;

const getAvailablePort = async (): Promise<number> =>
  await new Promise<number>((resolvePort, reject) => {
    const server = net.createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new TypeError('Unable to resolve an ephemeral test port')));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolvePort(address.port);
      });
    });
  });

export type ApiTestServerContext = {
  baseUrl: string;
  env: CliEnv;
  payoutPresetDirPath: string;
  subscriptionPresetDirPath: string;
  resetPayoutFixtures: () => Promise<void>;
  resetSubscriptionFixtures: () => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * Creates the CLI environment used by backend API tests from `.env.test`.
 *
 * @returns A normalized environment object for route and server tests.
 * @throws {TypeError} When the environment shape cannot be read from `process.env`.
 */
export const createTestCliEnv = (): CliEnv => getCliEnv(process.env);

/**
 * Starts an isolated API server backed by temp copies of the preset fixtures.
 *
 * @returns A running server context with base URL, env, reset hook, and shutdown hook.
 * @throws {Error} When Bun fails to start the HTTP server or fixture copies cannot be created.
 */
export const startApiTestServer = async (): Promise<ApiTestServerContext> => {
  const tempRootDirPath = await mkdtemp(join(tmpdir(), 'api-server-test-'));
  const depositPresetDirPath = join(tempRootDirPath, 'deposit');
  const payoutPresetDirPath = join(tempRootDirPath, 'payout');
  const subscriptionPresetDirPath = join(tempRootDirPath, 'subscription');
  const env = createTestCliEnv();

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
  const port = await getAvailablePort();

  const server = createApiServer({
    env,
    depositPresetDirPath,
    payoutPresetDirPath,
    subscriptionPresetDirPath,
    logger: console,
    makeId,
    port,
  });

  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    env,
    payoutPresetDirPath,
    subscriptionPresetDirPath,
    resetPayoutFixtures,
    resetSubscriptionFixtures,
    stop: async (): Promise<void> => {
      server.stop(true);
      await rm(tempRootDirPath, { recursive: true, force: true });
    },
  };
};
