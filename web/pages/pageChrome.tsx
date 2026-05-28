import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  getOperatorEnvironmentLabel,
  type ApiLogContext,
  type OperatorEnvironmentMode,
} from './operatorShared';

const panelClassName =
  'relative overflow-hidden rounded-[28px] border border-[var(--operator-panel-border)] bg-[var(--operator-panel-bg)] shadow-[var(--shadow-lg)] backdrop-blur-xl transition-colors duration-200';

const headingClassName =
  "font-['IBM_Plex_Sans',sans-serif] text-[13px] font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]";

const proseClassName = 'text-sm leading-6 text-[color:var(--color-text-muted)]';
const colorThemeStorageKey = 'examine-api.color-theme';
const operatorEnvironmentStorageKey = 'examine-api.operator-environment';

const darkThemeLabel = '夜間';
const lightThemeLabel = '日間';
const localEnvironmentToggleLabel = '沙盒';
const productEnvironmentToggleLabel = '產品';

export type ColorThemeMode = 'dark' | 'light';

type AppThemeContextValue = {
  colorTheme: ColorThemeMode;
  setColorTheme: (mode: ColorThemeMode) => void;
  environmentMode: OperatorEnvironmentMode;
  setEnvironmentMode: (mode: OperatorEnvironmentMode) => void;
  environmentLabel: string;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

const createColorThemeVariables = (mode: ColorThemeMode): CSSProperties => {
  const darkTheme = {
    colorScheme: 'dark',
    '--color-primary': '#F59E0B',
    '--color-secondary': '#FBBF24',
    '--color-cta': '#8B5CF6',
    '--color-background': '#0F172A',
    '--color-text': '#F8FAFC',
    '--color-text-muted': 'rgba(248,250,252,0.74)',
    '--app-canvas-bg':
      'radial-gradient(circle at 10% 15%, rgba(245,158,11,0.18), transparent 24%), radial-gradient(circle at 88% 18%, rgba(139,92,246,0.18), transparent 28%), radial-gradient(circle at 50% 100%, rgba(251,191,36,0.08), transparent 30%), linear-gradient(180deg, #020617 0%, #0b1120 42%, #0f172a 100%)',
    '--app-shell-header-bg':
      'linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82) 45%,rgba(76,29,149,0.32) 100%)',
    '--app-shell-header-border': 'rgba(255,255,255,0.10)',
    '--app-shell-surface-bg': 'rgba(0,0,0,0.20)',
    '--app-shell-surface-border': 'rgba(255,255,255,0.10)',
    '--app-option-card-bg': 'rgba(255,255,255,0.04)',
    '--app-option-card-hover-bg': 'rgba(255,255,255,0.08)',
    '--app-option-card-border': 'rgba(255,255,255,0.15)',
    '--app-nav-idle-bg': 'rgba(255,255,255,0.05)',
    '--app-nav-idle-border': 'rgba(255,255,255,0.15)',
    '--app-nav-idle-text': 'rgba(248,250,252,0.74)',
    '--operator-page-bg': 'linear-gradient(180deg,rgba(2,6,23,0.22),rgba(15,23,42,0.12))',
    '--operator-page-border': 'rgba(148,163,184,0.12)',
    '--operator-panel-bg': 'linear-gradient(180deg,rgba(15,23,42,0.94),rgba(8,15,29,0.9))',
    '--operator-panel-border': 'rgba(255,255,255,0.10)',
    '--operator-card-bg': 'rgba(255,255,255,0.05)',
    '--operator-card-border': 'rgba(255,255,255,0.10)',
    '--operator-card-soft-bg': 'rgba(255,255,255,0.03)',
    '--operator-card-soft-border': 'rgba(255,255,255,0.10)',
    '--operator-input-bg': 'rgba(255,255,255,0.05)',
    '--operator-input-border': 'rgba(255,255,255,0.12)',
    '--operator-input-shadow': 'inset 0 1px 0 rgba(255,255,255,0.03)',
    '--operator-neutral-pill-bg': 'rgba(255,255,255,0.05)',
    '--operator-neutral-pill-border': 'rgba(255,255,255,0.10)',
    '--operator-accent-pill-bg': 'rgba(139,92,246,0.18)',
    '--operator-accent-pill-border': 'rgba(139,92,246,0.40)',
    '--operator-ghost-button-bg': 'rgba(255,255,255,0.05)',
    '--operator-ghost-button-hover-bg': 'rgba(255,255,255,0.10)',
    '--operator-hero-rail': 'linear-gradient(to right,rgba(245,158,11,0),rgba(245,158,11,0.70),rgba(139,92,246,0))',
    '--operator-accent-card-bg':
      'linear-gradient(135deg,rgba(139,92,246,0.16),rgba(245,158,11,0.08))',
    '--operator-accent-card-border': 'rgba(139,92,246,0.25)',
    '--toggle-bg': 'rgba(255,255,255,0.05)',
    '--toggle-border': 'rgba(255,255,255,0.12)',
    '--toggle-text': 'rgba(248,250,252,0.74)',
    '--toggle-active-bg': '#F8FAFC',
    '--toggle-active-text': '#0F172A',
    '--status-success-bg': 'rgba(16,185,129,0.10)',
    '--status-success-border': 'rgba(52,211,153,0.45)',
    '--status-success-text': '#D1FAE5',
    '--status-danger-bg': 'rgba(244,63,94,0.10)',
    '--status-danger-border': 'rgba(251,113,133,0.45)',
    '--status-danger-text': '#FFE4E6',
    '--operator-pre-bg': 'linear-gradient(180deg, rgba(2,6,23,0.96), rgba(15,23,42,0.84))',
    '--operator-pre-border': 'rgba(148,163,184,0.12)',
    '--operator-pre-text': '#DCE6EF',
    '--button-secondary-text': '#0F172A',
  };

  const lightTheme = {
    colorScheme: 'light',
    '--color-primary': '#D97706',
    '--color-secondary': '#F59E0B',
    '--color-cta': '#7C3AED',
    '--color-background': '#FFF9ED',
    '--color-text': '#172033',
    '--color-text-muted': 'rgba(23,32,51,0.72)',
    '--app-canvas-bg':
      'radial-gradient(circle at 12% 14%, rgba(245,158,11,0.16), transparent 22%), radial-gradient(circle at 88% 18%, rgba(124,58,237,0.12), transparent 26%), radial-gradient(circle at 56% 100%, rgba(251,191,36,0.10), transparent 32%), linear-gradient(180deg, #fff8eb 0%, #fff7df 38%, #fffdf8 100%)',
    '--app-shell-header-bg':
      'linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,248,235,0.96) 45%,rgba(139,92,246,0.12) 100%)',
    '--app-shell-header-border': 'rgba(217,119,6,0.14)',
    '--app-shell-surface-bg': 'rgba(255,255,255,0.78)',
    '--app-shell-surface-border': 'rgba(148,163,184,0.20)',
    '--app-option-card-bg': 'rgba(255,255,255,0.82)',
    '--app-option-card-hover-bg': 'rgba(255,255,255,0.96)',
    '--app-option-card-border': 'rgba(148,163,184,0.18)',
    '--app-nav-idle-bg': 'rgba(255,255,255,0.80)',
    '--app-nav-idle-border': 'rgba(148,163,184,0.22)',
    '--app-nav-idle-text': 'rgba(23,32,51,0.72)',
    '--operator-page-bg': 'linear-gradient(180deg,rgba(255,248,235,0.95),rgba(255,255,255,0.88))',
    '--operator-page-border': 'rgba(217,119,6,0.14)',
    '--operator-panel-bg': 'linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,248,235,0.96))',
    '--operator-panel-border': 'rgba(148,163,184,0.22)',
    '--operator-card-bg': 'rgba(255,255,255,0.86)',
    '--operator-card-border': 'rgba(148,163,184,0.18)',
    '--operator-card-soft-bg': 'rgba(255,255,255,0.72)',
    '--operator-card-soft-border': 'rgba(148,163,184,0.16)',
    '--operator-input-bg': 'rgba(255,255,255,0.96)',
    '--operator-input-border': 'rgba(148,163,184,0.28)',
    '--operator-input-shadow': 'inset 0 1px 0 rgba(255,255,255,0.75)',
    '--operator-neutral-pill-bg': 'rgba(255,255,255,0.88)',
    '--operator-neutral-pill-border': 'rgba(148,163,184,0.22)',
    '--operator-accent-pill-bg': 'rgba(245,158,11,0.12)',
    '--operator-accent-pill-border': 'rgba(245,158,11,0.32)',
    '--operator-ghost-button-bg': 'rgba(255,255,255,0.82)',
    '--operator-ghost-button-hover-bg': 'rgba(255,255,255,1)',
    '--operator-hero-rail': 'linear-gradient(to right,rgba(245,158,11,0),rgba(245,158,11,0.75),rgba(251,191,36,0))',
    '--operator-accent-card-bg':
      'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(139,92,246,0.09))',
    '--operator-accent-card-border': 'rgba(245,158,11,0.24)',
    '--toggle-bg': 'rgba(255,255,255,0.88)',
    '--toggle-border': 'rgba(148,163,184,0.22)',
    '--toggle-text': 'rgba(23,32,51,0.72)',
    '--toggle-active-bg': '#0F172A',
    '--toggle-active-text': '#F8FAFC',
    '--status-success-bg': 'rgba(16,185,129,0.12)',
    '--status-success-border': 'rgba(5,150,105,0.28)',
    '--status-success-text': '#065F46',
    '--status-danger-bg': 'rgba(244,63,94,0.09)',
    '--status-danger-border': 'rgba(225,29,72,0.24)',
    '--status-danger-text': '#9F1239',
    '--operator-pre-bg': 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,248,235,0.88))',
    '--operator-pre-border': 'rgba(148,163,184,0.18)',
    '--operator-pre-text': '#243047',
    '--button-secondary-text': '#172033',
  };

  return (mode === 'light' ? lightTheme : darkTheme) as CSSProperties;
};

