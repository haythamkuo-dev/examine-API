import { startTransition, useEffect, useRef, useState } from 'react';
import type {
  PayoutCreateResponse,
  PayoutDefaultsResponse,
  PayoutDefaultsSavedResponse,
  PayoutFieldMap,
  PayoutFormValues,
  PayoutPreviewResponse,
  PayoutRequestValues,
} from '../../src/payout/web';
import {
  createPayoutRequest,
  fetchPayoutDefaults,
  generatePayoutMerchantReference,
  previewPayoutRequest,
  savePayoutDefaults,
} from '../pages/helper/operatorApi';
import {
  extractMerchantReferenceValue,
  buildApiLogContext,
  showApiKeyResetToast,
  type ApiResultView,
  type OperatorEnvironmentMode,
  updatePathValue,
} from '../pages/helper/operatorShared';
import type {
  FieldVisibilityResolver,
  RequestBuilderFieldOverride,
  SharedFieldSchema,
} from '../pages/requestBuilder';
import { usePersistentApiKey } from './usePersistentApiKey';

const optionalFieldMarker = '非必填';
const defaultsEndpoint = '/api/payout/defaults';
const previewEndpoint = '/api/payout/preview';
const createEndpoint = '/api/payout/create';
const merchantReferenceEndpoint = '/api/payout/merchant-reference';
const merchantReferenceFieldKey = 'merchantReference';
const specialPayoutChannels = new Set<PayoutFormValues['channel']>(['imps', 'bd_wallet']);

const shouldPreservePayoutApiKey = (
  currentChannel: PayoutFormValues['channel'] | undefined,
  nextChannel: string,
): boolean =>
  !specialPayoutChannels.has(nextChannel as PayoutFormValues['channel']) &&
  (!currentChannel || !specialPayoutChannels.has(currentChannel));

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
  const [loading, setLoading] = useState<'defaults' | 'preview' | 'create' | 'generate' | 'save' | null>('defaults');
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [persistedMerchantReference, setPersistedMerchantReference] = useState<string | null>(null);
  const defaultsLogContext = buildApiLogContext(defaultsEndpoint, mode);
  const previewLogContext = buildApiLogContext(previewEndpoint, mode);
  const createLogContext = buildApiLogContext(createEndpoint, mode);
  const generateLogContext = buildApiLogContext(merchantReferenceEndpoint, mode);

  const applyBundle = (
    response: PayoutDefaultsResponse | PayoutDefaultsSavedResponse,
    options?: { preserveMerchantReference?: string | null; preserveApiKey?: boolean },
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
    setPersistedMerchantReference(response.form.commonValues.merchantReference);
    setForm({
      ...response.form,
      commonValues: {
        ...response.form.commonValues,
        merchantReference:
          options?.preserveMerchantReference ?? response.form.commonValues.merchantReference,
      },
    });
  };

  const loadDefaults = async (
    channel?: string,
    options?: { preserveMerchantReference?: string | null; preserveApiKey?: boolean },
  ) => {
    setLoading('defaults');
    setError(null);
    setSaveMessage(null);
    setPreview(null);
    setResult(null);

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
    void loadDefaults(form?.channel, {
      preserveMerchantReference: form?.commonValues.merchantReference ?? null,
    });
  }, [mode]);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  const createSavePayload = (values: PayoutFormValues): PayoutFormValues => ({
    ...values,
    commonValues: {
      ...values.commonValues,
      merchantReference:
        persistedMerchantReference ?? values.commonValues.merchantReference,
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

    setForm((current) =>
      current
        ? {
            ...current,
            commonValues: {
              ...current.commonValues,
              merchantReference: response.merchantReference,
            },
          }
        : current,
    );

    return nextValues;
  };

  const submitPreview = async () => {
    if (!form) return;

    setLoading('preview');
    setError(null);
    setSaveMessage(null);

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
        setForm((current) =>
          current
            ? {
                ...current,
                commonValues: {
                  ...current.commonValues,
                  merchantReference,
                },
              }
            : current,
        );
      }

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
      const message = caught instanceof Error ? caught.message : String(caught);

      setResult({
        ok: false,
        action: 'create',
        status: null,
        message,
        logContext: createLogContext,
        raw: {
          ok: false,
          action: 'create',
          status: null,
          message,
        },
      });
    } finally {
      setLoading(null);
    }
  };

  const generateMerchantReference = async () => {
    if (!form) return;

    setLoading('generate');
    setError(null);
    setSaveMessage(null);

    try {
      const response = await generatePayoutMerchantReference(mode);

      setForm((current) =>
        current
          ? {
              ...current,
              commonValues: {
                ...current.commonValues,
                merchantReference: response.merchantReference,
              },
            }
          : current,
      );
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
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);

      setResult({
        ok: false,
        action: 'generate',
        status: null,
        message,
        logContext: generateLogContext,
        raw: {
          ok: false,
          action: 'generate',
          status: null,
          message,
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
      const response = await savePayoutDefaults(
        mode,
        form.channel,
        createSavePayload(form),
      );
      apiKeyRef.current = response.apiKey;
      setApiKey(response.apiKey);
      setPersistedMerchantReference(response.form.commonValues.merchantReference);
      showApiKeyResetToast();
      setSaveMessage(`Saved defaults for ${response.channel}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(null);
    }
  };

  const commonFieldOverrides: Record<string, RequestBuilderFieldOverride> = {
    [merchantReferenceFieldKey]: {
      readOnly: true,
      action: {
        label: 'Generate',
        onClick: () => void generateMerchantReference(),
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
    result,
    loading,
    error,
    saveMessage,
    defaultsLogContext,
    previewLogContext,
    createLogContext,
    commonFieldOverrides,
    visibilityResolver: shouldHidePayoutField as FieldVisibilityResolver,
    updateApiKey: (value: string) => {
      apiKeyRef.current = value;
      setApiKey(value);
    },
    updateCommonValue,
    updateChannelValue,
    onChannelChange: (channel: string) =>
      void loadDefaults(channel, {
        preserveMerchantReference: form?.commonValues.merchantReference ?? null,
        preserveApiKey: shouldPreservePayoutApiKey(form?.channel, channel),
      }),
    actions: form
      ? [
          {
            label: 'Reload defaults',
            onClick: () =>
              void loadDefaults(form.channel, {
                preserveMerchantReference: form.commonValues.merchantReference,
              }),
          },
          { label: 'New draft', onClick: () => void loadDefaults(form.channel) },
          { label: 'Preview request', onClick: () => void submitPreview() },
          { label: 'Send request', tone: 'primary' as const, onClick: () => void submitCreate() },
          { label: 'Save defaults', tone: 'ghost' as const, onClick: () => void saveDefaults() },
        ]
      : [],
  };
}
