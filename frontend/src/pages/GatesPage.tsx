import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import {
  Badge,
  DataModeBanner,
  ErrorState,
  FreshnessBadge,
  Loading,
  PageHeader,
} from '../components/ui';
import { api, apiKeys } from '../lib/api';
import { fmtNumber, modeTone } from '../lib/format';
import { useSite } from '../lib/site';
import type { Gate } from '../types';

export default function GatesPage() {
  const { siteId } = useSite();

  const gates = useQuery({
    queryKey: apiKeys.gates(siteId),
    queryFn: () => api<{ data: Gate[] }>(`/gates?site_id=${siteId}`),
    enabled: Boolean(siteId),
    refetchInterval: 15_000,
  });

  if (gates.isLoading) return <Loading />;
  if (gates.error) return <ErrorState error={gates.error} onRetry={() => gates.refetch()} />;

  return (
    <>
      <PageHeader
        title="Pintu Air"
        lede="Status aktuator, bukan sekadar nilai target. Mode FAULT atau MANUAL selalu menolak perintah dari aplikasi."
        badges={<Badge tone="demo">SIMULASI</Badge>}
      />
      <DataModeBanner />

      <div className="grid g-3 mt-4">
        {(gates.data?.data ?? []).map((gate) => (
          <section className="card" key={gate.id}>
            <div className="card__head">
              <div>
                <h2>{gate.code}</h2>
                <div className="small muted">{gate.name}</div>
              </div>
              <span className="spacer" />
              <Badge tone={modeTone(gate.state?.mode)}>{gate.state?.mode ?? 'UNKNOWN'}</Badge>
            </div>
            <div className="card__body">
              <div className="between">
                <div>
                  <div className="micro muted">Bukaan</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }} className="num">
                    {fmtNumber(gate.state?.position_pct, 1)}
                    <small style={{ fontSize: 13, color: 'var(--slate)' }}>%</small>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="micro muted">Target</div>
                  <div className="num strong">{fmtNumber(gate.state?.target_pct, 1)}%</div>
                </div>
              </div>
              <div className="progress mt-4">
                <span style={{ width: `${Math.min(100, gate.state?.position_pct ?? 0)}%` }} />
              </div>

              <dl className="kv mt-4">
                <dt>Debit</dt>
                <dd className="num">{fmtNumber(gate.flow_lps, 1)} L/d</dd>
                <dt>Level hulu</dt>
                <dd className="num">{fmtNumber(gate.level_m, 2)} m</dd>
                <dt>Baterai</dt>
                <dd className="num">{fmtNumber(gate.battery_pct, 0)}%</dd>
                <dt>Data</dt>
                <dd>
                  <FreshnessBadge value={gate.device_freshness} />
                </dd>
              </dl>

              <div className="row row--wrap mt-4">
                <Link className="btn btn--sm btn--primary" to={`/gates/${gate.id}`}>
                  Buka detail
                </Link>
                <span className="small muted">{gate.device_id}</span>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="banner banner--info mt-4">
        <span>ℹ️</span>
        <div className="small">
          Perintah aktuasi hanya tersedia bagi OPERATOR dan PEKASEH pada site dengan level OPERATE
          atau lebih. ADMIN teknis dapat melihat status tetapi tidak dapat menggerakkan pintu.
        </div>
      </div>
    </>
  );
}
