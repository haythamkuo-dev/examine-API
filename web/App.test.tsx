import { describe, expect, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

describe('web app routing', () => {
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
});
