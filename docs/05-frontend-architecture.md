# 05 — Frontend Architecture

**SUBAKO Web-PWA v0.1** · React 18 + TypeScript + Vite + Tailwind

---

## 1. Stack & versi (dikunci saat Phase 1)

| Kebutuhan | Pilihan | Catatan versi |
|---|---|---|
| Build | Vite 5 | ESM, dev server cepat |
| UI | React 18.3 | Concurrent features tidak dipaksakan |
| Bahasa | TypeScript 5.5 | `strict: true`, `noUncheckedIndexedAccess: true` |
| Styling | Tailwind CSS 3.4 + CSS variables | Token dari `04-ui-design-system.md` |
| Routing | React Router 6.26 (data router) | Route-level `loader` tidak dipakai; data via Query |
| Server state | TanStack Query 5 | Satu-satunya sumber data server |
| Form | React Hook Form 7 + Zod 3 | Zod schema dipakai ulang untuk validasi & tipe |
| Grafik | Recharts 2.12 | Dipilih karena SVG (aksesibel, mudah di-`aria`) |
| Peta | Leaflet 1.9 + react-leaflet 4 | Tile ringan, GeoJSON site |
| PWA | vite-plugin-pwa 0.20 (Workbox 7) | Precache shell, runtime cache terbatas |
| Test | Vitest 2 + Testing Library + Playwright 1.47 | Unit, komponen, e2e |
| Lint/format | ESLint 9 flat config + Prettier 3 | `import/order`, `no-restricted-imports` |

Versi dikunci di `package.json` + `package-lock.json` (commit lockfile, jangan pakai
range `^` pada dependency kritis). Pencatatan versi rilis ada di `RELEASE.md` Phase 1.

---

## 2. Struktur folder

```text
frontend/
├── public/
│   ├── icons/                     # 192, 512, maskable
│   ├── manifest.webmanifest
│   └── offline.html               # fallback navigasi offline
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx                # router + providers
│   │   ├── providers.tsx          # QueryClient, Auth, Toast, Theme
│   │   ├── routes.tsx             # route table (lihat §3)
│   │   └── guards/                # RequireAuth, RequirePermission, RequireSite
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── monitoring/
│   │   ├── gates/
│   │   ├── rules/
│   │   ├── schedule/
│   │   ├── ledger/
│   │   ├── alerts/
│   │   ├── reports/
│   │   ├── devices/
│   │   └── admin/
│   ├── components/
│   │   ├── ui/                    # primitif: Button, Card, Table, Badge, Dialog…
│   │   ├── data/                   # KpiCard, SensorValue, ChartCard, DataTable
│   │   ├── layout/                 # AppShell, Sidebar, TopBar, BottomNav
│   │   └── feedback/               # EmptyState, ErrorState, OfflineBanner, Skeleton
│   ├── lib/
│   │   ├── api/                    # client.ts, endpoints per fitur, error mapping
│   │   ├── realtime/               # ws-client.ts, channel registry, freshness
│   │   ├── format/                 # waktu WITA, angka id-ID, satuan
│   │   ├── auth/                   # token store (memori), refresh scheduler
│   │   ├── offline/                # cache policy, queue guard (hanya read)
│   │   └── analytics/              # event opt-in (default off)
│   ├── types/
│   │   ├── api.d.ts                # hasil generate dari OpenAPI
│   │   └── domain.ts               # tipe turunan yang dipakai UI
│   └── styles/
│       ├── tokens.css
│       └── globals.css
├── tests/
│   ├── unit/
│   └── e2e/
└── vite.config.ts
```

**Aturan struktur (di-enforce ESLint):**

1. `features/*` **tidak boleh** mengimpor `features/*` lain; komunikasi lewat
   `components/` bersama atau `lib/`. Pengecualian: `features/dashboard` boleh
   mengimpor komponen presentasional dari fitur lain **hanya** yang diekspor di
   `index.ts` publiknya.
2. `components/ui` tidak boleh mengimpor `features/*` atau `lib/api` (harus bodoh/presentational).
3. Semua panggilan HTTP hanya dari `lib/api/**` atau `features/*/api.ts`; komponen tidak
   memanggil `fetch` langsung.
4. Tipe dari backend **hanya** dari `types/api.d.ts` (hasil generate), tidak diketik ulang manual.

---

## 3. Routing & guard

