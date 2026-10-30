import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api';
import { initials } from '../lib/format';
import { useSite } from '../lib/site';

interface NavItem {
  to: string;
  label: string;
  permission: string;
  group: string;
  icon: JSX.Element;
}

const icon = (path: JSX.Element): JSX.Element => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
);

const NAV: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    permission: 'dashboard.view',
    group: 'Operasional',
    icon: icon(
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>,
    ),
  },
  {
    to: '/monitoring',
    label: 'Monitoring',
    permission: 'telemetry.read',
    group: 'Operasional',
    icon: icon(
      <>
        <path d="M3 12h4l2-5 3 10 2.5-7 2 2H21" />
      </>,
    ),
  },
  {
    to: '/gates',
    label: 'Pintu Air',
    permission: 'gate.read',
    group: 'Operasional',
    icon: icon(
      <>
        <path d="M4 20V9l6-4 6 4v11" />
        <path d="M9 20v-5h3v5" />
      </>,
    ),
  },
  {
    to: '/rules',
    label: 'Aturan & Jadwal',
    permission: 'rule.view',
    group: 'Tata kelola',
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>,
    ),
  },
  {
    to: '/ledger',
    label: 'Buku Catatan Air',
    permission: 'ledger.view',
    group: 'Tata kelola',
    icon: icon(
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </>,
    ),
  },
  {
    to: '/alerts',
    label: 'Peringatan',
    permission: 'alert.view',
    group: 'Operasional',
    icon: icon(
      <>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>,
    ),
  },
  {
    to: '/reports',
    label: 'Laporan',
    permission: 'report.view',
    group: 'Tata kelola',
    icon: icon(
      <>
        <path d="M4 20V6h16v14z" />
        <path d="M8 16v-4M12 16V8M16 16v-7" />
      </>,
    ),
  },
  {
    to: '/admin',
    label: 'Administrasi',
    permission: 'user.manage',
    group: 'Sistem',
    icon: icon(
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </>,
    ),
  },
];

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/monitoring': 'Monitoring',
  '/gates': 'Pintu Air',
  '/rules': 'Aturan & Jadwal',
  '/ledger': 'Buku Catatan Air',
  '/alerts': 'Peringatan',
  '/reports': 'Laporan',
  '/admin': 'Administrasi',
};

export default function AppShell() {
  const { user, can, logout } = useAuth();
  const { sites, siteId, setSiteId } = useSite();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: alertSummary } = useQuery({
    queryKey: ['alerts', 'summary', siteId],
    queryFn: () => api<{ open: number; critical: number }>(`/alerts/summary?site_id=${siteId}`),
    enabled: Boolean(siteId) && can('alert.view'),
    refetchInterval: 30_000,
  });

  const items = NAV.filter((item) => can(item.permission));
  const groups = Array.from(new Set(items.map((item) => item.group)));
  const path = `/${location.pathname.split('/')[1] ?? ''}`;
  const title =
    TITLES[path] ??
    (location.pathname.startsWith('/gates/') ? 'Detail Pintu' : 'SUBAKO');

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 20V9l6-4 6 4v11" />
              <path d="M9 20v-5h3v5" />
              <path d="M4 9h13" />
            </svg>
          </span>
          <div>
            <div className="brand__name">SUBAKO</div>
            <div className="brand__sub">Smart Irrigation</div>
          </div>
        </div>

        {groups.map((group) => (
          <div key={group}>
            <div className="nav-label">{group}</div>
            {items
              .filter((item) => item.group === group)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.to === '/alerts' && (alertSummary?.open ?? 0) > 0 && (
                    <span className="count">{alertSummary?.open}</span>
                  )}
                </NavLink>
              ))}
          </div>
        ))}

        <div className="sidebar__foot">
          <div>v0.1 · Phase 1</div>
          <div>Data telemetri SIMULATION</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__title">{title}</div>
          <span className="spacer" />
          <label className="site-select">
            <span className="small muted">Site</span>
            <select
              aria-label="Pilih site"
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
            >
              {sites.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <span className="badge badge--demo">DEMO</span>
          <div className="row" style={{ gap: 8 }}>
            <div className="avatar" title={user?.full_name}>
              {initials(user?.full_name ?? 'SU')}
            </div>
            <div className="who">
              <b>{user?.full_name}</b>
              <span>{user?.role}</span>
            </div>
            <button className="btn btn--sm" type="button" onClick={handleLogout}>
              Keluar
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Navigasi utama">
        {items.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'is-active' : '')}
          >
            {item.icon}
            <span>{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
