# 04 — UI Design System (High-Fidelity)

**SUBAKO Web-PWA v0.1** · Bahasa visual, token, komponen, aksesibilitas

Prototipe high-fidelity yang dapat diklik ada di [`../design/`](../design/index.html).
Dokumen ini menjelaskan **aturan** di balik prototipe tersebut agar implementasi tidak
menyimpang saat dibangun dengan React.

---

## 1. Arah desain

Tiga kata: **tenang, presisi, terukur.**

| Sumber inspirasi | Yang diambil | Yang dihindari |
|---|---|---|
| Dashboard industrial IoT | Kepadatan informasi terkendali, status jelas, angka besar | Neon, glow, gradien berlebihan |
| Identitas sawah Bali | Hijau hutan, tekstur halus, ruang lega | Ornamen dekoratif, motif yang mengganggu keterbacaan |
| Alat ukur lapangan | Angka + satuan jelas, toleransi terlihat, timestamp selalu ada | Angka tanpa konteks waktu/sumber |

Prinsip visual:

1. **Data dulu, dekorasi kemudian.** Setiap elemen harus membantu keputusan.
2. **Satu warna aksi.** Hanya teal yang menandakan sesuatu bisa ditekan.
3. **Status selalu ganda.** Warna + ikon + teks (tidak pernah warna saja).
4. **Angka besar, metadata kecil tapi terbaca.** Minimum 12 px, kontras ≥ 4,5:1.
5. **Ruang kosong sebagai pemisah, bukan garis.** Border 1 px hanya untuk tabel/kartu.

---

## 2. Design token

Didefinisikan sebagai CSS custom properties di `design/assets/app.css` dan akan
dipetakan ke `tailwind.config.ts` saat implementasi.

### 2.1 Warna brand

| Token | Hex | Pemakaian |
|---|---|---|
| `--forest-900` | `#0B2E28` | Sidebar aktif, teks pada badge terang |
| `--forest-800` | `#10443B` | Primary brand, header, sidebar |
| `--forest-700` | `#175C4F` | Hover pada elemen forest |
| `--teal-700` | `#0F7A6B` | **Fill tombol utama** (kontras 5,2:1 dengan putih) |
| `--teal-600` | `#159D8A` | Aksen grafik, indikator, garis fokus |
| `--teal-100` | `#D6EFEA` | Latar chip/aksi sekunder |
| `--soft-green` | `#E9F3EC` | Latar section, kartu sekunder |
| `--white` | `#FFFFFF` | Latar utama |
| `--ink` | `#172C30` | Teks utama (14,6:1 di atas putih) |
| `--slate` | `#64748B` | Teks sekunder (4,76:1 di atas putih) |
| `--line` | `#E2E8EC` | Garis tabel, divider |
| `--warning` | `#E8A23B` | Status peringatan (fill; teks pakai `--warning-ink`) |
| `--warning-ink` | `#8A5A12` | Teks peringatan di atas latar terang |
| `--warning-bg` | `#FDF4E3` | Latar badge peringatan |
| `--critical` | `#D84C4C` | Indikator kritikal, garis grafik |
| `--critical-ink` | `#B83A3A` | **Fill tombol destruktif** (5,7:1 dengan putih) |
| `--critical-bg` | `#FDECEC` | Latar badge kritikal |
| `--info` | `#2E6F9E` | Info netral |
| `--info-bg` | `#EAF2F8` | Latar info |

### 2.2 Rasio kontras yang sudah dihitung

Angka di bawah dihitung dengan formula WCAG 2.1 (relative luminance). Nilai yang gagal
tidak dipakai untuk teks; warna tersebut hanya dipakai sebagai *fill* atau garis.

