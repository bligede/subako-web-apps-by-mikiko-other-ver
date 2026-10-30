# 02 — Information Architecture

**SUBAKO Web-PWA v0.1** · Struktur navigasi, peta URL, dan kepemilikan halaman

---

## 1. Model mental pengguna

Empat pengguna dengan kebutuhan yang berbeda tajam. IA harus membuat **satu** aplikasi
terasa wajar untuk keempatnya, tanpa membuat Petani tersesat di menu teknis.

| Persona | Pertanyaan utama saat membuka aplikasi | Halaman pendaratan |
|---|---|---|
| Petani (Viewer) | "Apakah air saya dapat hari ini? Kapan?" | `/dashboard` (ringkas) → `/schedule` |
| Operator | "Ada gangguan apa? Pintu mana yang bermasalah?" | `/alerts` bila ada alert aktif, jika tidak `/monitoring` |
| Pekaseh | "Apakah distribusi sesuai kesepakatan? Siapa mengubah apa?" | `/dashboard` → `/governance/rules` |
| Admin Teknis | "Perangkat mana yang perlu perhatian/provisioning?" | `/devices` |

Konsekuensi IA:

1. **Satu dashboard, dua kedalaman.** Dashboard menampilkan kartu ringkas untuk semua
   role; blok operasional (gate control, device health) hanya muncul bila permission ada.
2. **Jadwal adalah halaman kelas satu**, bukan submenu laporan — Petani paling sering
   membutuhkan ini.
3. **Governance dipisah dari operasional.** Rule & approval tinggal di grup
   `Tata Kelola`, bukan bercampur dengan kontrol pintu.
4. **Bahasa Indonesia sebagai bahasa utama**, istilah teknis dipertahankan bila
   merupakan istilah lapangan (`tempek`, `pekaseh`, `subak`, `bangunan bagi`).

---

## 2. Peta navigasi (desktop: sidebar)

```text
SUBAKO
├── Dashboard                          /dashboard
├── Monitoring
│   ├── Peta Subak                     /monitoring/map
│   ├── Ketinggian Air                 /monitoring/water-level
│   ├── Debit Air                      /monitoring/flow
│   └── Kesehatan Perangkat            /monitoring/devices
├── Pintu Air
│   ├── Daftar Pintu                   /gates
│   └── Detail Pintu                   /gates/:gateId
├── Tata Kelola Air
│   ├── Jadwal Distribusi              /schedule
│   ├── Aturan Air                     /governance/rules
│   ├── Detail & Versi Aturan          /governance/rules/:ruleId
│   └── Buku Catatan Air               /ledger
├── Laporan                            /reports
├── Peringatan                         /alerts
├── Administrasi            (admin)    /admin
│   ├── Pengguna                       /admin/users
│   ├── Perangkat                      /admin/devices
│   ├── Gateway                        /admin/gateways
│   ├── Firmware & Kalibrasi           /admin/firmware
│   ├── Audit Teknis                   /admin/audit
│   └── Kesehatan Sistem               /admin/system-health
└── Pengaturan
    ├── Profil & Keamanan              /settings/profile
    └── Notifikasi                     /settings/notifications
```

**Aturan visibilitas menu:** item tanpa permission tidak dirender (bukan disabled),
kecuali pada dua kasus: (a) `Tata Kelola Air` untuk Operator ditampilkan disabled dengan
tooltip "Perlu peran Pekaseh" agar pengguna tahu fitur ada namun bukan haknya;
(b) modul yang sedang dalam masa commissioning ditandai label `Belum aktif`.

---

## 3. Navigasi mobile (bottom bar, 5 item)

| Slot | Item | Alasan dipilih |
|---|---|---|
| 1 | Beranda | Titik masuk universal |
| 2 | Jadwal | Kebutuhan harian Petani |
| 3 | Pintu | Kebutuhan operasional, sering diakses di lapangan |
| 4 | Peringatan | Keselamatan & respons cepat |
| 5 | Lainnya | Sheet: Ledger, Laporan, Tata Kelola, Admin, Pengaturan |

Bottom bar **tidak** memuat menu teknis (admin). Di mobile, tabel berubah menjadi
daftar kartu; grafik dikurangi menjadi satu sparkline per kartu dengan tombol
"Lihat grafik" menuju tampilan penuh.

---

## 4. Inventaris halaman

Kolom **Akses** memakai permission code (detail: `09-rbac-matrix.md`).

