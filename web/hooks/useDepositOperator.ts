import { startTransition, useEffect, useRef, useState } from 'react';
import type {
  DepositDefaultsResponse,
  DepositDefaultsSavedResponse,
  DepositFieldMap,
  DepositFormValues,
  DepositPreviewResponse,
  DepositRequestValues,
} from '../../src/deposit/web';
import {
  createDepositRequest,
  fetchDepositDefaults,
  generateDepositMerchantRef,
  previewDepositRequest,
  saveDepositDefaults,
} from '../pages/helper/operatorApi';
import {
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

const defaultsEndpoint = '/api/deposit/defaults';
const previewEndpoint = '/api/deposit/preview';
const createEndpoint = '/api/deposit/create';
const merchantRefEndpoint = '/api/deposit/merchant-ref';
const merchantRefFieldKey = 'merchantRef';
const productNoFieldKey = 'productNo';
const depositOnlyBadgeLabel = 'ReadOnly';
const specialDepositChannels = new Set<DepositFormValues['channel']>(['bdt_worldpay', 'inr_upi']);

const shouldPreserveDepositApiKey = (
  currentChannel: DepositFormValues['channel'] | undefined,
  nextChannel: string,
): boolean =>
  !specialDepositChannels.has(nextChannel as DepositFormValues['channel']) &&
  (!currentChannel || !specialDepositChannels.has(currentChannel));

/**
 * Manages page-local state and request handlers for the deposit operator screen.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @returns Deposit form state, log contexts, field overrides, and page actions.
 */
export function useDepositOperator(mode: OperatorEnvironmentMode) {
  const [form, setForm] = useState<DepositFormValues | null>(null);
  const [apiKey, setApiKey] = usePersistentApiKey('');
  const apiKeyRef = useRef(apiKey);
  const [commonSchema, setCommonSchema] = useState<DepositFieldMap>({});
  const [channelSchema, setChannelSchema] = useState<DepositFieldMap>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [preview, setPreview] = useState<DepositPreviewResponse | null>(null);
  const [apiResult, setApiResult] = useState<ApiResultView | null>(null);
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'generate' | 'save' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const [persistedMerchantRef, setPersistedMerchantRef] = useState<string | null>(null);
  const defaultsLogContext = buildApiLogContext(defaultsEndpoint, mode);
  const previewLogContext = buildApiLogContext(previewEndpoint, mode);
  const createLogContext = buildApiLogContext(createEndpoint, mode);
  const generateLogContext = buildApiLogContext(merchantRefEndpoint, mode);

  const applyBundle = (
    response: DepositDefaultsResponse | DepositDefaultsSavedResponse,
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
    setLoading('defaults');
    setError(null);
    setPreview(null);
    setApiResult(null);

    try {
      const response = await fetchDepositDefaults(mode, channel);

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
    void loadDefaults(form?.channel, { preserveMerchantRef: form?.commonValues.merchantRef ?? null });
  }, [mode]);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  const createSavePayload = (values: DepositFormValues): DepositFormValues => ({
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
      const response = await previewDepositRequest(mode, {
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
      const response = await createDepositRequest(mode, {
        ...form,
        apiKey: apiKeyRef.current,
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

  const generateMerchantRef = async () => {
    if (!form) return;

    setLoading('generate');

    try {
      const response = await generateDepositMerchantRef(mode);

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
        status: getNumericStatus(response),
        message: 'Merchant reference generated.',
        logContext: generateLogContext,
        raw: {
          ok: true,
          action: 'generate',
          status: getNumericStatus(response),
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
      const response = await saveDepositDefaults(
        mode,
        form.channel,
        createSavePayload(form),
      );
      apiKeyRef.current = response.apiKey;
      setApiKey(response.apiKey);
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
    [productNoFieldKey]: {
      readOnly: true,
      badge: depositOnlyBadgeLabel,
    },
    [merchantRefFieldKey]: {
      readOnly: true,
      action: {
        label: 'Generate',
        tone: 'secondary',
        onClick: () => void generateMerchantRef(),
      },
    },
  };

  return {
    form,
    apiKey,
    commonSchema,
    channelSchema,
    channels,
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
    onChannelChange: (channel: string) =>
      void loadDefaults(channel, {
        preserveMerchantRef: form?.commonValues.merchantRef ?? null,
        preserveApiKey: shouldPreserveDepositApiKey(form?.channel, channel),
      }),
    actions: form
      ? [
          {
            label: 'Reload defaults',
            tone: 'ghost' as const,
            onClick: () =>
              void loadDefaults(form.channel, { preserveMerchantRef: form.commonValues.merchantRef }),
          },
          { label: 'New draft', tone: 'ghost' as const, onClick: () => void loadDefaults(form.channel) },
          { label: 'Preview request', tone: 'secondary' as const, onClick: () => void submitPreview() },
          { label: 'Send request', tone: 'primary' as const, onClick: () => void submitCreate() },
          { label: 'Save defaults', tone: 'ghost' as const, onClick: () => void saveDefaults() },
        ]
      : [],
  };
}