| Kombinasi | Rasio | Nilai |
|---|---|---|
| `--ink` #172C30 pada putih | **14,6 : 1** | AAA |
| Putih pada `--forest-800` #10443B | **10,9 : 1** | AAA |
| Putih pada `--teal-700` #0F7A6B | **5,2 : 1** | AA |
| Putih pada `--teal-600` #159D8A | 3,4 : 1 | **Gagal untuk teks normal** → hanya untuk garis/ikon besar |
| `--slate` #64748B pada putih | **4,76 : 1** | AA |
| Putih pada `--critical-ink` #B83A3A | **5,7 : 1** | AA |
| Putih pada `--critical` #D84C4C | 4,15 : 1 | Gagal tipis → jangan untuk teks putih |
| `--warning-ink` #8A5A12 pada `--warning-bg` | **6,9 : 1** | AA |
| `--ink` pada `--warning` #E8A23B | **6,7 : 1** | AA (badge gelap di atas kuning) |

**Konsekuensi implementasi:** tombol utama memakai `--teal-700`, bukan `--teal-600`.
Ini perbedaan dari palet brand mentah dan disengaja demi aksesibilitas; PO perlu
menyetujui (lihat `11-keputusan-terbuka.md` K-09).

### 2.3 Skala tipografi

Font: **Inter** (fallback `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`).
Angka sensor memakai `font-variant-numeric: tabular-nums` agar tidak bergeser saat update.

| Token | Ukuran / line-height | Berat | Pemakaian |
|---|---|---|---|
| `display` | 40 / 44 px | 700 | Angka sensor hero (debit, level) |
| `h1` | 28 / 34 px | 700 | Judul halaman |
| `h2` | 20 / 28 px | 600 | Judul kartu |
| `h3` | 16 / 24 px | 600 | Sub-judul |
| `body` | 14 / 22 px | 400 | Teks umum |
| `body-strong` | 14 / 22 px | 600 | Nilai pada tabel |
| `meta` | 12 / 18 px | 500 | Timestamp, satuan, label |
| `micro` | 11 / 16 px | 600 | Badge, kolom sempit (uppercase, letter-spacing .04em) |

### 2.4 Spacing, radius, elevasi

- Skala spasi 4 px: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Radius: `sm 6px` (chip), `md 10px` (input, tombol), `lg 14px` (kartu), `xl 20px` (panel besar).
- Elevasi hanya dua: `shadow-sm` (kartu) `0 1px 2px rgba(16,68,59,.06), 0 1px 3px rgba(16,68,59,.08)`;
  `shadow-lg` (dropdown/modal) `0 12px 32px rgba(16,68,59,.16)`.
- Border: `1px solid var(--line)` pada kartu & tabel. Tidak ada border ganda.

### 2.5 Grid & breakpoint

| Breakpoint | Lebar | Layout |
|---|---|---|
| `sm` | < 640 px | 1 kolom, bottom nav, kartu penuh |
| `md` | 640–1023 px | 2 kolom, sidebar menjadi rail ikon (72 px) |
| `lg` | 1024–1439 px | Sidebar 248 px + konten, KPI 4 kolom |
| `xl` | ≥ 1440 px | Konten maksimum 1440 px, gutter 32 px |

Sidebar desktop 248 px tetap; pada `md` menyusut menjadi rail ikon dengan tooltip.
Top bar 64 px: site selector, mode data badge, notifikasi, profil.

---

## 3. Komponen

### 3.1 Inventaris