| Halaman | URL | Akses minimum | Konten utama | Status yang harus ada |
|---|---|---|---|---|
| Login | `/login` | publik | Form, error, lupa password | loading, invalid, locked |
| Dashboard | `/dashboard` | `dashboard.view` | 8 kartu KPI, peta mini, alert aktif, aktivitas terakhir | DEMO/LIVE, STALE, kosong |
| Peta Subak | `/monitoring/map` | `site.view` | Peta + marker gate/ukur/gateway, panel detail | offline tile, marker tanpa koordinat |
| Ketinggian Air | `/monitoring/water-level` | `telemetry.read` | Grafik hulu/hilir, tabel pembacaan, quality flag | no-data, gap, stale |
| Debit Air | `/monitoring/flow` | `telemetry.read` | Grafik debit, target vs aktual, volume terhitung | target belum diset |
| Kesehatan Perangkat | `/monitoring/devices` | `device.read` | Tabel health: online, baterai, RSSI/SNR, firmware | device baru, sensor error |
| Daftar Pintu | `/gates` | `gate.read` | Tabel/kartu gate, status mode, bukaan | FAULT, HOLD, maintenance |
| Detail Pintu | `/gates/:id` | `gate.read` | Status lengkap, telemetri, kontrol, riwayat event, command | MANUAL, FAULT, E-STOP, command pending |
| Jadwal Distribusi | `/schedule` | `schedule.view` | Kalender/timeline giliran tempek per tanggal | tidak ada rule aktif |
| Aturan Air | `/governance/rules` | `rule.view` | Daftar rule + status lifecycle | draft, in-review, published, expired |
| Detail Aturan | `/governance/rules/:id` | `rule.view` | Isi rule, entitlement, versi, approval, referensi Paruman | versi lama, superseded |
| Buku Catatan Air | `/ledger` | `ledger.view` | Daftar entri append-only, filter, verifikasi | chain invalid (kritis) |
| Laporan | `/reports` | `report.view` | Pilih jenis/periode/site, preview, ekspor | job berjalan, gagal, kosong |
| Peringatan | `/alerts` | `alert.view` | Daftar alert, filter severity/status, detail & aksi | acknowledged, resolved |
| Pengguna | `/admin/users` | `user.manage` | Tabel, tambah/edit, role, site access | akun nonaktif |
| Perangkat | `/admin/devices` | `device.manage` | Register, provisioning, assignment, health | unprovisioned, quarantined |
| Gateway | `/admin/gateways` | `gateway.manage` | Daftar gateway, status koneksi, statistik | offline |
| Firmware & Kalibrasi | `/admin/firmware` | `firmware.manage` | Versi, target rollout, catatan kalibrasi | versi mismatch |
| Audit Teknis | `/admin/audit` | `audit.read` | Tabel audit append-only + filter | — |
| Kesehatan Sistem | `/admin/system-health` | `system.health` | Ingest rate, WS clients, MQTT, DB, job queue | degraded |
| Profil & Keamanan | `/settings/profile` | terautentikasi | Nama, password, sesi aktif | — |
| Notifikasi | `/settings/notifications` | terautentikasi | Preferensi kanal & severity | permission ditolak |

Total 22 rute unik + 2 rute detail berparameter.

---

## 5. Hierarki informasi per halaman kritis

### 5.1 Dashboard

Urutan baca dari atas ke bawah (penting untuk pengambilan keputusan cepat):

1. **Baris konteks** — site aktif, mode data (DEMO/LIVE), waktu sinkron terakhir.
2. **Banner status** — hanya muncul bila ada kondisi abnormal (stale massal, alert
   kritikal, ledger invalid). Tidak ada banner bila semua normal.
3. **KPI primer (4 kartu)** — Pintu aktif, Debit terukur, Rata-rata ketinggian air,
   Alert kritis terbuka.
4. **KPI sekunder (4 kartu)** — Node online, Baterai terendah, Komunikasi (RSSI median),
   Kepatuhan jadwal hari ini.
5. **Peta mini + panel site** — 2/3 lebar.
6. **Alert aktif** — 1/3 lebar, diurut severity lalu waktu.
7. **Grafik 24 jam** — ketinggian air & debit, satu grafik gabungan dengan dua sumbu.
8. **Aktivitas terakhir** — 10 baris dari ledger/audit (bukan log teknis).

### 5.2 Detail Pintu (halaman paling sensitif)

Dibagi tiga kolom di desktop, satu kolom di mobile:

