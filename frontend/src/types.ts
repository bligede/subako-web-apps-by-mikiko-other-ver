export type Role = 'VIEWER' | 'OPERATOR' | 'PEKASEH' | 'ADMIN';
export type Freshness = 'LIVE' | 'STALE' | 'OFFLINE';
export type GateMode = 'AUTO' | 'IDLE' | 'HOLD' | 'MANUAL' | 'FAULT';

export interface SiteAccess {
  id: string;
  name: string;
  level: 'VIEW' | 'OPERATE' | 'GOVERN' | 'ADMIN';
  data_mode: 'SIMULATION' | 'LIVE';
}

export interface Me {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  permissions: string[];
  sites: SiteAccess[];
  requires_password_change: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: Me;
}

export interface GateState {
  gate_id: string;
  mode: GateMode;
  position_pct: number | null;
  target_pct: number | null;
  actuator_state: string | null;
  motor_current_a: number | null;
  limit_open: boolean | null;
  limit_closed: boolean | null;
  estop: boolean | null;
  updated_at: string | null;
  last_command_id: string | null;
  freshness?: Freshness;
  age_s?: number | null;
}

export interface Gate {
  id: string;
  site_id: string;
  code: string;
  name: string;
  gate_type: string;
  max_opening_pct: number;
  design_flow_lps: number;
  state: GateState | null;
  device_freshness: Freshness;
  device_id: string | null;
  battery_pct: number | null;
  flow_lps: number | null;
  level_m: number | null;
  age_s: number | null;
  is_active: boolean;
}

export interface Overview {
  site_id: string;
  site_name: string;
  data_mode: 'SIMULATION' | 'LIVE';
  gates_total: number;
  gates_online: number;
  gates_fault: number;
  devices_online: number;
  devices_total: number;
  avg_level_m: number | null;
  total_flow_lps: number;
  lowest_battery_pct: number | null;
  alerts_open: number;
  alerts_critical: number;
  schedule_compliance_pct: number | null;
  freshness: Freshness;
  last_updated: string | null;
  gates: Gate[];
}

export interface ReadingPoint {
  ts: string;
  value: number | null;
  quality: 'OK' | 'ESTIMATED' | 'SUSPECT' | 'BAD' | 'MISSING';
  derived: boolean;
}

export interface HistoryResponse {
  data: ReadingPoint[];
  meta: {
    server_time: string;
    data_mode: string;
    freshness_policy: { interval_s: number; stale_after_s: number; offline_after_s: number };
    channel?: string;
    unit?: string | null;
    quality?: { MEASURED: number; ESTIMATED: number };
    granularity?: string;
  };
}

export interface GateEvent {
  id: string;
  gate_id: string;
  occurred_at: string | null;
  event_type: string;
  message: string;
  data: Record<string, unknown> | null;
}

export interface Command {
  id: string;
  gate_id: string;
  action: string;
  target_pct: number | null;
  status:
    | 'PENDING_SIGN'
    | 'SENT'
    | 'ACKNOWLEDGED'
    | 'EXECUTED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'FAILED_TO_SEND'
    | 'UNKNOWN'
    | 'DIVERGED';
  rule_version: number | null;
  issued_at: string;
  expires_at: string;
  expires_in_s: number | null;
  actor_label: string | null;
  reason?: string | null;
  failure_reason: string | null;
  ack: { received_at: string; status: string; reason: string | null } | null;
}

export interface RuleVersion {
  id: string;
  site_id: string;
  code: string;
  version: number;
  version_no: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED' | 'REJECTED' | 'EXPIRED';
  effective_from: string;
  effective_to: string | null;
  allocation_mode: string;
  tolerance_pct: number;
  checksum: string | null;
  entitlements: Array<{ tempek_name: string; entitlement_pct: number | null; priority?: number }>;
  schedules: Array<{
    gate_code: string;
    tempek_name: string;
    starts_at: string;
    ends_at: string;
    target_flow_lps: number | null;
  }>;
  approved_by: string | null;
  published_at: string | null;
  created_by: string;
  notes: string | null;
}

export interface Alert {
  id: string;
  site_id: string;
  gate_id: string | null;
  device_id: string | null;
  alert_type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'LOW';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  title: string;
  first_seen_at: string;
  evidence: { message?: string };
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  data_mode: string;
}

export interface ScheduleSlot {
  gate_code: string | null;
  tempek_name: string;
  starts_at: string;
  ends_at: string;
  entitlement_pct: number | null;
  time_label: string;
  progress_pct?: number;
}

export interface ScheduleResponse {
  data: ScheduleSlot[];
  current: ScheduleSlot | null;
  server_time_wita: string;
}

export interface LedgerEntry {
  id: string;
  seq: number;
  occurred_at: string | null;
  entry_type: string;
  summary: string;
  gate_code: string | null;
  tempek_name: string | null;
  volume_m3: number | null;
  measurement_status: string | null;
  actor_label: string | null;
  prev_hash: string;
  entry_hash: string;
  data_mode: string;
}

export interface LedgerVerification {
  site_id: string;
  entries_checked: number;
  status: 'VALID' | 'INVALID';
  first_broken_seq: number | null;
  last_entry_hash: string;
  verified_at: string;
  verified_by: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  sites: Array<{ id: string; name: string; level: string }>;
  last_login_at: string | null;
}

export interface AuditEvent {
  id: string;
  occurred_at: string | null;
  actor_label: string;
  action: string;
  summary: string;
  permission: string | null;
  site_id: string | null;
  request_id: string | null;
}

export interface SystemHealth {
  server_time: string;
  version: string;
  components: Array<{ name: string; status: string; detail?: string }>;
  counts: Record<string, number>;
  last_reading_at: string | null;
  ledger: Array<{ site_id: string; site_name: string; entries: number; status: string }>;
}

export interface DeviceRow {
  id: string;
  device_id: string;
  dev_eui: string;
  gate_id: string | null;
  gate_code: string | null;
  kind: string;
  status: string;
  data_mode: string;
  firmware_version: string | null;
  battery_pct: number | null;
  rssi_dbm: number | null;
  last_communication_at: string | null;
}
