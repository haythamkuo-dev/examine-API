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
 * Asserts that a display-only request builder field shows the expected text.
 *
 * @param view Rendered page test view.
 * @param fieldLabel Visible label of the display-only field.
 * @param expectedText Expected displayed value, or an em dash for an empty value.
 * @returns Nothing when the field displays the expected text.
 * @throws {Error} When the field or expected text is not rendered.
 */
export const expectRequestBuilderFieldText = (
  view: PageTestView,
  fieldLabel: string,
  expectedText: string,
): void => {
  const fields = within(view.getByTestId('request-builder-fields'));
  const label = fields.getByText(fieldLabel, { exact: true });
  const field = label.closest('dl');

  if (!field) {
    throw new Error(`${fieldLabel} is not rendered as a definition list field.`);
  }

  expect(within(field).getByText(expectedText, { exact: true })).toBeInTheDocument();
};

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
 * Renders a page with the providers required by page-level tests.
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

const waitForModalClose = async (view: PageTestView, dialog: HTMLElement): Promise<void> => {
  await waitFor(() => expect(dialog).toHaveClass('modal-panel-exit'));

  const overlay = dialog.parentElement;
  if (!overlay) {
    throw new Error('Modal dialog is missing its overlay element.');
  }

  await act(async () => {
    fireEvent.animationEnd(overlay, { animationName: 'modal-backdrop-exit' });
  });

  await waitFor(() => expect(view.queryByRole('dialog')).not.toBeInTheDocument());
};

/**
 * Closes the currently open modal and waits for its exit lifecycle to finish.
 *
 * @param view Rendered page queries.
 * @returns A promise that resolves after the modal is removed from the document.
 * @throws {Error} When no modal close button or modal overlay can be found.
 */
export const closeModal = async (view: PageTestView): Promise<void> => {
  const dialog = view.getByRole('dialog');

  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: 'Close modal' }));
  });

  await waitForModalClose(view, dialog);
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
  const trigger = await waitFor(() => view.getByRole('button', { name: buttonName }));
  await act(async () => {
    fireEvent.click(trigger);
  });

  await waitFor(() => {
    expect(view.getByRole('dialog')).toBeInTheDocument();
  });

  await act(async () => {
    fireEvent.input(view.getByLabelText(fieldLabel), {
      target: { value },
    });
  });

  const dialog = view.getByRole('dialog');
  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: action }));
  });

  await waitForModalClose(view, dialog);
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

/**
 * Opens the shared channel selector modal.
 *
 * @param view Rendered page queries.
 * @returns A promise that resolves after the channel selector modal is visible.
 * @throws {Error} When the channel selector trigger or modal cannot be found.
 */
export const openRequestBuilderChannel = async (view: PageTestView): Promise<void> => {
  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: /Open channel selector/ }));
  });

  await waitFor(() => {
    expect(view.getByRole('dialog', { name: 'Select channel' })).toBeInTheDocument();
  });
};

/**
 * Selects a product through the shared searchable channel modal.
 *
 * @param view Rendered page queries.
 * @param searchValue Value used to filter the product list, usually the raw channel ID.
 * @param optionLabel Accessible product label rendered in the option.
 * @returns A promise that resolves after the option selection event has been dispatched.
 * @throws {Error} When the channel trigger, combobox, or matching product option cannot be found.
 */
export const selectRequestBuilderChannel = async (
  view: PageTestView,
  searchValue: string,
  optionLabel: string,
): Promise<void> => {
  await openRequestBuilderChannel(view);
  const combobox = view.getByRole('combobox', { name: 'Channel' });
  await act(async () => {
    fireEvent.input(combobox, { target: { value: searchValue } });
  });

  const option = await waitFor(() => view.getByRole('option', { name: optionLabel }));
  const dialog = view.getByRole('dialog');

  await act(async () => {
    fireEvent.click(option);
  });

  await waitForModalClose(view, dialog);
};
