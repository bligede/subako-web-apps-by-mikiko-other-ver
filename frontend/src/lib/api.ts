import type { LoginResponse } from '../types';

const BASE = '/api/v1';
let accessToken: string | null = null;
let refreshInFlight: Promise<LoginResponse | null> | null = null;

export class ApiError extends Error {
  code: string;
  status: number;
  requestId: string | null;
  errors: Array<{ field?: string; message: string }>;

  constructor(
    status: number,
    code: string,
    detail: string,
    requestId: string | null = null,
    errors: Array<{ field?: string; message: string }> = [],
  ) {
    super(detail);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.errors = errors;
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export async function refreshSession(): Promise<LoginResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Subako-Client': 'web' },
        });
        if (!response.ok) return null;
        const data = (await response.json()) as LoginResponse;
        accessToken = data.access_token;
        return data;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  json?: unknown;
  headers?: Record<string, string>;
  retry?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.json !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat menghubungi server SUBAKO.');
  }

  if (response.status === 401 && options.retry !== false && accessToken) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, { ...options, retry: false });
  }

  if (!response.ok) {
    let body: {
      code?: string;
      detail?: string;
      request_id?: string;
      errors?: Array<{ field?: string; message: string }>;
    } = {};
    try {
      body = await response.json();
    } catch {
      /* respons non-JSON */
    }
    throw new ApiError(
      response.status,
      body.code ?? 'REQUEST_FAILED',
      body.detail ?? `Permintaan gagal (${response.status}).`,
      body.request_id ?? null,
      body.errors ?? [],
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiKeys = {
  me: ['auth', 'me'] as const,
  sites: ['sites'] as const,
  overview: (siteId: string) => ['overview', siteId] as const,
  gates: (siteId: string) => ['gates', siteId] as const,
  gate: (gateId: string) => ['gate', gateId] as const,
  commands: (gateId: string) => ['commands', gateId] as const,
  history: (siteId: string, channel: string, gateId?: string | null, granularity = '1h') =>
    ['history', siteId, channel, gateId ?? null, granularity] as const,
  rules: (siteId: string) => ['rules', siteId] as const,
  ledger: (siteId: string) => ['ledger', siteId] as const,
  ledgerVerify: (siteId: string) => ['ledger', siteId, 'verify'] as const,
  alerts: (siteId: string) => ['alerts', siteId] as const,
  schedule: (siteId: string) => ['schedule', siteId] as const,
  adminUsers: ['admin', 'users'] as const,
  adminAudit: ['admin', 'audit'] as const,
  systemHealth: ['admin', 'system-health'] as const,
  devices: (siteId: string) => ['admin', 'devices', siteId] as const,
};
