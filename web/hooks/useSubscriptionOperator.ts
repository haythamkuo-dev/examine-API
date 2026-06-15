import { startTransition, useEffect, useRef, useState } from 'react';
import type {
  SubscriptionDefaultsResponse,
  SubscriptionDefaultsSavedResponse,
  SubscriptionFieldMap,
  SubscriptionFormValues,
  SubscriptionPreviewResponse,
  SubscriptionRequestValues,
} from '../../src/subscription/web';
import { missingSubscriptionPlanCode } from '../../src/subscription/web';
import {
  createSubscriptionRequest,
  fetchSubscriptionDefaults,
  generateSubscriptionMerchantRef,
  previewSubscriptionRequest,
  saveSubscriptionDefaults,
} from '../pages/helper/operatorApi';
import {
  ApiRequestError,
  extractMerchantReferenceValue,
  buildApiLogContext,
  buildFailureResult,
  getNumericStatus,
  showApiKeyResetToast,
  type ApiResultView,
  type OperatorEnvironmentMode,
  updatePathValue,
} from '../pages/helper/operatorShared';
import type { RequestBuilderFieldOverride } from '../pages/requestBuilder';
import { usePersistentApiKey } from './usePersistentApiKey';

const defaultsEndpoint = '/api/subscription/defaults';
const previewEndpoint = '/api/subscription/preview';
const createEndpoint = '/api/subscription/create';
const merchantRefEndpoint = '/api/subscription/merchant-ref';
const merchantRefFieldKey = 'merchantRef';
const subscriptionDraftPlanIdKey = 'subs_plan_id';
const isBlankMerchantRef = (value: string): boolean => !value.trim();
const missingPlanMessageFallback = 'Subscription plan configuration is missing for the selected channel.';

type OperatorApiErrorBody = {
  code?: string;
  message?: string;
};

const parseOperatorApiErrorBody = (rawBody: string): OperatorApiErrorBody | null => {
  const trimmedBody = rawBody.trim();
  if (!trimmedBody) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmedBody) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as OperatorApiErrorBody;
  } catch {
    return null;
  }
};

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
 * Manages page-local state and request handlers for the subscription operator screen.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @returns Subscription form state, log contexts, field overrides, and page actions.
 */
