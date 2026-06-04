import { useState, type ChangeEvent } from 'react';
import { MdEdit } from 'react-icons/md';
import { ActionButton } from './pageChrome';
import { useModal } from './utils/modal';

type ApiKeyEditorTriggerProps = {
  apiKey: string;
  disabled?: boolean;
  onConfirm: (value: string) => void;
};

function ApiKeyEditDialog(props: {
  initialValue: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const { initialValue, onCancel, onConfirm } = props;
  const [draftValue, setDraftValue] = useState(initialValue);

  return (
    <div className="grid gap-5">
      <label className="grid gap-2" htmlFor="api-key-modal-input">
        <span className="text-[13px] font-medium tracking-[0.01em] text-[color:var(--color-text-muted)]">
          API key
        </span>
        <input
          id="api-key-modal-input"
          className="w-full rounded-2xl border border-[var(--operator-input-border)] bg-[var(--operator-input-bg)] px-4 py-3 text-[var(--color-text)] shadow-[var(--operator-input-shadow)] transition duration-200"
          value={draftValue}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraftValue(event.target.value)}
          onInput={(event) => setDraftValue((event.target as HTMLInputElement).value)}
        />
      </label>

      <div className="flex flex-wrap justify-end gap-3">
        <ActionButton type="button" tone="ghost" onClick={onCancel}>
          Cancel
        </ActionButton>
        <ActionButton type="button" tone="primary" onClick={() => onConfirm(draftValue)}>
          Confirm
        </ActionButton>
      </div>
    </div>
  );
}

/**
 * Renders a read-only API key summary with an icon trigger that edits the value in a modal.
 *
 * @param props Current API key, disabled state, and confirmation handler.
 * @returns Summary row plus modal edit trigger for the API key field.
 */
export function ApiKeyEditorTrigger({
  apiKey,
  disabled = false,
  onConfirm,
}: ApiKeyEditorTriggerProps) {
  const { openModal, closeModal } = useModal();

  const openEditor = () => {
    openModal({
      title: 'Edit API key',
      description: 'Update the request signing key and confirm the change before applying it.',
      dismissible: true,
      children: (
        <ApiKeyEditDialog
          initialValue={apiKey}
          onCancel={closeModal}
          onConfirm={(value) => {
            onConfirm(value);
            closeModal();
          }}
        />
      ),
    });
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium tracking-[0.01em] text-[color:var(--color-text-muted)]">
          API key
        </span>
        <button
          type="button"
          aria-label="Edit API key"
          disabled={disabled}
          onClick={openEditor}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--operator-card-border)] bg-[var(--operator-ghost-button-bg)] text-[var(--color-text)] transition hover:bg-[var(--operator-ghost-button-hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MdEdit aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <div className="rounded-2xl border border-[var(--operator-input-border)] bg-[var(--operator-input-bg)] px-4 py-3 shadow-[var(--operator-input-shadow)]">
        <p className="overflow-x-auto font-mono text-sm text-[var(--color-text)]">{apiKey}</p>
      </div>
    </div>
  );
}
