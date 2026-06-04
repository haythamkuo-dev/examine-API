import { NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { DepositPage } from './pages/DepositPage';
import { PayoutPage } from './pages/PayoutPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import {
  AppThemeFrame,
  AppThemeProvider,
  ColorThemeToggle,
  StatusPill,
  useAppTheme,
} from './pages/pageChrome';
import { ModalProvider } from './pages/utils/modal';

const navBaseClassName =
  'inline-flex min-w-[118px] cursor-pointer items-center justify-center rounded-full border px-4 py-3 text-sm font-semibold transition duration-200';

const optionCardClassName =
  'group flex min-h-[120px] cursor-pointer flex-col justify-between rounded-2xl border border-[var(--app-option-card-border)] bg-[var(--app-option-card-bg)] p-5 transition duration-200 hover:border-[var(--color-primary)]/70 hover:bg-[var(--app-option-card-hover-bg)]';

const HomePage = () => (
  <section className="grid gap-4 sm:grid-cols-3" aria-label="Choose flow">
    <NavLink to="/deposit" className={optionCardClassName}>
      <h2 className="text-lg font-semibold text-[var(--color-text)]">Deposit</h2>
      <p className="text-sm text-[color:var(--color-text-muted)]">Open deposit request builder.</p>
    </NavLink>
    <NavLink to="/payout" className={optionCardClassName}>
      <h2 className="text-lg font-semibold text-[var(--color-text)]">Payout</h2>
      <p className="text-sm text-[color:var(--color-text-muted)]">Open payout request builder.</p>
    </NavLink>
    <NavLink to="/subscription" className={optionCardClassName}>
      <h2 className="text-lg font-semibold text-[var(--color-text)]">Subscription</h2>
      <p className="text-sm text-[color:var(--color-text-muted)]">Open subscription request builder.</p>
    </NavLink>
  </section>
);

const AppShell = () => {
  const theme = useAppTheme();

  return (
    <AppThemeFrame mode={theme.colorTheme}>
      <ModalProvider>
        <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <header className="mb-8 overflow-hidden rounded-[32px] border border-[var(--app-shell-header-border)] bg-[var(--app-shell-header-bg)] p-6 shadow-[var(--shadow-xl)] backdrop-blur-xl sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)] lg:items-end">
              <div className="relative">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[var(--color-primary)]/0 via-[var(--color-primary)]/80 to-[var(--color-cta)]/10" />
                <p className="mb-3 pt-4 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
                  Internal QA Tool
                </p>
                <h1 className="max-w-3xl text-[clamp(2rem,5vw,4rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-[var(--color-text)]">
                  Payment Test Workbench
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--color-text-muted)]">
                  Frontend-first operator console for running payment test flows through the local proxy with clear request
                  previews, visible safeguards, and low-light operational ergonomics.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <StatusPill tone="accent">Dark OLED default</StatusPill>
                  <StatusPill tone="neutral">Theme: {theme.colorTheme === 'dark' ? '夜間' : '日間'}</StatusPill>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[24px] border border-[var(--app-shell-surface-border)] bg-[var(--app-shell-surface-bg)] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
                        Console posture
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[color:var(--color-text-muted)]">
                        Operators can validate payloads, compare channel presets, and confirm proxied gateway responses
                        without exposing server credentials in the browser runtime.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                        UI mode
                      </span>
                      <ColorThemeToggle mode={theme.colorTheme} onChange={theme.setColorTheme} />
                    </div>
                  </div>
                </div>

                <nav className="flex flex-wrap gap-3" aria-label="Primary">
                  <NavLink
                    to="/deposit"
                    className={({ isActive }) =>
                      isActive
                        ? `${navBaseClassName} border-[var(--color-cta)]/70 bg-[var(--color-cta)] text-white shadow-[0_0_0_1px_rgba(139,92,246,0.25)]`
                        : `${navBaseClassName} border-[var(--app-nav-idle-border)] bg-[var(--app-nav-idle-bg)] text-[var(--app-nav-idle-text)] hover:border-[var(--color-primary)]/60 hover:bg-[var(--app-option-card-hover-bg)]`
                    }
                  >
                    Deposit
                  </NavLink>
                  <NavLink
                    to="/payout"
                    className={({ isActive }) =>
                      isActive
                        ? `${navBaseClassName} border-[var(--color-cta)]/70 bg-[var(--color-cta)] text-white shadow-[0_0_0_1px_rgba(139,92,246,0.25)]`
                        : `${navBaseClassName} border-[var(--app-nav-idle-border)] bg-[var(--app-nav-idle-bg)] text-[var(--app-nav-idle-text)] hover:border-[var(--color-primary)]/60 hover:bg-[var(--app-option-card-hover-bg)]`
                    }
                  >
                    Payout
                  </NavLink>
                  <NavLink
                    to="/subscription"
                    className={({ isActive }) =>
                      isActive
                        ? `${navBaseClassName} border-[var(--color-cta)]/70 bg-[var(--color-cta)] text-white shadow-[0_0_0_1px_rgba(139,92,246,0.25)]`
                        : `${navBaseClassName} border-[var(--app-nav-idle-border)] bg-[var(--app-nav-idle-bg)] text-[var(--app-nav-idle-text)] hover:border-[var(--color-primary)]/60 hover:bg-[var(--app-option-card-hover-bg)]`
                    }
                  >
                    Subscription
                  </NavLink>
                </nav>
              </div>
            </div>
          </header>

          <Outlet />
        </main>
      </ModalProvider>
    </AppThemeFrame>
  );
};

/**
 * Defines the web operator routes for deposit, payout, and subscription testing flows.
 *
 * @returns Browser routes wrapped in the shared application shell.
 */
export function App() {
  return (
    <AppThemeProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="/deposit" element={<DepositPage />} />
          <Route path="/payout" element={<PayoutPage />} />
          <Route path="/subscription" element={<SubscriptionPage />} />
        </Route>
      </Routes>
    </AppThemeProvider>
  );
}
