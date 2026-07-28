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
import { ToastContainer } from 'react-toastify';
import { FaSpinner } from 'react-icons/fa';
import {
  getOperatorEnvironmentLabel,
  type ApiLogContext,
  type OperatorEnvironmentMode,
} from './helper/operatorShared';
import { JsonCopyButton } from './JsonCopyButton';

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
    '--app-nav-active-bg': 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
    '--app-nav-active-border': 'rgba(167,139,250,0.72)',
    '--app-nav-active-text': '#F8FAFC',
    '--app-nav-active-shadow': '0 18px 32px rgba(76,29,149,0.30)',
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
    '--focus-ring-shadow': '0 0 0 4px rgba(245,158,11,0.20)',
    '--selection-bg': 'rgba(139,92,246,0.35)',
    '--modal-backdrop-bg': 'rgba(2,6,23,0.70)',
    '--modal-shadow': '0 24px 80px rgba(0,0,0,0.35)',
    '--accent-shadow-outline': '0 0 0 1px rgba(139,92,246,0.25)',
    '--color-on-cta': '#F8FAFC',
    '--button-primary-bg': 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
    '--button-primary-border': 'rgba(167,139,250,0.68)',
    '--button-primary-hover-bg': 'linear-gradient(135deg,#7C3AED,#6D28D9)',
    '--button-primary-hover-border': 'rgba(196,181,253,0.82)',
    '--button-primary-shadow': '0 16px 30px rgba(76,29,149,0.26)',
    '--button-secondary-bg': 'linear-gradient(135deg,#F59E0B,#FBBF24)',
    '--button-secondary-border': 'rgba(251,191,36,0.38)',
    '--button-secondary-hover-bg': 'linear-gradient(135deg,#FBBF24,#FCD34D)',
    '--button-secondary-hover-border': 'rgba(252,211,77,0.72)',
    '--button-secondary-shadow': '0 14px 28px rgba(180,83,9,0.22)',
    '--button-ghost-border': 'rgba(245,158,11,0.28)',
    '--button-ghost-bg': 'rgba(255,255,255,0.04)',
    '--button-ghost-text': '#F8FAFC',
    '--button-ghost-hover-border': 'rgba(245,158,11,0.62)',
    '--button-ghost-hover-bg': 'rgba(255,255,255,0.10)',
    '--button-secondary-text': '#F8FAFC',
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
    '--app-nav-active-bg': 'linear-gradient(135deg,#7C3AED,#6D28D9)',
    '--app-nav-active-border': 'rgba(124,58,237,0.34)',
    '--app-nav-active-text': '#F8FAFC',
    '--app-nav-active-shadow': '0 18px 32px rgba(124,58,237,0.18)',
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
    '--focus-ring-shadow': '0 0 0 4px rgba(217,119,6,0.18)',
    '--selection-bg': 'rgba(124,58,237,0.22)',
    '--modal-backdrop-bg': 'rgba(255,244,228,0.68)',
    '--modal-shadow': '0 24px 80px rgba(148,163,184,0.28)',
    '--accent-shadow-outline': '0 0 0 1px rgba(124,58,237,0.18)',
    '--color-on-cta': '#172033',
    '--button-primary-bg': 'linear-gradient(135deg,#7C3AED,#6D28D9)',
    '--button-primary-border': 'rgba(124,58,237,0.28)',
    '--button-primary-hover-bg': 'linear-gradient(135deg,#6D28D9,#5B21B6)',
    '--button-primary-hover-border': 'rgba(109,40,217,0.48)',
    '--button-primary-shadow': '0 16px 30px rgba(124,58,237,0.18)',
    '--button-secondary-bg': 'linear-gradient(135deg,#FFF2D6,#FDE7BF)',
    '--button-secondary-border': 'rgba(217,119,6,0.20)',
    '--button-secondary-hover-bg': 'linear-gradient(135deg,#FDE7BF,#FBD38D)',
    '--button-secondary-hover-border': 'rgba(217,119,6,0.34)',
    '--button-secondary-shadow': '0 14px 28px rgba(217,119,6,0.10)',
    '--button-ghost-border': 'rgba(148,163,184,0.24)',
    '--button-ghost-bg': 'rgba(255,255,255,0.72)',
    '--button-ghost-text': '#172033',
    '--button-ghost-hover-border': 'rgba(124,58,237,0.28)',
    '--button-ghost-hover-bg': 'rgba(255,255,255,0.96)',
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

const applyColorThemeToDocument = (mode: ColorThemeMode): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const themeVariables = createColorThemeVariables(mode);
  const rootStyle = document.documentElement.style;

  for (const [key, value] of Object.entries(themeVariables)) {
    if (typeof value !== 'string') {
      continue;
    }

    if (key === 'colorScheme') {
      rootStyle.colorScheme = value;
      continue;
    }

    rootStyle.setProperty(key, value);
  }

  document.documentElement.dataset.colorTheme = mode;
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
      applyColorThemeToDocument(colorTheme);
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

  return (
    <AppThemeContext.Provider value={value}>
      {children}
      <ToastContainer
        position="bottom-right"
        autoClose={2600}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        theme={colorTheme}
      />
    </AppThemeContext.Provider>
  );
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
 * Renders the shared hero block for operator pages, including the environment control.
 *
 * @param props Business title, scope, environment metadata, and environment change handler.
 * @returns The shared page-intro section used across deposit, payout, and subscription pages.
 */
