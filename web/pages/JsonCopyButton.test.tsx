/// <reference lib="dom" />

import '../../tests/web-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { JsonCopyButton } from './JsonCopyButton';

const writeText = mock(async (_value: string): Promise<void> => {});
const originalClipboard = navigator.clipboard;

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  writeText.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
});

describe('JsonCopyButton', () => {
  test('copies the rendered JSON and shows success feedback', async () => {
    const value = `{
  "ok": true
}`;
    const view = render(<JsonCopyButton value={value} />);

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Copy JSON' }));
    });

    expect(writeText).toHaveBeenCalledWith(value);
    expect(view.getByRole('button', { name: 'Copied JSON' })).toBeInTheDocument();
  });

  test('shows an error when clipboard writing fails', async () => {
    writeText.mockRejectedValueOnce(new Error('permission denied'));
    const view = render(<JsonCopyButton value='{\n  "ok": false\n}' />);

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Copy JSON' }));
    });

    await waitFor(() => {
      expect(view.getByRole('status')).toHaveTextContent('Copy failed. Check your browser clipboard permission.');
    });
    expect(view.getByRole('button', { name: 'Copy JSON' })).toBeInTheDocument();
  });

  test('disables copying when no JSON is available', () => {
    const view = render(<JsonCopyButton value={null} />);

    expect(view.getByRole('button', { name: 'Copy JSON' })).toBeDisabled();
  });
});
