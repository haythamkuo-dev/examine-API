import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createPresetBackedService, mergePresetFormValues } from './createPresetBackedService';
import type {
  PresetStorageExpectedTimestamps,
  PresetStorageSnapshot,
} from './presetStorage';

type TestChannel = 'alpha' | 'beta';

const createSnapshot = <Presets,>(presets: Presets): PresetStorageSnapshot<TestChannel, Presets> => ({
  presets,
  projection: {
    commonValues: {},
    channels: {
      alpha: { channelCommonValues: {}, channelValues: {} },
      beta: { channelCommonValues: {}, channelValues: {} },
    },
  },
  updatedAt: null,
  timestamps: {
    feature: null,
    channels: { alpha: null, beta: null },
  },
});

const fixedNow = () => new Date('2026-05-15T00:00:00.000Z');
const makeId = (prefix: string) => `${prefix}fixed-id`;
const logger = {
  info: mock(() => undefined),
  warn: mock(() => undefined),
  error: mock(() => undefined),
};

afterEach(() => {
  logger.info.mockClear();
  logger.warn.mockClear();
  logger.error.mockClear();
  mock.restore();
});

describe('createPresetBackedService', () => {
  test('loads defaults and maps updated presets back into a saved response', async () => {
    const loadPresets = mock(async () => createSnapshot({ version: 'loaded' }));
    const updatePreset = mock(async (
      _channel: TestChannel,
      values: { id: string },
      _expected: PresetStorageExpectedTimestamps<TestChannel>,
    ) => ({ version: values.id }));
    const toDefaultsResponse = mock((channel: TestChannel, presets: { version: string }) => ({
      channel,
      version: presets.version,
    }));

    const service = createPresetBackedService({
      loadPresets,
      toDefaultsResponse,
      updatePreset,
      buildPreviewResponse: (values: { id: string }, target: string) => ({ preview: `${values.id}:${target}` }),
      buildRequestFromForm: (values: { id: string }, _target: string) => ({
        name: 'create-test',
        method: 'POST',
        url: 'https://example.test/requests',
        payload: values,
      }),
      buildCreateResponse: (result) => result,
      logger,
      makeId,
      now: fixedNow,
      httpClient: mock(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    });

    await expect(service.getDefaults('alpha')).resolves.toEqual({
      channel: 'alpha',
      version: 'loaded',
    });
    await expect(service.saveDefaults('beta', { id: 'saved' })).resolves.toEqual({
      ok: true,
      channel: 'beta',
      version: 'saved',
    });

    expect(loadPresets).toHaveBeenCalledTimes(2);
    expect(updatePreset).toHaveBeenCalledWith('beta', { id: 'saved' }, {
      channel: 'beta',
      featureUpdatedAt: null,
      channelUpdatedAt: null,
    });
    expect(toDefaultsResponse).toHaveBeenNthCalledWith(1, 'alpha', { version: 'loaded' }, undefined);
    expect(toDefaultsResponse).toHaveBeenNthCalledWith(2, 'beta', { version: 'saved' }, undefined);
  });

  test('passes preview values through and builds a create response from runner output', async () => {
    const httpClient = mock(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input).toBe('https://example.test/requests');
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(JSON.stringify({ id: 'preview-me' }));

      return new Response(JSON.stringify({ code: 'accepted' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const buildCreateResponse = mock((result) => ({
      ok: result.ok,
      status: result.status,
      code: result.code,
      requestName: result.requestName,
    }));

    const service = createPresetBackedService({
      loadPresets: async () => createSnapshot({ version: 'loaded' }),
      toDefaultsResponse: (channel: string, presets: { version: string }) => ({ channel, version: presets.version }),
      updatePreset: async (
        _channel: string,
        values: { id: string },
        _expected: PresetStorageExpectedTimestamps<string>,
      ) => ({ version: values.id }),
      buildPreviewResponse: (values: { id: string }, target: string) => ({ preview: `${values.id}:${target}` }),
      buildRequestFromForm: (values: { id: string }, _target: string) => ({
        name: 'create-test',
        method: 'POST',
        url: 'https://example.test/requests',
        payload: values,
      }),
      buildCreateResponse,
      logger,
      makeId,
      now: fixedNow,
      httpClient,
    });

    const previewOperation = await service.prepareOperation('alpha', { id: 'preview-me' }, 'local');
    expect(service.preview(previewOperation)).toEqual({ preview: 'preview-me:local' });

    const createOperation = await service.prepareOperation('alpha', { id: 'preview-me' }, 'product');
    await expect(service.execute(createOperation)).resolves.toEqual({
      ok: true,
      status: 202,
      code: 'accepted',
      requestName: 'create-test',
    });

    expect(buildCreateResponse).toHaveBeenCalledTimes(1);
    expect(httpClient).toHaveBeenCalledTimes(1);
  });

  test('builds one operation snapshot by merging persistent values with request overrides', async () => {
    type Values = {
      id: string;
      nested: {
        persistentOnly?: string;
        requestOnly?: string;
      };
    };
    type Presets = { form: Values };

    const loadPresets = mock(async () => createSnapshot<Presets>({
      form: {
        id: 'persistent-id',
        nested: {
          persistentOnly: 'persistent-value',
          requestOnly: 'persistent-request-value',
        },
      },
    }));
    const buildPreviewResponse = mock((values: Values, context: string) => ({
      values,
      context,
    }));

    const service = createPresetBackedService({
      loadPresets,
      toDefaultsResponse: (_channel: string, presets: Presets) => ({ form: presets.form }),
      hydrateValues: (_channel: string, values: Values, presets: Presets) =>
        mergePresetFormValues(presets.form, values),
      updatePreset: async (
        _channel: string,
        _values: Values,
        _expected: PresetStorageExpectedTimestamps<string>,
      ) => ({
        form: {
          id: 'saved-id',
          nested: {},
        },
      }),
      buildPreviewResponse,
      buildRequestFromForm: (values: Values) => ({
        name: 'create-test',
        method: 'POST',
        url: 'https://example.test/requests',
        payload: values,
      }),
      buildCreateResponse: (result) => result,
      logger,
      makeId,
      httpClient: mock(async () => new Response('{}', { status: 200 })),
    });

    const operation = await service.prepareOperation(
      'alpha',
      {
        id: 'request-id',
        nested: {
          requestOnly: 'request-value',
        },
      },
      'local',
    );

    expect(loadPresets).toHaveBeenCalledTimes(1);
    expect(operation.defaults).toEqual({
      form: {
        id: 'persistent-id',
        nested: {
          persistentOnly: 'persistent-value',
          requestOnly: 'persistent-request-value',
        },
      },
    });
    expect(operation.values).toEqual({
      id: 'request-id',
      nested: {
        persistentOnly: 'persistent-value',
        requestOnly: 'request-value',
      },
    });
    expect(service.preview(operation)).toEqual({
      values: operation.values,
      context: 'local',
    });
    expect(buildPreviewResponse).toHaveBeenCalledWith(operation.values, 'local');
  });
});