export function PageHero(props: {
  title: string;
  scopeLabel: string;
  environmentLabel: string;
  environmentMode: OperatorEnvironmentMode;
  onEnvironmentChange: (mode: OperatorEnvironmentMode) => void;
}) {
  const {
    title,
    scopeLabel,
    environmentLabel,
    environmentMode,
    onEnvironmentChange,
  } = props;

  return (
    <PageCard className="mb-8 p-6 sm:p-8">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-[var(--operator-hero-rail)]" />
        <h1 className="pt-4 text-[clamp(2.2rem,6vw,4.6rem)] font-semibold leading-[0.94] tracking-[-0.04em] text-[var(--color-text)]">
          {title}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <StatusPill tone="neutral">Scope: {scopeLabel}</StatusPill>
          <StatusPill tone="neutral">環境: {environmentLabel}</StatusPill>
          <EnvironmentModeToggle mode={environmentMode} onChange={onEnvironmentChange} />
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
 * @param props Panel title, body payload, empty-state fallback text, and optional copy action.
 * @param props.copyable Whether to render a copy button for the JSON body.
 * @returns A card containing formatted JSON output.
 */
export function JsonPanel({
  title,
  body,
  emptyState,
  logContext,
  copyable = false,
}: {
  title: string;
  body: unknown;
  emptyState: string;
  logContext?: ApiLogContext | null;
  copyable?: boolean;
}) {
  const json = body ? JSON.stringify(body, null, 2) : null;

  return (
    <PageCard className="flex min-w-0 flex-col p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--color-text)]">{title}</h2>
        {copyable ? <JsonCopyButton value={json} /> : null}
      </div>
      {logContext ? <LogContextSummary logContext={logContext} /> : null}
      <pre className="operator-pre flex-1">{json ?? emptyState}</pre>
    </PageCard>
  );
}

/**
 * Renders API result messaging plus the raw payload preview in the shared visual style.
 *
 * @param props Result summary data, fallback empty-state copy, and optional copy action.
 * @param props.copyable Whether to render a copy button for the raw JSON result.
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
  copyable?: boolean;
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
    copyable = false,
  } = props;
  const json = raw ? JSON.stringify(raw, null, 2) : null;

  return (
    <PageCard className="flex min-w-0 flex-col p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--color-text)]">{title}</h2>
          {statusLabel ? (
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-primary)]">
              {statusLabel}
            </div>
          ) : null}
        </div>
        {copyable ? <JsonCopyButton value={json} /> : null}
      </div>
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
      <pre className="operator-pre flex-1">{json ?? emptyState}</pre>
    </PageCard>
  );
}

/**
 * Displays the checkout action returned by a successful API request.
 *
 * @param props Checkout URL to expose as an external action.
 * @returns A checkout link card, or `null` when no URL is available.
 */
export function CheckoutUrlPanel({ url }: { url?: string }) {
  if (!url) return null;

  return (
    <PageCard className="checkout-panel-enter border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-6">
      <h2 className="text-[1.05rem] font-semibold text-[var(--color-text)]">Checkout</h2>
      <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">Open the checkout page to complete payment.</p>
      <a
        className="mt-4 inline-flex max-w-full items-center rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-[var(--color-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        Open checkout
      </a>
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
  title: string;
  message: string;
  isLoading: boolean;
  environmentLabel: string;
  targetLabel: string;
}) {
  const {
    title,
    message,
    isLoading,
    environmentLabel,
    targetLabel,
  } = props;

  return (
    <PageCard className="mb-8 p-6 sm:p-8">
      <h1 className="text-[clamp(2rem,5vw,3.8rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--color-text)]">
        {title}
      </h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <StatusPill tone="neutral">環境: {environmentLabel}</StatusPill>
        <StatusPill tone="neutral">目標: {targetLabel}</StatusPill>
      </div>
      <p className="mt-4 flex max-w-2xl items-center gap-3 text-base leading-7 text-[color:var(--color-text-muted)]">
        {isLoading ? <FaSpinner className="shrink-0 animate-spin text-[var(--color-primary)]" aria-hidden="true" /> : null}
        <span>{message}</span>
      </p>
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
    className?: string;
  }>,
) {
  const { children, tone = 'secondary', className = '', ...buttonProps } = props;

  const toneClassName =
    tone === 'primary'
      ? 'border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--color-on-cta)] shadow-[var(--button-primary-shadow)] hover:border-[var(--button-primary-hover-border)] hover:bg-[var(--button-primary-hover-bg)] hover:brightness-105'
      : tone === 'ghost'
        ? 'border-[var(--button-ghost-border)] bg-[var(--button-ghost-bg)] text-[var(--button-ghost-text)] hover:border-[var(--button-ghost-hover-border)] hover:bg-[var(--button-ghost-hover-bg)]'
        : 'border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] shadow-[var(--button-secondary-shadow)] hover:border-[var(--button-secondary-hover-border)] hover:bg-[var(--button-secondary-hover-bg)]';

  return (
    <button
      {...buttonProps}
      className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border px-5 text-sm font-semibold transition duration-200 ${toneClassName} disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100 ${className}`.trim()}
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
