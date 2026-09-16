/// <reference lib="dom" />

import { act, type ReactNode } from 'react';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { expect } from 'bun:test';
import { AppThemeProvider } from './pageChrome';
import { ModalProvider } from './utils/modal';

export type FetchRequestRecord<TBody = unknown> = {
  body: TBody | null;
  headers: Headers;
  method: string;
  url: string;
};

export type MockRouteHandler<TBody = unknown> = (
  request: FetchRequestRecord<TBody>,
) => Response | Promise<Response>;

type FetchHarnessOptions<TBody> = {
  parseBody: (body: BodyInit | null | undefined) => TBody | null;
  routeKey?: (method: string, url: string) => string;
};

export type PageTestView = ReturnType<typeof renderPage>;

/**
 * Builds a JSON response for page-level fetch mocks.
 *
 * @param body Response payload.
 * @param init Optional response settings.
 * @returns A JSON response with the standard test content type.
 * @throws {TypeError} When the payload cannot be serialized by JSON.stringify.
 */
export const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

/**
 * Builds a plain-text response for page-level fetch mocks.
 *
 * @param body Response text.
 * @param init Optional response settings.
 * @returns A plain-text response.
 * @throws {TypeError} When the response body cannot be accepted by Response.
 */
export const textResponse = (body: string, init?: ResponseInit): Response =>
  new Response(body, {
    headers: { 'Content-Type': 'text/plain' },
    ...init,
  });

/**
 * Renders a page with the providers required by the application shell.
 *
 * @param ui Page element to render.
 * @returns Testing Library queries scoped to the rendered page container.
 * @throws {Error} When the page or its providers cannot be rendered.
 */
export const renderPage = (ui: ReactNode) => {
  const view = render(
    <AppThemeProvider>
      <ModalProvider>{ui}</ModalProvider>
    </AppThemeProvider>,
  );

  return { ...view, ...within(view.container) };
};

/**
 * Parses a JSON request body in a type-safe test boundary.
 *
 * @param body Request body to parse.
 * @returns Parsed request body or null for an empty/non-string body.
 * @throws {SyntaxError} When the request body is not valid JSON.
 */
export const readJsonBody = <TBody,>(body: BodyInit | null | undefined): TBody | null => {
  if (typeof body !== 'string' || !body.trim()) {
    return null;
  }

  return JSON.parse(body) as TBody;
};

/**
 * Creates an isolated fetch route registry and request recorder for page tests.
 *
 * @param options Body parser and optional route-key resolver.
 * @returns Controls for recording requests, registering handlers, and installing the fetch mock.
 * @throws {Error} When a page requests a route without a registered handler.
 */
export const createFetchHarness = <TBody,>(options: FetchHarnessOptions<TBody>) => {
  const records: FetchRequestRecord<TBody>[] = [];
  let routeHandlers = new Map<string, MockRouteHandler<TBody>>();
  const routeKey = options.routeKey ?? ((method, url) => `${method} ${url}`);

  const setHandlers = (handlers: Record<string, MockRouteHandler<TBody>>): void => {
    routeHandlers = new Map(Object.entries(handlers));
  };

  const setHandler = (key: string, handler: MockRouteHandler<TBody>): void => {
    routeHandlers.set(key, handler);
  };

  const reset = (): void => {
    records.length = 0;
    routeHandlers = new Map();
  };

  const install = (): void => {
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const record: FetchRequestRecord<TBody> = {
        url,
        method,
        body: options.parseBody(init?.body),
        headers: new Headers(init?.headers),
      };

      records.push(record);

      const handler = routeHandlers.get(routeKey(method, url));
      if (!handler) {
        throw new Error(`Unexpected fetch request: ${method} ${url}`);
      }

      return await handler(record);
    }) as typeof fetch;
  };

  return { records, reset, setHandler, setHandlers, install };
};

/**
 * Updates a text field through the shared modal editor.
 *
 * @param view Rendered page queries.
 * @param buttonName Accessible name of the button that opens the modal.
 * @param fieldLabel Accessible label of the modal input.
 * @param value Value entered into the field.
 * @param action Modal action to click after editing.
 * @returns A promise that resolves after the modal action completes.
 * @throws {Error} When the editor controls cannot be found.
 */
export const updateModalField = async (
  view: PageTestView,
  buttonName: string,
  fieldLabel: string,
  value: string,
  action: 'Confirm' | 'Cancel' = 'Confirm',
): Promise<void> => {
  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: buttonName }));
  });

  await waitFor(() => {
    expect(view.getByRole('dialog')).toBeInTheDocument();
  });

  await act(async () => {
    fireEvent.input(view.getByLabelText(fieldLabel), {
      target: { value },
    });
  });

  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: action }));
  });
};

/**
 * Updates the API key through the shared modal editor.
 *
 * @param view Rendered page queries.
 * @param value API key draft value.
 * @param action Modal action to click after editing.
 * @returns A promise that resolves after the modal action completes.
 * @throws {Error} When the API key editor controls cannot be found.
 */
export const updateApiKeyFromModal = (
  view: PageTestView,
  value: string,
  action: 'Confirm' | 'Cancel' = 'Confirm',
): Promise<void> => updateModalField(view, 'Edit API key', 'API key', value, action);