const readStoredColorTheme = (): ColorThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const storedMode = window.localStorage.getItem(colorThemeStorageKey);
  return storedMode === 'light' ? 'light' : 'dark';
};

const readStoredEnvironmentMode = (): OperatorEnvironmentMode => {
  if (typeof window === 'undefined') {
    return 'local';
  }

  const storedMode = window.localStorage.getItem(operatorEnvironmentStorageKey);
  return storedMode === 'product' ? 'product' : 'local';
};

const SegmentedToggle = <T extends string>({
  ariaLabel,
  mode,
  onChange,
  options,
}: {
  ariaLabel: string;
  mode: T;
  onChange: (mode: T) => void;
  options: ReadonlyArray<readonly [T, string]>;
}) => (
  <div
    className="inline-flex rounded-full border border-[var(--toggle-border)] bg-[var(--toggle-bg)] p-1"
    role="group"
    aria-label={ariaLabel}
  >
    {options.map(([candidate, label]) => {
      const isActive = mode === candidate;

      return (
        <button
          key={candidate}
          type="button"
          aria-pressed={isActive}
          className={`min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold transition duration-200 ${
            isActive
              ? 'bg-[var(--toggle-active-bg)] text-[var(--toggle-active-text)] shadow-[var(--shadow-sm)]'
              : 'text-[var(--toggle-text)] hover:text-[var(--color-text)]'
          }`}
          onClick={() => onChange(candidate)}
        >
          {label}
        </button>
      );
    })}
  </div>
);

