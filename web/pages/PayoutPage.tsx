import { startTransition, useEffect, useState } from 'react';
import type {
  PayoutCreateResponse,
  PayoutDefaultsResponse,
  PayoutDefaultsSavedResponse,
  PayoutFieldMap,
  PayoutFormValues,
  PayoutPreviewResponse,
} from '../../src/payout/web';
import {
  JsonPanel,
  LoadingHero,
  OperatorThemeFrame,
  PageHero,
  ResultPanel,
  useOperatorTheme,
} from './pageChrome';
import {
  buildApiLogContext,
  fetchJson,
  jsonHeaders,
  loadingLabels,
  resolveApiUrl,
  type ApiResultView,
  updatePathValue,
} from './operatorShared';
import {
  RequestBuilderCard,
  type FieldVisibilityResolver,
  type SharedFieldSchema,
} from './requestBuilder';

const moduleName = 'Payout Module';
const pageTitle = 'Payout Operator Console';
const previewEmptyState = 'Run a preview to inspect the exact request body, URL, and masked headers.';
const resultEmptyState = 'Send a request to capture the raw response, status code, and diagnostics.';
const optionalFieldMarker = '非必填';

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

const extractCreateDetails = (body: unknown, message: string): string | undefined => {
  if (typeof body === 'string') {
    const summary = body.trim();
    return summary && summary !== message ? summary : undefined;
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim() && record.error !== message) {
      return record.error;
    }
  }

  return undefined;
};

/**
 * Normalizes payout create API responses into a panel-friendly result object.
 *
 * @param response Raw fetch response from `/api/payout/create`.
 * @returns Normalized payload for API result panel rendering.
 */
export const normalizeCreateResult = async (response: Response): Promise<ApiResultView> => {
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
    const record = parsedBody as PayoutCreateResponse;
    const ok = typeof record.ok === 'boolean' ? record.ok : response.ok;
    const status = typeof record.status === 'number' ? record.status : response.status;
    const message =
      ok
        ? typeof record.message === 'string' && record.message.trim()
          ? record.message
          : 'Request sent successfully.'
        : extractCreateMessage(response.statusText, parsedBody);

    return {
      ok,
      action: 'create',
      status,
      message,
      details: ok ? undefined : extractCreateDetails(parsedBody, message),
      raw: parsedBody,
    };
  }

  const message = response.ok ? 'Request sent successfully.' : extractCreateMessage(response.statusText, parsedBody);

  return {
    ok: response.ok,
    action: 'create',
    status: response.status,
    message,
    details: response.ok ? undefined : extractCreateDetails(parsedBody, message),
    raw: {
      ok: response.ok,
      action: 'create',
      status: response.status,
      contentType: contentType || 'unknown',
      body: parsedBody,
    },
  };
};

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
  schema: SharedFieldSchema,
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

/**
 * Renders the payout operator page for editing defaults, previewing payloads, and sending payout tests.
 *
 * @returns The payout test workbench page.
 */
export function PayoutPage() {
  const theme = useOperatorTheme();
  const [form, setForm] = useState<PayoutFormValues | null>(null);
  const [commonSchema, setCommonSchema] = useState<PayoutFieldMap>({});
  const [channelSchema, setChannelSchema] = useState<PayoutFieldMap>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [preview, setPreview] = useState<PayoutPreviewResponse | null>(null);
  const [result, setResult] = useState<ApiResultView | null>(null);
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'save' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const defaultsLogContext = buildApiLogContext('/api/payout/defaults', theme.mode);
  const previewLogContext = buildApiLogContext('/api/payout/preview', theme.mode);
  const createLogContext = buildApiLogContext('/api/payout/create', theme.mode);

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
      const response = await fetch(resolveApiUrl('/api/payout/create'), {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(form),
      });
      setResult({
        ...(await normalizeCreateResult(response)),
        logContext: createLogContext,
      });
    } catch (caught) {
      setResult({
        ok: false,
        action: 'create',
        status: null,
        message: caught instanceof Error ? caught.message : String(caught),
        logContext: createLogContext,
        raw: {
          ok: false,
          action: 'create',
          status: null,
          message: caught instanceof Error ? caught.message : String(caught),
        },
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
      <OperatorThemeFrame>
        <LoadingHero
          eyebrow={moduleName}
          title={pageTitle}
          message={loading === 'defaults' ? 'Loading server-side defaults for the selected channel.' : error || 'Unable to load defaults.'}
          environmentMode={theme.mode}
          onEnvironmentChange={theme.setMode}
          environmentLabel={theme.environmentLabel}
          targetLabel={defaultsLogContext.targetLabel}
        />
      </OperatorThemeFrame>
    );
  }

  return (
    <OperatorThemeFrame>
      <PageHero
        eyebrow={moduleName}
        title={pageTitle}
        description="Edit shared payout fields, switch channel-specific payload sections, preview the signed request, and run the test through the active API target."
        scopeLabel="Payout"
        statusLabel={loading ? loadingLabels[loading] : 'Ready to test'}
        environmentMode={theme.mode}
        onEnvironmentChange={theme.setMode}
        environmentLabel={theme.environmentLabel}
        targetLabel={createLogContext.targetLabel}
      />

      <section className="grid gap-6 lg:grid-cols-[minmax(320px,460px)_minmax(0,1fr)]">
        <form
          className="contents"
          onSubmit={(event) => event.preventDefault()}
        >
          <RequestBuilderCard
            channels={channels}
            selectedChannel={form.channel}
            onChannelChange={(channel) => void loadDefaults(channel)}
            commonSchema={commonSchema}
            commonValues={form.commonValues as Record<string, unknown>}
            onCommonValueChange={updateCommonValue}
            channelSchema={channelSchema}
            channelValues={form.channelValues}
            onChannelValueChange={updateChannelValue}
            loadingLabel={loading ? loadingLabels[loading] : 'Form ready'}
            disabled={loading !== null}
            actions={[
              { label: 'Reload defaults', onClick: () => void loadDefaults(form.channel) },
              { label: 'Preview request', onClick: () => void submitPreview() },
              { label: 'Send request', tone: 'primary', onClick: () => void submitCreate() },
              { label: 'Save defaults', tone: 'ghost', onClick: () => void saveDefaults() },
            ]}
            visibilityResolver={shouldHidePayoutField as FieldVisibilityResolver}
            footer={
              <>
                {error ? <p className="text-sm text-[color:var(--color-text-muted)]">{error}</p> : null}
                {saveMessage ? <p className="text-sm text-[var(--status-success-text)]">{saveMessage}</p> : null}
              </>
            }
          />
        </form>

        <section className="grid min-w-0 content-start gap-6">
          <JsonPanel title="Request preview" body={preview} emptyState={previewEmptyState} logContext={previewLogContext} />
          <ResultPanel
            statusLabel={result?.status !== null && result?.status !== undefined ? `CREATE Status ${result.status}` : null}
            message={result?.message ?? null}
            details={result?.details ?? null}
            ok={result?.ok}
            raw={result?.raw}
            emptyState={resultEmptyState}
            logContext={result?.logContext ?? createLogContext}
          />
        </section>
      </section>
    </OperatorThemeFrame>
  );
}
