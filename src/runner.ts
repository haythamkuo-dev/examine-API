export type HttpClient = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

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
  timeoutMs?: number;
};

export type CommandRequest = {
  name: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  payload: unknown;
};

export type CommandResult = {
  requestName: string;
  ok: boolean;
  status?: number;
  request: { method: string; url: string; payload: unknown };
  response?: unknown;
  error?: string;
  code?: string;
  message?: string;
  durationMs: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

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
  const run = async (request: CommandRequest): Promise<CommandResult> => {
    const startedAt = deps.now().getTime();
    const timeoutMs = deps.timeoutMs || DEFAULT_TIMEOUT_MS;
    deps.logger.info(`Running request ${request.name} ${request.method} ${request.url} (timeout ${timeoutMs}ms)`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await deps.httpClient(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(request.payload),
        signal: controller.signal,
      });

      const responseBody = await parseResponse(response);
      const durationMs = deps.now().getTime() - startedAt;
      const responseObject =
        responseBody && typeof responseBody === 'object' ? (responseBody as Record<string, unknown>) : undefined;

      const result: CommandResult = {
        requestName: request.name,
        ok: response.ok,
        status: response.status,
        request: {
          method: request.method,
          url: request.url,
          payload: request.payload,
        },
        response: responseBody,
        code: typeof responseObject?.code === 'string' ? responseObject.code : undefined,
        message: typeof responseObject?.message === 'string' ? responseObject.message : undefined,
        durationMs,
      };

      if (!result.ok) {
        deps.logger.warn(
          `Request failed ${request.name} status=${response.status}` +
            (result.code ? ` code=${result.code}` : '') +
            (result.message ? ` message=${result.message}` : ''),
        );
      }

      return result;
    } catch (error) {
      const durationMs = deps.now().getTime() - startedAt;
      const errorMessage = stringifyError(error);

      deps.logger.error('Request crashed', request.name, errorMessage);

      return {
        requestName: request.name,
        ok: false,
        request: {
          method: request.method,
          url: request.url,
          payload: request.payload,
        },
        error: error instanceof DOMException && error.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : errorMessage,
        durationMs,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return {
    run,
  };
}
