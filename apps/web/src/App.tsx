import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import MesocycleWizardPage from './pages/MesocycleWizardPage';
import WorkoutSessionPage from './pages/WorkoutSessionPage';
import NextTargetsPage from './pages/NextTargetsPage';
import PastMesocyclesPage from './pages/PastMesocyclesPage';
import MyMesocyclesPage from './pages/MyMesocyclesPage';
import RequireAuth from './components/RequireAuth';
import { useAuth } from './lib/auth';
import { useMemo, useState } from 'react';

const AppShell = () => {
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = useMemo(
    () => [
      { label: 'Allenamento attuale', to: '/dashboard' },
      { label: 'Crea mesociclo', to: '/wizard' },
      { label: 'I tuoi mesocicli', to: '/mesocycles' },
      { label: 'Mesocicli completati', to: '/history' },
    ],
    [],
  );

  return (
    <div className={`app-shell ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="side-nav">
        <div className="side-brand">
          <span className="brand">Fitness Forge</span>
          <span className="muted">Training cockpit</span>
        </div>
        <nav className="side-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="ghost-button logout-button" type="button" onClick={logout}>
          Logout
        </button>
      </aside>

      <header className="top-bar mobile-only">
        <button
          className="ghost-button menu-button"
          type="button"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
        >
          <span className="hamburger" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <div>
          <span className="brand">Fitness Forge</span>
          <span className="muted">Training cockpit</span>
        </div>
        <button className="ghost-button" type="button" onClick={logout}>
          Logout
        </button>
      </header>

      <main className="app-main">
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/wizard"
            element={
              <RequireAuth>
                <MesocycleWizardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/mesocycles"
            element={
              <RequireAuth>
                <MyMesocyclesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/session/:id"
            element={
              <RequireAuth>
                <WorkoutSessionPage />
              </RequireAuth>
            }
          />
          <Route
            path="/next-targets"
            element={
              <RequireAuth>
                <NextTargetsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <PastMesocyclesPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <span className="brand">Menu</span>
          <button
            className="ghost-button"
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            Close
          </button>
        </div>
        <nav className="mobile-menu-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <button className="primary-button" type="button" onClick={logout}>
            Logout
          </button>
        </nav>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
};

export default App;
