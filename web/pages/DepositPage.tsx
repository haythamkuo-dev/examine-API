import { startTransition, useEffect, useState } from 'react';
import type {
  DepositCreateResponse,
  DepositDefaultsResponse,
  DepositDefaultsSavedResponse,
  DepositFieldMap,
  DepositFieldSchema,
  DepositFormValues,
  DepositPreviewResponse,
} from '../../src/deposit/web';

const jsonHeaders = { 'Content-Type': 'application/json' };

const loadingLabels = {
  defaults: 'Loading defaults',
  preview: 'Preparing preview',
  create: 'Sending request',
  save: 'Saving defaults',
} as const;

type ApiAction = 'preview' | 'create' | 'save';

type ApiResultView = {
  ok: boolean;
  action: ApiAction;
  status: number | null;
  message: string;
  details?: string;
  raw: unknown;
};

class ApiRequestError extends Error {
  readonly status: number;
  readonly url: string;
  readonly rawBody: string;
  readonly contentType: string;

  constructor(params: {
    message: string;
    status: number;
    url: string;
    rawBody: string;
    contentType: string;
  }) {
    super(params.message);
    this.name = 'ApiRequestError';
    this.status = params.status;
    this.url = params.url;
    this.rawBody = params.rawBody;
    this.contentType = params.contentType;
  }
}

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const rawBody = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    const summary = rawBody.trim() || response.statusText || 'Empty response body';
    throw new ApiRequestError({
      message: `API ${response.status} from ${url}: ${summary}`,
      status: response.status,
      url,
      rawBody,
      contentType,
    });
  }

  if (!rawBody.trim()) {
    throw new ApiRequestError({
      message: `Empty response from ${url}`,
      status: response.status,
      url,
      rawBody,
      contentType,
    });
  }

  if (!contentType.includes('application/json')) {
    throw new ApiRequestError({
      message: `Expected JSON from ${url} but received ${contentType || 'unknown content type'}`,
      status: response.status,
      url,
      rawBody,
      contentType,
    });
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new ApiRequestError({
      message: `Invalid JSON from ${url}`,
      status: response.status,
      url,
      rawBody,
      contentType,
    });
  }
};

const getNumericStatus = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = (value as { status?: unknown }).status;
  return typeof candidate === 'number' ? candidate : null;
};

const buildFailureResult = (action: ApiAction, caught: unknown): ApiResultView => {
  if (caught instanceof ApiRequestError) {
    return {
      ok: false,
      action,
      status: caught.status,
      message: caught.message,
      details: caught.rawBody.trim() || undefined,
      raw: {
        ok: false,
        action,
        status: caught.status,
        url: caught.url,
        message: caught.message,
        contentType: caught.contentType || 'unknown',
        body: caught.rawBody,
      },
    };
  }

  const message = caught instanceof Error ? caught.message : String(caught);
  return {
    ok: false,
    action,
    status: null,
    message,
    raw: {
      ok: false,
      action,
      status: null,
      message,
    },
  };
};

