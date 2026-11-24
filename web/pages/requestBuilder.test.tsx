/// <reference lib="dom" />

import '../../tests/web-setup';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import {
  RequestBuilderCard,
  type RequestBuilderFieldOverride,
  SchemaFields,
  type FieldVisibilityResolver,
  type SharedFieldMap,
} from './requestBuilder';
import { ModalProvider } from './utils/modal';

const schemaMap: SharedFieldMap = {
  interval_count: {
    kind: 'number',
    label: 'Interval count',
    required: true,
  },
  enabled: {
    kind: 'boolean',
    label: 'Enabled',
  },
  note: {
    kind: 'textarea',
    label: 'Operator note',
    helperText: 'Visible helper copy',
  },
  method: {
    kind: 'select',
    label: 'Method',
    required: true,
    options: [
      { label: 'Card', value: 'card' },
      { label: 'Wallet', value: 'wallet' },
    ],
  },
  payload: {
    kind: 'object',
    label: 'Payload',
    fields: {
      customerId: {
        kind: 'text',
        label: 'Customer ID',
        required: true,
      },
    },
  },
  items: {
    kind: 'array',
    label: 'Items',
    itemLabel: 'Item',
    itemSchema: {
      kind: 'object',
      label: 'Item object',
      fields: {
        sku: {
          kind: 'text',
          label: 'SKU',
          required: true,
        },
      },
    },
  },
};

beforeEach(() => {
  cleanup();
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
});

const renderScoped = (ui: Parameters<typeof render>[0]) => {
  const view = render(<ModalProvider>{ui}</ModalProvider>);
  return { ...view, ...within(view.container) };
};

describe('SchemaFields', () => {
  test('renders nested object and array fields and emits boolean path changes', () => {
    const onChange = mock<(path: Array<string | number>, value: unknown) => void>();

    const view = renderScoped(
      <SchemaFields
        schemaMap={schemaMap}
        values={{
          enabled: true,
          note: 'Initial note',
          method: 'card',
          payload: { customerId: 'cust-1' },
          items: [{ sku: 'sku-1' }],
        }}
        pathPrefix={[]}
        onChange={onChange}
      />,
    );

    expect(view.getByText('Payload')).toBeTruthy();
    expect(view.getByText('Item 1')).toBeTruthy();
    expect(view.getByText('Visible helper copy')).toBeTruthy();

    fireEvent.click(view.getByLabelText(/Enabled/i));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['enabled'], false);
  });

  test('omits fields hidden by the visibility resolver', () => {
    const visibilityResolver: FieldVisibilityResolver = (schema, value) =>
      schema.label === 'Operator note' && typeof value === 'string' && value.includes('hide');

    const view = renderScoped(
      <SchemaFields
        schemaMap={schemaMap}
        values={{
          enabled: true,
          note: 'hide this field',
          method: 'wallet',
          payload: { customerId: 'cust-1' },
          items: [],
        }}
        pathPrefix={[]}
        onChange={() => undefined}
        visibilityResolver={visibilityResolver}
      />,
    );

    expect(view.queryByText('Operator note')).toBeNull();
    expect(view.getByText('Method *')).toBeTruthy();
  });

  test('renders numeric schema fields as number inputs', () => {
    const view = renderScoped(
      <SchemaFields
        schemaMap={{
          interval_count: schemaMap.interval_count,
        }}
        values={{
          interval_count: 1,
        }}
        pathPrefix={[]}
        onChange={() => undefined}
      />,
    );

    expect(view.getByRole('spinbutton', { name: 'Interval count *' })).toHaveAttribute('type', 'number');
  });
});

