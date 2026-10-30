# 08 — API Specification

**Base path:** `/api/v1` · **Format:** JSON UTF-8 · **Auth:** Bearer JWT
**Spesifikasi mesin:** [`api/openapi.yaml`](api/openapi.yaml) (OpenAPI 3.1)

---

## 1. Konvensi

### 1.1 Envelope & pagination

Daftar memakai cursor (bukan offset) agar stabil saat data baru masuk:

```json
{
  "data": [ /* ... */ ],
  "page": { "next_cursor": "eyJ0cyI6IjIwMjYtMTAtMzBUMDM6MTI6MDBaIn0", "has_more": true },
  "meta": { "server_time": "2026-10-30T03:12:44Z", "data_mode": "SIMULATION" }
}
```

Single resource mengembalikan objek langsung (tanpa envelope) plus header
`X-Request-Id`. Parameter: `?limit=50&cursor=…` (limit maks 200, default 50).

### 1.2 Error (RFC 9457 Problem Details)

```json
{
  "type": "https://subako.mikiko.id/errors/rule-expired",
  "title": "Rule sudah tidak berlaku",
  "status": 409,
  "code": "RULE_EXPIRED",
  "detail": "Rule SUBAK-AIR-021 versi 3 berakhir 2026-10-29T16:00:00Z.",
  "instance": "/api/v1/gates/b7f1/commands",
  "request_id": "0f9d2c8a",
  "errors": [ { "field": "rule_version", "message": "expected published version" } ]
}
```

Kode yang dipakai UI (stabil, tidak boleh diubah tanpa versi API baru):

`AUTH_INVALID`, `AUTH_LOCKED`, `AUTH_RATE_LIMITED`, `FORBIDDEN`, `SITE_FORBIDDEN`,
`NOT_FOUND`, `VALIDATION_ERROR`, `RULE_IMMUTABLE`, `RULE_EXPIRED`, `RULE_NOT_APPROVED`,
`RULE_CHECKSUM_MISMATCH`, `MODE_BLOCKED`, `MODE_CONFLICT`, `STALE_TELEMETRY`,
`COMMAND_IN_FLIGHT`, `COMMAND_EXPIRED`, `DUPLICATE_COMMAND`, `IDEMPOTENCY_MISMATCH`,
`DEVICE_UNAVAILABLE`, `CAPABILITY_UNSUPPORTED`, `SIGNING_FAILED`, `BROKER_UNAVAILABLE`,
`LEDGER_INTEGRITY_FAILED`, `EXPORT_IN_PROGRESS`.

### 1.3 Header penting

| Header | Arah | Keterangan |
|---|---|---|
| `Authorization: Bearer <jwt>` | → | Wajib kecuali `/auth/login`, `/auth/refresh`, `/healthz` |
| `Idempotency-Key: <uuid>` | → | **Wajib** pada `POST /gates/{id}/commands`, `POST /rules`, ekspor laporan |
| `X-Request-Id` | ↔ | Diteruskan/dibuat; muncul di log & error |
| `If-None-Match` / `ETag` | ↔ | Untuk `GET /rules/{id}` (versi rule) |
| `Retry-After` | ← | Pada 429/503 |
| `X-Data-Mode` | ← | `SIMULATION` atau `LIVE` pada endpoint yang menyajikan data operasional |

### 1.4 Waktu, satuan, enum

- Semua waktu ISO 8601 UTC (`2026-10-30T03:12:44Z`). Frontend mengonversi ke WITA.
- Satuan: `m`, `L/s`, `%`, `V`, `dBm`, `dB`, `A`, `m³`, `kWh`.
- `mode`: `AUTO | MANUAL | HOLD | FAULT | IDLE` (persis seperti dilaporkan perangkat).
- `freshness`: `LIVE | STALE | OFFLINE` — **dihitung server**.

---

## 2. Katalog endpoint

Legenda akses: permission minimum (lihat `09-rbac-matrix.md`); `scope` = site access
minimum.

### 2.1 Authentication

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | publik | `{email,password}` → access token + cookie refresh |
| POST | `/auth/logout` | terautentikasi | revoke sesi aktif |
| POST | `/auth/refresh` | cookie | rotasi refresh, access token baru |
| GET | `/auth/me` | terautentikasi | user, roles, permissions[], sites[] |
| POST | `/auth/ws-ticket` | terautentikasi | ticket sekali pakai (30 s) untuk WSS |
| POST | `/auth/password/reset-request` | publik | kirim tautan reset (selalu 202) |
| POST | `/auth/password/reset` | token | set password baru, revoke semua sesi |