const JsonPanel = ({
  title,
  body,
  emptyState,
}: {
  title: string;
  body: unknown;
  emptyState: string;
}) => (
  <article className="flex min-w-0 flex-col rounded-3xl border border-white/10 bg-[rgba(14,18,23,0.74)] p-[22px] shadow-[0_20px_70px_rgba(0,0,0,0.25)] backdrop-blur-[10px]">
    <div className="mb-[18px] flex items-baseline justify-between gap-3">
      <h2 className="m-0 font-['Iowan_Old_Style','Georgia',serif]">{title}</h2>
    </div>
    <pre className="m-0 max-h-[420px] min-w-0 flex-1 overflow-auto rounded-[18px] bg-black/30 p-4 text-xs text-[#dce6ef]">
      {body ? JSON.stringify(body, null, 2) : emptyState}
    </pre>
  </article>
);

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const updatePathValue = (
  source: Record<string, unknown>,
  path: Array<string | number>,
  nextValue: unknown,
): Record<string, unknown> => {
  const draft = clone(source);
  if (path.length === 0) {
    return draft;
  }

  let cursor: Record<string, unknown> | unknown[] = draft;

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    const nextSegment = path[index + 1];
    if (segment === undefined) {
      throw new Error('Invalid path segment');
    }

    const nextContainer = typeof nextSegment === 'number' ? [] : {};

    if (typeof segment === 'number') {
      if (!Array.isArray(cursor)) {
        throw new Error('Invalid array path');
      }

      const currentValue = cursor[segment];
      const normalized = currentValue === undefined || currentValue === null
        ? nextContainer
        : clone(currentValue);
      cursor[segment] = normalized;
      cursor = normalized as Record<string, unknown> | unknown[];
      continue;
    }

    if (Array.isArray(cursor)) {
      throw new Error('Invalid object path');
    }

    const currentValue = cursor[segment];
    if (currentValue === undefined || currentValue === null) {
      cursor[segment] = nextContainer;
    } else {
      cursor[segment] = clone(currentValue);
    }
    cursor = cursor[segment] as Record<string, unknown> | unknown[];
  }

  const lastSegment = path[path.length - 1];
  if (lastSegment === undefined) {
    throw new Error('Invalid final path segment');
  }

  if (typeof lastSegment === 'number') {
    if (!Array.isArray(cursor)) {
      throw new Error('Invalid final array path');
    }
    cursor[lastSegment] = nextValue;
    return draft;
  }

  if (Array.isArray(cursor)) {
    throw new Error('Invalid final object path');
  }

  cursor[lastSegment] = nextValue;
  return draft;
};

const renderSchemaMap = ({
  schemaMap,
  values,
  pathPrefix,
  onChange,
}: {
  schemaMap: DepositFieldMap;
  values: Record<string, unknown>;
  pathPrefix: Array<string | number>;
  onChange: (path: Array<string | number>, value: unknown) => void;
}) =>
  Object.entries(schemaMap).map(([key, schema]) => {
    const value = values[key];
    const fieldPath = [...pathPrefix, key];
    const pathKey = fieldPath.join('.');

    if (schema.kind === 'object') {
      const objectValues = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      return (
        <fieldset className="mb-[14px] rounded-[18px] border border-white/10 p-4" key={pathKey}>
          <legend className="px-2 text-amber-300">
            {schema.label}
            {schema.required ? ' *' : ''}
          </legend>
          {renderSchemaMap({
            schemaMap: schema.fields,
            values: objectValues,
            pathPrefix: fieldPath,
            onChange,
          })}
        </fieldset>
      );
    }

    if (schema.kind === 'array') {
      const items = Array.isArray(value) ? value : [];
      return (
        <div className="mb-[14px] grid gap-3" key={pathKey}>
          <div className="flex items-center justify-between gap-3 text-[13px] text-[rgba(245,243,237,0.72)]">
            <span>{schema.label}</span>
            <span>{items.length} items</span>
          </div>
          {items.map((item, index) => (
            <fieldset className="mb-[14px] rounded-[18px] border border-white/10 p-4" key={`${pathKey}.${index}`}>
              <legend className="px-2 text-amber-300">
                {schema.itemLabel} {index + 1}
              </legend>
              {renderSchemaMap({
                schemaMap: schema.itemSchema.fields,
                values: (item || {}) as Record<string, unknown>,
                pathPrefix: [...fieldPath, index],
                onChange,
              })}
            </fieldset>
          ))}
        </div>
      );
    }

    if (schema.kind === 'boolean') {
      return (
        <label className="mb-[14px] flex items-center gap-3" key={pathKey}>
          <input
            className="w-auto"
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(fieldPath, event.target.checked)}
          />
          <span>
            {schema.label}
            {schema.required ? ' *' : ''}
          </span>
        </label>
      );
    }

    if (schema.kind === 'select') {
      return (
        <label className="mb-[14px] grid gap-2" key={pathKey}>
          <span className="text-[13px] text-[rgba(245,243,237,0.84)]">
            {schema.label}
            {schema.required ? ' *' : ''}
          </span>
          <select
            className="w-full rounded-[14px] border border-white/15 bg-white/5 px-[14px] py-3 text-inherit"
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(fieldPath, event.target.value)}
          >
            <option value="">Select an option</option>
            {schema.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (schema.kind === 'textarea') {
      return (
        <label className="mb-[14px] grid gap-2" key={pathKey}>
          <span className="text-[13px] text-[rgba(245,243,237,0.84)]">
            {schema.label}
            {schema.required ? ' *' : ''}
          </span>
          <textarea
            className="min-h-24 w-full resize-y rounded-[14px] border border-white/15 bg-white/5 px-[14px] py-3 text-inherit"
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(fieldPath, event.target.value)}
          />
        </label>
      );
    }

    return (
      <label className="mb-[14px] grid gap-2" key={pathKey}>
        <span className="text-[13px] text-[rgba(245,243,237,0.84)]">
          {schema.label}
          {schema.required ? ' *' : ''}
        </span>
        <input
          className="w-full rounded-[14px] border border-white/15 bg-white/5 px-[14px] py-3 text-inherit"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(fieldPath, event.target.value)}
        />
      </label>
    );
  });

