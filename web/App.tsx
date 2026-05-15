import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { DepositPage } from './pages/DepositPage';
import { PayoutPage } from './pages/PayoutPage';
import { SubscriptionPage } from './pages/SubscriptionPage';

const AppShell = () => (
  <main className="mx-auto min-h-screen w-full max-w-[1280px] px-5 pb-12 pt-8">
    <header className="mb-6 grid gap-4 rounded-3xl border border-white/10 bg-[rgba(14,18,23,0.74)] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.25)] backdrop-blur-[10px]">
      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-amber-300">Internal QA Tool</p>
        <h1 className="m-0 font-['Iowan_Old_Style','Georgia',serif] text-[clamp(1.75rem,3vw,2.8rem)]">Payment Test Workbench</h1>
        <p className="mt-2 max-w-[640px] text-[rgba(245,243,237,0.72)]">
          Frontend-first operator console for running payment test flows through the local proxy.
        </p>
      </div>

      <nav className="flex gap-2.5" aria-label="Primary">
        <NavLink
          to="/deposit"
          className={({ isActive }) =>
            isActive
              ? 'inline-flex min-w-[116px] items-center justify-center rounded-full border border-transparent bg-amber-300 px-4 py-2.5 text-[#141414]'
              : 'inline-flex min-w-[116px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-[rgba(245,243,237,0.72)] transition hover:-translate-y-px hover:border-amber-300/40'
          }
        >
          Deposit
        </NavLink>
        <NavLink
          to="/payout"
          className={({ isActive }) =>
            isActive
              ? 'inline-flex min-w-[116px] items-center justify-center rounded-full border border-transparent bg-amber-300 px-4 py-2.5 text-[#141414]'
              : 'inline-flex min-w-[116px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-[rgba(245,243,237,0.72)] transition hover:-translate-y-px hover:border-amber-300/40'
          }
        >
          Payout
        </NavLink>
        <NavLink
          to="/subscription"
          className={({ isActive }) =>
            isActive
              ? 'inline-flex min-w-[116px] items-center justify-center rounded-full border border-transparent bg-amber-300 px-4 py-2.5 text-[#141414]'
              : 'inline-flex min-w-[116px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-[rgba(245,243,237,0.72)] transition hover:-translate-y-px hover:border-amber-300/40'
          }
        >
          Subscription
        </NavLink>
      </nav>
    </header>

    <Outlet />
  </main>
);

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