```tsx
// routes.tsx (ringkas)
const routes = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <RequirePermission code="dashboard.view"><DashboardPage /></RequirePermission> },
      { path: 'monitoring', children: [
          { path: 'map', element: <Permission code="site.view"><MapPage /></Permission> },
          { path: 'water-level', element: <Permission code="telemetry.read"><WaterLevelPage /></Permission> },
          { path: 'flow', element: <Permission code="telemetry.read"><FlowPage /></Permission> },
          { path: 'devices', element: <Permission code="device.read"><DeviceHealthPage /></Permission> },
      ]},
      { path: 'gates', element: <Permission code="gate.read"><GatesPage /></Permission> },
      { path: 'gates/:gateId', element: <Permission code="gate.read"><GateDetailPage /></Permission> },
      { path: 'schedule', element: <Permission code="schedule.view"><SchedulePage /></Permission> },
      { path: 'governance/rules', element: <Permission code="rule.view"><RulesPage /></Permission> },
      { path: 'governance/rules/:ruleId', element: <Permission code="rule.view"><RuleDetailPage /></Permission> },
      { path: 'ledger', element: <Permission code="ledger.view"><LedgerPage /></Permission> },
      { path: 'alerts', element: <Permission code="alert.view"><AlertsPage /></Permission> },
      { path: 'reports', element: <Permission code="report.view"><ReportsPage /></Permission> },
      { path: 'admin/*', element: <RequireRole role="ADMIN"><AdminRoutes /></RequireRole> },
      { path: '403', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
```

**Guard bersifat kosmetik, bukan keamanan.** Semua guard hanya mencegah tampilan yang
tidak relevan; otorisasi sebenarnya di backend. Setiap endpoint tetap divalidasi server,
dan UI harus mampu menangani `403` yang datang dari server (bukan hanya guard).

Pemuatan halaman memakai `React.lazy` per fitur; bundle awal target < 200 kB gzip.

---

## 4. Server state (TanStack Query)

### 4.1 Konvensi key

```ts
// lib/api/keys.ts
export const qk = {
  me: ['auth', 'me'] as const,
  sites: (f?: Filter) => ['sites', f ?? {}] as const,
  dashboard: (siteId: string) => ['dashboard', siteId] as const,
  gates: (siteId: string, f?: Filter) => ['gates', siteId, f ?? {}] as const,
  gate: (id: string) => ['gate', id] as const,
  gateEvents: (id: string, p?: Page) => ['gate', id, 'events', p ?? {}] as const,
  telemetry: (q: TelemetryQuery) => ['telemetry', q] as const,
  ledger: (q: LedgerQuery) => ['ledger', q] as const,
  rules: (siteId: string, status?: string) => ['rules', siteId, status ?? 'all'] as const,
  rule: (id: string) => ['rule', id] as const,
  alerts: (f?: AlertFilter) => ['alerts', f ?? {}] as const,
  reports: (q: ReportQuery) => ['reports', q] as const,
  devices: (siteId: string) => ['devices', siteId] as const,
};
```

Aturan: semua key diawali resource; tidak ada key yang dibuat ad-hoc di komponen.

### 4.2 Kebijakan staleness (selaras freshness backend)

| Query | `staleTime` | `refetchInterval` | Alasan |
|---|---|---|---|
| `me` | 5 mnt | — | permissions jarang berubah |
| `dashboard` | 10 s | 30 s | cadangan bila WS putus |
| `telemetry` (24 jam) | 30 s | — | WS menangani update point |
| `gate` (detail) | 5 s | 15 s | status aktuator kritis |
| `gateEvents` | 15 s | — | paginated |
| `ledger` | 60 s | — | append-only, tidak perlu cepat |
| `rules` | 60 s | — | governance, jarang berubah |
| `alerts` | 15 s | 30 s | perlu respons cepat |
| `devices` | 30 s | 60 s | health berubah lambat |

`refetchOnWindowFocus: true` kecuali halaman kritis (gate detail) yang memakai
`refetchOnWindowFocus: 'always'`.

### 4.3 Mutasi

```ts
useMutation({
  mutationFn: (body: CommandInput) => api.gates.command(gateId, body, { idempotencyKey: crypto.randomUUID() }),
  onSuccess: (cmd) => {
    qc.setQueryData(qk.gate(gateId), (old) => /* sisipkan command PENDING */ old);
    // TIDAK ada optimistic "success": status mengikuti WS/ACK
  },
  onError: (err) => mapApiError(err), // menampilkan kode: RULE_EXPIRED, STALE_TELEMETRY, ...
});
```