export function DepositPage() {
  const [form, setForm] = useState<DepositFormValues | null>(null);
  const [commonSchema, setCommonSchema] = useState<DepositFieldMap>({});
  const [channelSchema, setChannelSchema] = useState<DepositFieldMap>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [preview, setPreview] = useState<DepositPreviewResponse | null>(null);
  const [apiResult, setApiResult] = useState<ApiResultView | null>(null);
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'save' | null>('defaults');
  const [error, setError] = useState<string | null>(null);

  const applyBundle = (response: DepositDefaultsResponse | DepositDefaultsSavedResponse) => {
    setChannels(response.availableChannels);
    setCommonSchema(response.commonSchema);
    setChannelSchema(response.channelSchema);
    setForm(response.form);
  };

  const loadDefaults = async (channel?: string) => {
    setLoading('defaults');
    setError(null);
    setPreview(null);
    setApiResult(null);

    try {
      const query = channel ? `?channel=${encodeURIComponent(channel)}` : '';
      const response = await fetchJson<DepositDefaultsResponse>(`/api/deposit/defaults${query}`);

      startTransition(() => {
        applyBundle(response);
        setLoading(null);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setForm(null);
      setLoading(null);
    }
  };

  useEffect(() => {
    void loadDefaults();
  }, []);

  const updateCommonValue = (key: string, value: string) => {
    setForm((current) =>
      current
        ? {
            ...current,
            commonValues: {
              ...current.commonValues,
              [key]: value,
            },
          }
        : current,
    );
  };

  const updateChannelValue = (path: Array<string | number>, nextValue: unknown) => {
    setForm((current) =>
      current
        ? {
            ...current,
            channelValues: updatePathValue(current.channelValues, path, nextValue),
          }
        : current,
    );
  };

  const submitPreview = async () => {
    if (!form) return;

    setLoading('preview');

    try {
      const response = await fetchJson<DepositPreviewResponse>('/api/deposit/preview', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(form),
      });
      setPreview(response);
      setApiResult({
        ok: true,
        action: 'preview',
        status: getNumericStatus(response),
        message: 'Preview completed.',
        raw: {
          ok: true,
          action: 'preview',
          status: getNumericStatus(response),
          data: response,
        },
      });
    } catch (caught) {
      setPreview(null);
      setApiResult(buildFailureResult('preview', caught));
    } finally {
      setLoading(null);
    }
  };

  const submitCreate = async () => {
    if (!form) return;

    setLoading('create');

    try {
      const response = await fetchJson<DepositCreateResponse>('/api/deposit/create', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(form),
      });
      setApiResult({
        ok: true,
        action: 'create',
        status: getNumericStatus(response),
        message: 'Request sent successfully.',
        raw: {
          ok: true,
          action: 'create',
          status: getNumericStatus(response),
          data: response,
        },
      });
    } catch (caught) {
      setApiResult(buildFailureResult('create', caught));
    } finally {
      setLoading(null);
    }
  };

  const saveDefaults = async () => {
    if (!form) return;

    setLoading('save');

    try {
      const response = await fetchJson<DepositDefaultsSavedResponse>(
        `/api/deposit/defaults?channel=${encodeURIComponent(form.channel)}`,
        {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify(form),
        },
      );
      applyBundle(response);
      setApiResult({
        ok: true,
        action: 'save',
        status: getNumericStatus(response),
        message: `Saved defaults for ${response.channel}.`,
        raw: {
          ok: true,
          action: 'save',
          status: getNumericStatus(response),
          data: response,
        },
      });
    } catch (caught) {
      setApiResult(buildFailureResult('save', caught));
    } finally {
      setLoading(null);
    }
  };

  if (!form) {
    return (
      <section className="mb-6 grid gap-5 rounded-3xl border border-white/10 bg-[rgba(14,18,23,0.74)] p-7 shadow-[0_20px_70px_rgba(0,0,0,0.25)] backdrop-blur-[10px] md:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-amber-300">Deposit Module</p>
          <h1 className="m-0 font-['Iowan_Old_Style','Georgia',serif] text-[clamp(2rem,4vw,4rem)] leading-[0.98]">Deposit Operator Console</h1>
          <p className="text-[rgba(245,243,237,0.72)]">
            {loading === 'defaults' ? 'Loading server-side defaults for the selected channel.' : error || 'Unable to load defaults.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="mb-6 grid gap-5 rounded-3xl border border-white/10 bg-[rgba(14,18,23,0.74)] p-7 shadow-[0_20px_70px_rgba(0,0,0,0.25)] backdrop-blur-[10px] md:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-amber-300">Deposit Module</p>
          <h1 className="m-0 font-['Iowan_Old_Style','Georgia',serif] text-[clamp(2rem,4vw,4rem)] leading-[0.98]">Deposit Operator Console</h1>
          <p className="text-[rgba(245,243,237,0.72)]">
            Edit shared request fields, switch channel-specific payload sections, preview the signed request, and run the test through the local Bun proxy.
          </p>
        </div>
        <div className="self-end rounded-[18px] bg-white/5 p-[18px]">
          <h2 className="m-0 font-['Iowan_Old_Style','Georgia',serif]">Execution mode</h2>
          <p className="text-[rgba(245,243,237,0.72)]">
            Credentials stay on the API server. The browser only edits test inputs and reads the proxied response.
          </p>
          <div className="mt-[18px] flex flex-wrap gap-2.5">
            <span className="inline-flex min-h-[34px] items-center rounded-full border border-white/10 bg-white/5 px-[14px] text-[rgba(245,243,237,0.82)]">
              Scope: Deposit
            </span>
            <span className="inline-flex min-h-[34px] items-center rounded-full border border-transparent bg-sky-300 px-[14px] text-[#141414]">
              {loading ? loadingLabels[loading] : 'Ready to test'}
            </span>
          </div>
        </div>
      </section>

      <section className="[display:grid] gap-6 md:grid-cols-[minmax(320px,440px)_minmax(0,1fr)]">
        <form
          className="rounded-3xl border border-white/10 bg-[rgba(14,18,23,0.74)] p-[22px] shadow-[0_20px_70px_rgba(0,0,0,0.25)] backdrop-blur-[10px]"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="mb-[18px] flex items-baseline justify-between gap-3">
            <h2 className="m-0 font-['Iowan_Old_Style','Georgia',serif]">Request builder</h2>
            <span className="text-[13px] text-amber-300">{loading ? loadingLabels[loading] : 'Form ready'}</span>
          </div>

          <label className="mb-[14px] grid gap-2">
            <span className="text-[13px] text-[rgba(245,243,237,0.84)]">Channel</span>
            <select
              className="w-full rounded-[14px] border border-white/15 bg-white/5 px-[14px] py-3 text-inherit"
              value={form.channel}
              onChange={(event) => void loadDefaults(event.target.value)}
            >
              {channels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 border-t border-white/10 pt-[18px]">
            <h3 className="mb-3 m-0 font-['Iowan_Old_Style','Georgia',serif]">Shared fields</h3>
            {renderSchemaMap({
              schemaMap: commonSchema,
              values: form.commonValues as Record<string, unknown>,
              pathPrefix: [],
              onChange: (path, value) => {
                const key = path[0];
                if (typeof key === 'string' && typeof value === 'string') {
                  updateCommonValue(key, value);
                }
              },
            })}
          </div>

          <div className="mt-3 border-t border-white/10 pt-[18px]">
            <h3 className="mb-3 m-0 font-['Iowan_Old_Style','Georgia',serif]">Channel fields</h3>
            {renderSchemaMap({
              schemaMap: channelSchema,
              values: form.channelValues,
              pathPrefix: [],
              onChange: updateChannelValue,
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="cursor-pointer rounded-full bg-amber-300 px-[18px] py-3 text-[#141414] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              onClick={() => void loadDefaults(form.channel)}
              disabled={loading !== null}
            >
              Reload defaults
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full bg-amber-300 px-[18px] py-3 text-[#141414] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              onClick={() => void submitPreview()}
              disabled={loading !== null}
            >
              Preview request
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full bg-sky-300 px-[18px] py-3 text-[#141414] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              onClick={() => void submitCreate()}
              disabled={loading !== null}
            >
              Send request
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full bg-white/10 px-[18px] py-3 text-[#f5f3ed] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              onClick={() => void saveDefaults()}
              disabled={loading !== null}
            >
              Save defaults
            </button>
          </div>

        </form>

        <section className="[display:grid] gap-6 content-start min-w-0">
          <JsonPanel
            title="Request preview"
            body={preview}
            emptyState="Run a preview to inspect the exact request body, URL, and masked headers."
          />

          <article className="flex min-w-0 flex-col rounded-3xl border border-white/10 bg-[rgba(14,18,23,0.74)] p-[22px] shadow-[0_20px_70px_rgba(0,0,0,0.25)] backdrop-blur-[10px]">
            <div className="mb-[18px] flex items-baseline justify-between gap-3">
              <h2 className="m-0 font-['Iowan_Old_Style','Georgia',serif]">API result</h2>
              {apiResult ? (
                <span className="text-[13px] text-amber-300">
                  {apiResult.action.toUpperCase()} {apiResult.status !== null ? `Status ${apiResult.status}` : ''}
                </span>
              ) : null}
            </div>
            {apiResult ? (
              <div
                className={`mb-[14px] rounded-2xl px-4 py-[14px] ${
                  apiResult.ok
                    ? 'border border-emerald-500/50 bg-emerald-900/30 text-emerald-200'
                    : 'border border-red-500/50 bg-red-900/30 text-red-200'
                }`}
              >
                {apiResult.message}
                {apiResult.details ? <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-[13px]">{apiResult.details}</p> : null}
              </div>
            ) : null}
            <pre className="m-0 max-h-[420px] min-w-0 flex-1 overflow-auto rounded-[18px] bg-black/30 p-4 text-xs text-[#dce6ef]">
              {apiResult
                ? JSON.stringify(apiResult.raw, null, 2)
                : 'Send a request to capture the raw response, status code, and any diagnostic hint.'}
            </pre>
          </article>
        </section>
      </section>
    </>
  );
}
