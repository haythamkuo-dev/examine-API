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

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const rawBody = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    const summary = rawBody.trim() || response.statusText || 'Empty response body';
    throw new Error(`API ${response.status} from ${url}: ${summary}`);
  }

  if (!rawBody.trim()) {
    throw new Error(`Empty response from ${url}`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON from ${url} but received ${contentType || 'unknown content type'}`);
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new Error(`Invalid JSON from ${url}`);
  }
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
  let cursor: Record<string, unknown> | unknown[] = draft;

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    const nextSegment = path[index + 1];

    if (typeof segment === 'number') {
      if (!Array.isArray(cursor)) {
        throw new Error('Invalid array path');
      }
      cursor[segment] = clone(cursor[segment]);
      cursor = cursor[segment] as Record<string, unknown> | unknown[];
      if (cursor === undefined) {
        cursor = typeof nextSegment === 'number' ? [] : {};
        (draft as unknown[])[segment] = cursor;
      }
      continue;
    }

    const currentValue = (cursor as Record<string, unknown>)[segment];
    if (currentValue === undefined || currentValue === null) {
      (cursor as Record<string, unknown>)[segment] = typeof nextSegment === 'number' ? [] : {};
    } else {
      (cursor as Record<string, unknown>)[segment] = clone(currentValue);
    }
    cursor = (cursor as Record<string, unknown>)[segment] as Record<string, unknown> | unknown[];
  }

  const lastSegment = path[path.length - 1];

  if (typeof lastSegment === 'number') {
    if (!Array.isArray(cursor)) {
      throw new Error('Invalid final array path');
    }
    cursor[lastSegment] = nextValue;
    return draft;
  }

  (cursor as Record<string, unknown>)[lastSegment] = nextValue;
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
  const [result, setResult] = useState<DepositCreateResponse | null>(null);
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'save' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const applyBundle = (response: DepositDefaultsResponse | DepositDefaultsSavedResponse) => {
    setChannels(response.availableChannels);
    setCommonSchema(response.commonSchema);
    setChannelSchema(response.channelSchema);
    setForm(response.form);
  };

  const loadDefaults = async (channel?: string) => {
    setLoading('defaults');
    setError(null);
    setSaveMessage(null);
    setPreview(null);
    setResult(null);

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
    setError(null);
    setSaveMessage(null);

    try {
      const response = await fetchJson<DepositPreviewResponse>('/api/deposit/preview', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(form),
      });
      setPreview(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setPreview(null);
    } finally {
      setLoading(null);
    }
  };

  const submitCreate = async () => {
    if (!form) return;

    setLoading('create');
    setError(null);
    setSaveMessage(null);

    try {
      const response = await fetchJson<DepositCreateResponse>('/api/deposit/create', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(form),
      });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setResult(null);
    } finally {
      setLoading(null);
    }
  };

  const saveDefaults = async () => {
    if (!form) return;

    setLoading('save');
    setError(null);
    setSaveMessage(null);

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
      setSaveMessage(`Saved defaults for ${response.channel}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
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

          {error ? <p className="text-[rgba(245,243,237,0.72)]">{error}</p> : null}
          {saveMessage ? <p className="text-sky-200">{saveMessage}</p> : null}
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
              {result?.status ? <span className="text-[13px] text-amber-300">Status {result.status}</span> : null}
            </div>
            {result?.hint ? (
              <div className="mb-[14px] rounded-2xl border border-red-500/50 bg-red-900/30 px-4 py-[14px] text-red-200">
                {result.hint}
              </div>
            ) : null}
            <pre className="m-0 max-h-[420px] min-w-0 flex-1 overflow-auto rounded-[18px] bg-black/30 p-4 text-xs text-[#dce6ef]">
              {result
                ? JSON.stringify(result, null, 2)
                : 'Send a request to capture the raw response, status code, and any diagnostic hint.'}
            </pre>
          </article>
        </section>
      </section>
    </>
  );
}
