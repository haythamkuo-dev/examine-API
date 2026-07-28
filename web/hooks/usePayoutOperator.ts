import { startTransition, useEffect, useRef, useState } from 'react';
import type {
  PayoutDefaultsResponse,
  PayoutFieldMap,
  PayoutFormValues,
  PayoutPreviewResponse,
} from '../../src/payout/web';
import {
  createPayoutRequest,
  fetchPayoutDefaults,
  generatePayoutMerchantReference,
  previewPayoutRequest,
} from '../pages/helper/operatorApi';
import {
  extractMerchantReferenceValue,
  buildApiLogContext,
  buildFailureResult,
  type ApiResultView,
  type OperatorEnvironmentMode,
  updatePathValue,
} from '../pages/helper/operatorShared';
import { normalizeOperatorError } from '../pages/helper/operatorError';
import type {
  FieldVisibilityResolver,
  RequestBuilderFieldOverride,
  SharedFieldSchema,
} from '../pages/requestBuilder';
import { clearSessionDraft, readSessionDraft, writeSessionDraft } from './sessionDraft';
import { usePersistentApiKey } from './usePersistentApiKey';

const optionalFieldMarker = '非必填';
const defaultsEndpoint = '/api/payout/defaults';
const previewEndpoint = '/api/payout/preview';
const createEndpoint = '/api/payout/create';
const merchantReferenceEndpoint = '/api/payout/merchant-reference';
const merchantReferenceFieldKey = 'merchantReference';
const productNoFieldKey = 'product_no';
const readOnlyBadgeLabel = 'ReadOnly';
const specialPayoutChannels = new Set<PayoutFormValues['channel']>(['imps', 'bd_wallet']);

const shouldPreservePayoutApiKey = (
  currentChannel: PayoutFormValues['channel'] | undefined,
  nextChannel: string,
): boolean =>
  !specialPayoutChannels.has(nextChannel as PayoutFormValues['channel']) &&
  (!currentChannel || !specialPayoutChannels.has(currentChannel));

const isBlankMerchantReference = (value: string): boolean => !value.trim();

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
      checkoutUrl: null,
    };
  }

  return {
    ok: true,
    action: 'create',
    status: typeof record?.status === 'number' ? record.status : response.status,
    message:
      typeof record?.message === 'string' && record.message.trim()
        ? record.message
        : 'Request sent successfully.',
    raw: { response: record?.response ?? parsedBody },
    checkoutUrl: typeof record?.checkoutUrl === 'string' ? record.checkoutUrl : null,
  };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPlaceholderOptionalValue = (value: unknown): boolean =>
  typeof value === 'string' && value.includes(optionalFieldMarker);

/**
 * Returns whether a payout field should be hidden in the frontend form.
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
 * Manages page-local state and request handlers for the payout operator screen.
 *
 * @param mode Operator environment selected in the frontend UI.
 * @returns Payout form state, log contexts, field overrides, footer messages, and page actions.
 */
