import { startTransition, useEffect, useState } from 'react';
import type {
  PayoutCreateResponse,
  PayoutDefaultsResponse,
  PayoutDefaultsSavedResponse,
  PayoutFieldMap,
  PayoutFormValues,
  PayoutPreviewResponse,
} from '../../src/payout/web';
import { ActionButton, JsonPanel, LoadingHero, PageCard, PageHero, ResultPanel, SectionHeading } from './pageChrome';

const jsonHeaders = { 'Content-Type': 'application/json' };
const fieldsetClassName = 'mb-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4';
const fieldLabelClassName = 'mb-4 grid gap-2';
const fieldLabelTextClassName = 'text-[13px] font-medium tracking-[0.01em] text-[color:var(--color-text-muted)]';
const inputClassName =
  'w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[var(--color-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';

const loadingLabels = {
  defaults: 'Loading defaults',
  preview: 'Preparing preview',
  create: 'Sending request',
  save: 'Saving defaults',
} as const;

const moduleName = 'Payout Module';
const pageTitle = 'Payout Operator Console';
const previewEmptyState = 'Run a preview to inspect the exact request body, URL, and masked headers.';
const resultEmptyState = 'Send a request to capture the raw response, status code, and diagnostics.';
const optionalFieldMarker = '非必填';

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

const extractCreateMessage = (statusText: string, body: unknown): string => {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
  }

  return statusText || 'Request failed';
};

/**
 * Normalizes payout create API responses into a panel-friendly result object.
 *
 * @param response Raw fetch response from `/api/payout/create`.
 * @returns Normalized payload for API result panel rendering.
 */
