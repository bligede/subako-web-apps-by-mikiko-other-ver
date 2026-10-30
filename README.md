# SUBAKO Web-PWA v0.1

**Smart Irrigation Management Platform**
by Mikiko Technology

> **Tradition decides. Technology measures. SUBAKO executes.**

---

## Status: Tahap A–B (Paket Arsitektur untuk Review)

Repository ini **belum** berisi implementasi aplikasi. Sesuai instruksi pengembangan
(Pasal 24 — *Output Pertama*), tahap pertama menyerahkan **paket arsitektur** untuk
disetujui Product Owner sebelum masuk ke Phase 1 (Project Foundation).

| # | Deliverable | Lokasi | Status |
|---|---|---|---|
| 1 | System Architecture Diagram | [`docs/01-system-architecture.md`](docs/01-system-architecture.md) | ✅ siap review |
| 2 | Information Architecture | [`docs/02-information-architecture.md`](docs/02-information-architecture.md) | ✅ siap review |
| 3 | User Flow Diagram | [`docs/03-user-flows.md`](docs/03-user-flows.md) | ✅ siap review |
| 4 | High-Fidelity UI Design | [`design/`](design/index.html) (prototipe klik-able) + [`docs/04-ui-design-system.md`](docs/04-ui-design-system.md) | ✅ siap review |
| 5 | Frontend Component Architecture | [`docs/05-frontend-architecture.md`](docs/05-frontend-architecture.md) | ✅ siap review |
| 6 | Backend Architecture | [`docs/06-backend-architecture.md`](docs/06-backend-architecture.md) | ✅ siap review |
| 7 | Database ERD | [`docs/07-database-erd.md`](docs/07-database-erd.md) | ✅ siap review |
| 8 | API Specification | [`docs/08-api-specification.md`](docs/08-api-specification.md) + [`docs/api/openapi.yaml`](docs/api/openapi.yaml) | ✅ siap review |
| 9 | RBAC Permission Matrix | [`docs/09-rbac-matrix.md`](docs/09-rbac-matrix.md) | ✅ siap review |
| 10 | Development Roadmap & Estimasi | [`docs/10-roadmap.md`](docs/10-roadmap.md) | ✅ siap review |

Dokumen pendukung:

- [`docs/00-paket-arsitektur.md`](docs/00-paket-arsitektur.md) — ringkasan paket, alur review, checklist sign-off.
- [`docs/11-keputusan-terbuka.md`](docs/11-keputusan-terbuka.md) — **keputusan teknis yang butuh persetujuan PO** (blocking & non-blocking).

---

## Cara mereview

### 1. Dokumen

Mulai dari [`docs/00-paket-arsitektur.md`](docs/00-paket-arsitektur.md). Dokumen
menggunakan Mermaid, sehingga dapat dibaca langsung di GitHub/GitLab atau VS Code
(extension *Markdown Preview Mermaid Support*).

### 2. Prototipe desain (high-fidelity, klik-able)

Prototipe adalah HTML/CSS/JS statis tanpa dependency build — hanya untuk review visual
dan alur, **bukan** aplikasi. Tidak ada koneksi ke backend, semua angka adalah
**data DEMO** yang dilabeli jelas.

```bash
cd design && python3 -m http.server 8080
# buka http://localhost:8080
```

Isi prototipe: Login, Dashboard, Monitoring (peta + water level + flow + device health),
Gate list, Gate detail, Water Allocation/Rules, Water Ledger, Alerts, Reports, serta
styleguide (design token & komponen).

### 3. Kontrak API

`docs/api/openapi.yaml` dapat dibuka di Swagger Editor / Redoc untuk melihat bentuk
request-response sebelum implementasi dimulai.

---

## Batasan yang dipegang paket ini

1. **Tidak ada keputusan hardware yang dikunci.** Semua parameter sensor, motor, encoder,
   dan radio diperlakukan sebagai *device capability* yang dapat dikonfigurasi.
2. **Tidak ada otoritas AI atas aktuasi.** Analytics hanya advisory, tanpa jalur ke
   command controller.
3. **Tidak ada antrean command di PWA.** Command kedaluwarsa ditolak, bukan dikirim ulang.
4. **Water Ledger bukan blockchain.** Implementasinya hash chain + append-only table.
5. **Data simulasi selalu berlabel.** Mode SIMULATION dan LIVE dipisahkan pada level
   data, bukan hanya label UI.