export function usePayoutOperator(mode: OperatorEnvironmentMode) {
  const [form, setForm] = useState<PayoutFormValues | null>(null);
  const [apiKey, setApiKey] = usePersistentApiKey('');
  const apiKeyRef = useRef(apiKey);
  const [commonSchema, setCommonSchema] = useState<PayoutFieldMap>({});
  const [channelSchema, setChannelSchema] = useState<PayoutFieldMap>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [preview, setPreview] = useState<PayoutPreviewResponse | null>(null);
  const [result, setResult] = useState<ApiResultView | null>(null);
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'generate' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const defaultsLogContext = buildApiLogContext(defaultsEndpoint, mode);
  const previewLogContext = buildApiLogContext(previewEndpoint, mode);
  const createLogContext = buildApiLogContext(createEndpoint, mode);
  const generateLogContext = buildApiLogContext(merchantReferenceEndpoint, mode);

  const buildDraftScope = (channel: PayoutFormValues['channel']) => ({
    domain: 'payout' as const,
    channel,
    targetEnvironment: mode,
  });

  const commitForm = (nextForm: PayoutFormValues) => {
    setForm(nextForm);
    writeSessionDraft(buildDraftScope(nextForm.channel), nextForm);
  };

  const updateForm = (updater: (current: PayoutFormValues) => PayoutFormValues) => {
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
    response: PayoutDefaultsResponse,
    options?: { preserveApiKey?: boolean },
  ) => {
    const draft = readSessionDraft<PayoutFormValues>(buildDraftScope(response.form.channel));
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
    setResult(null);

    if (channel && options?.clearDraft) {
      clearSessionDraft(buildDraftScope(channel as PayoutFormValues['channel']));
    }

    try {
      const response = await fetchPayoutDefaults(mode, channel);

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

  const ensureMerchantReference = async (
    values: PayoutFormValues,
  ): Promise<PayoutFormValues> => {
    if (!isBlankMerchantReference(values.commonValues.merchantReference)) {
      return values;
    }

    const response = await generatePayoutMerchantReference(mode);
    const nextValues: PayoutFormValues = {
      ...values,
      commonValues: {
        ...values.commonValues,
        merchantReference: response.merchantReference,
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
      const response = await previewPayoutRequest(mode, {
        ...form,
        apiKey: apiKeyRef.current,
      });
      const merchantReference = extractMerchantReferenceValue(
        response.request.payload,
        'merchant_reference',
      );

      if (merchantReference) {
        updateForm((current) => ({
            ...current,
            commonValues: {
              ...current.commonValues,
              merchantReference,
            },
          }));
      }

      setPreview(response);
    } catch (caught) {
      setResult(buildFailureResult('preview', caught, previewLogContext));
      setPreview(null);
    } finally {
      setLoading(null);
    }
  };

  const submitCreate = async () => {
    if (!form) return;

    setLoading('create');
    setError(null);

    try {
      const nextForm = await ensureMerchantReference(form);
      const response = await createPayoutRequest(mode, {
        ...nextForm,
        apiKey: apiKeyRef.current,
      });
      setResult({
        ...(await normalizeCreateResult(response)),
        logContext: createLogContext,
      });
    } catch (caught) {
      setResult(buildFailureResult('create', caught, createLogContext));
    } finally {
      setLoading(null);
    }
  };

  const generateMerchantReference = async () => {
    if (!form) return;

    setLoading('generate');
    setError(null);

    try {
      const response = await generatePayoutMerchantReference(mode);
      updateForm((current) => ({
        ...current,
        commonValues: {
          ...current.commonValues,
          merchantReference: response.merchantReference,
        },
      }));
      setResult({
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
        checkoutUrl: null,
      });
    } catch (caught) {
      setResult(buildFailureResult('generate', caught, generateLogContext));
    } finally {
      setLoading(null);
    }
  };

  const commonFieldOverrides: Record<string, RequestBuilderFieldOverride> = {
    [merchantReferenceFieldKey]: {
      readOnly: true,
      action: {
        label: 'Generate',
        tone: 'secondary',
        onClick: () => void generateMerchantReference(),
      },
    },
  };

  const channelFieldOverrides: Record<string, RequestBuilderFieldOverride> = {
    [productNoFieldKey]: {
      readOnly: true,
      badge: readOnlyBadgeLabel,
    },
  };

  return {
    form,
    apiKey,
    commonSchema,
    channelSchema,
    channels,
    preview,
    result,
    loading,
    error,
    defaultsLogContext,
    previewLogContext,
    createLogContext,
    commonFieldOverrides,
    channelFieldOverrides,
    visibilityResolver: shouldHidePayoutField as FieldVisibilityResolver,
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
              channel: channel as PayoutFormValues['channel'],
            }
          : current,
      );
      void loadDefaults(channel, {
        preserveApiKey: shouldPreservePayoutApiKey(form?.channel, channel),
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