| Komponen | Varian | Catatan implementasi |
|---|---|---|
| `AppShell` | desktop rail / mobile bottom nav | Satu komponen, dua mode |
| `SiteSwitcher` | select + pencarian | Menyimpan pilihan di URL |
| `DataModeBadge` | `LIVE`, `DEMO`, `MIXED (dilarang)` | Persisten, tidak bisa ditutup |
| `FreshnessBadge` | `LIVE`, `STALE`, `OFFLINE` | Menampilkan umur data (`2 mnt lalu`) |
| `KpiCard` | default, warning, critical, skeleton | Nilai + satuan + delta + sparkline opsional |
| `StatusPill` | online/offline/fault/manual/hold/auto/idle | Ikon + teks, bukan warna saja |
| `SensorValue` | inline, stacked, hero | tabular-nums, satuan selalu tampil |
| `ChartCard` | line, area, bar, dual-axis | Slot toggle "Grafik / Tabel" |
| `DataTable` | desktop tabel, mobile kartu | Kolom prioritas, sticky header, sort |
| `FilterBar` | inline, drawer (mobile) | Chip filter aktif + reset |
| `AlertRow` | compact, expanded | Severity bar di kiri (4 px) |
| `GateControlPanel` | enabled, blocked(reason), pending, expired | Tidak ada state "sukses" tanpa ACK |
| `CommandTimeline` | vertical stepper | SENT → ACK → EXECUTED/REJECTED/EXPIRED |
| `RuleLifecycleStepper` | horizontal | Draft → Review → Approved → Published |
| `VersionDiff` | side-by-side | Perubahan entitlement/jam per versi |
| `LedgerEntryRow` | default, compensation | Hash pendek + tooltip hash penuh |
| `HashChainVerify` | idle, running, valid, invalid | Hasil per rentang |
| `EmptyState` | no-data, no-permission, no-device | Selalu punya aksi lanjut |
| `Toast` | info, success, warning, error | Maks 4 s; tidak untuk status command |
| `ConfirmDialog` | standard, destructive-typed | Untuk command: ketik `BUKA 40` |
| `OfflineBanner` | offline, reconnected | Menyebut timestamp cache |
| `InstallPrompt` | banner halus | Muncul setelah 2 sesi, bukan saat load |

### 3.2 Anatomi KpiCard

```text
┌─────────────────────────────────┐
│ LABEL (micro, slate)      [ikon]│
│ 37,6  L/detik                   │  ← display, tabular
│ ▲ +2,1 vs 1 jam lalu   ● LIVE   │  ← meta + freshness
│ ▁▂▃▅▆▅▄▃ (sparkline 24 titik)   │
└─────────────────────────────────┘
```

Aturan: bila `freshness != LIVE`, nilai diredupkan 60% dan badge `STALE` wajib tampil;
bila `no-data`, tampilkan `—` (em dash), **bukan** `0`.

### 3.3 Anatomi GateControlPanel

| State | Tampilan |
|---|---|
| `IDLE`/`AUTO` + permission | Dua tombol (Buka/Tutup), input target %, textarea alasan, tombol kirim aktif setelah valid |
| `HOLD` | Tombol aktif dengan peringatan kuning "Mode HOLD aktif — butuh izin override" |
| `MANUAL` | Panel kuning: "Operasikan manual di lokasi", tombol diganti tombol bantuan |
| `FAULT` | Panel merah: alasan fault, langkah E-STOP/handwheel, kontak admin |
| Pending | Tombol nonaktif + stepper + countdown `expires_in` |
| Expired/Unknown | Panel abu: "Status tidak diketahui — verifikasi di lokasi", tombol buat command baru |

### 3.4 Status & ikon

| Status | Ikon | Warna | Teks |
|---|---|---|---|
| LIVE / OK | `●` penuh | teal-600 | LIVE |
| STALE | `◐` setengah | warning | STALE · 4 mnt |
| OFFLINE | `○` kosong | slate | OFFLINE |
| FAULT | `⚠` | critical | FAULT |
| MANUAL | `✋` | warning | MANUAL |
| HOLD | `⏸` | warning | HOLD |
| AUTO | `⟳` | teal-700 | AUTO |
| IDLE | `—` | slate | IDLE |

Ikon dirender sebagai SVG 16 px (`stroke-width: 2`), bukan emoji, pada implementasi.

---

## 4. Pola data & keselamatan di UI

1. **Timestamp selalu terlihat** di kartu yang menampilkan nilai sensor (kanan atas,
   `meta`, slate). Format: `14:32 WITA`.
