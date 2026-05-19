import { startTransition, useEffect, useState } from 'react';
import type {
  DepositCreateResponse,
  DepositDefaultsResponse,
  DepositDefaultsSavedResponse,
  DepositFieldMap,
  DepositFormValues,
  DepositPreviewResponse,
} from '../../src/deposit/web';
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
  buildFailureResult,
  fetchJson,
  getNumericStatus,
  jsonHeaders,
  loadingLabels,
  type ApiResultView,
  updatePathValue,
} from './operatorShared';
import { RequestBuilderCard } from './requestBuilder';

const pageTitle = 'Deposit Operator Console';
const moduleName = 'Deposit Module';
const previewEmptyState = 'Run a preview to inspect the exact request body, URL, and masked headers.';
const resultEmptyState = 'Send a request to capture the raw response, status code, and any diagnostic hint.';

/**
 * Renders the deposit operator page for editing defaults, previewing payloads, and sending test requests.
 *
 * @returns The deposit test workbench page.
 */
export function DepositPage() {
  const theme = useOperatorTheme();
  const [form, setForm] = useState<DepositFormValues | null>(null);
  const [commonSchema, setCommonSchema] = useState<DepositFieldMap>({});
  const [channelSchema, setChannelSchema] = useState<DepositFieldMap>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [preview, setPreview] = useState<DepositPreviewResponse | null>(null);
  const [apiResult, setApiResult] = useState<ApiResultView | null>(null);
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'save' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const defaultsLogContext = buildApiLogContext('/api/deposit/defaults', theme.mode);
  const previewLogContext = buildApiLogContext('/api/deposit/preview', theme.mode);
  const createLogContext = buildApiLogContext('/api/deposit/create', theme.mode);

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
        logContext: previewLogContext,
        raw: {
          ok: true,
          action: 'preview',
          status: getNumericStatus(response),
          data: response,
        },
      });
    } catch (caught) {
      setPreview(null);
      setApiResult(buildFailureResult('preview', caught, previewLogContext));
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
        logContext: createLogContext,
        raw: {
          ok: true,
          action: 'create',
          status: getNumericStatus(response),
          data: response,
        },
      });
    } catch (caught) {
      setApiResult(buildFailureResult('create', caught, createLogContext));
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
        logContext: defaultsLogContext,
        raw: {
          ok: true,
          action: 'save',
          status: getNumericStatus(response),
          data: response,
        },
      });
    } catch (caught) {
      setApiResult(buildFailureResult('save', caught, defaultsLogContext));
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
        description="Edit shared request fields, switch channel-specific payload sections, preview the signed request, and run the test through the active API target."
        scopeLabel="Deposit"
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
          />
        </form>

        <section className="grid min-w-0 content-start gap-6">
          <JsonPanel title="Request preview" body={preview} emptyState={previewEmptyState} logContext={previewLogContext} />
          <ResultPanel
            statusLabel={apiResult ? `${apiResult.action.toUpperCase()}${apiResult.status !== null ? ` Status ${apiResult.status}` : ''}` : null}
            message={apiResult?.message ?? null}
            details={apiResult?.details ?? null}
            ok={apiResult?.ok}
            raw={apiResult?.raw}
            emptyState={resultEmptyState}
            logContext={apiResult?.logContext ?? createLogContext}
          />
        </section>
      </section>
    </OperatorThemeFrame>
  );
}