**Larangan mutasi optimistik untuk command.** UI boleh optimistis untuk hal seperti
rename site, tetapi tidak untuk aktuasi.

---

## 5. Realtime (WebSocket)

Satu koneksi per tab, dibuat setelah login.

```text
WSS /ws/v1?ticket=<one-time-ticket>   (ticket dari POST /auth/ws-ticket, TTL 30 s)
```

Alur:

```mermaid
sequenceDiagram
    participant UI
    participant Auth as AuthProvider
    participant WS as WsClient
    participant API
    Auth->>API: POST /auth/ws-ticket
    API-->>Auth: {ticket, expires_in:30}
    Auth->>WS: connect(ticket)
    WS->>API: upgrade
    API-->>WS: hello {server_time, channels, freshness_policy}
    WS->>API: subscribe {site_ids, topics:["gate.status","alert","command"]}
    API-->>WS: snapshot {gates:[...], alerts:[...], server_time}
    loop setiap event
        API-->>WS: event {type, payload, ts, seq}
        WS->>UI: dispatch → queryClient.setQueryData
    end
    Note over WS: heartbeat 25 s; reconnect backoff 1,2,4,8,16 s (maks 30 s)
```

Prinsip:

1. **Snapshot-on-connect**, bukan replay event. Setelah reconnect, UI mengambil snapshot
   penuh lalu melanjutkan delta. Tidak ada event yang "ditumpuk" selama offline.
2. **Freshness watchdog** di klien: setiap 5 s hitung `now - lastMessage`; jika
   melewati `freshness_policy.stale_after`, tandai seluruh data site `STALE` dan
   tampilkan banner — tanpa menunggu server.
3. **Tidak ada antrean kirim.** `WsClient.send` menolak saat `readyState !== OPEN`.
   Tidak ada buffer pesan keluar, tidak ada IndexedDB outbox untuk perintah.
4. Event membawa `seq` monoton per kanal; klien mengabaikan `seq ≤ lastSeq` (proteksi
   duplikat saat reconnect).
5. `document.visibilityState === 'hidden'` → koneksi ditutup setelah 60 s; dibuka lagi
   saat terlihat (menghemat baterai perangkat lapangan yang memakai aplikasi).

Channel yang tersedia: `site:{id}:gate`, `site:{id}:alert`, `site:{id}:telemetry`,
`user:{id}:command`. Klien hanya boleh subscribe ke site dalam `user_site_access`
(divalidasi server, bukan klien).

---

## 6. Auth di klien

