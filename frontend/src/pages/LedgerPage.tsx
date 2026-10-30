import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Badge, DataModeBanner, ErrorState, Loading, PageHeader } from '../components/ui';
import { api, apiKeys } from '../lib/api';
import { fmtDateTime, statusTone } from '../lib/format';
import { useSite } from '../lib/site';
import type { LedgerEntry, LedgerVerification } from '../types';

export default function LedgerPage() {
  const { siteId } = useSite();
  const [copied, setCopied] = useState<string | null>(null);

  const entries = useQuery({
    queryKey: apiKeys.ledger(siteId),
    queryFn: () => api<{ data: LedgerEntry[] }>(`/ledger?site_id=${siteId}&limit=60`),
    enabled: Boolean(siteId),
    refetchInterval: 60_000,
  });

  const verify = useMutation({
    mutationFn: () => api<LedgerVerification>(`/ledger/verify?site_id=${siteId}`),
  });

  async function copyHash(hash: string) {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(hash);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  if (entries.isLoading) return <Loading />;
  if (entries.error) return <ErrorState error={entries.error} onRetry={() => entries.refetch()} />;

  const rows = entries.data?.data ?? [];
  const seals = rows.filter((row) => row.entry_type === 'LEDGER_SEAL').length;

  return (
    <>
      <PageHeader
        title="Buku Catatan Air"
        lede="Catatan distribusi bersifat append-only dan dirantai dengan hash. Ini hash chain untuk mendeteksi perubahan, bukan blockchain dan bukan klaim desentralisasi."
        badges={<Badge tone="demo">SIMULASI</Badge>}
        actions={
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => verify.mutate()}
            disabled={verify.isPending}
          >
            {verify.isPending ? 'Memverifikasi…' : 'Verifikasi hash-chain'}
          </button>
        }
      />
      <DataModeBanner />

      {verify.data && (
        <div
          className={`banner banner--${verify.data.status === 'VALID' ? 'info' : 'critical'} mt-4`}
          role="status"
        >
          <span>{verify.data.status === 'VALID' ? '⛨' : '⛔'}</span>
          <div className="small">
            <strong>
              {verify.data.status === 'VALID'
                ? `Rantai valid — ${verify.data.entries_checked} entri diperiksa.`
                : `Rantai TIDAK valid pada urutan #${verify.data.first_broken_seq}.`}
            </strong>{' '}
            Diverifikasi {fmtDateTime(verify.data.verified_at)} oleh {verify.data.verified_by}.
            {verify.data.status === 'VALID' && (
              <>
                {' '}Hash terakhir <span className="mono">{verify.data.last_entry_hash.slice(0, 18)}…</span>
              </>
            )}
          </div>
        </div>
      )}

      {verify.error && <ErrorState error={verify.error} />}

      <div className="grid g-3 mt-4">
        <section className="card kpi">
          <span className="kpi__label">Entri ditampilkan</span>
          <span className="kpi__value">{rows.length}</span>
          <span className="kpi__meta">append-only</span>
        </section>
        <section className="card kpi">
          <span className="kpi__label">Seal harian</span>
          <span className="kpi__value">{seals}</span>
          <span className="kpi__meta">verifikasi manual</span>
        </section>
        <section className="card kpi">
          <span className="kpi__label">Status verifikasi</span>
          <span className="kpi__value" style={{ fontSize: 22 }}>
            {verify.data ? verify.data.status : 'Belum dijalankan'}
          </span>
          <span className="kpi__meta">dihitung dari isi entri</span>
        </section>
      </div>

      <section className="card mt-4">
        <div className="card__head">
          <h2>Entri terbaru</h2>
          <span className="spacer" />
          <span className="small muted">hash disalin dengan klik</span>
        </div>
        <div className="card__body card__body--flush">
          <div className="table-wrap">
            <table className="table table--cards table--flush">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Waktu</th>
                  <th>Jenis</th>
                  <th>Ringkasan</th>
                  <th>Aktor</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="#" className="num">
                      {row.seq}
                    </td>
                    <td data-label="Waktu">{fmtDateTime(row.occurred_at)}</td>
                    <td data-label="Jenis">
                      <Badge tone={row.entry_type === 'COMPENSATION' ? 'warning' : 'neutral'}>
                        {row.entry_type}
                      </Badge>
                    </td>
                    <td data-label="Ringkasan">
                      <div>{row.summary}</div>
                      {(row.gate_code || row.tempek_name) && (
                        <div className="small muted">
                          {row.gate_code ?? '—'} · {row.tempek_name ?? '—'}
                          {row.volume_m3 ? ` · ${row.volume_m3} m³` : ''}
                        </div>
                      )}
                    </td>
                    <td data-label="Aktor" className="small">
                      {row.actor_label ?? (row.measurement_status === 'MEASURED' ? 'sistem' : '—')}
                    </td>
                    <td data-label="Hash">
                      <button
                        type="button"
                        className="mono"
                        style={{
                          background: 'none',
                          border: 0,
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--teal-700)',
                          textAlign: 'left',
                        }}
                        title={row.entry_hash}
                        onClick={() => copyHash(row.entry_hash)}
                      >
                        {row.entry_hash.slice(0, 14)}…
                      </button>
                      {copied === row.entry_hash && (
                        <div className="small" style={{ color: 'var(--teal-700)' }}>
                          tersalin
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card__foot">
          <span>
            Setiap entri menyimpan <span className="mono">prev_hash</span> dan hash konten. Tidak ada
            endpoint untuk mengubah atau menghapus entri — koreksi dilakukan sebagai entri
            kompensasi baru pada Phase 5.
          </span>
        </div>
      </section>
    </>
  );
}
