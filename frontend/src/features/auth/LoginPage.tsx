import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { ApiError } from '../../lib/api';
import { useAuth } from './AuthContext';

const DEMO_ACCOUNTS = [
  { email: 'pekaseh@demo', role: 'Pekaseh', note: 'tata kelola air' },
  { email: 'operator@demo', role: 'Operator', note: 'aktuasi & alert' },
  { email: 'petani@demo', role: 'Petani', note: 'hanya melihat' },
  { email: 'admin@mikiko.id', role: 'Admin', note: 'teknis, tanpa aktuasi' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('pekaseh@demo');
  const [password, setPassword] = useState('Subako#2026');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={from} replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Tidak dapat masuk. Periksa koneksi ke server.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth__panel">
        <div className="auth__card">
          <div className="row" style={{ gap: 10 }}>
            <span className="brand__mark" style={{ width: 38, height: 38, borderRadius: 10 }}>
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
              <div style={{ fontWeight: 700, letterSpacing: '.14em', color: '#10443b' }}>
                SUBAKO
              </div>
              <div className="small muted">Smart Irrigation Management Platform</div>
            </div>
          </div>

          <div>
            <h1 style={{ fontSize: 24, lineHeight: '30px' }}>Masuk ke akun Anda</h1>
            <p className="small muted mt-4">
              Gunakan akun yang diberikan Pekaseh atau administrator teknis.
            </p>
          </div>

          <div className="banner banner--info" role="note">
            <span>ℹ️</span>
            <div className="small">
              <strong>Lingkungan demo.</strong> Semua data site berlabel SIMULATION. Password demo:{' '}
              <span className="mono">Subako#2026</span>
            </div>
          </div>

          <form className="stack" onSubmit={submit}>
            <div className="field">
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                className="input"
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">
                Kata sandi
              </label>
              <input
                className="input"
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error && (
              <div className="banner banner--critical" role="alert">
                <span>⛔</span>
                <div className="small">{error}</div>
              </div>
            )}

            <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
              {busy ? 'Memeriksa…' : 'Masuk'}
            </button>
          </form>

          <div className="stack stack--sm">
            <span className="micro muted">Akun demo</span>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="between"
                style={{
                  border: '1px solid var(--line)',
                  background: '#fff',
                  borderRadius: 8,
                  padding: '7px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onClick={() => {
                  setEmail(account.email);
                  setPassword('Subako#2026');
                }}
              >
                <span className="small">
                  <strong>{account.role}</strong> · {account.email}
                </span>
                <span className="small muted">{account.note}</span>
              </button>
            ))}
          </div>

          <p className="small muted">
            Dengan masuk, Anda menyetujui pencatatan aktivitas operasional pada audit dan Water
            Ledger. Tidak ada perintah aktuasi yang diantrekan saat offline.
          </p>
        </div>
      </section>

      <aside className="auth__hero">
        <div className="row" style={{ gap: 10 }}>
          <span
            className="badge"
            style={{
              background: 'rgba(255,255,255,.12)',
              color: '#eaf5f2',
              borderColor: 'rgba(255,255,255,.22)',
            }}
          >
            v0.1 · PHASE 1
          </span>
          <span className="badge badge--demo">DATA SIMULASI</span>
        </div>

        <div className="stack" style={{ maxWidth: '44ch' }}>
          <h2>Tradisi yang memutuskan. Teknologi yang mengukur.</h2>
          <p style={{ fontSize: 14, lineHeight: '22px', color: '#a8cbc3' }}>
            SUBAKO tidak menggantikan Paruman atau Pekaseh. Sistem mencatat kondisi air,
            menjalankan aturan yang telah disahkan, dan membuka catatan distribusi agar dapat
            diperiksa bersama.
          </p>
          <div className="auth__quote">
            “Pintu air tetap dapat dioperasikan secara mekanis ketika sistem elektronik
            mengalami kegagalan.”
          </div>
        </div>

        <div className="grid g-3" style={{ gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }} className="num">
              6
            </div>
            <div className="small" style={{ color: '#8fbdb3' }}>
              pintu terpantau
            </div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }} className="num">
              4
            </div>
            <div className="small" style={{ color: '#8fbdb3' }}>
              role dengan batas jelas
            </div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }} className="num">
              0
            </div>
            <div className="small" style={{ color: '#8fbdb3' }}>
              perintah saat offline
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
