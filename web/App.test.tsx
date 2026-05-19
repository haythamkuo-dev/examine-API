/// <reference lib="dom" />

import '../tests/web-setup';
import { beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

beforeEach(() => {
  localStorage.clear();
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
    const view = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(view.getByRole('button', { name: '日間' }));

    expect(localStorage.getItem('examine-api.color-theme')).toBe('light');
    expect(localStorage.getItem('examine-api.operator-environment')).toBe('local');
    expect(view.getByText('Theme: 日間')).toBeInTheDocument();
  });

  test('toggles the operator target environment and persists the product target', () => {
    const view = render(
      <MemoryRouter initialEntries={['/deposit']}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(view.getAllByRole('button', { name: '產品' })[0]!);

    expect(localStorage.getItem('examine-api.operator-environment')).toBe('product');
  });
});
