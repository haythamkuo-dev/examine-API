/// <reference lib="dom" />

import '../tests/web-setup';
import { beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, within } from '@testing-library/react';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { DEPOSIT_CHANNELS } from '../src/core/env';
import type { DepositDefaultsResponse } from '../src/deposit/web';
import { App } from './App';

const renderApp = (initialEntries: string[]) => {
  const view = render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );

  return { ...view, ...within(view.container) };
};

const primaryDepositChannel = DEPOSIT_CHANNELS[0];

if (!primaryDepositChannel) {
  throw new Error('Deposit channels are not configured.');
}

const createDepositDefaultsResponse = (): DepositDefaultsResponse => ({
  apiKey: 'default-api-key',
  availableChannels: [primaryDepositChannel],
  channel: primaryDepositChannel,
  commonSchema: {
    productNo: { kind: 'text', label: 'Product number', required: true },
    merchantRef: { kind: 'text', label: 'Merchant reference', required: true },
    amount: { kind: 'text', label: 'Amount', required: true },
    currencyCode: {
      kind: 'select',
      label: 'Currency code',
      required: true,
      options: [{ label: 'US Dollar', value: 'USD' }],
    },
    returnUrl: { kind: 'text', label: 'Return URL', required: true },
  },
  channelSchema: {},
  form: {
    channel: primaryDepositChannel,
    commonValues: {
      productNo: 'PROD-TEST',
      merchantRef: 'MERCHANT-TEST',
      amount: '10.00',
      currencyCode: 'USD',
      returnUrl: 'https://merchant.example.com/return',
    },
    channelValues: {},
  },
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('web app routing', () => {
  test('renders homepage with three flow options', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain('Payment Test Workbench');
    expect(html).toContain('Deposit');
    expect(html).toContain('Payout');
    expect(html).toContain('Subscription');
  });

  test('renders the deposit workbench on the deposit route', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/deposit']}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain('Payment Test Workbench');
    expect(html).toContain('Deposit Operator Console');
  });

  test('renders the payout workbench on the payout route', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/payout']}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain('Payment Test Workbench');
    expect(html).toContain('Payout Operator Console');
    expect(html).toContain('Payout');
  });

  test('renders the subscription workbench on the subscription route', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/subscription']}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain('Payment Test Workbench');
    expect(html).toContain('Subscription Operator Console');
    expect(html).toContain('Subscription');
  });

  test('toggles the application color theme and persists it separately from target environment', () => {
    const view = renderApp(['/']);

    act(() => {
      fireEvent.click(view.getByRole('button', { name: '日間' }));
    });

    expect(localStorage.getItem('examine-api.color-theme')).toBe('light');
    expect(localStorage.getItem('examine-api.operator-environment')).toBe('local');
    expect(view.getByText('Theme: 日間')).toBeInTheDocument();
  });

  test('toggles the operator target environment and persists the product target', async () => {
    globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === '/api/deposit/defaults') {
        return new Response(JSON.stringify(createDepositDefaultsResponse()), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch request: ${url}`);
    }) as typeof fetch;

    const view = renderApp(['/deposit']);

    await view.findByText('Request builder');

    act(() => {
      fireEvent.click(view.getAllByRole('button', { name: '產品' })[0]!);
    });

    expect(localStorage.getItem('examine-api.operator-environment')).toBe('product');
  });
});
