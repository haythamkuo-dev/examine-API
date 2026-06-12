/// <reference lib="dom" />

import '../../tests/web-setup';
import { beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render } from '@testing-library/react';
import { usePersistentApiKey } from './usePersistentApiKey';

const storageKey = 'examine-api.operator-api-key';

function Harness({ fallbackValue }: { fallbackValue: string }) {
  const [apiKey, setApiKey] = usePersistentApiKey(fallbackValue);

  return (
    <div>
      <output data-testid="value">{apiKey}</output>
      <button type="button" onClick={() => setApiKey('manual-api-key')}>
        Update
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('usePersistentApiKey', () => {
  test('restores stored value with lazy initial state and persists edits', () => {
    localStorage.setItem(storageKey, 'stored-api-key');

    const view = render(<Harness fallbackValue="default-api-key" />);

    expect(view.getByTestId('value')).toHaveTextContent('stored-api-key');

    fireEvent.click(view.getByRole('button', { name: 'Update' }));

    expect(localStorage.getItem(storageKey)).toBe('manual-api-key');
  });

  test('removes the draft when the hook unmounts', () => {
    const view = render(<Harness fallbackValue="default-api-key" />);

    fireEvent.click(view.getByRole('button', { name: 'Update' }));
    expect(localStorage.getItem(storageKey)).toBe('manual-api-key');

    view.unmount();

    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  test('clears the draft during beforeunload', () => {
    const view = render(<Harness fallbackValue="default-api-key" />);

    fireEvent.click(view.getByRole('button', { name: 'Update' }));
    expect(localStorage.getItem(storageKey)).toBe('manual-api-key');

    window.dispatchEvent(new Event('beforeunload'));

    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});
