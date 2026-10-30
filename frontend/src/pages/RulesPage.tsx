import { useQuery } from '@tanstack/react-query';

import {
  Badge,
  DataModeBanner,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from '../components/ui';
import { api, apiKeys } from '../lib/api';
import { fmtDate, fmtNumber, statusTone } from '../lib/format';
import { useSite } from '../lib/site';
import type { RuleVersion } from '../types';

export default function RulesPage() {
  const { siteId } = useSite();

  const rules = useQuery({
    queryKey: apiKeys.rules(siteId),
    queryFn: () => api<{ data: RuleVersion[] }>(`/rules?site_id=${siteId}`),
    enabled: Boolean(siteId),
    refetchInterval: 60_000,
  });

  if (rules.isLoading) return <Loading />;
  if (rules.error) return <ErrorState error={rules.error} onRetry={() => rules.refetch()} />;

  const data = rules.data?.data ?? [];
  const published = data.find((rule) => rule.status === 'PUBLISHED');
  const versions = [...data].sort((a, b) => b.version - a.version);

  return (
    <>
      <PageHeader
        title="Aturan & Jadwal"
        lede="Rule yang berlaku bersifat immutable: perubahan dibuat sebagai versi baru, disetujui pihak berbeda, lalu diterbitkan. Phase 1 menampilkan data; alur penuh menyusul di Phase 4."
        badges={<Badge tone="demo">SIMULASI</Badge>}
        actions={<Badge tone="info">READ-ONLY PHASE 1</Badge>}
      />
      <DataModeBanner />

      {!published ? (
        <div className="card mt-4">
          <EmptyState title="Belum ada rule yang diterbitkan">
            Aturan air harus diterbitkan Pekaseh sebelum perintah aktuasi diizinkan.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid g-side mt-4">
            <section className="card">
              <div className="card__head">
                <div>
                  <h2>Rule aktif · {published.code}</h2>
                  <div className="small muted">
                    Versi {published.version_no} · berlaku {fmtDate(published.effective_from)} —{' '}
                    {published.effective_to ? fmtDate(published.effective_to) : 'sampai dicabut'}
                  </div>
                </div>
                <span className="spacer" />
                <Badge tone={statusTone(published.status)}>{published.status}</Badge>
              </div>
              <div className="card__body">
                <div className="grid g-2" style={{ gap: 12 }}>
                  <dl className="kv">
                    <dt>Mode alokasi</dt>
                    <dd>{published.allocation_mode}</dd>
                    <dt>Toleransi</dt>
                    <dd className="num">±{fmtNumber(published.tolerance_pct, 0)}%</dd>
                    <dt>Disetujui</dt>
                    <dd>{published.approved_by ?? '—'}</dd>
                  </dl>
                  <dl className="kv">
                    <dt>Diterbitkan</dt>
                    <dd>{fmtDate(published.published_at)}</dd>
                    <dt>Dibuat oleh</dt>
                    <dd>{published.created_by}</dd>
                    <dt>Checksum</dt>
                    <dd className="mono">{published.checksum?.slice(0, 16) ?? '—'}…</dd>
                  </dl>
                </div>

                <h3 className="mt-4" style={{ fontSize: 14 }}>
                  Hak air per tempek
                </h3>
                <div className="table-wrap mt-4">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tempek</th>
                        <th className="right">Hak (%)</th>
                        <th className="right">Prioritas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {published.entitlements.map((item) => (
                        <tr key={item.tempek_name}>
                          <td>{item.tempek_name}</td>
                          <td className="right num">{fmtNumber(item.entitlement_pct, 0)}%</td>
                          <td className="right num">{item.priority ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 className="mt-4" style={{ fontSize: 14 }}>
                  Slot terjadwal
                </h3>
                <div className="table-wrap mt-4">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Slot</th>
                        <th>Pintu</th>
                        <th>Tempek</th>
                        <th className="right">Target debit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {published.schedules.map((slot) => (
                        <tr key={`${slot.gate_code}-${slot.starts_at}`}>
                          <td className="num">
                            {slot.starts_at}–{slot.ends_at}
                          </td>
                          <td>{slot.gate_code}</td>
                          <td>{slot.tempek_name}</td>
                          <td className="right num">
                            {fmtNumber(slot.target_flow_lps, 1)} L/d
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card__foot">
                <span>
                  Perubahan hak air harus melalui Paruman. Sistem tidak menyediakan tombol edit
                  langsung pada rule yang sudah diterbitkan.
                </span>
              </div>
            </section>

            <section className="card">
              <div className="card__head">
                <h2>Pemisahan tugas</h2>
              </div>
              <div className="card__body stack--sm">
                <p className="small">
                  Pembuat rule tidak boleh menyetujui rule yang sama. Pada data demo, v3 dibuat
                  oleh Wayan Sudira dan disetujui Made Wirawan.
                </p>
                <p className="small">
                  Administrator teknis tidak memiliki izin <span className="mono">rule.approve</span>{' '}
                  atau <span className="mono">gate.command</span>. Ini ditegakkan di backend.
                </p>
                <hr className="divider" />
                <div className="between small">
                  <span>Versi tersimpan</span>
                  <strong>{versions.length}</strong>
                </div>
                <div className="between small">
                  <span>Status aktif</span>
                  <Badge tone={statusTone(published.status)}>{published.status}</Badge>
                </div>
              </div>
              <div className="card__foot">
                <LinkNote />
              </div>
            </section>
          </div>

          <section className="card mt-4">
            <div className="card__head">
              <h2>Riwayat versi</h2>
              <span className="spacer" />
              <span className="small muted">versi lama tidak diubah</span>
            </div>
            <div className="card__body card__body--flush">
              <div className="table-wrap">
                <table className="table table--cards table--flush">
                  <thead>
                    <tr>
                      <th>Versi</th>
                      <th>Status</th>
                      <th>Berlaku</th>
                      <th>Disetujui</th>
                      <th>Dibuat</th>
                      <th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((rule) => (
                      <tr key={rule.id}>
                        <td data-label="Versi">
                          <strong>v{rule.version_no}</strong>
                        </td>
                        <td data-label="Status">
                          <Badge tone={statusTone(rule.status)}>{rule.status}</Badge>
                        </td>
                        <td data-label="Berlaku">{fmtDate(rule.effective_from)}</td>
                        <td data-label="Disetujui" className="small">
                          {rule.approved_by ?? '—'}
                        </td>
                        <td data-label="Dibuat" className="small">
                          {rule.created_by}
                        </td>
                        <td data-label="Catatan" className="small muted">
                          {rule.notes ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card__foot">
              <span>
                Draft v4 tersedia untuk inspeksi. Pengajuan, persetujuan, dan penerbitan versi baru
                diimplementasikan pada Phase 4 bersama rule engine.
              </span>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function LinkNote() {
  return <span className="small">Aturan hanya dapat diubah lewat alur versi baru.</span>;
}