```text
┌──────────────────────────────┬───────────────────────┐
│ A. Status & mode (besar)     │ B. Panel aksi          │
│    mode, bukaan %, posisi    │    - tombol buka/tutup │
│    encoder, arus motor       │    - set target %      │
│    limit switch, baterai     │    - alasan wajib      │
│    LoRaWAN (RSSI/SNR/FCnt)   │    - konfirmasi 2 langkah│
├──────────────────────────────┴───────────────────────┤
│ C. Telemetri 24 jam (grafik ketinggian, debit, bukaan)│
├──────────────────────────────────────────────────────┤
│ D. Riwayat event & command (tabel, termasuk yang gagal)│
└──────────────────────────────────────────────────────┘
```

Aturan IA untuk halaman ini:

- Panel aksi **selalu** menampilkan `expires_in` command terakhir dan alasan penolakan
  bila ada, di tempat yang sama (bukan toast yang hilang).
- Bila `MANUAL`/`FAULT`, panel aksi diganti panel penjelasan + instruksi lapangan
  (handwheel/E-STOP), bukan tombol disabled tanpa konteks.
- Status command tidak pernah ditampilkan sebagai "berhasil" sebelum ACK + posisi aktual.

### 5.3 Buku Catatan Air

- Header: total entri, rentang tanggal, status verifikasi terakhir.
- Filter: site, tempek, gate, jenis entri (distribusi / aktivitas pintu / koreksi).
- Baris: waktu (WITA), gate, tempek, hak air, volume, posisi sebelum→sesudah,
  hash pendek (8 karakter) dengan tooltip hash penuh.
- Aksi baris: lihat detail, lihat entri terkait (koreksi), salin hash.
- Verifikasi: halaman `/ledger` punya panel "Verifikasi integritas" → menjalankan
  `GET /ledger/verify?from=&to=` dan menampilkan hasil per rentang.

---

## 6. Model filter global

Filter berikut **persisten** di seluruh sesi (disimpan di URL + `localStorage`):

| Filter | Default | Pengaruh |
|---|---|---|
| Site | Site pertama yang user punya akses | Semua halaman |
| Rentang waktu | 24 jam | Monitoring, ledger, laporan |
| Mode data | Sesuai site (`SIMULATION`/`LIVE`) | Semua, read-only |

Filter tidak boleh mengubah otorisasi: memilih site yang tidak diizinkan menghasilkan
`403`, bukan daftar kosong (agar tidak menyamarkan kesalahan konfigurasi).

---

## 7. Perilaku state yang konsisten di semua halaman

| State | Representasi visual | Teks |
|---|---|---|
| Loading pertama | Skeleton kartu (bukan spinner penuh layar) | — |
| Refetch (data ada) | Indikator halus di kanan atas kartu + timestamp | "Memperbarui…" |
| Kosong (belum ada data) | Ilustrasi ringan + penjelasan + aksi lanjut | "Belum ada pembacaan untuk periode ini" |
| Kosong (bukan hak akses) | Pesan netral | "Site ini belum memiliki perangkat aktif" |
| Error jaringan | Kartu data terakhir + label `STALE` + tombol coba lagi | "Gagal memuat. Menampilkan data terakhir 12:04 WITA" |
| Error otorisasi | Halaman 403 dengan jalan kembali | "Anda tidak memiliki akses ke site ini" |
| Mode DEMO | Badge kuning persisten di header | "DATA SIMULASI — bukan kondisi lapangan" |

Prinsip: **jangan pernah** menampilkan data lama tanpa label, dan jangan pernah
menampilkan angka nol sebagai pengganti "tidak ada data".

---

## 8. Prinsip penamaan

- Label tombol = kata kerja + objek: "Kirim perintah", "Setujui aturan", bukan "OK".
- Nama status memakai istilah sistem yang sama dengan backend (`AUTO`, `MANUAL`,
  `HOLD`, `FAULT`, `IDLE`) agar operator dan log berbicara bahasa yang sama.
- Satuan selalu eksplisit di label: `cm`, `L/detik`, `%`, `V`, `dBm`.
- Waktu selalu `WITA` dan format `14:32 WITA · 12 Okt` (bukan `14:32:07.123`).

---

## 9. Aksesibilitas & responsif (ringkas)

- Target sentuh minimum 44×44 px; jarak antar kontrol ≥ 8 px.
- Bottom nav mobile aman terhadap `safe-area-inset-bottom`.
- Tabel → kartu pada `< 768 px`; kolom prioritas tetap terlihat (waktu, gate, nilai).
- Grafik punya alternatif tabel (toggle "Tabel") untuk pembaca layar.
- Fokus keyboard terlihat (`:focus-visible` 2 px outline teal) dan urutan tab logis.
- Warna bukan satu-satunya pembeda status: selalu ada ikon/teks.
