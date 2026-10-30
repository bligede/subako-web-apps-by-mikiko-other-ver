export const WITA = 'Asia/Makassar';

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WITA,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WITA,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WITA,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function fmtNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('id-ID').format(value);
}

export function ageLabel(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'tanpa data';
  if (seconds < 60) return `${seconds} s lalu`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} mnt lalu`;
  return `${Math.round(seconds / 3600)} jam lalu`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function freshnessTone(freshness: string | undefined): string {
  if (freshness === 'LIVE') return 'ok';
  if (freshness === 'STALE') return 'stale';
  return 'offline';
}

export function modeTone(mode: string | undefined): string {
  switch (mode) {
    case 'AUTO':
      return 'ok';
    case 'HOLD':
      return 'warning';
    case 'FAULT':
    case 'MANUAL':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function statusTone(status: string): string {
  switch (status) {
    case 'EXECUTED':
    case 'RESOLVED':
    case 'PUBLISHED':
    case 'VALID':
    case 'ACTIVE':
      return 'ok';
    case 'ACKNOWLEDGED':
    case 'SENT':
    case 'APPROVED':
      return 'info';
    case 'OPEN':
    case 'FAILED_TO_SEND':
    case 'REJECTED':
    case 'INVALID':
      return 'critical';
    case 'EXPIRED':
    case 'SUPERSEDED':
      return 'expired';
    case 'HOLD':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function severityTone(severity: string): string {
  if (severity === 'CRITICAL') return 'critical';
  if (severity === 'WARNING') return 'warning';
  return 'info';
}
