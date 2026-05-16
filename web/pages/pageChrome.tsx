import type { PropsWithChildren, ReactNode } from 'react';

const panelClassName =
  'relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(8,15,29,0.9))] shadow-[var(--shadow-lg)] backdrop-blur-xl';

const headingClassName =
  "font-['IBM_Plex_Sans',sans-serif] text-[13px] font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]";

const proseClassName = 'text-sm leading-6 text-[color:var(--color-text-muted)]';

/**
 * Wraps content in the shared dark card treatment defined by the web design system.
 *
 * @param props Standard children plus optional className for layout composition.
 * @returns Styled panel container for page sections and cards.
 */
export function PageCard({
  children,
  className = '',
}: PropsWithChildren<{ className?: string }>) {
  return <section className={`${panelClassName} ${className}`.trim()}>{children}</section>;
}

/**
 * Renders the shared hero block for operator pages, including security framing and live status.
 *
 * @param props Page-specific copy and status labels for the hero area.
 * @returns The shared page-intro section used across deposit, payout, and subscription pages.
 */
export function PageHero(props: {
  eyebrow: string;
  title: string;
  description: string;
  scopeLabel: string;
  statusLabel: string;
}) {
  const { eyebrow, title, description, scopeLabel, statusLabel } = props;

  return (
    <PageCard className="mb-8 grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)]">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[var(--color-primary)]/0 via-[var(--color-primary)]/70 to-[var(--color-cta)]/0" />
        <p className={`${headingClassName} mb-3 pt-4`}>{eyebrow}</p>
        <h1 className="max-w-3xl text-[clamp(2.2rem,6vw,4.6rem)] font-semibold leading-[0.94] tracking-[-0.04em] text-[var(--color-text)]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--color-text-muted)]">{description}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <StatusPill tone="neutral">Scope: {scopeLabel}</StatusPill>
          <StatusPill tone="accent">{statusLabel}</StatusPill>
        </div>
      </div>

      <div className="grid gap-4 self-end">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <IconShield className="h-6 w-6 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Execution mode</h2>
          </div>
          <p className={`${proseClassName} mt-3`}>
            Credentials remain on the API server. The browser only edits test inputs, previews signed payloads,
            and reads proxied responses.
          </p>
        </div>
        <div className="grid gap-3 rounded-[24px] border border-[var(--color-cta)]/25 bg-[linear-gradient(135deg,rgba(139,92,246,0.16),rgba(245,158,11,0.08))] p-5">
          <div className="flex items-center gap-3">
            <IconPulse className="h-6 w-6 text-[var(--color-cta)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Operator safeguards</h2>
          </div>
          <p className={proseClassName}>
            Review generated requests before dispatch, keep channel presets synchronized, and verify status codes
            without exposing gateway secrets in the UI.
          </p>
        </div>
      </div>
    </PageCard>
  );
}

/**
 * Renders a consistent page title row for cards and sections.
 *
 * @param props Section title plus optional right-side metadata.
 * @returns Shared section heading row.
 */
export function SectionHeading({ title, detail }: { title: string; detail?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--color-text)]">{title}</h2>
      {detail ? <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-primary)]">{detail}</div> : null}
    </div>
  );
}

/**
 * Displays JSON data inside the shared operator panel treatment.
 *
 * @param props Panel title, body payload, and empty-state fallback text.
 * @returns A card containing formatted JSON output.
 */
export function JsonPanel({
  title,
  body,
  emptyState,
}: {
  title: string;
  body: unknown;
  emptyState: string;
}) {
  return (
    <PageCard className="flex min-w-0 flex-col p-6">
      <SectionHeading title={title} />
      <pre className="operator-pre flex-1">{body ? JSON.stringify(body, null, 2) : emptyState}</pre>
    </PageCard>
  );
}

/**
 * Renders API result messaging plus the raw payload preview in the shared visual style.
 *
 * @param props Result summary data and fallback empty-state copy.
 * @returns Shared API result card for operator pages.
 */
