import { startTransition, useEffect, useRef, useState } from 'react';
import type {
  SubscriptionDefaultsResponse,
  SubscriptionFieldMap,
  SubscriptionFormValues,
  SubscriptionPreviewResponse,
} from '../../src/subscription/web';
import { missingSubscriptionPlanCode } from '../../src/subscription/web';
import {
  createSubscriptionRequest,
  fetchSubscriptionDefaults,
  generateSubscriptionMerchantRef,
  previewSubscriptionRequest,
} from '../pages/helper/operatorApi';
import {
  ApiRequestError,
  extractMerchantReferenceValue,
  buildApiLogContext,
  buildFailureResult,
  getNumericStatus,
  type ApiResultView,
  type OperatorEnvironmentMode,
  updatePathValue,
} from '../pages/helper/operatorShared';
import type { RequestBuilderFieldOverride } from '../pages/requestBuilder';
import {
  normalizeOperatorError,
  parseOperatorError,
} from '../pages/helper/operatorError';
import { clearSessionDraft, readSessionDraft, writeSessionDraft } from './sessionDraft';
import { usePersistentApiKey } from './usePersistentApiKey';

const defaultsEndpoint = '/api/subscription/defaults';
const previewEndpoint = '/api/subscription/preview';
const createEndpoint = '/api/subscription/create';
const merchantRefEndpoint = '/api/subscription/merchant-ref';
const merchantRefFieldKey = 'merchantRef';
const isBlankMerchantRef = (value: string): boolean => !value.trim();
const missingPlanMessageFallback = 'Subscription plan configuration is missing for the selected channel.';
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

  const record = isPlainObject(parsedBody) ? parsedBody : null;
  const ok = typeof record?.ok === 'boolean' ? record.ok : response.ok;
  if (!ok) {
    const envelope = normalizeOperatorError(
      parsedBody,
      response.status,
      response.statusText,
    );
    return {
      ok: false,
      action: 'create',
      status: envelope.response.status,
      message: envelope.response.message,
      raw: envelope,
    };
  }

  return {
    ok: true,
    action: 'create',
    status: typeof record?.status === 'number' ? record.status : response.status,
    message: 'Request sent successfully.',
    raw: { response: record?.response ?? parsedBody },
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
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'generate' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const [hasMissingPlanConfig, setHasMissingPlanConfig] = useState(false);
  const apiKeyRef = useRef(apiKey);
  const latestDefaultsRequestIdRef = useRef(0);
  const defaultsLogContext = buildApiLogContext(defaultsEndpoint, mode);
  const previewLogContext = buildApiLogContext(previewEndpoint, mode);
  const createLogContext = buildApiLogContext(createEndpoint, mode);
  const generateLogContext = buildApiLogContext(merchantRefEndpoint, mode);

  const buildDraftScope = (channel: SubscriptionFormValues['channel']) => ({
    domain: 'subscription' as const,
    channel,
    targetEnvironment: mode,
  });

  const commitForm = (nextForm: SubscriptionFormValues) => {
    setForm(nextForm);
    writeSessionDraft(buildDraftScope(nextForm.channel), nextForm);
  };

  const updateForm = (updater: (current: SubscriptionFormValues) => SubscriptionFormValues) => {
    setForm((current) => {
      if (!current) {
        return current;
      }

      const nextForm = updater(current);
      writeSessionDraft(buildDraftScope(nextForm.channel), nextForm);
      return nextForm;
    });
  };

  const applyBundle = (
    response: SubscriptionDefaultsResponse,
    options?: { preserveApiKey?: boolean },
  ) => {
    const draft = readSessionDraft<SubscriptionFormValues>(buildDraftScope(response.form.channel));
    const nextForm = draft || response.form;

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
    setForm(nextForm);
  };

  const loadDefaults = async (
    channel?: string,
    options?: { clearDraft?: boolean; preserveApiKey?: boolean },
  ) => {
    const requestId = latestDefaultsRequestIdRef.current + 1;
    latestDefaultsRequestIdRef.current = requestId;
    setLoading('defaults');
    setError(null);
    setHasMissingPlanConfig(false);
    setPreview(null);
    setApiResult(null);

    if (channel && options?.clearDraft) {
      clearSessionDraft(buildDraftScope(channel as SubscriptionFormValues['channel']));
    }

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
        const errorEnvelope = parseOperatorError(caught.rawBody, caught.status);
        if (errorEnvelope.response.code === missingSubscriptionPlanCode) {
          setHasMissingPlanConfig(true);
          setResolvedPlanId('');
          setError(errorEnvelope.response.message || missingPlanMessageFallback);
          setLoading(null);
          return;
        }
      }

      setLoading(null);
    }
  };

  useEffect(() => {
    void loadDefaults(form?.channel);
  }, [mode]);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  const updateCommonValue = (key: string, value: string) => {
    updateForm((current) => ({
        ...current,
        commonValues: {
          ...current.commonValues,
          [key]: value,
        },
      }));
  };

  const updateChannelValue = (path: Array<string | number>, nextValue: unknown) => {
    updateForm((current) => ({
        ...current,
        channelValues: updatePathValue(current.channelValues, path, nextValue),
      }));
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

    commitForm(nextValues);

    return nextValues;
  };

  const submitPreview = async () => {
    if (!form) return;

    setLoading('preview');
    setError(null);

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
        updateForm((current) => ({
            ...current,
            commonValues: {
              ...current.commonValues,
              merchantRef,
            },
          }));
      }

      setPreview(response);
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
      updateForm((current) => ({
        ...current,
        commonValues: {
          ...current.commonValues,
          merchantRef: response.merchantRef,
        },
      }));
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
        preserveApiKey: true,
      });
    },
    actions: form
      ? [
          {
            label: 'Reload defaults',
            tone: 'ghost' as const,
            onClick: () => void loadDefaults(form.channel, { preserveApiKey: true }),
          },
          {
            label: 'New draft',
            tone: 'ghost' as const,
            onClick: () => void loadDefaults(form.channel, { clearDraft: true, preserveApiKey: true }),
          },
          ...(canSubmit
            ? [
                { label: 'Preview request', tone: 'secondary' as const, onClick: () => void submitPreview() },
                { label: 'Send request', tone: 'primary' as const, onClick: () => void submitCreate() },
              ]
            : []),
        ]
      : [],
  };
}