### 2.2 Sites

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/sites` | `site.view` | hanya site dalam scope |
| POST | `/sites` | `site.manage` (admin) | site baru default `SIMULATION` + `PROVISIONING` |
| GET | `/sites/{site_id}` | `site.view` + scope | detail + ringkasan |
| PATCH | `/sites/{site_id}` | `site.manage` | nama, koordinat, `unit_pref`, `separation_of_duties` |
| GET | `/sites/{site_id}/overview` | `dashboard.view` | agregat dashboard satu site |

### 2.3 Devices, gateway, provisioning

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/devices` | `device.read` | filter `site_id, kind, status, freshness` |
| POST | `/devices` | `device.manage` | register (devEUI, kind) → `UNPROVISIONED` |
| GET | `/devices/{id}` | `device.read` | detail + capability + assignment |
| PATCH | `/devices/{id}` | `device.manage` | assignment, interval, `is_active` |
| GET | `/devices/{id}/health` | `device.read` | health terkini + riwayat 24 jam |
| GET | `/devices/{id}/history` | `device.read` | riwayat health (pagination) |
| POST | `/devices/{id}/provision` | `device.manage` | buat secret, kirim ke ChirpStack, **respons secret sekali** |
| POST | `/devices/{id}/calibration` | `calibration.manage` | catat versi kalibrasi |
| GET | `/devices/{id}/capabilities` | `device.read` | daftar capability + config |
| GET | `/gateways` | `gateway.manage` | status gateway |

### 2.4 Telemetry

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/telemetry/latest` | `telemetry.read` | nilai terakhir per channel (+ freshness) |
| GET | `/telemetry/history` | `telemetry.read` | `granularity=raw|1m|1h`, maks 31 hari |
| GET | `/telemetry/water-level` | `telemetry.read` | hulu/hilir + ambang |
| GET | `/telemetry/flow` | `telemetry.read` | debit + target rule aktif |
| GET | `/telemetry/battery` | `telemetry.read` | baterai per device |
| POST | `/internal/v1/ingest` | service token | **internal**, batch telemetri/ACK |

Contoh `/telemetry/latest`:

```json
{
  "data": [
    {
      "device_id": "3b9a…",
      "gate_id": "b7f1…",
      "gate_code": "GATE-01",
      "site_id": "0c1d…",
      "ts": "2026-10-30T03:12:00Z",
      "freshness": "LIVE",
      "age_s": 44,
      "channels": {
        "water_level_up":   { "value": 0.82, "unit": "m",  "quality": "OK" },
        "water_level_down": { "value": 0.61, "unit": "m",  "quality": "OK" },
        "flow":             { "value": 37.6, "unit": "L/s","quality": "OK" },
        "battery_pct":      { "value": 87,   "unit": "%",  "quality": "OK" }
      },
      "mode": "AUTO",
      "gate_position_pct": 34.0
    }
  ],
  "meta": { "server_time": "2026-10-30T03:12:44Z", "data_mode": "SIMULATION",
            "freshness_policy": { "interval_s": 60, "stale_after_s": 120, "offline_after_s": 300 } }
}
```

### 2.5 Gates

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/gates` | `gate.read` | daftar + state + freshness |
| GET | `/gates/{id}` | `gate.read` | detail lengkap |
| GET | `/gates/{id}/status` | `gate.read` | state ringkas (dipakai polling/WS fallback) |
| GET | `/gates/{id}/events` | `gate.read` | riwayat event (cursor) |
| GET | `/gates/{id}/commands` | `gate.read` | riwayat command + status |
| POST | `/gates/{id}/commands` | `gate.command` + scope `OPERATE` | **lihat §4** |
| POST | `/gates/{id}/commands/{cmd_id}/cancel` | `gate.command` | hanya bila masih `SENT` dan belum ACK |