export function ResultPanel(props: {
  title?: string;
  statusLabel?: string | null;
  message?: string | null;
  details?: string | null;
  ok?: boolean;
  raw: unknown;
  emptyState: string;
}) {
  const {
    title = 'API result',
    statusLabel,
    message,
    details,
    ok,
    raw,
    emptyState,
  } = props;

  return (
    <PageCard className="flex min-w-0 flex-col p-6">
      <SectionHeading title={title} detail={statusLabel} />
      {message ? (
        <div
          className={`mb-4 rounded-[20px] border px-4 py-3 text-sm ${
            ok
              ? 'border-emerald-400/45 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-400/45 bg-rose-500/10 text-rose-100'
          }`}
        >
          <p>{message}</p>
          {details ? <p className="mt-2 whitespace-pre-wrap break-words text-xs opacity-90">{details}</p> : null}
        </div>
      ) : null}
      <pre className="operator-pre flex-1">{raw ? JSON.stringify(raw, null, 2) : emptyState}</pre>
    </PageCard>
  );
}

/**
 * Renders the shared loading or error state before page defaults are available.
 *
 * @param props Hero copy plus the current loading/error message.
 * @returns Pre-load hero card matching the operator page visual system.
 */
export function LoadingHero(props: {
  eyebrow: string;
  title: string;
  message: string;
}) {
  const { eyebrow, title, message } = props;

  return (
    <PageCard className="mb-8 p-6 sm:p-8">
      <p className={`${headingClassName} mb-3`}>{eyebrow}</p>
      <h1 className="text-[clamp(2rem,5vw,3.8rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--color-text)]">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--color-text-muted)]">{message}</p>
    </PageCard>
  );
}

/**
 * Renders a styled button variant aligned to the design system.
 *
 * @param props Standard button props plus a visual tone option.
 * @returns Shared action button used by the operator request forms.
 */
export function ActionButton(
  props: PropsWithChildren<{
    type?: 'button' | 'submit' | 'reset';
    tone?: 'primary' | 'secondary' | 'ghost';
    disabled?: boolean;
    onClick?: () => void;
  }>,
) {
  const { children, tone = 'secondary', ...buttonProps } = props;

  const toneClassName =
    tone === 'primary'
      ? 'border-[var(--color-cta)]/70 bg-[var(--color-cta)] text-white hover:border-[var(--color-cta)]/85 hover:brightness-110'
      : tone === 'ghost'
        ? 'border-[var(--color-primary)]/30 bg-white/5 text-[var(--color-text)] hover:border-[var(--color-primary)]/70 hover:bg-white/10'
        : 'border-[var(--color-primary)]/35 bg-[var(--color-primary)] text-slate-950 hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary)]';

  return (
    <button
      {...buttonProps}
      className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border px-5 text-sm font-semibold transition duration-200 ${toneClassName} disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100`}
    >
      {children}
    </button>
  );
}

/**
 * Labels section metadata with the shared capsule styling.
 *
 * @param props Capsule tone and content.
 * @returns Inline status badge element.
 */
export function StatusPill({
  children,
  tone,
}: PropsWithChildren<{ tone: 'neutral' | 'accent' }>) {
  const toneClassName =
    tone === 'accent'
      ? 'border-[var(--color-cta)]/40 bg-[var(--color-cta)]/18 text-[var(--color-text)]'
      : 'border-white/10 bg-white/5 text-[color:var(--color-text-muted)]';

  return (
    <span className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium ${toneClassName}`}>
      {children}
    </span>
  );
}

const IconShield = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 5.5 5.75v5.33c0 4.4 2.75 8.47 6.5 9.92 3.75-1.45 6.5-5.52 6.5-9.92V5.75L12 3Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 12 1.6 1.6 3.4-3.7" />
  </svg>
);

const IconPulse = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2.2-4.5L13 17l2.25-5H21" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c4.5-2.7 7.5-6.5 7.5-10.5A4.5 4.5 0 0 0 12 6.75 4.5 4.5 0 0 0 4.5 10.5C4.5 14.5 7.5 18.3 12 21Z" />
  </svg>
);
