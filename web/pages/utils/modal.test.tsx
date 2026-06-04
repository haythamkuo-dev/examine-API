/// <reference lib="dom" />

import '../../../tests/web-setup';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { ModalProvider, useModal } from './modal';

const openButtonLabel = 'Open modal';

const ModalHarness = () => {
  const modal = useModal();

  useEffect(() => {
    const trigger = document.getElementById('trigger-button') as HTMLButtonElement | null;
    trigger?.focus();
  }, []);

  return (
    <div>
      <button
        id="trigger-button"
        type="button"
        onClick={() =>
          modal.openModal({
            title: 'Confirm action',
            description: 'Provide a note before continuing.',
            dismissible: true,
            children: (
              <div className="grid gap-4">
                <label htmlFor="note-input">Note</label>
                <input id="note-input" type="text" defaultValue="prefilled" />
                <button type="button">Confirm</button>
              </div>
            ),
          })
        }
      >
        {openButtonLabel}
      </button>
    </div>
  );
};

const renderModalHarness = () =>
  render(
    <ModalProvider>
      <ModalHarness />
    </ModalProvider>,
  );

beforeEach(() => {
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
});

afterEach(() => {
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
});

describe('global modal', () => {
  test('opens content through a portal and moves focus into the dialog', async () => {
    const view = renderModalHarness();
    const scope = within(view.container);

    fireEvent.click(scope.getByRole('button', { name: openButtonLabel }));

    const dialog = await scope.findByRole('dialog', { name: 'Confirm action' });
    expect(dialog).toBeInTheDocument();
    expect(scope.getByLabelText('Note')).toHaveValue('prefilled');
    expect(document.body.style.overflow).toBe('hidden');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  test('closes with escape, overlay click, and close button', async () => {
    const view = renderModalHarness();
    const scope = within(view.container);

    fireEvent.click(scope.getByRole('button', { name: openButtonLabel }));
    await scope.findByRole('dialog', { name: 'Confirm action' });

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(scope.queryByRole('dialog', { name: 'Confirm action' })).not.toBeInTheDocument());

    fireEvent.click(scope.getByRole('button', { name: openButtonLabel }));
    await scope.findByRole('dialog', { name: 'Confirm action' });

    fireEvent.mouseDown(scope.getByRole('dialog', { name: 'Confirm action' }).parentElement!);
    await waitFor(() => expect(scope.queryByRole('dialog', { name: 'Confirm action' })).not.toBeInTheDocument());

    fireEvent.click(scope.getByRole('button', { name: openButtonLabel }));
    await scope.findByRole('dialog', { name: 'Confirm action' });
    fireEvent.click(scope.getByRole('button', { name: 'Close modal' }));

    await waitFor(() => expect(scope.queryByRole('dialog', { name: 'Confirm action' })).not.toBeInTheDocument());
  });

  test('restores the opener focus and scroll state after close', async () => {
    const view = renderModalHarness();
    const scope = within(view.container);

    const opener = scope.getByRole('button', { name: openButtonLabel });
    opener.focus();
    fireEvent.click(opener);

    await scope.findByRole('dialog', { name: 'Confirm action' });
    fireEvent.click(scope.getByRole('button', { name: 'Close modal' }));

    await waitFor(() => expect(scope.queryByRole('dialog', { name: 'Confirm action' })).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
  });
});