### 2.6 Rules

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/rules` | `rule.view` | filter status, site |
| POST | `/rules` | `rule.create` | buat rule + versi draft 1 |
| GET | `/rules/{id}` | `rule.view` | rule + versi aktif |
| PATCH | `/rules/{id}` | `rule.create` | **hanya draft**; selain itu 409 `RULE_IMMUTABLE` |
| POST | `/rules/{id}/submit` | `rule.create` | `DRAFT → IN_REVIEW` |
| POST | `/rules/{id}/approve` | `rule.approve` | `IN_REVIEW → APPROVED` (SOE dicek) |
| POST | `/rules/{id}/reject` | `rule.approve` | alasan wajib |
| POST | `/rules/{id}/publish` | `rule.publish` | `APPROVED → PUBLISHED`, set `effective_from` |
| GET | `/rules/{id}/versions` | `rule.view` | daftar versi + checksum |
| GET | `/rules/{id}/versions/{v}` | `rule.view` | detail versi (immutable) |
| GET | `/rules/{id}/diff?from=&to=` | `rule.view` | perbedaan entitlement/jadwal |
| GET | `/schedule` | `schedule.view` | jadwal per tanggal (`?date=YYYY-MM-DD&site_id=`) |
| GET | `/meeting-references` | `rule.view` | referensi Paruman |

### 2.7 Water Ledger

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/ledger` | `ledger.view` | filter site, gate, tempek, jenis, periode |
| GET | `/ledger/{entry_id}` | `ledger.view` | detail + hash + entri terkait |
| GET | `/ledger/verify` | `ledger.view` | `?site_id&from&to` → hasil verifikasi |
| GET | `/ledger/seals` | `ledger.view` | daftar seal harian |
| GET | `/ledger/export` | `ledger.export` | `format=csv|pdf` → job/stream |
| POST | `/ledger/compensations` | `ledger.correct` | entri koreksi (bukan edit) |

### 2.8 Alerts

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/alerts` | `alert.view` | filter status/severity/site/device |
| GET | `/alerts/{id}` | `alert.view` | detail + evidence + riwayat |
| POST | `/alerts/{id}/acknowledge` | `alert.acknowledge` | `{note, assigned_to?}` |
| POST | `/alerts/{id}/resolve` | `alert.resolve` | `{resolution, evidence?, sensor_ref?}` |
| GET | `/alerts/summary` | `alert.view` | hitungan per severity/status |

### 2.9 Reports

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/reports/daily` | `report.view` | `?date=&site_id=` |
| GET | `/reports/weekly` | `report.view` | `?week_start=` |
| GET | `/reports/monthly` | `report.view` | `?month=YYYY-MM` |
| GET | `/reports/gate-performance` | `report.view` | per gate, periode |
| GET | `/reports/device-performance` | `report.view` | kesehatan & uptime |
| GET | `/reports/energy` | `report.view` | konsumsi (bila metrik tersedia) |
| GET | `/reports/incidents` | `report.view` | histori gangguan |
| GET | `/reports/deviation` | `report.view` | aktual vs aturan |
| GET | `/reports/operator-activity` | `report.view` | rekap aksi operator |
| GET | `/reports/export` | `report.export` | `?report=…&format=pdf|xlsx` → `{job_id}` |
| GET | `/reports/export/{job_id}` | `report.export` | status + signed URL |

### 2.10 Administration

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/admin/users` | `user.manage` | daftar + filter |
| POST | `/admin/users` | `user.manage` | buat user (password sementara wajib diganti) |
| PATCH | `/admin/users/{id}` | `user.manage` | nama, role, site access, aktif/nonaktif |
| POST | `/admin/users/{id}/reset-password` | `user.manage` | revoke sesi, kirim tautan |
| GET | `/admin/users/{id}/activity` | `user.manage` | audit per user |
| GET | `/admin/audit` | `audit.read` | audit append-only + filter |
| GET | `/admin/system-health` | `system.health` | ingest, WS, MQTT, DB, job |
| GET | `/admin/notifications` | `user.manage` | preferensi notifikasi |
| PATCH | `/admin/notifications` | `user.manage` | ubah preferensi |
| GET | `/admin/ledger-integrity` | `system.health` | status verifikasi terakhir per site |

### 2.11 WebSocket

`WSS /ws/v1?ticket=<one-time>`

| Arah | Pesan |
|---|---|
| ← | `hello {server_time, channels, freshness_policy}` |
| → | `subscribe {site_ids[], topics[]}` |
| ← | `snapshot {gates[], alerts[], server_time, seq}` |
| ← | `event {type, seq, ts, site_id, payload}` — `type ∈ gate.status, gate.position, telemetry, alert.new, alert.update, command.update` |
| ↔ | `ping/pong` (25 s) |

Tidak ada topik untuk mengirim command. Command selalu lewat REST + Idempotency-Key.

---

## 3. Contoh payload kritis

### 3.1 `POST /gates/{gate_id}/commands`

Request:

```http
POST /api/v1/gates/b7f1e2a4-…/commands
Authorization: Bearer <jwt>
Idempotency-Key: 6a1f0d7e-8c3b-4f2a-9d55-1f0e2b7c9a11
Content-Type: application/json

