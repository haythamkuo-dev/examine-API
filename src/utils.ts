import crypto from 'crypto';

/**
 * 根據路徑從物件中挖出深層的值 (例如挖出 'amount.amount' 裡面的 '99.00')
 */
const getNestedValue = (obj: any, path: string): string => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

/**
 * 泛用的 SHA-256 簽章產生器
 */
export const generateSign = (
  payload: any,
  signFields: string[],
  secretKey: string
): string => {
  const sortedFields = [...signFields].sort();
  const keyValuePairs = sortedFields.map((field) => {
    const value = getNestedValue(payload, field);
    return `${field}=${value}`;
  });

  keyValuePairs.push(`key=${secretKey}`);
  const canonicalString = keyValuePairs.join('&');
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
};

export const createUniqueReference = (
  value: string | undefined,
  makeId: (prefix: string) => string,
  fallbackPrefix: string,
): string => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return makeId(fallbackPrefix);
  }

  return makeId(`${trimmed}_`);
};

const KEEP_ALIVE_SERVER_URL = 'https://examine-api.onrender.com';
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;
const TAIPEI_UTC_OFFSET_HOURS = 8;
const TAIPEI_WORKING_HOUR_START = 9;
const TAIPEI_WORKING_HOUR_END = 21;

type KeepAliveDeps = {
  fetchFn: typeof fetch;
  setIntervalFn: typeof setInterval;
  clearIntervalFn: typeof clearInterval;
  now: () => Date;
  logger: Pick<Console, 'log' | 'error'>;
};

const defaultKeepAliveDeps: KeepAliveDeps = {
  fetchFn: fetch,
  setIntervalFn: setInterval,
  clearIntervalFn: clearInterval,
  now: () => new Date(),
  logger: console,
};

const isTaipeiWorkingHours = (now: Date): boolean => {
  const taipeiHour = (now.getUTCHours() + TAIPEI_UTC_OFFSET_HOURS) % 24;
  return taipeiHour >= TAIPEI_WORKING_HOUR_START && taipeiHour < TAIPEI_WORKING_HOUR_END;
};

/**
 * Starts a periodic keep-alive ping for the Render-hosted server.
 *
 * @param deps Internal runtime dependencies used for scheduling, pinging, and logging.
 * @returns A stop function that clears the interval and prevents future pings.
 * @throws Never throws explicitly. Ping failures are handled and logged.
 */
export const keepAlive = (deps: Partial<KeepAliveDeps> = {}): (() => void) => {
  const resolvedDeps: KeepAliveDeps = {
    ...defaultKeepAliveDeps,
    ...deps,
  };

  const timer = resolvedDeps.setIntervalFn(async () => {
    const now = resolvedDeps.now();
    const currentTime = now.toLocaleTimeString();
    if (!isTaipeiWorkingHours(now)) {
      resolvedDeps.logger.log(`[${currentTime}] 深夜時段 (21:00-09:00)，暫停 Ping 以節省額度。`);
      return;
    }

    try {
      resolvedDeps.logger.log(`[${currentTime}] 在工作時間，發送 Ping...`);
      await resolvedDeps.fetchFn(KEEP_ALIVE_SERVER_URL);
    } catch (error) {
      resolvedDeps.logger.error('Ping 失敗:', error);
    }
  }, KEEP_ALIVE_INTERVAL_MS);

  return () => {
    resolvedDeps.clearIntervalFn(timer);
  };
};
