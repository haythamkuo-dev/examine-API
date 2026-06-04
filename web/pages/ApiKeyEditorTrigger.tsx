import { useState, type ChangeEvent } from 'react';
import { MdEdit } from 'react-icons/md';
import { ActionButton } from './pageChrome';
import { useModal } from './utils/modal';

type EditableSummaryFieldTriggerProps = {
  label: string;
  value: string;
  editLabel: string;
  modalTitle: string;
  modalDescription: string;
  inputId: string;
  disabled?: boolean;
  onConfirm: (value: string) => void;
};

type ApiKeyEditorTriggerProps = {
  apiKey: string;
  disabled?: boolean;
  onConfirm: (value: string) => void;
};

function EditableSummaryFieldDialog(props: {
  label: string;
  initialValue: string;
  inputId: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const { label, initialValue, inputId, onCancel, onConfirm } = props;
  const [draftValue, setDraftValue] = useState(initialValue);

  return (
    <div className="grid gap-5">
      <label className="grid gap-2" htmlFor={inputId}>
        <span className="text-[13px] font-medium tracking-[0.01em] text-[color:var(--color-text-muted)]">
          {label}
        </span>
        <input
          id={inputId}
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
 * Renders a read-only field summary with an icon trigger that edits the value in a modal.
 *
 * @param props Current field value, copy, and confirmation handler.
 * @returns Summary row plus modal edit trigger for the target field.
 */
export function EditableSummaryFieldTrigger({
  label,
  value,
  editLabel,
  modalTitle,
  modalDescription,
  inputId,
  disabled = false,
  onConfirm,
}: EditableSummaryFieldTriggerProps) {
  const { openModal, closeModal } = useModal();

  const openEditor = () => {
    openModal({
      title: modalTitle,
      description: modalDescription,
      dismissible: true,
      children: (
        <EditableSummaryFieldDialog
          label={label}
          initialValue={value}
          inputId={inputId}
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
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium tracking-[0.01em] text-[color:var(--color-text-muted)]">
          {label}
        </span>
        <button
          type="button"
          aria-label={editLabel}
          disabled={disabled}
          onClick={openEditor}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--operator-card-border)] bg-[var(--operator-ghost-button-bg)] text-[var(--color-text)] transition hover:bg-[var(--operator-ghost-button-hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MdEdit aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="min-w-0 rounded-2xl border border-[var(--operator-input-border)] bg-[var(--operator-input-bg)] px-4 py-3 shadow-[var(--operator-input-shadow)]">
        <p className="min-w-0 break-all font-mono text-sm text-[var(--color-text)]">{value}</p>
      </div>
    </div>
  );
}

/**
 * Renders the API key-specific summary editor using the shared modal-backed field trigger.
 *
 * @param props Current API key, disabled state, and confirmation handler.
 * @returns Summary row plus modal edit trigger for the API key field.
 */
export function ApiKeyEditorTrigger({
  apiKey,
  disabled = false,
  onConfirm,
}: ApiKeyEditorTriggerProps) {
  return (
    <EditableSummaryFieldTrigger
      label="API key"
      value={apiKey}
      editLabel="Edit API key"
      modalTitle="Edit API key"
      modalDescription="Update the api key and confirm the change before applying it."
      inputId="api-key-modal-input"
      disabled={disabled}
      onConfirm={onConfirm}
    />
  );
}
