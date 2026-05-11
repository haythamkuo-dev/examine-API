import crypto from 'crypto';
import { Command, Option } from 'commander';
import {
  DEPOSIT_CHANNELS,
  PAYOUT_CHANNELS,
  getCliEnv,
  type DepositChannel,
  type PayoutChannel,
} from '../core/env';
import { printJson } from '../core/output';
import { createDepositRequest } from '../domains/deposit';
import { createPayoutRequest } from '../domains/payout';
import { createSubscriptionRequest } from '../domains/subscription';
import { createRunner, type CommandRequest, type Logger } from '../runner';

const logger: Logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const makeId = (prefix: string): string => `${prefix}${crypto.randomUUID()}`;
const createDepositChannelOption = () =>
  new Option('--channel <channel>', 'Deposit channel').choices(DEPOSIT_CHANNELS as unknown as string[]);
const createPayoutChannelOption = () =>
  new Option('--channel <channel>', 'Payout channel').choices(PAYOUT_CHANNELS as unknown as string[]);

const buildPreviewOutput = (request: CommandRequest) => ({
  name: request.name,
  method: request.method,
  url: request.url,
  headers: request.headers,
  payload: request.payload,
});

const executeRequest = async (request: CommandRequest) => {
  const runner = createRunner({
    httpClient: fetch,
    logger,
    now: () => new Date(),
    makeId,
  });
  const result = await runner.run(request);
  if (!result.ok) {
    process.exitCode = 1;
  }
  printJson(result);
};

export const buildProgram = (): Command => {
  const env = getCliEnv();
  const program = new Command();

  program
    .name('examine-api')
    .description('Internal payment API CLI for deposit, subscription, and payout flows')
    .showHelpAfterError();

  const deposit = program.command('deposit').description('Deposit request tooling');
  deposit
    .command('preview')
    .description('Build the deposit request and print it without sending')
    .addOption(createDepositChannelOption())
    .action((options: { channel?: DepositChannel }) => {
      const request = createDepositRequest(env, options.channel || DEPOSIT_CHANNELS[0], makeId);
      printJson(buildPreviewOutput(request));
    });
  deposit
    .command('create')
    .description('Build the deposit request and send it')
    .addOption(createDepositChannelOption())
    .action(async (options: { channel?: DepositChannel }) => {
      const request = createDepositRequest(env, options.channel || DEPOSIT_CHANNELS[0], makeId);
      await executeRequest(request);
    });

  const payout = program.command('payout').description('Payout request tooling');
  payout
    .command('preview')
    .description('Build the payout request and print it without sending')
    .addOption(createPayoutChannelOption())
    .action((options: { channel?: PayoutChannel }) => {
      const request = createPayoutRequest(env, options.channel || PAYOUT_CHANNELS[0], makeId);
      printJson(buildPreviewOutput(request));
    });
  payout
    .command('create')
    .description('Build the payout request and send it')
    .addOption(createPayoutChannelOption())
    .action(async (options: { channel?: PayoutChannel }) => {
      const request = createPayoutRequest(env, options.channel || PAYOUT_CHANNELS[0], makeId);
      await executeRequest(request);
    });

  const subscription = program.command('subscription').description('Subscription request tooling');
  subscription
    .command('preview')
    .description('Build the subscription request and print it without sending')
    .option('--plan-id <planId>', 'Subscription plan id override')
    .action((options: { planId?: string }) => {
      const request = createSubscriptionRequest(env, makeId, { planId: options.planId });
      printJson(buildPreviewOutput(request));
    });
  subscription
    .command('create')
    .description('Build the subscription request and send it')
    .option('--plan-id <planId>', 'Subscription plan id override')
    .action(async (options: { planId?: string }) => {
      const request = createSubscriptionRequest(env, makeId, { planId: options.planId });
      await executeRequest(request);
    });

  return program;
};

export const runCli = async (argv = process.argv): Promise<void> => {
  const program = buildProgram();
  await program.parseAsync(argv);
};