const LogContextSummary = ({ logContext }: { logContext: ApiLogContext }) => (
  <div className="mb-4 rounded-[18px] border border-[var(--operator-card-border)] bg-[var(--operator-card-soft-bg)] px-4 py-3 text-xs leading-6 text-[color:var(--color-text-muted)]">
    <p>
      模式 {logContext.environmentLabel} · 目標 {logContext.targetLabel}
    </p>
    <p className="break-all">{logContext.requestUrl}</p>
  </div>
);

const environmentModeOptions = [
  ['local', localEnvironmentToggleLabel],
  ['product', productEnvironmentToggleLabel],
] as const;

/**
 * Provides the shared frontend color theme and operator environment state.
 *
 * @param props Standard React children to render inside the theme provider.
 * @returns Context provider for app-wide theme and environment controls.
 */
export function AppThemeProvider({ children }: PropsWithChildren) {
  const [colorTheme, setColorTheme] = useState<ColorThemeMode>(readStoredColorTheme);
  const [environmentMode, setEnvironmentMode] = useState<OperatorEnvironmentMode>(
    readStoredEnvironmentMode,
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(colorThemeStorageKey, colorTheme);
      document.documentElement.style.colorScheme = colorTheme;
    }
  }, [colorTheme]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(operatorEnvironmentStorageKey, environmentMode);
    }
  }, [environmentMode]);

  const value = useMemo(
    () => ({
      colorTheme,
      setColorTheme,
      environmentMode,
      setEnvironmentMode,
      environmentLabel: getOperatorEnvironmentLabel(environmentMode),
    }),
    [colorTheme, environmentMode],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

/**
 * Reads the shared frontend color theme and operator environment state.
 *
 * @returns Active color theme, operator environment mode, and both setters.
 * @throws {Error} When used outside `AppThemeProvider`.
 */
export function useAppTheme() {
  const theme = useContext(AppThemeContext);

  if (!theme) {
    throw new Error('useAppTheme must be used within AppThemeProvider.');
  }

  return theme;
}

/**
 * Exposes the operator-page environment controls together with the global color theme.
 *
 * @returns Shared operator environment state plus the app color theme controls.
 */
export function useOperatorTheme() {
  const theme = useAppTheme();

  return {
    mode: theme.environmentMode,
    setMode: theme.setEnvironmentMode,
    environmentLabel: theme.environmentLabel,
    colorTheme: theme.colorTheme,
    setColorTheme: theme.setColorTheme,
  };
}

/**
 * Applies the active color-theme variables to the shared web application shell.
 *
 * @param props Theme mode plus the subtree that should inherit the CSS variables.
 * @returns Wrapper element that scopes the current design tokens.
 */
export function AppThemeFrame({
  children,
  mode,
}: PropsWithChildren<{ mode: ColorThemeMode }>) {
  return (
    <div
      className="min-h-screen bg-[var(--app-canvas-bg)] text-[var(--color-text)] transition-colors duration-200"
      data-color-theme={mode}
      style={createColorThemeVariables(mode)}
    >
      {children}
    </div>
  );
}

/**
 * Renders the shared day/night theme toggle used by the app shell.
 *
 * @param props Current color theme plus setter callback.
 * @returns Segmented control for switching between dark and light themes.
 */
export function ColorThemeToggle({
  mode,
  onChange,
}: {
  mode: ColorThemeMode;
  onChange: (mode: ColorThemeMode) => void;
}) {
  return (
    <SegmentedToggle
      ariaLabel="Application color theme"
      mode={mode}
      onChange={onChange}
      options={[
        ['dark', darkThemeLabel],
        ['light', lightThemeLabel],
      ]}
    />
  );
}

/**
 * Renders the shared local/product environment toggle used by operator pages.
 *
 * @param props Current operator environment plus setter callback.
 * @returns Segmented control for switching between local and product targets.
 */
export function EnvironmentModeToggle({
  mode,
  onChange,
}: {
  mode: OperatorEnvironmentMode;
  onChange: (mode: OperatorEnvironmentMode) => void;
}) {
  return (
    <SegmentedToggle
      ariaLabel="Operator environment mode"
      mode={mode}
      onChange={onChange}
      options={environmentModeOptions}
    />
  );
}

/**
 * Wraps an operator page section in the shared panel chrome.
 *
 * @param props Standard children rendered inside the themed operator surface.
 * @returns Styled wrapper for deposit, payout, and subscription page content.
 */
export function OperatorThemeFrame({ children }: PropsWithChildren) {
  return (
    <div className="rounded-[36px] border border-[var(--operator-page-border)] bg-[var(--operator-page-bg)] p-3 transition-colors duration-200 sm:p-4">
      {children}
    </div>
  );
}

/**
 * Wraps content in the shared card treatment defined by the web design system.
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
 * @param props Page-specific copy, status labels, and environment controls.
 * @returns The shared page-intro section used across deposit, payout, and subscription pages.
 */
export function PageHero(props: {
  eyebrow: string;
  title: string;
  description: string;
  scopeLabel: string;
  statusLabel: string;
  environmentMode: OperatorEnvironmentMode;
  onEnvironmentChange: (mode: OperatorEnvironmentMode) => void;
  environmentLabel: string;
  targetLabel: string;
}) {
  const {
    eyebrow,
    title,
    description,
    scopeLabel,
    statusLabel,
    environmentMode,
    onEnvironmentChange,
    environmentLabel,
    targetLabel,
  } = props;

  return (
    <PageCard className="mb-8 grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)]">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-[var(--operator-hero-rail)]" />
        <p className={`${headingClassName} mb-3 pt-4`}>{eyebrow}</p>
        <h1 className="max-w-3xl text-[clamp(2.2rem,6vw,4.6rem)] font-semibold leading-[0.94] tracking-[-0.04em] text-[var(--color-text)]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--color-text-muted)]">{description}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <StatusPill tone="neutral">Scope: {scopeLabel}</StatusPill>
          <StatusPill tone="accent">{statusLabel}</StatusPill>
          <StatusPill tone="neutral">環境: {environmentLabel}</StatusPill>
          <StatusPill tone="neutral">目標: {targetLabel}</StatusPill>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className={headingClassName}>Execution target</span>
          <EnvironmentModeToggle mode={environmentMode} onChange={onEnvironmentChange} />
        </div>
      </div>

      <div className="grid gap-4 self-end">
        <div className="rounded-[24px] border border-[var(--operator-card-border)] bg-[var(--operator-card-bg)] p-5">
          <div className="flex items-center gap-3">
            <IconShield className="h-6 w-6 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Execution mode</h2>
          </div>
          <p className={`${proseClassName} mt-3`}>
            Credentials remain on the API server. The browser only edits test inputs, previews signed payloads,
            and reads proxied responses.
          </p>
        </div>
        <div className="grid gap-3 rounded-[24px] border border-[var(--operator-accent-card-border)] bg-[var(--operator-accent-card-bg)] p-5">
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
      {detail ? (
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-primary)]">
          {detail}
        </div>
      ) : null}
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
  logContext,
}: {
  title: string;
  body: unknown;
  emptyState: string;
  logContext?: ApiLogContext | null;
}) {
  return (
    <PageCard className="flex min-w-0 flex-col p-6">
      <SectionHeading title={title} />
      {logContext ? <LogContextSummary logContext={logContext} /> : null}
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
  logContext?: ApiLogContext | null;
}) {
  const {
    title = 'API result',
    statusLabel,
    message,
    details,
    ok,
    raw,
    emptyState,
    logContext,
  } = props;

  return (
    <PageCard className="flex min-w-0 flex-col p-6">
      <SectionHeading title={title} detail={statusLabel} />
      {logContext ? <LogContextSummary logContext={logContext} /> : null}
      {message ? (
        <div
          className={`mb-4 rounded-[20px] border px-4 py-3 text-sm ${
            ok
              ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
              : 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
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
 * @param props Hero copy plus the current loading or error message.
 * @returns Pre-load hero card matching the operator page visual system.
 */
export function LoadingHero(props: {
  eyebrow: string;
  title: string;
  message: string;
  environmentMode: OperatorEnvironmentMode;
  onEnvironmentChange: (mode: OperatorEnvironmentMode) => void;
  environmentLabel: string;
  targetLabel: string;
}) {
  const {
    eyebrow,
    title,
    message,
    environmentMode,
    onEnvironmentChange,
    environmentLabel,
    targetLabel,
  } = props;

  return (
    <PageCard className="mb-8 p-6 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className={headingClassName}>{eyebrow}</p>
        <EnvironmentModeToggle mode={environmentMode} onChange={onEnvironmentChange} />
      </div>
      <h1 className="text-[clamp(2rem,5vw,3.8rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--color-text)]">
        {title}
      </h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <StatusPill tone="neutral">環境: {environmentLabel}</StatusPill>
        <StatusPill tone="neutral">目標: {targetLabel}</StatusPill>
      </div>
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
        ? 'border-[var(--color-primary)]/30 bg-[var(--operator-ghost-button-bg)] text-[var(--color-text)] hover:border-[var(--color-primary)]/70 hover:bg-[var(--operator-ghost-button-hover-bg)]'
        : 'border-[var(--color-primary)]/35 bg-[var(--color-primary)] text-[var(--button-secondary-text)] hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary)]';

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
      ? 'border-[var(--operator-accent-pill-border)] bg-[var(--operator-accent-pill-bg)] text-[var(--color-text)]'
      : 'border-[var(--operator-neutral-pill-border)] bg-[var(--operator-neutral-pill-bg)] text-[color:var(--color-text-muted)]';

  return (
    <span className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium ${toneClassName}`}>
      {children}
    </span>
  );
}

const IconShield = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3 5.5 5.75v5.33c0 4.4 2.75 8.47 6.5 9.92 3.75-1.45 6.5-5.52 6.5-9.92V5.75L12 3Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 12 1.6 1.6 3.4-3.7" />
  </svg>
);

const IconPulse = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2.2-4.5L13 17l2.25-5H21" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21c4.5-2.7 7.5-6.5 7.5-10.5A4.5 4.5 0 0 0 12 6.75 4.5 4.5 0 0 0 4.5 10.5C4.5 14.5 7.5 18.3 12 21Z"
    />
  </svg>
);
