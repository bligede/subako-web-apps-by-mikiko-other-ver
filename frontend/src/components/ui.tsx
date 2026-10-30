import type { ReactNode } from 'react';

import { freshnessTone } from '../lib/format';

export function Badge({
  tone = 'neutral',
  children,
  title,
}: {
  tone?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  lede,
  actions,
  badges,
}: {
  title: string;
  lede?: string;
  actions?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="row row--wrap" style={{ gap: 8, marginBottom: 4 }}>
          <h1>{title}</h1>
          {badges}
        </div>
        {lede && <p className="lede">{lede}</p>}
      </div>
      <span className="spacer" />
      {actions}
    </div>
  );
}

export function Kpi({
  label,
  value,
  unit,
  meta,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  meta?: ReactNode;
  tone?: 'warning' | 'critical';
}) {
  return (
    <section className={`card kpi${tone ? ` kpi--${tone}` : ''}`}>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {meta && <span className="kpi__meta">{meta}</span>}
    </section>
  );
}

export function FreshnessBadge({ value }: { value?: string | null }) {
  const label = value ?? 'OFFLINE';
  return (
    <Badge tone={freshnessTone(label)} title="Status kesegaran data">
      <span className="dot-live" style={{ background: 'currentColor', boxShadow: 'none' }} />
      {label}
    </Badge>
  );
}

export function Loading({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="card" style={{ padding: 28, textAlign: 'center' }}>
      <div className="small muted">{label}</div>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
  return (
    <div className="banner banner--critical" role="alert">
      <span>⛔</span>
      <div>
        <div className="small strong">{message}</div>
        {onRetry && (
          <button className="btn btn--sm mt-4" type="button" onClick={onRetry}>
            Coba lagi
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center' }}>
      <div className="strong">{title}</div>
      {children && <div className="small muted mt-4">{children}</div>}
    </div>
  );
}

export function DataModeBanner({ mode = 'SIMULATION' }: { mode?: string }) {
  if (mode !== 'SIMULATION') return null;
  return (
    <div className="banner banner--demo" role="note">
      <span>⚠️</span>
      <div className="small">
        <strong>DATA SIMULASI.</strong> Angka pada layar ini dihasilkan simulator, bukan
        pembacaan perangkat lapangan. Jangan dipakai sebagai bukti pelaksanaan Paruman.
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card__head">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="btn btn--sm" type="button" onClick={onClose}>
            Tutup
          </button>
        </div>
        <div className="card__body">{children}</div>
      </div>
    </div>
  );
}
