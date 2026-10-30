import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { TimeSeriesChart } from '../components/charts';
import {
  Badge,
  DataModeBanner,
  EmptyState,
  ErrorState,
  FreshnessBadge,
  Kpi,
  Loading,
  PageHeader,
} from '../components/ui';
import { api, apiKeys } from '../lib/api';
import {
  ageLabel,
  fmtDateTime,
  fmtNumber,
  fmtTime,
  modeTone,
  severityTone,
  statusTone,
} from '../lib/format';
import { useSite } from '../lib/site';
import type {
  Alert,
  Gate,
  HistoryResponse,
  Overview,
  ScheduleResponse,
} from '../types';

export default function DashboardPage() {
  const { site, siteId } = useSite();
  const navigate = useNavigate();

  const overview = useQuery({
    queryKey: apiKeys.overview(siteId),
    queryFn: () => api<Overview>(`/sites/${siteId}/overview`),
    enabled: Boolean(siteId),
    refetchInterval: 30_000,
  });

  const history = useQuery({
    queryKey: apiKeys.history(siteId, 'flow', null, '1h'),
    queryFn: () =>
      api<HistoryResponse>(`/telemetry/history?site_id=${siteId}&channel=flow&granularity=1h`),
    enabled: Boolean(siteId),
    refetchInterval: 60_000,
  });

  const schedule = useQuery({
    queryKey: apiKeys.schedule(siteId),
    queryFn: () => api<ScheduleResponse>(`/schedule?site_id=${siteId}`),
    enabled: Boolean(siteId),
  });

  const alerts = useQuery({
    queryKey: apiKeys.alerts(siteId),
    queryFn: () => api<{ data: Alert[] }>(`/alerts?site_id=${siteId}`),
    enabled: Boolean(siteId),
    refetchInterval: 30_000,
  });

  if (overview.isLoading) return <Loading label="Memuat ringkasan site…" />;
  if (overview.error) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const data = overview.data!;
  const openAlerts = (alerts.data?.data ?? []).filter((alert) => alert.status !== 'RESOLVED');

  return (
    <>
      <PageHeader
        title="Dashboard"
        lede={`${site?.name ?? 'Site'} · ringkasan kondisi air, pintu, dan peringatan. Waktu ditampilkan dalam WITA.`}
        badges={<FreshnessBadge value={data.freshness} />}
        actions={
          <div className="row">
            <span className="small muted">Diperbarui {fmtTime(data.last_updated)} WITA</span>
            <button
              className="btn btn--sm"
              type="button"
              onClick={() => {
                overview.refetch();
                history.refetch();
                alerts.refetch();
              }}
            >
              Segarkan
            </button>
          </div>
        }
      />

      <DataModeBanner mode={data.data_mode} />

      <div className="grid g-4 mt-4">
        <Kpi
          label="Debit total"
          value={fmtNumber(data.total_flow_lps, 1)}
          unit="L/detik"
          meta={<span className="badge badge--neutral">{data.gates_online}/{data.gates_total} pintu terpantau</span>}
        />
        <Kpi
          label="Ketinggian rata-rata"
          value={fmtNumber(data.avg_level_m, 2)}
          unit="m"
          meta={<span>{data.devices_online}/{data.devices_total} perangkat online</span>}
        />
        <Kpi
          label="Pintu gangguan"
          value={data.gates_fault}
          meta={<span>{data.gates_fault > 0 ? 'Perlu tindakan operator' : 'Tidak ada gangguan aktif'}</span>}
          tone={data.gates_fault > 0 ? 'critical' : undefined}
        />
        <Kpi
          label="Peringatan terbuka"
          value={data.alerts_open}
          meta={<span>{data.alerts_critical} kritis · batas bawah baterai {fmtNumber(data.lowest_battery_pct, 0)}%</span>}
          tone={data.alerts_critical > 0 ? 'warning' : undefined}
        />
      </div>

      <div className="grid g-side mt-4">
        <section className="card">
          <div className="card__head">
            <h2>Debit total 24 jam</h2>
            <span className="spacer" />
            <span className="small muted">agregasi per jam · L/detik</span>
          </div>
          <div className="card__body">
            <TimeSeriesChart points={history.data?.data ?? []} unit="L/d" height={260} />
          </div>
          <div className="card__foot">
            <span>Garis hanya menghubungkan titik terukur; nilai estimasi tidak diisi otomatis.</span>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="card__head">
              <h2>Giliran saat ini</h2>
              <span className="spacer" />
              <span className="badge badge--neutral">WITA</span>
            </div>
            <div className="card__body">
              {schedule.data?.current ? (
                <>
                  <div className="between">
                    <div>
                      <div className="strong">{schedule.data.current.tempek_name}</div>
                      <div className="small muted">
                        {schedule.data.current.time_label} · {schedule.data.current.gate_code}
                      </div>
                    </div>
                    <Badge tone="ok">BERJALAN</Badge>
                  </div>
                  <div className="progress mt-4">
                    <span style={{ width: `${schedule.data.current.progress_pct ?? 0}%` }} />
                  </div>
                  <div className="small muted mt-4">
                    {fmtNumber(schedule.data.current.progress_pct, 0)}% durasi slot · hak{' '}
                    {fmtNumber(schedule.data.current.entitlement_pct, 0)}%
                  </div>
                </>
              ) : (
                <EmptyState title="Di luar slot terjadwal">
                  Tidak ada giliran aktif pada jam ini. Periksa halaman Aturan &amp; Jadwal untuk
                  slot berikutnya.
                </EmptyState>
              )}
            </div>
            <div className="card__foot">
              <Link to="/rules">Lihat aturan &amp; jadwal lengkap</Link>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2>Peringatan aktif</h2>
              <span className="spacer" />
              <Badge tone={openAlerts.length > 0 ? 'warning' : 'ok'}>{openAlerts.length}</Badge>
            </div>
            {openAlerts.length === 0 ? (
              <EmptyState title="Tidak ada peringatan terbuka" />
            ) : (
              <div className="list">
                {openAlerts.slice(0, 4).map((alert) => (
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
                    <div style={{ minWidth: 0 }}>
                      <div className="between">
                        <span className="strong small">{alert.title}</span>
                        <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge>
                      </div>
                      <div className="small muted">{alert.evidence?.message}</div>
                      <div className="small muted">
                        {fmtDateTime(alert.first_seen_at)} · {alert.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="card__foot">
              <Link to="/alerts">Buka semua peringatan</Link>
            </div>
          </section>
        </div>
      </div>

      <section className="card mt-4">
        <div className="card__head">
          <h2>Kondisi pintu</h2>
          <span className="spacer" />
          <Link className="small" to="/gates">
            Semua pintu
          </Link>
        </div>
        <div className="card__body card__body--flush">
          <div className="table-wrap">
            <table className="table table--cards table--flush">
              <thead>
                <tr>
                  <th>Pintu</th>
                  <th>Mode</th>
                  <th className="right">Bukaan</th>
                  <th className="right">Target</th>
                  <th className="right">Debit</th>
                  <th className="right">Level</th>
                  <th className="right">Baterai</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {data.gates.map((gate: Gate) => (
                  <tr key={gate.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/gates/${gate.id}`)}>
                    <td data-label="Pintu">
                      <strong>{gate.code}</strong>
                      <div className="small muted">{gate.name}</div>
                    </td>
                    <td data-label="Mode">
                      <Badge tone={modeTone(gate.state?.mode)}>{gate.state?.mode ?? '—'}</Badge>
                    </td>
                    <td data-label="Bukaan" className="right num">
                      {fmtNumber(gate.state?.position_pct, 1)}%
                    </td>
                    <td data-label="Target" className="right num">
                      {fmtNumber(gate.state?.target_pct, 1)}%
                    </td>
                    <td data-label="Debit" className="right num">
                      {fmtNumber(gate.flow_lps, 1)} L/d
                    </td>
                    <td data-label="Level" className="right num">
                      {fmtNumber(gate.level_m, 2)} m
                    </td>
                    <td data-label="Baterai" className="right num">
                      {fmtNumber(gate.battery_pct, 0)}%
                    </td>
                    <td data-label="Data">
                      <FreshnessBadge value={gate.device_freshness} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card__foot">
          <span>
            Status data terakhir: {ageLabel(data.gates[0]?.age_s)}. Data basi tidak dianggap
            perintah berhasil.
          </span>
        </div>
      </section>

      <div className="banner banner--info mt-4">
        <span>ℹ️</span>
        <div className="small">
          Kepatuhan jadwal belum dihitung pada Phase 1 (butuh integrasi laporan dan rule engine).
          Nilai sengaja dikosongkan, bukan diisi angka contoh.
        </div>
      </div>
    </>
  );
}
