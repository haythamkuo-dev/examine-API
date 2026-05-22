import { startTransition, useEffect, useState } from 'react';
import type {
  SubscriptionDefaultsResponse,
  SubscriptionDefaultsSavedResponse,
  SubscriptionFieldMap,
  SubscriptionFormValues,
  SubscriptionMerchantRefResponse,
  SubscriptionPreviewResponse,
} from '../../src/subscription/web';
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
  getNumericStatus,
  loadingLabels,
  type ApiResultView,
  updatePathValue,
} from './operatorShared';
import {
  createSubscriptionRequest,
  fetchSubscriptionDefaults,
  generateSubscriptionMerchantRef,
  previewSubscriptionRequest,
  saveSubscriptionDefaults,
} from './operatorApi';
import {
  RequestBuilderCard,
  type RequestBuilderFieldOverride,
} from './requestBuilder';

const moduleName = 'Subscription Module';
const pageTitle = 'Subscription Operator Console';
const previewEmptyState = 'Run a preview to inspect the exact subscription request body, URL, and masked headers.';
const resultEmptyState = 'Send a subscription request to capture the raw response, status code, and diagnostics.';
const defaultsEndpoint = '/api/subscription/defaults';
const previewEndpoint = '/api/subscription/preview';
const createEndpoint = '/api/subscription/create';
const merchantRefEndpoint = '/api/subscription/merchant-ref';
const merchantRefFieldKey = 'merchantRef';

/**
 * Normalizes subscription create API responses into a panel-friendly result object.
 *
 * @param response Raw fetch response from `/api/subscription/create`.
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

  if (response.ok && parsedBody && typeof parsedBody === 'object') {
    return {
      ok: true,
      action: 'create',
      status: response.status,
      message: 'Request sent successfully.',
      raw: {
        ok: true,
        action: 'create',
        status: response.status,
        data: parsedBody,
      },
    };
  }

  return {
    ok: response.ok,
    action: 'create',
    status: response.status,
    message: rawBody.trim() || response.statusText || 'Request failed',
    details: rawBody.trim() || undefined,
    raw: {
      ok: response.ok,
      action: 'create',
      status: response.status,
      contentType: contentType || 'unknown',
      body: parsedBody,
    },
  };
};


/**
 * Renders the subscription operator page for editing defaults, previewing payloads, and sending test requests.
 *
 * @returns The subscription test workbench page.
 */
export function SubscriptionPage() {
  const theme = useOperatorTheme();
  const [form, setForm] = useState<SubscriptionFormValues | null>(null);
  const [commonSchema, setCommonSchema] = useState<SubscriptionFieldMap>({});
  const [channelSchema, setChannelSchema] = useState<SubscriptionFieldMap>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [preview, setPreview] = useState<SubscriptionPreviewResponse | null>(null);
  const [apiResult, setApiResult] = useState<ApiResultView | null>(null);
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'generate' | 'save' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const [persistedMerchantRef, setPersistedMerchantRef] = useState<string | null>(null);
  const defaultsLogContext = buildApiLogContext(defaultsEndpoint, theme.mode);
  const previewLogContext = buildApiLogContext(previewEndpoint, theme.mode);
  const createLogContext = buildApiLogContext(createEndpoint, theme.mode);
  const generateLogContext = buildApiLogContext(merchantRefEndpoint, theme.mode);

  const applyBundle = (
    response: SubscriptionDefaultsResponse | SubscriptionDefaultsSavedResponse,
    options?: { preserveMerchantRef?: string | null },
  ) => {
    setChannels(response.availableChannels);
    setCommonSchema(response.commonSchema);
    setChannelSchema(response.channelSchema);
    setPersistedMerchantRef(response.form.commonValues.merchantRef);
    setForm({
      ...response.form,
      commonValues: {
        ...response.form.commonValues,
        merchantRef: options?.preserveMerchantRef ?? response.form.commonValues.merchantRef,
      },
    });
  };

  const loadDefaults = async (
    channel?: string,
    options?: { preserveMerchantRef?: string | null },
  ) => {
    setLoading('defaults');
    setError(null);
    setPreview(null);
    setApiResult(null);

    try {
      const response = await fetchSubscriptionDefaults(theme.mode, channel);

      startTransition(() => {
        applyBundle(response, options);
        setLoading(null);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLoading(null);
    }
  };

  useEffect(() => {
    void loadDefaults();
  }, []);

  const createSavePayload = (values: SubscriptionFormValues): SubscriptionFormValues => ({
    ...values,
    commonValues: {
      ...values.commonValues,
      merchantRef: persistedMerchantRef ?? values.commonValues.merchantRef,
    },
  });

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
      const response = await previewSubscriptionRequest(theme.mode, form);
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
      const response = await createSubscriptionRequest(theme.mode, form);
      setApiResult({
        ...(await normalizeCreateResult(response)),
        logContext: createLogContext,
      });
    } catch (caught) {
      setApiResult(buildFailureResult('create', caught, createLogContext));
    } finally {
      setLoading(null);
    }
  };

  const generateMerchantRef = async () => {
    if (!form) return;

    setLoading('generate');

    try {
      const response = await generateSubscriptionMerchantRef(theme.mode);
      setForm((current) =>
        current
          ? {
              ...current,
              commonValues: {
                ...current.commonValues,
                merchantRef: response.merchantRef,
              },
            }
          : current,
      );
      setApiResult({
        ok: true,
        action: 'generate',
        status: 200,
        message: 'Merchant reference generated.',
        logContext: generateLogContext,
        raw: {
          ok: true,
          action: 'generate',
          status: 200,
          data: response,
        },
      });
    } catch (caught) {
      setApiResult(buildFailureResult('generate', caught, generateLogContext));
    } finally {
      setLoading(null);
    }
  };

  const saveDefaults = async () => {
    if (!form) return;

    setLoading('save');

    try {
      const response = await saveSubscriptionDefaults(
        theme.mode,
        form.channel,
        createSavePayload(form),
      );
      applyBundle(response, { preserveMerchantRef: form.commonValues.merchantRef });
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

  const commonFieldOverrides: Record<string, RequestBuilderFieldOverride> = {
    [merchantRefFieldKey]: {
      readOnly: true,
      action: {
        label: 'Generate',
        onClick: () => void generateMerchantRef(),
      },
    },
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
        description="Edit shared subscription fields, review the signed payload preview, and run the test flow through the active API target."
        scopeLabel="Subscription"
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
            onChannelChange={(channel) =>
              void loadDefaults(channel, { preserveMerchantRef: form.commonValues.merchantRef })
            }
            commonSchema={commonSchema}
            commonValues={form.commonValues as Record<string, unknown>}
            onCommonValueChange={updateCommonValue}
            commonFieldOverrides={commonFieldOverrides}
            channelSchema={channelSchema}
            channelValues={form.channelValues}
            onChannelValueChange={updateChannelValue}
            loadingLabel={loading ? loadingLabels[loading] : 'Form ready'}
            disabled={loading !== null}
            actions={[
              {
                label: 'Reload defaults',
                onClick: () =>
                  void loadDefaults(form.channel, { preserveMerchantRef: form.commonValues.merchantRef }),
              },
              { label: 'New draft', onClick: () => void loadDefaults(form.channel) },
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
