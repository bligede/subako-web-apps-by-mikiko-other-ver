import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

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
import { useAuth } from '../features/auth/AuthContext';
import { ApiError, api, apiKeys } from '../lib/api';
import {
  ageLabel,
  fmtDateTime,
  fmtNumber,
  modeTone,
  statusTone,
} from '../lib/format';
import { useSite } from '../lib/site';
import type { Command, Gate, GateEvent, HistoryResponse, RuleVersion } from '../types';

interface GateDetail extends Gate {
  device: {
    device_id: string;
    firmware_version: string | null;
    battery_pct: number | null;
    rssi_dbm: number | null;
    last_communication_at: string | null;
  } | null;
  active_rule_version: RuleVersion | null;
  recent_events: GateEvent[];
  recent_commands: Command[];
}

type ActionType = 'SET_POSITION' | 'OPEN' | 'CLOSE' | 'HOLD' | 'RELEASE_HOLD';

const ACTIONS: Array<{ value: ActionType; label: string }> = [
  { value: 'SET_POSITION', label: 'Atur posisi (%)' },
  { value: 'OPEN', label: 'Buka penuh' },
  { value: 'CLOSE', label: 'Tutup penuh' },
  { value: 'HOLD', label: 'Tahan (HOLD)' },
  { value: 'RELEASE_HOLD', label: 'Lepas HOLD' },
];

