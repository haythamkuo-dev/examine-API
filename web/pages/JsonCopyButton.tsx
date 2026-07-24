import { useEffect, useRef, useState } from 'react';
import { MdCheck, MdContentCopy } from 'react-icons/md';

const copyResetDelayMs = 2000;
const copyFailureMessage = 'Copy failed. Check your browser clipboard permission.';

type JsonCopyButtonProps = {
  value: string | null;
};

/**
 * Copies a rendered JSON string and provides accessible success or failure feedback.
 *
 * @param props JSON string to copy, or null when the panel has no JSON content.
 * @returns A copy button with transient feedback state.
 */
export function JsonCopyButton({ value }: JsonCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
  }, []);

  const copyValue = async () => {
    if (!value) {
      return;
    }

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }

      await navigator.clipboard.writeText(value);
      setCopied(true);
      setCopyError(false);
      resetTimer.current = setTimeout(() => {
        setCopied(false);
        resetTimer.current = null;
      }, copyResetDelayMs);
    } catch {
      setCopied(false);
      setCopyError(true);
      resetTimer.current = setTimeout(() => {
        setCopyError(false);
        resetTimer.current = null;
      }, copyResetDelayMs);
    }
  };

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label={copied ? 'Copied JSON' : 'Copy JSON'}
        title={copied ? 'Copied JSON' : 'Copy JSON'}
        disabled={!value}
        onClick={copyValue}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--operator-card-border)] bg-[var(--operator-ghost-button-bg)] text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--operator-ghost-button-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {copied ? <MdCheck aria-hidden="true" className="h-4 w-4 text-[var(--status-success-text)]" /> : <MdContentCopy aria-hidden="true" className="h-4 w-4" />}
      </button>
      {copyError ? (
        <span role="status" className="absolute right-0 top-full z-10 mt-2 w-max max-w-64 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-text)] shadow-[var(--shadow-sm)]">
          {copyFailureMessage}
        </span>
      ) : null}
    </div>
  );
}
