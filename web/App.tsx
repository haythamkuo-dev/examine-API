import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { DepositPage } from './pages/DepositPage';

const AppShell = () => (
  <main className="shell">
    <header className="panel app-frame">
      <div>
        <p className="eyebrow">Internal QA Tool</p>
        <h1 className="app-title">Payment Test Workbench</h1>
        <p className="app-copy">Frontend-first operator console for running payment test flows through the local proxy.</p>
      </div>

      <nav className="module-nav" aria-label="Primary">
        <NavLink to="/deposit" className={({ isActive }) => (isActive ? 'module-link is-active' : 'module-link')}>
          Deposit
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
      </Route>
    </Routes>
  );
}