2. **Satuan tidak pernah dipisah baris** dari angka pada mobile.
3. **Grafik punya penanda gap.** Bila ada jeda > 2× interval, garis diputus, bukan
   diinterpolasi. Area kosong diberi label `data tidak tersedia`.
4. **Ambang aman digambar** sebagai garis putus-putus dengan label (`Batas normal 1,2 m`).
5. **Mode DEMO:** badge kuning di top bar + garis tepi kuning 2 px pada seluruh area
   konten + footer "Data simulasi, bukan kondisi lapangan". Tidak dapat disembunyikan.
6. **Kontrol tidak pernah muncul di peta.** Klik marker hanya membuka detail.
7. **Konfirmasi destruktif** untuk command: mengetik ulang target (`BUKA 40`) agar tidak
   terjadi salah tekan.
8. **`prefers-reduced-motion`** mematikan animasi transisi dan pulse; nilai tetap
   diperbarui tanpa animasi.

---

## 5. Responsif: perubahan per modul

| Modul | Desktop | Tablet | Mobile |
|---|---|---|---|
| Dashboard | KPI 4 kolom, peta 2/3 + alert 1/3 | KPI 2 kolom, peta penuh, alert di bawah | KPI 1 kolom horizontal-scroll? **tidak** — stack; peta tinggi 200 px |
| Monitoring | Grafik 2 kolom, tabel penuh | Grafik 1 kolom | Satu kartu per gate; tabel → kartu; filter jadi drawer |
| Gate detail | 2 kolom + grafik penuh | 2 kolom rapat | 1 kolom; panel aksi sticky di bawah |
| Ledger | Tabel 8 kolom | Tabel 5 kolom + detail sheet | Kartu per entri |
| Rules | Tabel + panel versi | Tabel + drawer | Kartu + stepper vertikal |
| Reports | Form + preview PDF | Form penuh | Form + unduh saja (preview disembunyikan) |

Panel aksi gate pada mobile memakai `position: sticky; bottom: calc(64px + safe-area)`
sehingga tetap terjangkau tanpa menutupi data.

---

## 6. Motion

- Durasi: `120 ms` (hover/press), `200 ms` (panel/buka-tutup), `320 ms` (halaman).
- Easing: `cubic-bezier(.2,.8,.2,1)`.
- Tidak ada animasi loop kecuali indikator live (`pulse` 2 s) dan skeleton (`shimmer`).
- Angka sensor yang berubah tidak dianimasikan menghitung naik (hindari kesan "grafik
  bergerak" saat data sebenarnya statis); cukup fade 120 ms.

---

## 7. Aksesibilitas

| Kriteria | Implementasi |
|---|---|
| Kontras | Semua teks ≥ 4,5:1 (lihat §2.2) |
| Fokus | `outline: 2px solid var(--teal-600); outline-offset: 2px` |
| Target sentuh | ≥ 44 px pada mobile, ≥ 40 px desktop |
| Label | Semua input punya `<label>`; ikon-only punya `aria-label` |
| Live region | Nilai sensor kritis memakai `aria-live="polite"`, bukan `assertive` |
| Grafik | `<figure>` + `aria-describedby` ringkasan teks + toggle tabel |
| Warna status | Selalu disertai ikon + teks |
| Zoom 200% | Tidak ada horizontal scroll pada 320 px width |
| Bahasa | `lang="id"` pada `<html>` |

---

## 8. Yang sengaja tidak dipakai

- **Dark mode** untuk v0.1: belum ada kebutuhan lapangan dan menambah biaya QA; token
  sudah disiapkan agar dapat ditambahkan tanpa refactor.
- **Gradient dekoratif**, glassmorphism, ilustrasi besar di dashboard.
- **Grafik 3D / gauge setengah lingkaran** — lebih sulit dibaca daripada angka + garis.
- **Peta satelit default** — tile jalan/netral lebih jelas untuk marker status dan lebih
  ringan di koneksi lapangan.