export const normalizeCreateResult = async (response: Response): Promise<PayoutCreateResponse> => {
  const rawBody = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let parsedBody: unknown = null;

  if (rawBody.trim()) {
    if (contentType.includes('application/json')) {
      try {
        parsedBody = JSON.parse(rawBody) as unknown;
      } catch {
        parsedBody = rawBody;
      }
    } else {
      parsedBody = rawBody;
    }
  }

  if (parsedBody && typeof parsedBody === 'object') {
    return parsedBody as PayoutCreateResponse;
  }

  return {
    requestName: 'payout:create',
    ok: response.ok,
    status: response.status,
    request: {
      method: 'POST',
      url: '/api/payout/create',
      payload: null,
    },
    response: parsedBody,
    message: extractCreateMessage(response.statusText, parsedBody),
    durationMs: 0,
  };
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPlaceholderOptionalValue = (value: unknown): boolean =>
  typeof value === 'string' && value.includes(optionalFieldMarker);

/**
 * Returns whether a payout field should be hidden in the frontend form.
 *
 * Optional fields stay visible when they already carry a real value. Placeholder-only
 * optional fields, plus any parent container that only contains hidden descendants,
 * are hidden to reduce accidental submission noise.
 *
 * @param schema The schema entry describing the field.
 * @param value The current field value from the form state.
 * @returns `true` when the field should be hidden from the payout form.
 */
export const shouldHidePayoutField = (
  schema: PayoutFieldMap[string],
  value: unknown,
): boolean => {
  if (schema.kind === 'object') {
    const record = isPlainObject(value) ? value : {};

    return Object.entries(schema.fields).every(([key, childSchema]) =>
      shouldHidePayoutField(childSchema, record[key]),
    );
  }

  if (schema.kind === 'array') {
    if (schema.required) {
      return false;
    }

    if (!Array.isArray(value) || value.length === 0) {
      return true;
    }

    return value.every((item) => shouldHidePayoutField(schema.itemSchema, item));
  }

  if (schema.required) {
    return false;
  }

  return isPlaceholderOptionalValue(value);
};

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
      const normalized = currentValue === undefined || currentValue === null ? nextContainer : clone(currentValue);
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
  schemaMap: PayoutFieldMap;
  values: Record<string, unknown>;
  pathPrefix: Array<string | number>;
  onChange: (path: Array<string | number>, value: unknown) => void;
}) =>
  Object.entries(schemaMap).map(([key, schema]) => {
    const value = values[key];
    const fieldPath = [...pathPrefix, key];
    const pathKey = fieldPath.join('.');

    if (shouldHidePayoutField(schema, value)) {
      return null;
    }

    if (schema.kind === 'object') {
      const objectValues = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      return (
        <fieldset className={fieldsetClassName} key={pathKey}>
          <legend className="px-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
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
          <div className="flex items-center justify-between gap-3 text-[13px] text-[color:var(--color-text-muted)]">
            <span>{schema.label}</span>
            <span>{items.length} items</span>
          </div>
          {items.map((item, index) => (
            <fieldset className={fieldsetClassName} key={`${pathKey}.${index}`}>
              <legend className="px-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
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
        <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3" key={pathKey}>
          <input
            className="h-4 w-4 accent-[var(--color-primary)]"
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(fieldPath, event.target.checked)}
          />
          <span className="text-sm text-[var(--color-text)]">
            {schema.label}
            {schema.required ? ' *' : ''}
          </span>
        </label>
      );
    }

    if (schema.kind === 'select') {
      return (
        <label className={fieldLabelClassName} key={pathKey}>
          <span className={fieldLabelTextClassName}>
            {schema.label}
            {schema.required ? ' *' : ''}
          </span>
          <select
            className={inputClassName}
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

    return (
      <label className={fieldLabelClassName} key={pathKey}>
        <span className={fieldLabelTextClassName}>
          {schema.label}
          {schema.required ? ' *' : ''}
        </span>
        <input
          className={inputClassName}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(fieldPath, event.target.value)}
        />
      </label>
    );
  });

/**
 * Renders the payout operator page for editing defaults, previewing payloads, and sending payout tests.
 *
 * @returns The payout test workbench page.
 */
export function PayoutPage() {
  const [form, setForm] = useState<PayoutFormValues | null>(null);
  const [commonSchema, setCommonSchema] = useState<PayoutFieldMap>({});
  const [channelSchema, setChannelSchema] = useState<PayoutFieldMap>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [preview, setPreview] = useState<PayoutPreviewResponse | null>(null);
  const [result, setResult] = useState<PayoutCreateResponse | null>(null);
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'save' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const applyBundle = (response: PayoutDefaultsResponse | PayoutDefaultsSavedResponse) => {
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
      const response = await fetchJson<PayoutDefaultsResponse>(`/api/payout/defaults${query}`);

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
      const response = await fetchJson<PayoutPreviewResponse>('/api/payout/preview', {
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
      const response = await fetch('/api/payout/create', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(form),
      });
      setResult(await normalizeCreateResult(response));
    } catch (caught) {
      setResult({
        requestName: 'payout:create',
        ok: false,
        request: {
          method: 'POST',
          url: '/api/payout/create',
          payload: form,
        },
        error: caught instanceof Error ? caught.message : String(caught),
        message: caught instanceof Error ? caught.message : String(caught),
        durationMs: 0,
      });
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
      const response = await fetchJson<PayoutDefaultsSavedResponse>(
        `/api/payout/defaults?channel=${encodeURIComponent(form.channel)}`,
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
      <LoadingHero
        eyebrow={moduleName}
        title={pageTitle}
        message={loading === 'defaults' ? 'Loading server-side defaults for the selected channel.' : error || 'Unable to load defaults.'}
      />
    );
  }

  return (
    <>
      <PageHero
        eyebrow={moduleName}
        title={pageTitle}
        description="Edit shared payout fields, switch channel-specific payload sections, preview the signed request, and run the test through the local Bun proxy."
        scopeLabel="Payout"
        statusLabel={loading ? loadingLabels[loading] : 'Ready to test'}
      />

      <section className="grid gap-6 lg:grid-cols-[minmax(320px,460px)_minmax(0,1fr)]">
        <form
          className="contents"
          onSubmit={(event) => event.preventDefault()}
        >
          <PageCard className="p-6">
            <SectionHeading title="Request builder" detail={loading ? loadingLabels[loading] : 'Form ready'} />

            <label className={fieldLabelClassName}>
              <span className={fieldLabelTextClassName}>Channel</span>
              <select className={inputClassName} value={form.channel} onChange={(event) => void loadDefaults(event.target.value)}>
                {channels.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 border-t border-white/10 pt-5">
              <SectionHeading title="Shared fields" />
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

            <div className="mt-4 border-t border-white/10 pt-5">
              <SectionHeading title="Channel fields" />
              {renderSchemaMap({
                schemaMap: channelSchema,
                values: form.channelValues,
                pathPrefix: [],
                onChange: updateChannelValue,
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <ActionButton type="button" onClick={() => void loadDefaults(form.channel)} disabled={loading !== null}>
                Reload defaults
              </ActionButton>
              <ActionButton type="button" onClick={() => void submitPreview()} disabled={loading !== null}>
                Preview request
              </ActionButton>
              <ActionButton type="button" tone="primary" onClick={() => void submitCreate()} disabled={loading !== null}>
                Send request
              </ActionButton>
              <ActionButton type="button" tone="ghost" onClick={() => void saveDefaults()} disabled={loading !== null}>
                Save defaults
              </ActionButton>
            </div>

            {error ? <p className="mt-4 text-sm text-[color:var(--color-text-muted)]">{error}</p> : null}
            {saveMessage ? <p className="mt-4 text-sm text-emerald-200">{saveMessage}</p> : null}
          </PageCard>
        </form>

        <section className="grid min-w-0 content-start gap-6">
          <JsonPanel title="Request preview" body={preview} emptyState={previewEmptyState} />
          <ResultPanel statusLabel={result?.status ? `Status ${result.status}` : null} raw={result} emptyState={resultEmptyState} />
        </section>
      </section>
    </>
  );
}
