import crypto from 'crypto';

/**
 * 根據路徑從物件中挖出深層的值 (例如挖出 'amount.amount' 裡面的 '99.00')
 */
const getNestedValue = (obj: any, path: string): string => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

/**
 * Builds a SHA-256 signature string from selected payload fields.
 *
 * @param payload Source object containing the values to sign.
 * @param signFields Dot-path field names used to build the canonical string.
 * @param secretKey Secret key appended as the final `key` field.
 * @returns A lowercase hex SHA-256 digest of the canonical signature string.
 * @throws Never throws explicitly. Any failure comes from invalid payload access or crypto runtime errors.
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

/**
 * Creates a merchant reference using a generated ID prefix.
 *
 * @param value Optional user-provided prefix source.
 * @param makeId ID factory used to produce the final reference string.
 * @param fallbackPrefix Prefix used when `value` is empty or whitespace only.
 * @returns A generated reference derived from `value` or the fallback prefix.
 * @throws Never throws explicitly.
 */
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



////////////////////////////////////////////////////////////////////////////////////////////////////////////
const KEEP_ALIVE_SERVER_URL = 'https://examine-api.onrender.com';
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;
const TAIPEI_UTC_OFFSET_HOURS = 8;
const TAIPEI_WORKING_HOUR_START = 9;
const TAIPEI_WORKING_HOUR_END = 21;
/**
 * Timer handle returned by `setInterval` in the current runtime.
 *
 * Keep the handle derived from the runtime API instead of hard-coding
 * `NodeJS.Timeout`, `number`, or Bun-specific aliases. That makes the code
 * portable across Bun, Node, and DOM-oriented test environments.
 */
type IntervalHandle = ReturnType<typeof setInterval>;


/**
 * Interval callback type derived from the active runtime's `setInterval`.
 *
 * Use the callback type produced by the runtime API rather than a manually
 * declared `TimerHandler`/`Timeout` alias so tests remain compatible across
 * Bun and DOM typings.
 */
type IntervalCallback = Parameters<typeof setInterval>[0];


/**
 * Minimal fetch signature used by `keepAlive`.
 *
 * Prefer the callable fetch shape instead of `typeof fetch` in tests, because
 * Bun's built-in `fetch` carries additional static properties such as
 * `preconnect` that lightweight stubs do not implement.
 * to refine the definition of `RequestInfo attributes`
 */
type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type KeepAliveDeps = {
  fetchFn: FetchFn;
  setIntervalFn: (handler: IntervalCallback, timeout?: number) => IntervalHandle;
  clearIntervalFn: (intervalId: IntervalHandle) => void;
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
