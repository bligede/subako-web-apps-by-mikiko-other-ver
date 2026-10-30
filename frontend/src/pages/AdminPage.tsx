import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Badge,
  DataModeBanner,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';
import { ApiError, api, apiKeys } from '../lib/api';
import { fmtDateTime, fmtInt, statusTone } from '../lib/format';
import { useSite } from '../lib/site';
import type { AdminUser, AuditEvent, DeviceRow, Role, SystemHealth } from '../types';

const ROLES: Role[] = ['VIEWER', 'OPERATOR', 'PEKASEH', 'ADMIN'];

export default function AdminPage() {
  const { can, user } = useAuth();
  const { siteId } = useSite();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const users = useQuery({
    queryKey: apiKeys.adminUsers,
    queryFn: () => api<{ data: AdminUser[] }>('/admin/users'),
    enabled: can('user.manage'),
  });

  const audit = useQuery({
    queryKey: apiKeys.adminAudit,
    queryFn: () => api<{ data: AuditEvent[] }>('/admin/audit?limit=40'),
    enabled: can('audit.read'),
  });

  const health = useQuery({
    queryKey: apiKeys.systemHealth,
    queryFn: () => api<SystemHealth>('/admin/system-health'),
    enabled: can('system.health'),
  });

  const devices = useQuery({
    queryKey: apiKeys.devices(siteId),
    queryFn: () => api<{ data: DeviceRow[] }>(`/admin/devices?site_id=${siteId}`),
    enabled: can('device.read') && Boolean(siteId),
  });

  const patchUser = useMutation({
    mutationFn: (payload: { id: string; body: { role?: Role; is_active?: boolean } }) =>
      api<AdminUser>(`/admin/users/${payload.id}`, {
        method: 'PATCH',
        json: payload.body,
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: apiKeys.adminUsers });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? `${err.code}: ${err.message}` : 'Perubahan pengguna gagal.',
      ),
  });

  return (
    <>
      <PageHeader
        title="Administrasi"
        lede="Pengguna, audit teknis, dan kesehatan sistem. Administrator teknis tidak dapat mengubah aturan air atau menggerakkan pintu."
        badges={<Badge tone="demo">DEMO</Badge>}
      />
      <DataModeBanner />

      {error && (
        <div className="mt-4">
          <ErrorState error={new Error(error)} />
        </div>
      )}

      <section className="card mt-4">
        <div className="card__head">
          <h2>Pengguna</h2>
          <span className="spacer" />
          <span className="small muted">role tunggal per pengguna (pilot)</span>
        </div>
        <div className="card__body card__body--flush">
          {users.isLoading ? (
            <Loading />
          ) : users.error ? (
            <ErrorState error={users.error} onRetry={() => users.refetch()} />
          ) : (
            <div className="table-wrap">
              <table className="table table--cards table--flush">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Site</th>
                    <th>Terakhir masuk</th>
                    <th>Status</th>
                    <th className="right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(users.data?.data ?? []).map((item) => (
                    <tr key={item.id}>
                      <td data-label="Nama">
                        <strong>{item.full_name}</strong>
                        {item.id === user?.id && <span className="small muted"> · Anda</span>}
                      </td>
                      <td data-label="Email" className="mono">
                        {item.email}
                      </td>
                      <td data-label="Role">
                        {item.role === 'ADMIN' && item.id === user?.id ? (
                          <Badge tone="critical">ADMIN</Badge>
                        ) : (
                          <select
                            className="select"
                            style={{ minHeight: 30, padding: '3px 8px' }}
                            value={item.role}
                            disabled={patchUser.isPending || !can('user.manage')}
                            onChange={(event) => {
                              setError(null);
                              patchUser.mutate({
                                id: item.id,
                                body: { role: event.target.value as Role },
                              });
                            }}
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td data-label="Site" className="small">
                        {item.sites.map((site) => `${site.name} (${site.level})`).join(', ') || '—'}
                      </td>
                      <td data-label="Terakhir masuk" className="small">
                        {fmtDateTime(item.last_login_at)}
                      </td>
                      <td data-label="Status">
                        <Badge tone={item.is_active ? 'ok' : 'offline'}>
                          {item.is_active ? 'AKTIF' : 'NONAKTIF'}
                        </Badge>
                      </td>
                      <td data-label="Aksi" className="right">
                        <button
                          className="btn btn--sm"
                          type="button"
                          disabled={patchUser.isPending || item.id === user?.id}
                          onClick={() => {
                            setError(null);
                            patchUser.mutate({
                              id: item.id,
                              body: { is_active: !item.is_active },
                            });
                          }}
                        >
                          {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card__foot">
          <span>
            Server menolak perubahan role akun sendiri dan menonaktifkan admin terakhir. Akun yang
            dinonaktifkan langsung kehilangan akses token.
          </span>
        </div>
      </section>

      {can('device.read') && (
        <section className="card mt-4">
          <div className="card__head">
            <h2>Perangkat</h2>
            <span className="spacer" />
            <span className="small muted">provisioning penuh di Phase 3</span>
          </div>
          <div className="card__body card__body--flush">
            {devices.isLoading ? (
              <Loading />
            ) : (
              <div className="table-wrap">
                <table className="table table--cards table--flush">
                  <thead>
                    <tr>
                      <th>Device ID</th>
                      <th>Jenis</th>
                      <th>Pintu</th>
                      <th>Mode data</th>
                      <th>Status</th>
                      <th className="right">Baterai</th>
                      <th>Komunikasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(devices.data?.data ?? []).map((device) => (
                      <tr key={device.id}>
                        <td data-label="Device ID" className="mono">
                          {device.device_id}
                        </td>
                        <td data-label="Jenis">{device.kind}</td>
                        <td data-label="Pintu">{device.gate_code ?? '—'}</td>
                        <td data-label="Mode data">
                          <Badge tone="warning">{device.data_mode}</Badge>
                        </td>
                        <td data-label="Status">
                          <Badge tone={statusTone(device.status)}>{device.status}</Badge>
                        </td>
                        <td data-label="Baterai" className="right num">
                          {device.battery_pct ?? '—'}%
                        </td>
                        <td data-label="Komunikasi">{fmtDateTime(device.last_communication_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="grid g-2 mt-4">
        {can('audit.read') && (
          <section className="card">
            <div className="card__head">
              <h2>Audit teknis</h2>
              <span className="spacer" />
              <Badge tone="neutral">append-only</Badge>
            </div>
            <div className="card__body card__body--flush" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {audit.isLoading ? (
                <Loading />
              ) : (
                <div className="list">
                  {(audit.data?.data ?? []).map((event) => (
                    <div className="list__item" key={event.id}>
                      <span className="sev-bar sev-bar--medium" />
                      <div style={{ minWidth: 0 }}>
                        <div className="between">
                          <span className="strong small">{event.action}</span>
                          <span className="small muted">{fmtDateTime(event.occurred_at)}</span>
                        </div>
                        <div className="small muted">{event.summary}</div>
                        <div className="small muted">
                          {event.actor_label}
                          {event.permission ? ` · ${event.permission}` : ''}
                          {event.request_id ? ` · ${event.request_id}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {can('system.health') && (
          <section className="card">
            <div className="card__head">
              <h2>Kesehatan sistem</h2>
              <span className="spacer" />
              <span className="small muted">v{health.data?.version ?? '—'}</span>
            </div>
            <div className="card__body">
              {health.isLoading ? (
                <Loading />
              ) : health.error ? (
                <ErrorState error={health.error} />
              ) : (
                <>
                  <dl className="kv">
                    {health.data?.components.map((component) => (
                      <div className="between" key={component.name} style={{ display: 'contents' }}>
                        <dt>{component.name}</dt>
                        <dd>
                          <Badge tone={component.status === 'OK' || component.status === 'ACTIVE' ? 'ok' : 'neutral'}>
                            {component.status}
                          </Badge>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <hr className="divider" />
                  <div className="between small">
                    <span>Telemetri tersimpan</span>
                    <strong className="num">{fmtInt(health.data?.counts.readings)}</strong>
                  </div>
                  <div className="between small mt-4">
                    <span>Perangkat aktif</span>
                    <strong className="num">
                      {health.data?.counts.devices_active}/{health.data?.counts.devices}
                    </strong>
                  </div>
                  <div className="between small mt-4">
                    <span>Pembacaan terakhir</span>
                    <span>{fmtDateTime(health.data?.last_reading_at)}</span>
                  </div>

                  <hr className="divider" />
                  <div className="micro muted mb-2">Integritas ledger per site</div>
                  {(health.data?.ledger ?? []).map((item) => (
                    <div className="between small" key={item.site_id}>
                      <span>{item.site_name}</span>
                      <span>
                        <span className="muted">{item.entries} entri</span>{' '}
                        <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="card__foot">
              <span>MQTT/ChirpStack belum dikonfigurasi pada Phase 1 — tidak ada uplink nyata.</span>
            </div>
          </section>
        )}
      </div>

      {!can('audit.read') && !can('system.health') && (
        <section className="card mt-4">
          <EmptyState title="Audit dan kesehatan sistem hanya untuk administrator teknis">
            Pekaseh dapat mengelola pengguna pada site-nya, tetapi tidak dapat membaca audit
            teknis atau status infrastruktur.
          </EmptyState>
        </section>
      )}
    </>
  );
}
