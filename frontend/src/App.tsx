import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import AppShell from './components/AppShell';
import LoginPage from './features/auth/LoginPage';
import { useAuth } from './features/auth/AuthContext';
import { SiteProvider } from './lib/site';
import AdminPage from './pages/AdminPage';
import AlertsPage from './pages/AlertsPage';
import DashboardPage from './pages/DashboardPage';
import GateDetailPage from './pages/GateDetailPage';
import GatesPage from './pages/GatesPage';
import LedgerPage from './pages/LedgerPage';
import MonitoringPage from './pages/MonitoringPage';
import ReportsPage from './pages/ReportsPage';
import RulesPage from './pages/RulesPage';

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--soft-green)',
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

function BootScreen() {
  return (
    <FullScreen>
      <div style={{ textAlign: 'center' }}>
        <div className="brand__name" style={{ color: 'var(--forest-800)' }}>
          SUBAKO
        </div>
        <div className="small muted mt-4">Memuat sesi…</div>
      </div>
    </FullScreen>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function Permit({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="card" style={{ padding: 28, maxWidth: 560 }}>
        <h2 style={{ fontSize: 18 }}>Akses ditolak</h2>
        <p className="small muted mt-4">
          Role Anda tidak memiliki izin <span className="mono">{permission}</span>. Ini juga
          ditegakkan di server, bukan hanya disembunyikan di antarmuka.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <SiteProvider>
              <AppShell />
            </SiteProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/monitoring"
          element={
            <Permit permission="telemetry.read">
              <MonitoringPage />
            </Permit>
          }
        />
        <Route
          path="/gates"
          element={
            <Permit permission="gate.read">
              <GatesPage />
            </Permit>
          }
        />
        <Route
          path="/gates/:gateId"
          element={
            <Permit permission="gate.read">
              <GateDetailPage />
            </Permit>
          }
        />
        <Route
          path="/rules"
          element={
            <Permit permission="rule.view">
              <RulesPage />
            </Permit>
          }
        />
        <Route
          path="/ledger"
          element={
            <Permit permission="ledger.view">
              <LedgerPage />
            </Permit>
          }
        />
        <Route
          path="/alerts"
          element={
            <Permit permission="alert.view">
              <AlertsPage />
            </Permit>
          }
        />
        <Route
          path="/reports"
          element={
            <Permit permission="report.view">
              <ReportsPage />
            </Permit>
          }
        />
        <Route
          path="/admin"
          element={
            <Permit permission="user.manage">
              <AdminPage />
            </Permit>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