export default function GateDetailPage() {
  const { gateId = '' } = useParams();
  const { siteId } = useSite();
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [action, setAction] = useState<ActionType>('SET_POSITION');
  const [target, setTarget] = useState('40');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const gate = useQuery({
    queryKey: apiKeys.gate(gateId),
    queryFn: () => api<GateDetail>(`/gates/${gateId}`),
    enabled: Boolean(gateId),
    refetchInterval: 5_000,
    refetchOnWindowFocus: 'always',
  });

  const history = useQuery({
    queryKey: apiKeys.history(siteId, 'flow', gateId, 'raw'),
    queryFn: () =>
      api<HistoryResponse>(
        `/telemetry/history?site_id=${siteId}&channel=flow&gate_id=${gateId}&granularity=raw&limit=320`,
      ),
    enabled: Boolean(siteId && gateId),
    refetchInterval: 30_000,
  });

  const command = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<Command>(`/gates/${gateId}/commands`, {
        method: 'POST',
        json: payload,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    onSuccess: (result) => {
      setFeedback({
        tone: 'ok',
        text: `Perintah ${result.action} terkirim dengan status ${result.status}. Menunggu ACK perangkat simulasi.`,
      });
      setReason('');
      queryClient.invalidateQueries({ queryKey: apiKeys.gate(gateId) });
      queryClient.invalidateQueries({ queryKey: apiKeys.commands(gateId) });
    },
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? `${error.code}: ${error.message}`
          : 'Perintah gagal dikirim.';
      setFeedback({ tone: 'error', text: message });
    },
  });

  if (gate.isLoading) return <Loading label="Memuat detail pintu…" />;
  if (gate.error) return <ErrorState error={gate.error} onRetry={() => gate.refetch()} />;
  const data = gate.data!;
  const state = data.state;
  const immutableMode = state?.mode === 'FAULT' || state?.mode === 'MANUAL';
  const canCommand = can('gate.command');

  function submit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    if (reason.trim().length < 10) {
      setFeedback({ tone: 'error', text: 'Alasan wajib diisi minimal 10 karakter.' });
      return;
    }
    const payload: Record<string, unknown> = { action, reason: reason.trim() };
    if (action === 'SET_POSITION') payload.target_pct = Number(target);
    if (data.active_rule_version?.checksum) {
      payload.expected_rule_checksum = data.active_rule_version.checksum;
    }
    command.mutate(payload);
  }

  return (
    <>
      <PageHeader
        title={`${data.code} · ${data.name}`}
        badges={
          <>
            <Badge tone={modeTone(state?.mode)}>{state?.mode ?? 'UNKNOWN'}</Badge>
            <FreshnessBadge value={data.device_freshness} />
            <Badge tone="demo">SIMULASI</Badge>
          </>
        }
        actions={
          <Link className="btn btn--sm" to="/gates">
            ← Semua pintu
          </Link>
        }
        lede={`Target ${fmtNumber(state?.target_pct, 1)}% · data ${ageLabel(data.age_s)} · node ${data.device?.device_id ?? '—'}`}
      />

      <DataModeBanner />

      <div className="grid g-4 mt-4">
        <Kpi label="Bukaan aktual" value={fmtNumber(state?.position_pct, 1)} unit="%" meta={<span>{state?.actuator_state ?? '—'}</span>} />
        <Kpi label="Debit" value={fmtNumber(data.flow_lps, 1)} unit="L/d" meta={<span>desain {fmtNumber(data.design_flow_lps, 0)} L/d</span>} />
        <Kpi label="Level hulu" value={fmtNumber(data.level_m, 2)} unit="m" meta={<span>sensor node</span>} />
        <Kpi
          label="Arus motor"
          value={fmtNumber(state?.motor_current_a, 2)}
          unit="A"
          meta={<span>{state?.mode === 'FAULT' ? 'di atas ambang' : 'dalam rentang normal'}</span>}
          tone={state?.mode === 'FAULT' ? 'critical' : undefined}
        />
      </div>

      <div className="grid g-side mt-4">
        <section className="card">
          <div className="card__head">
            <h2>Debit 24 jam</h2>
            <span className="spacer" />
            <span className="small muted">{data.device_freshness}</span>
          </div>
          <div className="card__body">
            <TimeSeriesChart points={history.data?.data ?? []} unit="L/d" height={280} />
          </div>
          <div className="card__foot">
            <span>
              Firmware {data.device?.firmware_version ?? '—'} · baterai {fmtNumber(data.device?.battery_pct, 0)}% ·
              {' '}RSSI {data.device?.rssi_dbm ?? '—'} dBm
            </span>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h2>Kendali pintu</h2>
            <span className="spacer" />
            {data.state?.freshness && <FreshnessBadge value={data.state.freshness} />}
          </div>
          <div className="card__body">
            {!canCommand ? (
              <div className="banner banner--info">
                <span>👁️</span>
                <div className="small">
                  Mode pantau. Aktuasi memerlukan role OPERATOR atau PEKASEH dengan site level
                  OPERATE. Administrator teknis tidak memiliki izin ini.
                </div>
              </div>
            ) : immutableMode ? (
              <div className="banner banner--critical">
                <span>⛔</span>
                <div className="small">
                  Pintu dalam mode {state?.mode}. Perintah dari aplikasi ditolak sampai mode
                  dikembalikan ke AUTO/IDLE di lapangan.
                </div>
              </div>
            ) : (
              <form className="stack" onSubmit={submit}>
                <div className="field">
                  <label className="label" htmlFor="action">
                    Tindakan
                  </label>
                  <select
                    id="action"
                    className="select"
                    value={action}
                    onChange={(event) => setAction(event.target.value as ActionType)}
                  >
                    {ACTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {action === 'SET_POSITION' && (
                  <div className="field">
                    <label className="label" htmlFor="target">
                      Target bukaan (%)
                    </label>
                    <input
                      id="target"
                      className="input"
                      type="number"
                      min={0}
                      max={data.max_opening_pct}
                      step={1}
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                      required
                    />
                    <span className="hint">Maksimum pintu ini {fmtNumber(data.max_opening_pct, 0)}%.</span>
                  </div>
                )}

                <div className="field">
                  <label className="label" htmlFor="reason">
                    Alasan (min. 10 karakter)
                  </label>
                  <textarea
                    id="reason"
                    className="textarea"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Contoh: penyesuaian giliran Tempek Kedua sesuai rule v3"
                    required
                  />
                </div>

                {feedback && (
                  <div
                    className={`banner banner--${feedback.tone === 'ok' ? 'info' : 'critical'}`}
                    role={feedback.tone === 'ok' ? 'status' : 'alert'}
                  >
                    <span>{feedback.tone === 'ok' ? 'ℹ️' : '⛔'}</span>
                    <div className="small">{feedback.text}</div>
                  </div>
                )}

                <button className="btn btn--primary" type="submit" disabled={command.isPending}>
                  {command.isPending ? 'Mengirim…' : 'Kirim perintah'}
                </button>
                <p className="hint">
                  Perintah divalidasi server: izin, site scope, rule aktif, kesegaran data,
                  capability node, dan command in-flight. Kedaluwarsa 90 detik bila tanpa ACK.
                </p>
              </form>
            )}
          </div>
          <div className="card__foot">
            Rule aktif: {data.active_rule_version ? `v${data.active_rule_version.version_no}` : '—'}{' '}
            · checksum{' '}
            <span className="mono">
              {data.active_rule_version?.checksum?.slice(0, 10) ?? '—'}
            </span>
          </div>
        </section>
      </div>

      <div className="grid g-2 mt-4">
        <section className="card">
          <div className="card__head">
            <h2>Riwayat perintah</h2>
          </div>
          <div className="card__body card__body--flush">
            <div className="table-wrap">
              <table className="table table--cards table--flush">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Aksi</th>
                    <th>Status</th>
                    <th>Oleh</th>
                    <th>Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_commands.length === 0 && (
                    <tr>
                      <td colSpan={5} className="small muted">
                        Belum ada perintah.
                      </td>
                    </tr>
                  )}
                  {data.recent_commands.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Waktu">{fmtDateTime(item.issued_at)}</td>
                      <td data-label="Aksi">{item.action}</td>
                      <td data-label="Status">
                        <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                      </td>
                      <td data-label="Oleh" className="small">
                        {item.actor_label ?? '—'}
                      </td>
                      <td data-label="Alasan" className="small muted">
                        {item.reason ?? item.failure_reason ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card__foot">
            <span>Status EXECUTED hanya diberikan setelah ACK dan posisi dilaporkan kembali.</span>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h2>Peristiwa terakhir</h2>
          </div>
          <div className="card__body">
            <div className="list">
              {data.recent_events.length === 0 && (
                <div className="small muted">Belum ada peristiwa tercatat.</div>
              )}
              {data.recent_events.map((event) => (
                <div className="list__item" key={event.id} style={{ paddingLeft: 0, paddingRight: 0 }}>
                  <span className="sev-bar sev-bar--medium" />
                  <div>
                    <div className="strong small">{event.event_type}</div>
                    <div className="small muted">{event.message}</div>
                    <div className="small muted">{fmtDateTime(event.occurred_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
