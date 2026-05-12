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
  <article className="panel result-panel">
    <div className="section-heading">
      <h2>{title}</h2>
    </div>
    <pre>{body ? JSON.stringify(body, null, 2) : emptyState}</pre>
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
        <fieldset className="field-group" key={pathKey}>
          <legend>
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
        <div className="field-array" key={pathKey}>
          <div className="array-heading">
            <span>{schema.label}</span>
            <span>{items.length} items</span>
          </div>
          {items.map((item, index) => (
            <fieldset className="field-group" key={`${pathKey}.${index}`}>
              <legend>
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
        <label className="checkbox-field" key={pathKey}>
          <input
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
        <label className="field" key={pathKey}>
          <span>
            {schema.label}
            {schema.required ? ' *' : ''}
          </span>
          <select value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(fieldPath, event.target.value)}>
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
        <label className="field" key={pathKey}>
          <span>
            {schema.label}
            {schema.required ? ' *' : ''}
          </span>
          <textarea value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(fieldPath, event.target.value)} />
        </label>
      );
    }

    return (
      <label className="field" key={pathKey}>
        <span>
          {schema.label}
          {schema.required ? ' *' : ''}
        </span>
        <input value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(fieldPath, event.target.value)} />
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
      <section className="panel hero">
        <div>
          <p className="eyebrow">Deposit Module</p>
          <h1>Deposit Operator Console</h1>
          <p className="lede">
            {loading === 'defaults' ? 'Loading server-side defaults for the selected channel.' : error || 'Unable to load defaults.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="panel hero">
        <div>
          <p className="eyebrow">Deposit Module</p>
          <h1>Deposit Operator Console</h1>
          <p className="lede">
            Edit shared request fields, switch channel-specific payload sections, preview the signed request, and run the test through the local Bun proxy.
          </p>
        </div>
        <div className="credential-note">
          <h2>Execution mode</h2>
          <p>Credentials stay on the API server. The browser only edits test inputs and reads the proxied response.</p>
          <div className="status-row">
            <span className="status-pill">Scope: Deposit</span>
            <span className="status-pill accent">{loading ? loadingLabels[loading] : 'Ready to test'}</span>
          </div>
        </div>
      </section>

      <section className="grid">
        <form className="panel form-panel" onSubmit={(event) => event.preventDefault()}>
          <div className="section-heading">
            <h2>Request builder</h2>
            <span>{loading ? loadingLabels[loading] : 'Form ready'}</span>
          </div>

          <label className="field">
            <span>Channel</span>
            <select value={form.channel} onChange={(event) => void loadDefaults(event.target.value)}>
              {channels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>

          <div className="subsection">
            <h3>Shared fields</h3>
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

          <div className="subsection">
            <h3>Channel fields</h3>
            {renderSchemaMap({
              schemaMap: channelSchema,
              values: form.channelValues,
              pathPrefix: [],
              onChange: updateChannelValue,
            })}
          </div>

          <div className="actions">
            <button type="button" onClick={() => void loadDefaults(form.channel)} disabled={loading !== null}>
              Reload defaults
            </button>
            <button type="button" onClick={() => void submitPreview()} disabled={loading !== null}>
              Preview request
            </button>
            <button type="button" className="primary" onClick={() => void submitCreate()} disabled={loading !== null}>
              Send request
            </button>
            <button type="button" className="secondary" onClick={() => void saveDefaults()} disabled={loading !== null}>
              Save defaults
            </button>
          </div>

          {error ? <p className="inline-error">{error}</p> : null}
          {saveMessage ? <p className="inline-success">{saveMessage}</p> : null}
        </form>

        <section className="stack">
          <JsonPanel
            title="Request preview"
            body={preview}
            emptyState="Run a preview to inspect the exact request body, URL, and masked headers."
          />

          <article className="panel result-panel">
            <div className="section-heading">
              <h2>API result</h2>
              {result?.status ? <span>Status {result.status}</span> : null}
            </div>
            {result?.hint ? <div className="error-banner">{result.hint}</div> : null}
            <pre>
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
