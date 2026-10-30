import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { TimeSeriesChart } from '../components/charts';
import {
  Badge,
  DataModeBanner,
  ErrorState,
  FreshnessBadge,
  Kpi,
  Loading,
  PageHeader,
} from '../components/ui';
import { api, apiKeys } from '../lib/api';
import { fmtNumber } from '../lib/format';
import { useSite } from '../lib/site';
import type { Gate, HistoryResponse } from '../types';

type Channel = 'flow' | 'water_level_up';

const CHANNELS: Record<Channel, { label: string; unit: string; color: string }> = {
  flow: { label: 'Debit', unit: 'L/detik', color: '#159d8a' },
  water_level_up: { label: 'Ketinggian hulu', unit: 'm', color: '#2e6f9e' },
};

export default function MonitoringPage() {
  const { siteId } = useSite();
  const [gateId, setGateId] = useState<string>('');
  const [channel, setChannel] = useState<Channel>('flow');

  const gates = useQuery({
    queryKey: apiKeys.gates(siteId),
    queryFn: () => api<{ data: Gate[] }>(`/gates?site_id=${siteId}`),
    enabled: Boolean(siteId),
    refetchInterval: 15_000,
  });

  const selected = gates.data?.data.find((gate) => gate.id === gateId) ?? gates.data?.data[0];

  const history = useQuery({
    queryKey: apiKeys.history(siteId, channel, selected?.id ?? null, 'raw'),
    queryFn: () =>
      api<HistoryResponse>(
        `/telemetry/history?site_id=${siteId}&channel=${channel}&gate_id=${selected?.id}&granularity=raw&limit=320`,
      ),
    enabled: Boolean(siteId && selected?.id),
    refetchInterval: 30_000,
  });

  if (gates.isLoading) return <Loading />;
  if (gates.error) return <ErrorState error={gates.error} onRetry={() => gates.refetch()} />;
  if (!gates.data?.data.length) return <Loading label="Belum ada pintu pada site ini." />;

  const meta = CHANNELS[channel];

  return (
    <>
      <PageHeader
        title="Monitoring"
        lede="Deret waktu sensor per pintu. Grafik menampilkan nilai apa adanya — estimasi ditandai terpisah, tidak dicampur sebagai terukur."
        badges={<Badge tone="demo">SIMULASI</Badge>}
      />

      <DataModeBanner />

      <div className="filter-bar mt-4">
        <label className="field" style={{ minWidth: 240 }}>
          <span className="label">Pintu</span>
          <select
            className="select"
            value={selected?.id ?? ''}
            onChange={(event) => setGateId(event.target.value)}
          >
            {gates.data.data.map((gate) => (
              <option key={gate.id} value={gate.id}>
                {gate.code} · {gate.name}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented" style={{ alignSelf: 'end' }}>
          {(Object.keys(CHANNELS) as Channel[]).map((key) => (
            <button
              key={key}
              type="button"
              className={channel === key ? 'is-active' : ''}
              onClick={() => setChannel(key)}
            >
              {CHANNELS[key].label}
            </button>
          ))}
        </div>
        {selected && <FreshnessBadge value={selected.device_freshness} />}
      </div>

      {selected && (
        <div className="grid g-4">
          <Kpi
            label="Debit terakhir"
            value={fmtNumber(selected.flow_lps, 1)}
            unit="L/d"
            meta={<span>desain {fmtNumber(selected.design_flow_lps, 0)} L/d</span>}
          />
          <Kpi
            label="Level hulu"
            value={fmtNumber(selected.level_m, 2)}
            unit="m"
            meta={<span>sensor hulu</span>}
          />
          <Kpi
            label="Bukaan"
            value={fmtNumber(selected.state?.position_pct, 1)}
            unit="%"
            meta={<Badge tone={selected.state?.mode === 'FAULT' ? 'critical' : 'ok'}>{selected.state?.mode}</Badge>}
          />
          <Kpi
            label="Baterai node"
            value={fmtNumber(selected.battery_pct, 0)}
            unit="%"
            meta={<span className="mono">{selected.device_id}</span>}
          />
        </div>
      )}

      <section className="card mt-4">
        <div className="card__head">
          <h2>
            {meta.label} · {selected?.code}
          </h2>
          <span className="spacer" />
          <span className="small muted">
            {history.data?.meta?.quality
              ? `${history.data.meta.quality.MEASURED} terukur · ${history.data.meta.quality.ESTIMATED} estimasi`
              : '24 jam terakhir'}
          </span>
        </div>
        <div className="card__body">
          <TimeSeriesChart
            points={history.data?.data ?? []}
            unit={history.data?.meta?.unit ?? meta.unit}
            color={meta.color}
            height={300}
          />
        </div>
        <div className="card__foot">
          <span>
            Nilai estimasi tidak diberi garis penghubung. Pada Phase 1, seluruh data berasal dari
            simulator berlabel SIMULATION.
          </span>
        </div>
      </section>

      <section className="card mt-4">
        <div className="card__head">
          <h2>Ringkasan semua pintu</h2>
        </div>
        <div className="card__body card__body--flush">
          <div className="table-wrap">
            <table className="table table--cards table--flush">
              <thead>
                <tr>
                  <th>Pintu</th>
                  <th>Mode</th>
                  <th className="right">Debit</th>
                  <th className="right">Level</th>
                  <th className="right">Bukaan</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {gates.data.data.map((gate) => (
                  <tr
                    key={gate.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setGateId(gate.id)}
                  >
                    <td data-label="Pintu">
                      <strong>{gate.code}</strong>
                      <div className="small muted">{gate.name}</div>
                    </td>
                    <td data-label="Mode">{gate.state?.mode}</td>
                    <td data-label="Debit" className="right num">
                      {fmtNumber(gate.flow_lps, 1)} L/d
                    </td>
                    <td data-label="Level" className="right num">
                      {fmtNumber(gate.level_m, 2)} m
                    </td>
                    <td data-label="Bukaan" className="right num">
                      {fmtNumber(gate.state?.position_pct, 1)}%
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
      </section>
    </>
  );
}
