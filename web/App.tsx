import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { DepositPage } from './pages/DepositPage';
import { PayoutPage } from './pages/PayoutPage';
import { SubscriptionPage } from './pages/SubscriptionPage';

const navBaseClassName =
  'inline-flex min-w-[118px] cursor-pointer items-center justify-center rounded-full border px-4 py-3 text-sm font-semibold transition duration-200';

const AppShell = () => (
  <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
    <header className="mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82)_45%,rgba(76,29,149,0.32)_100%)] p-6 shadow-[var(--shadow-xl)] backdrop-blur-xl sm:p-8">
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
        </div>

        <div className="grid gap-4">
          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
              Console posture
            </p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--color-text-muted)]">
              Operators can validate payloads, compare channel presets, and confirm proxied gateway responses without
              exposing server credentials in the browser runtime.
            </p>
          </div>

          <nav className="flex flex-wrap gap-3" aria-label="Primary">
            <NavLink
              to="/deposit"
              className={({ isActive }) =>
                isActive
                  ? `${navBaseClassName} border-[var(--color-cta)]/70 bg-[var(--color-cta)] text-white shadow-[0_0_0_1px_rgba(139,92,246,0.25)]`
                  : `${navBaseClassName} border-white/15 bg-white/5 text-[color:var(--color-text-muted)] hover:border-[var(--color-primary)]/60 hover:bg-white/10`
              }
            >
              Deposit
            </NavLink>
            <NavLink
              to="/payout"
              className={({ isActive }) =>
                isActive
                  ? `${navBaseClassName} border-[var(--color-cta)]/70 bg-[var(--color-cta)] text-white shadow-[0_0_0_1px_rgba(139,92,246,0.25)]`
                  : `${navBaseClassName} border-white/15 bg-white/5 text-[color:var(--color-text-muted)] hover:border-[var(--color-primary)]/60 hover:bg-white/10`
              }
            >
              Payout
            </NavLink>
            <NavLink
              to="/subscription"
              className={({ isActive }) =>
                isActive
                  ? `${navBaseClassName} border-[var(--color-cta)]/70 bg-[var(--color-cta)] text-white shadow-[0_0_0_1px_rgba(139,92,246,0.25)]`
                  : `${navBaseClassName} border-white/15 bg-white/5 text-[color:var(--color-text-muted)] hover:border-[var(--color-primary)]/60 hover:bg-white/10`
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
);

/**
 * Defines the web operator routes for deposit, payout, and subscription testing flows.
 *
 * @returns Browser routes wrapped in the shared application shell.
 */
export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/deposit" replace />} />
        <Route path="/deposit" element={<DepositPage />} />
        <Route path="/payout" element={<PayoutPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
      </Route>
    </Routes>
  );
}
