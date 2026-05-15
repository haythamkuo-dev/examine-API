import { describe, expect, mock, test } from 'bun:test';
import { createPresetBackedService } from './createPresetBackedService';

const fixedNow = () => new Date('2026-05-15T00:00:00.000Z');
const makeId = (prefix: string) => `${prefix}fixed-id`;
const logger = {
  info: mock(() => undefined),
  warn: mock(() => undefined),
  error: mock(() => undefined),
};

describe('createPresetBackedService', () => {
  test('loads defaults and maps updated presets back into a saved response', async () => {
    const loadPresets = mock(async () => ({ version: 'loaded' }));
    const updatePreset = mock(async (_channel: string, values: { id: string }) => ({ version: values.id }));
    const toDefaultsResponse = mock((channel: string, presets: { version: string }) => ({
      channel,
      version: presets.version,
    }));

    const service = createPresetBackedService({
      loadPresets,
      toDefaultsResponse,
      updatePreset,
      buildPreviewResponse: (values: { id: string }) => ({ preview: values.id }),
      buildRequestFromForm: (values: { id: string }) => ({
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

    expect(loadPresets).toHaveBeenCalledTimes(1);
    expect(updatePreset).toHaveBeenCalledWith('beta', { id: 'saved' });
    expect(toDefaultsResponse).toHaveBeenNthCalledWith(1, 'alpha', { version: 'loaded' });
    expect(toDefaultsResponse).toHaveBeenNthCalledWith(2, 'beta', { version: 'saved' });
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
      loadPresets: async () => ({ version: 'loaded' }),
      toDefaultsResponse: (channel: string, presets: { version: string }) => ({ channel, version: presets.version }),
      updatePreset: async (_channel: string, values: { id: string }) => ({ version: values.id }),
      buildPreviewResponse: (values: { id: string }) => ({ preview: values.id }),
      buildRequestFromForm: (values: { id: string }) => ({
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

    expect(service.preview({ id: 'preview-me' })).toEqual({ preview: 'preview-me' });
    await expect(service.execute({ id: 'preview-me' })).resolves.toEqual({
      ok: true,
      status: 202,
      code: 'accepted',
      requestName: 'create-test',
    });

    expect(buildCreateResponse).toHaveBeenCalledTimes(1);
    expect(httpClient).toHaveBeenCalledTimes(1);
  });
});
