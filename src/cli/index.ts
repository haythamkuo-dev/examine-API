import crypto from 'crypto';
import { Command, Option } from 'commander';
import {
  DEPOSIT_CHANNELS,
  PAYOUT_CHANNELS,
  getCliEnv,
  type CliEnv,
  type DepositChannel,
  type PayoutChannel,
} from '../core/env';
import { confirmPrompt, promptDepositFlow, type DepositPromptResult, type DepositPromptSeed } from './depositPrompt';
import { printJson } from '../core/output';
import { createDepositRequest } from '../domains/deposit';
import { getRequestFailureHint as getSharedRequestFailureHint } from '../deposit/failureHint';
import { createPayoutRequest } from '../domains/payout';
import { createSubscriptionRequest } from '../domains/subscription';
import { createRunner, type CommandRequest, type CommandResult, type Logger } from '../runner';

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

type DepositCommandOptions = {
  channel?: DepositChannel;
  yes?: boolean;
  apiBaseUrl?: string;
  apiKey?: string;
  signKey?: string;
  productNo?: string;
  merchantRef?: string;
  amount?: string;
  currencyCode?: string;
  returnUrl?: string;
  countryCode?: string;
  productDetail?: string;
  productName?: string;
  shopperReference?: string;
  origin?: string;
};

type ProgramDeps = {
  env?: CliEnv;
  makeId?: (prefix: string) => string;
  logger?: Logger;
  promptDeposit?: (args: {
    env: CliEnv;
    seed?: DepositPromptSeed;
    input: NodeJS.ReadableStream;
    output: NodeJS.WritableStream;
    makeId: (prefix: string) => string;
  }) => Promise<DepositPromptResult>;
  confirmSend?: (args: {
    input: NodeJS.ReadableStream;
    output: NodeJS.WritableStream;
    message: string;
  }) => Promise<boolean>;
  executeRequest?: (request: CommandRequest) => Promise<void>;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
};

const buildPreviewOutput = (request: CommandRequest) => ({
  name: request.name,
  method: request.method,
  url: request.url,
  headers: request.headers,
  payload: request.payload,
});

export const getRequestFailureHint = (result: CommandResult): string | undefined => {
  return getSharedRequestFailureHint(result);
};


const executeRequest = async (
  request: CommandRequest,
  deps: { logger: Logger; makeId: (prefix: string) => string },
) => {
  const runner = createRunner({
    httpClient: fetch,
    logger: deps.logger,
    now: () => new Date(),
    makeId: deps.makeId,
  });
  const result = await runner.run(request);
  if (!result.ok) {
    process.exitCode = 1;
    deps.logger.error(
      `Request failed: status=${result.status || 'n/a'} code=${result.code || 'n/a'} ` +
        `message=${result.message || result.error || 'Unknown error'}`,
    );
    const hint = getRequestFailureHint(result);
    if (hint) {
      deps.logger.error(hint);
    }
  }
  printJson(result);
};
const getDepositSeed = (options: DepositCommandOptions): DepositPromptSeed => ({
  channel: options.channel,
  apiBaseUrl: options.apiBaseUrl,
  apiKey: options.apiKey,
  signKey: options.signKey,
  productNo: options.productNo,
  merchantRef: options.merchantRef,
  amount: options.amount,
  currencyCode: options.currencyCode,
  returnUrl: options.returnUrl,
  countryCode: options.countryCode,
  productDetail: options.productDetail,
  productName: options.productName,
  shopperReference: options.shopperReference,
  origin: options.origin,
});

