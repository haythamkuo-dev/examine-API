import { startTransition, useEffect, useRef, useState } from 'react';
import type {
  DepositDefaultsResponse,
  DepositFieldMap,
  DepositFormValues,
  DepositPreviewResponse,
} from '../../src/deposit/web';
import {
  createDepositRequest,
  fetchDepositDefaults,
  generateDepositMerchantRef,
  previewDepositRequest,
} from '../pages/helper/operatorApi';
import {
  extractMerchantReferenceValue,
  buildApiLogContext,
  buildFailureResult,
  getNumericStatus,
  type ApiResultView,
  type OperatorEnvironmentMode,
  updatePathValue,
} from '../pages/helper/operatorShared';
import type { RequestBuilderFieldOverride } from '../pages/requestBuilder';
import { clearSessionDraft, readSessionDraft, writeSessionDraft } from './sessionDraft';
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
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'generate' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const defaultsLogContext = buildApiLogContext(defaultsEndpoint, mode);
  const previewLogContext = buildApiLogContext(previewEndpoint, mode);
  const createLogContext = buildApiLogContext(createEndpoint, mode);
  const generateLogContext = buildApiLogContext(merchantRefEndpoint, mode);

  const buildDraftScope = (channel: DepositFormValues['channel']) => ({
    domain: 'deposit' as const,
    channel,
    targetEnvironment: mode,
  });

  const commitForm = (nextForm: DepositFormValues) => {
    setForm(nextForm);
    writeSessionDraft(buildDraftScope(nextForm.channel), nextForm);
  };

  const updateForm = (updater: (current: DepositFormValues) => DepositFormValues) => {
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
    response: DepositDefaultsResponse,
    options?: { preserveApiKey?: boolean },
  ) => {
    const draft = readSessionDraft<DepositFormValues>(buildDraftScope(response.form.channel));
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
    setForm(nextForm);
  };

  const loadDefaults = async (
    channel?: string,
    options?: { clearDraft?: boolean; preserveApiKey?: boolean },
  ) => {
    setLoading('defaults');
    setError(null);
    setPreview(null);
    setApiResult(null);

    if (channel && options?.clearDraft) {
      clearSessionDraft(buildDraftScope(channel as DepositFormValues['channel']));
    }

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

  const submitPreview = async () => {
    if (!form) return;

    setLoading('preview');
    setError(null);

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
          response: response.response ?? null,
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
    onChannelChange: (channel: string) => {
      setForm((current) =>
        current
          ? {
              ...current,
              channel: channel as DepositFormValues['channel'],
            }
          : current,
      );
      void loadDefaults(channel, {
        preserveApiKey: shouldPreserveDepositApiKey(form?.channel, channel),
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
          { label: 'Preview request', tone: 'secondary' as const, onClick: () => void submitPreview() },
          { label: 'Send request', tone: 'primary' as const, onClick: () => void submitCreate() },
        ]
      : [],
  };
}