{
  "action": "SET_POSITION",
  "target_pct": 40.0,
  "rule_version_id": "5d2c…",
  "reason": "Menyesuaikan giliran Tempek Subak Sari sesuai jadwal 12:00 WITA",
  "expected_rule_checksum": "sha256:9f2c…"
}
```

Respons `202`:

```json
{
  "id": "c4d9…",
  "gate_id": "b7f1…",
  "action": "SET_POSITION",
  "target_pct": 40.0,
  "status": "SENT",
  "issued_at": "2026-10-30T03:12:00Z",
  "expires_at": "2026-10-30T03:13:30Z",
  "expires_in_s": 90,
  "rule_version": 3,
  "rule_checksum": "sha256:9f2c…",
  "requires_ack": true,
  "message": "Perintah dikirim. Status akhir menunggu ACK dan telemetri posisi."
}
```

Respons penolakan (contoh) `409`:

```json
{
  "type": "https://subako.mikiko.id/errors/mode-blocked",
  "title": "Perintah tidak diizinkan pada mode perangkat",
  "status": 409,
  "code": "MODE_BLOCKED",
  "detail": "Gate GATE-01 melaporkan mode MANUAL. Operasikan secara manual di lokasi.",
  "request_id": "8f2b…",
  "errors": []
}
```

### 3.2 `GET /ledger/verify`

```json
{
  "site_id": "0c1d…",
  "from": "2026-10-23T00:00:00Z",
  "to": "2026-10-30T00:00:00Z",
  "entries_checked": 118,
  "status": "VALID",
  "first_broken_seq": null,
  "seals_checked": 7,
  "seals_matched": 7,
  "last_entry_hash": "9f2c8b1e…",
  "verified_at": "2026-10-30T03:14:02Z",
  "verified_by": "user:1f0c…"
}
```

Bila rusak: `status: "INVALID"`, `first_broken_seq: 87`, plus `detail` yang menjelaskan
entri mana dan mengapa (mis. `prev_hash` tidak cocok).

### 3.3 `POST /rules/{id}/publish`

```json
{ "effective_from": "2026-11-01", "effective_to": "2026-11-15", "note": "Paruman 12 Okt 2026" }
```

Respons `200` mengembalikan versi yang kini `PUBLISHED` + `superseded_version_id`
(bila ada). Penolakan: `422 MEETING_REFERENCE_REQUIRED`, `409 RULE_NOT_APPROVED`,
`422 ENTITLEMENT_OVER_100`.

---

## 4. Aturan API yang mengikat implementasi

1. **Tidak ada endpoint untuk mengubah atau menghapus** `ledger_entries`, `audit_events`,
   `gate_events`, `rule_approvals`, atau versi rule yang sudah `PUBLISHED`.
2. **Tidak ada endpoint** yang mengirim command tanpa `Idempotency-Key` dan tanpa
   validasi 9 lapis.
3. **Tidak ada endpoint** yang menerima target perangkat langsung (devEUI/topic) dari
   klien; klien hanya menyebut `gate_id`.
4. Semua daftar yang memuat data site **wajib** menerapkan site scope; parameter
   `site_id` di luar scope → `403 SITE_FORBIDDEN`.
5. Semua respons data operasional menyertakan `freshness`; UI tidak boleh menebak.
6. Endpoint internal (`/internal/*`) tidak diekspos melalui reverse proxy publik.

---

## 5. Versioning & deprecation

- Path major (`/v1`) hanya berubah untuk breaking change.
- Field baru bersifat opsional dan additive.
- Endpoint yang akan dihapus: header `Deprecation` + `Sunset` + entri di `CHANGELOG.md`,
  minimal 1 rilis sebelum dihapus.
- Klien frontend dan OpenAPI di-generate dari sumber yang sama pada CI untuk mencegah
  drift (`openapi-typescript` → `types/api.d.ts`).
