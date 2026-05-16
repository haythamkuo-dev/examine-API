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
import { ActionButton, JsonPanel, LoadingHero, PageCard, PageHero, ResultPanel, SectionHeading } from './pageChrome';

const jsonHeaders = { 'Content-Type': 'application/json' };
const fieldsetClassName = 'mb-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4';
const fieldLabelClassName = 'mb-4 grid gap-2';
const fieldLabelTextClassName = 'text-[13px] font-medium tracking-[0.01em] text-[color:var(--color-text-muted)]';
const inputClassName =
  'w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[var(--color-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
const textareaClassName = `${inputClassName} min-h-24 resize-y`;
const pageTitle = 'Deposit Operator Console';
const moduleName = 'Deposit Module';
const previewEmptyState = 'Run a preview to inspect the exact request body, URL, and masked headers.';
const resultEmptyState = 'Send a request to capture the raw response, status code, and any diagnostic hint.';

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

    if (schema.kind === 'textarea') {
      return (
        <label className={fieldLabelClassName} key={pathKey}>
          <span className={fieldLabelTextClassName}>
            {schema.label}
            {schema.required ? ' *' : ''}
          </span>
          <textarea
            className={textareaClassName}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(fieldPath, event.target.value)}
          />
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
 * Renders the deposit operator page for editing defaults, previewing payloads, and sending test requests.
 *
 * @returns The deposit test workbench page.
 */
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
        description="Edit shared request fields, switch channel-specific payload sections, preview the signed request, and run the test through the local Bun proxy."
        scopeLabel="Deposit"
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
          </PageCard>
        </form>

        <section className="grid min-w-0 content-start gap-6">
          <JsonPanel title="Request preview" body={preview} emptyState={previewEmptyState} />
          <ResultPanel
            statusLabel={apiResult ? `${apiResult.action.toUpperCase()}${apiResult.status !== null ? ` Status ${apiResult.status}` : ''}` : null}
            message={apiResult?.message ?? null}
            details={apiResult?.details ?? null}
            ok={apiResult?.ok}
            raw={apiResult?.raw}
            emptyState={resultEmptyState}
          />
        </section>
      </section>
    </>
  );
}
