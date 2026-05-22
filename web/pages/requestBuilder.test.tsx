/// <reference lib="dom" />

import '../../tests/web-setup';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import {
  RequestBuilderCard,
  type RequestBuilderFieldOverride,
  SchemaFields,
  type FieldVisibilityResolver,
  type SharedFieldMap,
} from './requestBuilder';

const schemaMap: SharedFieldMap = {
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
});

describe('SchemaFields', () => {
  test('renders nested object and array fields and emits boolean path changes', () => {
    const onChange = mock<(path: Array<string | number>, value: unknown) => void>();

    const view = render(
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

    const view = render(
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
});

describe('RequestBuilderCard', () => {
  test('renders the shared request builder shell and delegates actions', () => {
    const onChannelChange = mock<(channel: string) => void>();
    const reload = mock<() => void>();
    const preview = mock<() => void>();

    const view = render(
      <RequestBuilderCard
        channels={['alpha', 'beta']}
        selectedChannel="alpha"
        onChannelChange={onChannelChange}
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

    fireEvent.change(view.getByDisplayValue('alpha'), { target: { value: 'beta' } });
    fireEvent.click(view.getByRole('button', { name: 'Reload defaults' }));
    fireEvent.click(view.getByRole('button', { name: 'Preview request' }));

    expect(onChannelChange).toHaveBeenCalledWith('beta');
    expect(reload).toHaveBeenCalled();
    expect(preview).toHaveBeenCalled();
    expect(view.getByText('Footer message')).toBeTruthy();
    expect(view.container.querySelectorAll('button')).toHaveLength(2);
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

    const view = render(
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
