import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Badge,
  DataModeBanner,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
} from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';
import { ApiError, api, apiKeys } from '../lib/api';
import { fmtDateTime, severityTone, statusTone } from '../lib/format';
import { useSite } from '../lib/site';
import type { Alert } from '../types';

const TABS = [
  { key: 'OPEN', label: 'Terbuka' },
  { key: 'ACKNOWLEDGED', label: 'Diakui' },
  { key: 'RESOLVED', label: 'Selesai' },
  { key: 'ALL', label: 'Semua' },
] as const;

export default function AlertsPage() {
  const { siteId } = useSite();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('OPEN');
  const [resolving, setResolving] = useState<Alert | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const alerts = useQuery({
    queryKey: apiKeys.alerts(siteId),
    queryFn: () => api<{ data: Alert[] }>(`/alerts?site_id=${siteId}`),
    enabled: Boolean(siteId),
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: apiKeys.alerts(siteId) });
    queryClient.invalidateQueries({ queryKey: ['alerts', 'summary', siteId] });
  };

  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      api<Alert>(`/alerts/${id}/acknowledge`, { method: 'POST', json: {} }),
    onSuccess: invalidate,
    onError: (err) =>
      setError(err instanceof ApiError ? `${err.code}: ${err.message}` : 'Gagal mengakui alert.'),
  });

  const resolve = useMutation({
    mutationFn: (payload: { id: string; note: string }) =>
      api<Alert>(`/alerts/${payload.id}/resolve`, {
        method: 'POST',
        json: { note: payload.note },
      }),
    onSuccess: () => {
      setResolving(null);
      setNote('');
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? `${err.code}: ${err.message}` : 'Gagal menyelesaikan alert.'),
  });

  if (alerts.isLoading) return <Loading />;
  if (alerts.error) return <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />;

  const all = alerts.data?.data ?? [];
  const rows = tab === 'ALL' ? all : all.filter((alert) => alert.status === tab);
  const counts = {
    OPEN: all.filter((a) => a.status === 'OPEN').length,
    ACKNOWLEDGED: all.filter((a) => a.status === 'ACKNOWLEDGED').length,
    RESOLVED: all.filter((a) => a.status === 'RESOLVED').length,
    ALL: all.length,
  };

  return (
    <>
      <PageHeader
        title="Peringatan"
        lede="Alert operasional dan teknis. Menyelesaikan alert memerlukan catatan dan tercatat di ledger."
        badges={<Badge tone="demo">SIMULASI</Badge>}
      />
      <DataModeBanner />

      <div className="filter-bar mt-4">
        <div className="segmented">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={tab === item.key ? 'is-active' : ''}
              onClick={() => setTab(item.key)}
            >
              {item.label} ({counts[item.key]})
            </button>
          ))}
        </div>
        <span className="spacer" />
        <span className="small muted">Diperbarui otomatis tiap 30 detik</span>
      </div>

      {error && <ErrorState error={new Error(error)} />}

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState title="Tidak ada alert pada filter ini" />
        ) : (
          <div className="list">
            {rows.map((alert) => (
              <div className="list__item" key={alert.id}>
                <span
                  className={`sev-bar sev-bar--${
                    alert.severity === 'CRITICAL'
                      ? 'critical'
                      : alert.severity === 'WARNING'
                        ? 'medium'
                        : 'low'
                  }`}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="between">
                    <div className="row row--wrap">
                      <strong>{alert.title}</strong>
                      <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge>
                      <Badge tone={statusTone(alert.status)}>{alert.status}</Badge>
                    </div>
                    <span className="small muted">{fmtDateTime(alert.first_seen_at)}</span>
                  </div>
                  <div className="small muted mt-4">{alert.evidence?.message}</div>
                  <div className="small muted">
                    {alert.alert_type}
                    {alert.resolution_note ? ` · ${alert.resolution_note}` : ''}
                  </div>

                  <div className="row row--wrap mt-4">
                    {alert.status === 'OPEN' && can('alert.acknowledge') && (
                      <button
                        className="btn btn--sm"
                        type="button"
                        disabled={acknowledge.isPending}
                        onClick={() => {
                          setError(null);
                          acknowledge.mutate(alert.id);
                        }}
                      >
                        Akui
                      </button>
                    )}
                    {alert.status !== 'RESOLVED' && can('alert.resolve') && (
                      <button
                        className="btn btn--sm btn--primary"
                        type="button"
                        onClick={() => {
                          setResolving(alert);
                          setNote('');
                          setError(null);
                        }}
                      >
                        Selesaikan
                      </button>
                    )}
                    {!can('alert.acknowledge') && (
                      <span className="small muted">Mode pantau — aksi memerlukan operator.</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(resolving)}
        title={`Selesaikan: ${resolving?.title ?? ''}`}
        onClose={() => setResolving(null)}
      >
        <div className="stack">
          <p className="small muted">
            Catatan minimal 10 karakter. Setelah diselesaikan, alert tidak dapat dibuka kembali
            dan ringkasannya masuk ke ledger.
          </p>
          <div className="field">
            <label className="label" htmlFor="note">
              Tindakan / penyebab
            </label>
            <textarea
              id="note"
              className="textarea"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Contoh: motor diperiksa, hambatan dibersihkan, arus kembali 1,2 A"
            />
          </div>
          {error && <div className="small" style={{ color: 'var(--critical-ink)' }}>{error}</div>}
          <button
            className="btn btn--primary"
            type="button"
            disabled={note.trim().length < 10 || resolve.isPending}
            onClick={() => {
              if (resolving) resolve.mutate({ id: resolving.id, note: note.trim() });
            }}
          >
            {resolve.isPending ? 'Menyimpan…' : 'Selesaikan alert'}
          </button>
        </div>
      </Modal>
    </>
  );
}