export function useSubscriptionOperator(mode: OperatorEnvironmentMode) {
  const [form, setForm] = useState<SubscriptionFormValues | null>(null);
  const [apiKey, setApiKey] = usePersistentApiKey('');
  const [commonSchema, setCommonSchema] = useState<SubscriptionFieldMap>({});
  const [channelSchema, setChannelSchema] = useState<SubscriptionFieldMap>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [resolvedPlanId, setResolvedPlanId] = useState('');
  const [preview, setPreview] = useState<SubscriptionPreviewResponse | null>(null);
  const [apiResult, setApiResult] = useState<ApiResultView | null>(null);
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'generate' | 'save' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const [persistedMerchantRef, setPersistedMerchantRef] = useState<string | null>(null);
  const [hasMissingPlanConfig, setHasMissingPlanConfig] = useState(false);
  const apiKeyRef = useRef(apiKey);
  const latestDefaultsRequestIdRef = useRef(0);
  const defaultsLogContext = buildApiLogContext(defaultsEndpoint, mode);
  const previewLogContext = buildApiLogContext(previewEndpoint, mode);
  const createLogContext = buildApiLogContext(createEndpoint, mode);
  const generateLogContext = buildApiLogContext(merchantRefEndpoint, mode);

  const applyBundle = (
    response: SubscriptionDefaultsResponse | SubscriptionDefaultsSavedResponse,
    options?: { preserveMerchantRef?: string | null; preserveApiKey?: boolean },
  ) => {
    setChannels(response.availableChannels);
    if (options?.preserveApiKey) {
      apiKeyRef.current = apiKeyRef.current || response.apiKey;
    } else {
      apiKeyRef.current = response.apiKey;
      setApiKey(response.apiKey);
    }
    setCommonSchema(response.commonSchema);
    setChannelSchema(response.channelSchema);
    setResolvedPlanId(response.resolvedPlanId);
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
    options?: { preserveMerchantRef?: string | null; preserveApiKey?: boolean },
  ) => {
    const requestId = latestDefaultsRequestIdRef.current + 1;
    latestDefaultsRequestIdRef.current = requestId;
    setLoading('defaults');
    setError(null);
    setHasMissingPlanConfig(false);
    setPreview(null);
    setApiResult(null);

    try {
      const response = await fetchSubscriptionDefaults(mode, channel);
      if (latestDefaultsRequestIdRef.current !== requestId) {
        return;
      }

      startTransition(() => {
        applyBundle(response, options);
        setLoading(null);
      });
    } catch (caught) {
      if (latestDefaultsRequestIdRef.current !== requestId) {
        return;
      }

      setError(caught instanceof Error ? caught.message : String(caught));
      if (caught instanceof ApiRequestError) {
        const errorBody = parseOperatorApiErrorBody(caught.rawBody);
        if (errorBody?.code === missingSubscriptionPlanCode) {
          setHasMissingPlanConfig(true);
          setResolvedPlanId('');
          setError(errorBody.message || missingPlanMessageFallback);
          setLoading(null);
          return;
        }
      }

      setLoading(null);
    }
  };

  useEffect(() => {
    void loadDefaults(form?.channel, { preserveMerchantRef: form?.commonValues.merchantRef ?? null });
  }, [mode]);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  const createSavePayload = (values: SubscriptionFormValues): SubscriptionFormValues => ({
    ...values,
    commonValues: {
      ...values.commonValues,
      merchantRef: persistedMerchantRef ?? values.commonValues.merchantRef,
    },
    channelValues: Object.fromEntries(
      Object.entries(values.channelValues).filter(([key]) => key !== subscriptionDraftPlanIdKey),
    ),
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

  const ensureMerchantRef = async (
    values: SubscriptionFormValues,
  ): Promise<SubscriptionFormValues> => {
    if (!isBlankMerchantRef(values.commonValues.merchantRef)) {
      return values;
    }

    const response = await generateSubscriptionMerchantRef(mode);
    const nextValues: SubscriptionFormValues = {
      ...values,
      commonValues: {
        ...values.commonValues,
        merchantRef: response.merchantRef,
      },
    };

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

    return nextValues;
  };

  const submitPreview = async () => {
    if (!form) return;

    setLoading('preview');

    try {
      const response = await previewSubscriptionRequest(mode, {
        ...form,
        apiKey: apiKeyRef.current,
      });
      const merchantRef = extractMerchantReferenceValue(
        response.request.payload,
        'merchant_ref',
      );

      if (merchantRef) {
        setForm((current) =>
          current
            ? {
                ...current,
                commonValues: {
                  ...current.commonValues,
                  merchantRef,
                },
              }
            : current,
        );
      }

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
      const nextForm = await ensureMerchantRef(form);
      const response = await createSubscriptionRequest(mode, {
        ...nextForm,
        apiKey: apiKeyRef.current,
      });
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
      const response = await generateSubscriptionMerchantRef(mode);
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
        mode,
        form.channel,
        createSavePayload(form),
      );
      apiKeyRef.current = response.apiKey;
      setApiKey(response.apiKey);
      setResolvedPlanId(response.resolvedPlanId);
      setPersistedMerchantRef(response.form.commonValues.merchantRef);
      showApiKeyResetToast();
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
        tone: 'secondary',
        onClick: () => void generateMerchantRef(),
      },
    },
  };

  const canSubmit = !hasMissingPlanConfig;

  return {
    form,
    apiKey,
    commonSchema,
    channelSchema,
    channels,
    resolvedPlanId,
    canSubmit,
    hasMissingPlanConfig,
    preview,
    apiResult,
    loading,
    error,
    defaultsLogContext,
    previewLogContext,
    createLogContext,
    commonFieldOverrides,
    updateApiKey: (value: string) => {
      apiKeyRef.current = value;
      setApiKey(value);
    },
    updateCommonValue,
    updateChannelValue,
    onChannelChange: (channel: string) => {
      setResolvedPlanId('');
      setForm((current) =>
        current
          ? {
              ...current,
              channel: channel as SubscriptionFormValues['channel'],
            }
          : current,
      );
      void loadDefaults(channel, {
        preserveMerchantRef: form?.commonValues.merchantRef ?? null,
        preserveApiKey: true,
      });
    },
    actions: form
      ? [
          {
            label: 'Reload defaults',
            tone: 'ghost' as const,
            onClick: () =>
              void loadDefaults(form.channel, { preserveMerchantRef: form.commonValues.merchantRef }),
          },
          { label: 'New draft', tone: 'ghost' as const, onClick: () => void loadDefaults(form.channel) },
          ...(canSubmit
            ? [
                { label: 'Preview request', tone: 'secondary' as const, onClick: () => void submitPreview() },
                { label: 'Send request', tone: 'primary' as const, onClick: () => void submitCreate() },
                { label: 'Save defaults', tone: 'ghost' as const, onClick: () => void saveDefaults() },
              ]
            : []),
        ]
      : [],
  };
}