describe('RequestBuilderCard', () => {
  test('closes an open channel picker when loading starts and uses fresh channels after reload', async () => {
    const initialOnChannelChange = mock<(channel: string) => void>();
    const latestOnChannelChange = mock<(channel: string) => void>();
    const renderCard = (
      channels: string[],
      selectedChannel: string,
      onChannelChange: (channel: string) => void,
      disabled: boolean,
    ) => (
      <ModalProvider>
        <RequestBuilderCard
          channels={channels}
          selectedChannel={selectedChannel}
          onChannelChange={onChannelChange}
          commonSchema={{}}
          commonValues={{}}
          onCommonValueChange={() => undefined}
          channelSchema={{}}
          channelValues={{}}
          onChannelValueChange={() => undefined}
          loadingLabel={disabled ? 'Loading defaults…' : 'Form ready'}
          disabled={disabled}
          actions={[]}
        />
      </ModalProvider>
    );

    const rendered = render(renderCard(['alpha', 'beta'], 'alpha', initialOnChannelChange, false));
    const view = { ...rendered, ...within(rendered.container) };
    fireEvent.click(view.getByRole('button', { name: /Open channel selector/ }));

    const dialog = await view.findByRole('dialog', { name: 'Select channel' });
    expect(view.getByRole('option', { name: 'beta' })).toBeInTheDocument();

    view.rerender(renderCard(['gamma', 'delta'], 'gamma', latestOnChannelChange, true));
    expect(view.getByRole('button', { name: /Open channel selector/ })).toBeDisabled();
    await waitFor(() => expect(dialog).toHaveClass('modal-panel-exit'));
    fireEvent.animationEnd(dialog.parentElement!, { animationName: 'modal-backdrop-exit' });
    await waitFor(() => expect(view.queryByRole('dialog', { name: 'Select channel' })).not.toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(view.queryByRole('dialog', { name: 'Select channel' })).not.toBeInTheDocument();

    view.rerender(renderCard(['gamma', 'delta'], 'gamma', latestOnChannelChange, false));
    fireEvent.click(view.getByRole('button', { name: /Open channel selector/ }));
    const refreshedDialog = await view.findByRole('dialog', { name: 'Select channel' });
    expect(view.getByRole('option', { name: 'delta' })).toBeInTheDocument();

    fireEvent.click(view.getByRole('option', { name: 'delta' }));
    expect(latestOnChannelChange).toHaveBeenCalledWith('delta');
    fireEvent.animationEnd(refreshedDialog.parentElement!, { animationName: 'modal-backdrop-exit' });
    await waitFor(() => expect(view.queryByRole('dialog', { name: 'Select channel' })).not.toBeInTheDocument());
    expect(initialOnChannelChange).not.toHaveBeenCalled();
  });

  test('opens the channel picker with Control+K and focuses the search field', async () => {
    const view = renderScoped(
      <RequestBuilderCard
        channels={['alpha', 'beta']}
        selectedChannel="alpha"
        onChannelChange={() => undefined}
        commonSchema={{}}
        commonValues={{}}
        onCommonValueChange={() => undefined}
        channelSchema={{}}
        channelValues={{}}
        onChannelValueChange={() => undefined}
        loadingLabel="Form ready"
        disabled={false}
        actions={[]}
      />,
    );

    const trigger = view.getByRole('button', { name: /Open channel selector/ });
    trigger.focus();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const dialog = await view.findByRole('dialog', { name: 'Select channel' });
    const search = view.getByRole('combobox', { name: 'Channel' });

    expect(trigger.getAttribute('aria-keyshortcuts')).toMatch(/^(Meta|Control)\+K$/);
    expect(view.getByText(/^(⌘K|Ctrl K)$/)).toBeInTheDocument();
    expect(search).toHaveFocus();

    fireEvent.keyDown(search, { key: 'Escape' });
    await waitFor(() => expect(dialog).toHaveClass('modal-panel-exit'));
    fireEvent.animationEnd(dialog.parentElement!, { animationName: 'modal-backdrop-exit' });
    await waitFor(() => expect(view.queryByRole('dialog', { name: 'Select channel' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  test('opens the channel picker with Meta+K and ignores the shortcut while editing', async () => {
    const view = renderScoped(
      <RequestBuilderCard
        channels={['alpha', 'beta']}
        selectedChannel="alpha"
        onChannelChange={() => undefined}
        commonSchema={{
          merchantRef: {
            kind: 'text',
            label: 'Merchant ref',
          },
        }}
        commonValues={{ merchantRef: 'merchant-a' }}
        onCommonValueChange={() => undefined}
        channelSchema={{}}
        channelValues={{}}
        onChannelValueChange={() => undefined}
        loadingLabel="Form ready"
        disabled={false}
        actions={[]}
      />,
    );

    const input = view.getByRole('textbox', { name: 'Merchant ref' });
    input.focus();
    fireEvent.keyDown(input, { key: 'k', metaKey: true });
    expect(view.queryByRole('dialog', { name: 'Select channel' })).not.toBeInTheDocument();

    view.getByRole('button', { name: /Open channel selector/ }).focus();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const dialog = await view.findByRole('dialog', { name: 'Select channel' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(view.getByRole('button', { name: 'Close modal' }));
    await waitFor(() => expect(dialog).toHaveClass('modal-panel-exit'));
    fireEvent.animationEnd(dialog.parentElement!, { animationName: 'modal-backdrop-exit' });
    await waitFor(() => expect(view.queryByRole('dialog', { name: 'Select channel' })).not.toBeInTheDocument());
  });

  test('filters products immediately by display label and channel id', () => {
    const view = renderScoped(
      <RequestBuilderCard
        channels={['pix_brl', 'googlepay_usd']}
        selectedChannel="pix_brl"
        onChannelChange={() => undefined}
        channelLabel={(channel) => (channel === 'pix_brl' ? 'Brazil Pix' : 'Google Pay USD')}
        commonSchema={{}}
        commonValues={{}}
        onCommonValueChange={() => undefined}
        channelSchema={{}}
        channelValues={{}}
        onChannelValueChange={() => undefined}
        loadingLabel="Form ready"
        disabled={false}
        actions={[]}
      />,
    );

    fireEvent.click(view.getByRole('button', { name: /Open channel selector/ }));
    expect(view.getByRole('dialog', { name: 'Select channel' })).toBeInTheDocument();

    const search = view.getByRole('combobox', { name: 'Channel' });

    fireEvent.input(search, { target: { value: 'google pay' } });

    expect(view.getByRole('option', { name: 'Google Pay USD' })).toBeInTheDocument();
    expect(view.queryByRole('option', { name: 'Brazil Pix' })).toBeNull();
    expect(view.getByText('1 of 2 products')).toBeInTheDocument();

    fireEvent.input(search, { target: { value: 'pix_brl' } });

    expect(view.getByRole('option', { name: 'Brazil Pix' })).toBeInTheDocument();
    expect(view.queryByRole('option', { name: 'Google Pay USD' })).toBeNull();

    fireEvent.input(search, { target: { value: 'does-not-exist' } });

    expect(view.queryByRole('option', { name: 'Google Pay USD' })).toBeNull();
    expect(view.getByRole('status')).toHaveTextContent('No products match “does-not-exist”.');

    fireEvent.click(view.getByRole('button', { name: 'Close modal' }));
  });

  test('renders the shared request builder shell and delegates actions', () => {
    const onChannelChange = mock<(channel: string) => void>();
    const reload = mock<() => void>();
    const preview = mock<() => void>();

    const view = renderScoped(
      <RequestBuilderCard
        channels={['alpha', 'beta']}
        selectedChannel="alpha"
        onChannelChange={onChannelChange}
        channelDetail={<p>Plan ID detail</p>}
        commonSchema={{
          merchantRef: {
            kind: 'text',
            label: 'Merchant ref',
            required: true,
          },
        }}
        commonValues={{ merchantRef: 'merchant-a' }}
        onCommonValueChange={() => undefined}
        channelSchema={{
          payload: {
            kind: 'object',
            label: 'Payload',
            fields: {
              nested: {
                kind: 'text',
                label: 'Nested',
              },
            },
          },
        }}
        channelValues={{ payload: { nested: 'value-a' } }}
        onChannelValueChange={() => undefined}
        loadingLabel="Form ready"
        disabled={false}
        actions={[
          { label: 'Reload defaults', onClick: reload },
          { label: 'Preview request', tone: 'primary', onClick: preview },
        ]}
        footer={<p>Footer message</p>}
      />,
    );

    fireEvent.click(view.getByRole('button', { name: /Open channel selector/ }));
    const channelSearch = view.getByRole('combobox', { name: 'Channel' });
    fireEvent.input(channelSearch, { target: { value: 'beta' } });
    fireEvent.click(view.getByRole('option', { name: 'beta' }));
    fireEvent.click(view.getByRole('button', { name: 'Reload defaults' }));
    fireEvent.click(view.getByRole('button', { name: 'Preview request' }));

    expect(onChannelChange).toHaveBeenCalledWith('beta');
    expect(reload).toHaveBeenCalled();
    expect(preview).toHaveBeenCalled();
    expect(view.getByText('Plan ID detail')).toBeTruthy();
    expect(view.getByText('Footer message')).toBeTruthy();
    expect(view.getByTestId('request-builder-fields')).toHaveClass(
      'rounded-2xl',
      'border-[var(--operator-card-border)]',
      'bg-[var(--operator-card-bg)]',
    );
    expect(view.getByRole('button', { name: /Open channel selector/ })).toHaveTextContent('alpha');
  });

  test('renders read-only shared fields with an inline action button', () => {
    const generate = mock<() => void>();
    const commonFieldOverrides: Record<string, RequestBuilderFieldOverride> = {
      merchantRef: {
        readOnly: true,
        action: {
          label: 'Generate',
          onClick: generate,
        },
      },
    };

    const view = renderScoped(
      <RequestBuilderCard
        channels={['alpha']}
        selectedChannel="alpha"
        onChannelChange={() => undefined}
        commonSchema={{
          merchantRef: {
            kind: 'text',
            label: 'Merchant ref',
            required: true,
          },
        }}
        commonValues={{ merchantRef: 'merchant-a' }}
        onCommonValueChange={() => undefined}
        commonFieldOverrides={commonFieldOverrides}
        channelSchema={{}}
        channelValues={{}}
        onChannelValueChange={() => undefined}
        loadingLabel="Form ready"
        disabled={false}
        actions={[]}
      />,
    );

    const input = view.getByLabelText('Merchant ref *');

    expect(input).toHaveAttribute('readonly');

    fireEvent.click(view.getByRole('button', { name: 'Generate' }));

    expect(generate).toHaveBeenCalledTimes(1);
  });
});