| Item | Penyimpanan | Umur |
|---|---|---|
| Access token (JWT) | Variabel modul di memori (`lib/auth/tokenStore`) | 15 mnt |
| Refresh token | Cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` | 7 hari, rotasi |
| Site aktif & filter | `sessionStorage` | Sesi tab |
| Preferensi UI (tabel per halaman) | `localStorage` | Persisten |

- Refresh dijadwalkan 60 s sebelum `exp`, dengan single-flight (satu request walau
  banyak komponen meminta).
- `401` pada request → satu kali refresh → retry; `401` kedua → logout paksa + pesan
  sesi berakhir.
- `403` tidak pernah memicu refresh.
- Logout memanggil `POST /auth/logout` (revoke refresh) lalu membersihkan QueryCache.

---

## 7. PWA

### 7.1 Manifest (ringkas)

```json
{
  "name": "SUBAKO — Smart Irrigation Management Platform",
  "short_name": "SUBAKO",
  "description": "Monitoring dan tata kelola irigasi Subak",
  "start_url": "/dashboard?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#FFFFFF",
  "theme_color": "#10443B",
  "lang": "id",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Peringatan", "url": "/alerts" },
    { "name": "Pintu Air", "url": "/gates" },
    { "name": "Jadwal", "url": "/schedule" }
  ]
}
```

### 7.2 Strategi service worker

| Resource | Strategi | Cache | Alasan |
|---|---|---|---|
| `index.html`, JS/CSS build | Precache (revision hash) | Cache Storage | Shell instan |
| Ikon, font | Cache-first | 30 hari | Statis |
| Tile peta | Stale-while-revalidate, max 200 entri | 7 hari | Offline peta terakhir |
| `GET /api/v1/**` (read) | **Network-only**, dengan cache manual terbatas di Query (`gcTime` 24 jam) | — | Data operasional harus segar; Query persistence menangani offline read |
| `POST/PATCH/DELETE /api/v1/**` | **Tidak di-cache, tidak di-queued** | — | Larangan antrean command |
| `/ws/v1` | Tidak disentuh SW | — | — |
| Navigasi offline | Fallback `/offline.html` | — | Pesan jelas, bukan layar putih |

### 7.3 Persistensi cache data untuk offline

Memakai `@tanstack/query-persist-client-core` + `idb-keyval`:

- Hanya query **read** dengan key di whitelist (`dashboard`, `gate`, `telemetry`,
  `alerts`, `rules`, `schedule`) yang dipersist.
- `maxAge: 12 jam`, `buster` dinaikkan setiap kali skema berubah.
- Data yang dipersist **tidak** memuat: access token, data pribadi pengguna lain,
  respons audit mentah, atau file ekspor.
- Saat aplikasi dibuka offline, setiap blok data wajib menampilkan umur data.

### 7.4 Notifikasi

- Web Push (VAPID) untuk alert `CRITICAL` dan `HIGH` — opt-in.
- Permission **hanya** diminta setelah pengguna menekan "Aktifkan notifikasi" di
  `/settings/notifications` dan setelah melihat penjelasan manfaat.
- Preferensi disimpan di server (`user_notification_prefs`), bukan hanya lokal, agar
  konsisten antar perangkat.
- Klik notifikasi → deep link ke halaman detail (gate/alert) **tanpa** aksi otomatis.

### 7.5 Install

`InstallPrompt` muncul sebagai banner halus setelah 2 sesi berturut-turut dan tidak
pernah di atas area data kritis. Dismiss disimpan 30 hari (`localStorage`).

---

## 8. Format & lokalisasi

```ts
// lib/format/time.ts
export const fmtWita = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso)) + ' WITA';
```

- Semua waktu dari API UTC (`...Z`), ditampilkan `Asia/Makassar`.
- Angka: `Intl.NumberFormat('id-ID')` → pemisah desimal koma (`37,6`), ribuan titik.
- Satuan: `cm`/`m` mengikuti preferensi site (`site.unit_pref`), konversi hanya untuk
  tampilan; **backend selalu meter & liter/detik**.
- Durasi relatif: `2 mnt lalu`, `3 jam lalu`, `kemarin 14:20 WITA`.

---

## 9. Error handling

| Kondisi | Perilaku |
|---|---|
| `400 VALIDATION_ERROR` | Tampilkan pesan per-field dari detail Zod server |
| `401` | Refresh sekali, lalu logout |
| `403` | Halaman/panel "tidak berwenang" dengan jalan kembali |
| `404` | Empty state spesifik ("Gate tidak ditemukan") |
| `409` (RULE_IMMUTABLE, MODE_CONFLICT, DUPLICATE_COMMAND) | Dialog penjelasan + langkah benar |
| `422 COMMAND_REJECTED` | Timeline command: status `REJECTED` + alasan perangkat |
| `429` | Countdown dari header `Retry-After` |
| `5xx` / network | Kartu data terakhir + `STALE` + tombol coba lagi; tidak auto-retry mutasi |

`ErrorBoundary` per route (bukan seluruh app) agar satu grafik rusak tidak mematikan
navigasi. Error dilaporkan ke `console` + (opsional, opt-in) endpoint telemetri前端
yang **tidak** mengirim data pribadi.

---

## 10. Testing frontend

| Level | Alat | Cakupan wajib |
|---|---|---|
| Unit | Vitest | formatter WITA/angka, freshness reducer, permission helper, Zod schema |
| Komponen | Vitest + RTL | KpiCard (no-data/stale), GateControlPanel (5 state), LedgerEntryRow, StatusPill, ConfirmDialog |
| Integrasi | MSW + RTL | Login flow, 403 handling, WS event → UI update, offline banner |
| E2E | Playwright | login → dashboard → gate detail → command (mock server) → ACK; ledger verify; rule lifecycle; install/offline (Chromium) |
| A11y | axe-core (Playwright) | 0 violation serius pada 8 halaman utama |
| Visual | Playwright screenshot (opsional) | 3 viewport × 6 halaman |

Definition of done frontend: `tsc --noEmit`, `eslint`, unit+integration hijau,
e2e jalur kritis hijau, tidak ada `console.error` saat navigasi normal.