export const buildProgram = (deps: ProgramDeps = {}): Command => {
  const env = deps.env || getCliEnv();
  const currentMakeId = deps.makeId || makeId;
  const currentLogger = deps.logger || logger;
  const currentPromptDeposit = deps.promptDeposit || promptDepositFlow;
  const currentConfirmSend = deps.confirmSend || confirmPrompt;
  const currentExecuteRequest =
    deps.executeRequest || ((request: CommandRequest) => executeRequest(request, { logger: currentLogger, makeId: currentMakeId }));
  const input = deps.stdin || process.stdin;
  const output = deps.stdout || process.stdout;
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
    .option('--api-base-url <url>', 'Deposit API base URL override')
    .option('--api-key <token>', 'Deposit API key override')
    .option('--sign-key <key>', 'Deposit sign key override')
    .option('--product-no <productNo>', 'Deposit product number override')
    .option('--merchant-ref <merchantRef>', 'Deposit merchant reference override')
    .option('--amount <amount>', 'Deposit amount override')
    .option('--currency-code <code>', 'Deposit currency code override')
    .option('--return-url <url>', 'Deposit return URL override')
    .option('--country-code <code>', 'Deposit collect country code')
    .option('--product-detail <text>', 'Deposit collect product detail')
    .option('--product-name <text>', 'Deposit collect product name')
    .option('--shopper-reference <reference>', 'Deposit collect shopper reference')
    .option('--origin <url>', 'Deposit collect origin URL')
    .action(async (options: DepositCommandOptions) => {
      const promptResult = await currentPromptDeposit({
        env,
        seed: getDepositSeed(options),
        input,
        output,
        makeId: currentMakeId,
      });
      const request = createDepositRequest(env, promptResult.channel, currentMakeId, promptResult.overrides);
      printJson(buildPreviewOutput(request));
    });
  deposit
    .command('create')
    .description('Build the deposit request and send it')
    .addOption(createDepositChannelOption())
    .option('--api-base-url <url>', 'Deposit API base URL override')
    .option('--api-key <token>', 'Deposit API key override')
    .option('--sign-key <key>', 'Deposit sign key override')
    .option('--product-no <productNo>', 'Deposit product number override')
    .option('--merchant-ref <merchantRef>', 'Deposit merchant reference override')
    .option('--amount <amount>', 'Deposit amount override')
    .option('--currency-code <code>', 'Deposit currency code override')
    .option('--return-url <url>', 'Deposit return URL override')
    .option('--country-code <code>', 'Deposit collect country code')
    .option('--product-detail <text>', 'Deposit collect product detail')
    .option('--product-name <text>', 'Deposit collect product name')
    .option('--shopper-reference <reference>', 'Deposit collect shopper reference')
    .option('--origin <url>', 'Deposit collect origin URL')
    .option('-y, --yes', 'Send without confirmation prompt')
    .action(async (options: DepositCommandOptions) => {
      const promptResult = await currentPromptDeposit({
        env,
        seed: getDepositSeed(options),
        input,
        output,
        makeId: currentMakeId,
      });
      const request = createDepositRequest(env, promptResult.channel, currentMakeId, promptResult.overrides);
      printJson(buildPreviewOutput(request));

      const shouldSend = options.yes
        ? true
        : await currentConfirmSend({
            input,
            output,
            message: 'Send this deposit request?',
          });

      if (!shouldSend) {
        currentLogger.info('Request cancelled');
        return;
      }

      await currentExecuteRequest(request);
    });

  const payout = program.command('payout').description('Payout request tooling');
  payout
    .command('preview')
    .description('Build the payout request and print it without sending')
    .addOption(createPayoutChannelOption())
    .action((options: { channel?: PayoutChannel }) => {
      const request = createPayoutRequest(env, options.channel || PAYOUT_CHANNELS[0], currentMakeId);
      printJson(buildPreviewOutput(request));
    });
  payout
    .command('create')
    .description('Build the payout request and send it')
    .addOption(createPayoutChannelOption())
    .action(async (options: { channel?: PayoutChannel }) => {
      const request = createPayoutRequest(env, options.channel || PAYOUT_CHANNELS[0], currentMakeId);
      await currentExecuteRequest(request);
    });

  const subscription = program.command('subscription').description('Subscription request tooling');
  subscription
    .command('preview')
    .description('Build the subscription request and print it without sending')
    .option('--plan-id <planId>', 'Subscription plan id override')
    .action((options: { planId?: string }) => {
      const request = createSubscriptionRequest(env, currentMakeId, { planId: options.planId });
      printJson(buildPreviewOutput(request));
    });
  subscription
    .command('create')
    .description('Build the subscription request and send it')
    .option('--plan-id <planId>', 'Subscription plan id override')
    .action(async (options: { planId?: string }) => {
      const request = createSubscriptionRequest(env, currentMakeId, { planId: options.planId });
      await currentExecuteRequest(request);
    });

  return program;
};

export const runCli = async (argv = process.argv): Promise<void> => {
  const program = buildProgram();
  await program.parseAsync(argv);
};
