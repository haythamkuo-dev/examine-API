import { apiTests } from './src/config';
import { createRunner, type Logger } from './src/runner';

const logger: Logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const runner = createRunner({
  httpClient: fetch,
  logger,
  now: () => new Date(),
  makeId: (prefix: string) => `${prefix}${crypto.randomUUID()}`,
});

const results = await runner.runAll(apiTests);

console.log(JSON.stringify(results, null, 2));
