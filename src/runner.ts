export type HttpClient = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>;

export type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export type RunnerDeps = {
  httpClient: HttpClient;
  logger: Logger;
  now: () => Date;
  makeId: (prefix: string) => string;
};

type PayloadContext = Pick<RunnerDeps, 'now' | 'makeId'>;

export type ApiTestCase = {
  name: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  generatePayload: (ctx: PayloadContext) => unknown | Promise<unknown>;
};

export type TestResult = {
  caseName: string;
  ok: boolean;
  status?: number;
  request: { method: string; url: string; payload: unknown };
  response?: unknown;
  error?: string;
  durationMs: number;
};

const parseResponse = async (response: Response): Promise<unknown> => {
  const rawText = await response.text();

  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
};

const stringifyError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export function createRunner(deps: RunnerDeps) {
  const runOne = async (testCase: ApiTestCase): Promise<TestResult> => {
    const startedAt = deps.now().getTime();

    const payload = await testCase.generatePayload({
      now: deps.now,
      makeId: deps.makeId,
    });

    deps.logger.info('Running test case', testCase.name, testCase.method, testCase.url);

    try {
      const response = await deps.httpClient(testCase.url, {
        method: testCase.method,
        headers: testCase.headers,
        body: JSON.stringify(payload),
      });

      const responseBody = await parseResponse(response);
      const durationMs = deps.now().getTime() - startedAt;

      const result: TestResult = {
        caseName: testCase.name,
        ok: response.ok,
        status: response.status,
        request: {
          method: testCase.method,
          url: testCase.url,
          payload,
        },
        response: responseBody,
        durationMs,
      };

      if (!result.ok) {
        deps.logger.warn('Test case failed', testCase.name, response.status);
      }

      return result;
    } catch (error) {
      const durationMs = deps.now().getTime() - startedAt;
      const errorMessage = stringifyError(error);

      deps.logger.error('Test case crashed', testCase.name, errorMessage);

      return {
        caseName: testCase.name,
        ok: false,
        request: {
          method: testCase.method,
          url: testCase.url,
          payload,
        },
        error: errorMessage,
        durationMs,
      };
    }
  };

  const runAll = async (cases: ApiTestCase[]): Promise<TestResult[]> => {
    const results: TestResult[] = [];

    for (const testCase of cases) {
      const result = await runOne(testCase);
      results.push(result);
    }

    return results;
  };

  return {
    runOne,
    runAll,
  };
}