---

## Struktur repository

```text
.
├── README.md
├── docs/                     # paket arsitektur (deliverable tahap 1)
│   ├── 00-paket-arsitektur.md
│   ├── 01-system-architecture.md
│   ├── 02-information-architecture.md
│   ├── 03-user-flows.md
│   ├── 04-ui-design-system.md
│   ├── 05-frontend-architecture.md
│   ├── 06-backend-architecture.md
│   ├── 07-database-erd.md
│   ├── 08-api-specification.md
│   ├── 09-rbac-matrix.md
│   ├── 10-roadmap.md
│   ├── 11-keputusan-terbuka.md
│   └── api/
│       └── openapi.yaml
└── design/                   # prototipe high-fidelity untuk review
    ├── index.html
    ├── styleguide.html
    ├── 01-login.html … 09-reports.html
    └── assets/{app.css,app.js}
```

Setelah paket ini disetujui, Phase 1 akan menambahkan `frontend/`, `backend/`,
`iot-bridge/`, `infra/`, dan `simulator/` sesuai [`docs/10-roadmap.md`](docs/10-roadmap.md).

---

**Project Owner:** Mikiko Technology
**Versi dokumen:** v0.1 · **Bahasa:** Indonesia · **Zona waktu tampilan:** WITA (UTC+8)

---

## Phase 1 — implementasi fondasi (disetujui)

Phase 1 membangun fondasi yang benar-benar berjalan di atas paket arsitektur di atas:
autentikasi, RBAC yang ditegakkan server, telemetri **SIMULATION**, siklus command, dan
Water Ledger hash-chain. Belum ada MQTT/ChirpStack, rule engine, atau laporan.

### Struktur

```text
backend/            FastAPI + SQLAlchemy 2 (SQLite dev, PostgreSQL/Timescale via compose)
  app/              config, models, permissions, routers, services (ledger/commands/simulation)
  tests/            16 tes kontrak (RBAC, site scope, command, ledger)
frontend/           React 18 + TypeScript + Vite + TanStack Query + Recharts + PWA shell
design/             prototipe statis yang disetujui (referensi visual)
docs/               paket arsitektur v0.1
docker-compose.yml  db (Timescale) + api + web nginx
```

### Menjalankan lokal

Backend (terminal 1):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Frontend (terminal 2):

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000, proxy /api → 127.0.0.1:8000
```

Buka `http://localhost:3000`. Akun demo (password `Subako#2026`):

| Email | Role | Yang bisa dilakukan |
|---|---|---|
| `pekaseh@demo` | PEKASEH | rule, user lokal, command + override HOLD |
| `operator@demo` | OPERATOR | command, ack/resolve alert |
| `petani@demo` | VIEWER | baca dashboard, ledger, alert |
| `admin@mikiko.id` | ADMIN | user, audit, kesehatan sistem — **tanpa** gate.command |

### Menjalankan dengan Docker

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # isi SUBAKO_JWT_SECRET
docker compose up --build                                       # web di :8080
```

Compose memakai TimescaleDB, tetapi schema Phase 1 dibuat dengan `create_all` agar
demo bisa langsung jalan. Migrasi Alembic baseline dijadwalkan pada Phase 2, sebelum
skema dipakai data nyata.

### Tes & pemeriksaan

```bash
cd backend && .venv/bin/python -m pytest        # 16 tes
cd frontend && npm run build                    # tsc strict + vite build + PWA
```

Tes mencakup: ADMIN/VIEWER ditolak saat mengirim command, isolasi site, command pada
pintu FAULT ditolak, pelepasan HOLD hanya oleh Pekaseh, data basi menolak command,
idempotency key, dan ledger yang diubah langsung terdeteksi `INVALID` pada urutan yang benar.

### Batasan Phase 1 (disengaja)

- Semua angka berasal dari simulator; site berlabel `SIMULATION` dan UI menampilkan banner DEMO.
- Report, ekspor, rule approval/publish, provisioning perangkat, dan koneksi LoRaWAN belum aktif.
- Access token disimpan di memori; refresh token di cookie httpOnly. Rotasi sesi dan
  pencabutan token akses penuh (denylist) menyusul di Phase 2.
- Belum ada CI; perintah tes di atas dijalankan manual.
