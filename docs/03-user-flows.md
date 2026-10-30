# 03 — User Flow Diagram

**SUBAKO Web-PWA v0.1** · Alur kritis yang menentukan keputusan arsitektur

Delapan alur di bawah dipilih karena masing-masing memiliki titik keputusan yang, bila
salah, berakibat pada keselamatan, keabsahan tata kelola, atau integritas catatan.

---

## 1. Login & sesi

```mermaid
flowchart TD
    A["Buka aplikasi"] --> B{"Ada refresh token<br/>cookie HttpOnly?"}
    B -->|"Tidak"| L["/login"]
    B -->|"Ya"| R["POST /auth/refresh"]
    R -->|"200"| S["Simpan access token<br/>di memori (15 mnt)"]
    R -->|"401"| L
    S --> D["/dashboard sesuai role"]
    L --> F["Input email + password"]
    F --> P["POST /auth/login<br/>(rate limit 5/menit/IP)"]
    P -->|"200"| S
    P -->|"401"| E1["Pesan generik:<br/>'Email atau password salah'"]
    P -->|"423"| E2["Akun terkunci 15 menit<br/>+ arahkan ke Pekaseh"]
    P -->|"429"| E3["Tunggu, tampilkan sisa waktu"]
    S --> M["GET /auth/me<br/>role, permissions, sites"]
    M --> C{"Site access<br/>kosong?"}
    C -->|"Ya"| N["Halaman 'Belum ada akses site'<br/>+ kontak Pekaseh"]
    C -->|"Tidak"| D
```

Aturan:

- Password salah tidak pernah menyebut apakah email terdaftar.
- Setelah 5 kegagalan, akun `locked_until = now + 15 mnt` dan dicatat di `audit_events`.
- Access token tidak pernah masuk `localStorage`/`sessionStorage`.
- Idle 30 menit → sesi berakhir (refresh token di-revoke), PWA menampilkan layar kunci.

---

## 2. Dashboard → alert → acknowledge → resolve

```mermaid
flowchart TD
    D["Dashboard"] --> A{"Ada alert terbuka?"}
    A -->|"Tidak"| K["Kartu 'Tidak ada gangguan'"]
    A -->|"Ya"| L["Daftar alert<br/>urut severity, waktu"]
    L --> X["Pilih alert"]
    X --> DET["Detail: device, evidence,<br/>suggested_action, owner"]
    DET --> Q{"Pengguna punya<br/>alert.acknowledge?"}
    Q -->|"Tidak"| V["Lihat saja + tombol<br/>'Laporkan ke operator'"]
    Q -->|"Ya"| ACK["POST /alerts/:id/acknowledge<br/>{note, assigned_to}"]
    ACK --> S1["Status ACKNOWLEDGED<br/>tercatat: siapa, kapan"]
    S1 --> W{"Gangguan selesai?"}
    W -->|"Belum"| H["Pantau; eskalasi bila<br/>severity naik"]
    W -->|"Ya"| RES["POST /alerts/:id/resolve<br/>{resolution, evidence, sensor_ref}"]
    RES --> S2["Status RESOLVED<br/>masuk riwayat"]
    S2 --> AUD["audit_events + ledger<br/>(bila ada aktivitas pintu)"]
```

Catatan: alert otomatis tidak pernah menutup dirinya sendiri tanpa bukti pemulihan
(telemetri baru dengan quality `OK` selama ≥ 2 siklus), dan **tidak pernah** memicu
command. Lihat §7 di bawah untuk batas AI.

---

## 3. Command aktuasi pintu (paling kritis)

```mermaid
flowchart TD
    A["Detail Pintu"] --> B{"mode perangkat?"}
    B -->|"FAULT"| F1["Tombol nonaktif.<br/>Alasan fault + instruksi:<br/>E-STOP, handwheel, hubungi admin"]
    B -->|"MANUAL"| F2["Tombol nonaktif.<br/>'Operasikan manual di lokasi'"]
    B -->|"AUTO / IDLE / HOLD"| C{"permission gate.command?"}
    C -->|"Tidak"| F3["Panel read-only +<br/>'Minta operator'"]
    C -->|"Ya"| D["Form: aksi, target %, alasan"]
    D --> V["Validasi klien (Zod)<br/>+ tampilkan rule yang berlaku"]
    V --> E["POST /gates/:id/commands<br/>Idempotency-Key"]
    E --> G{"9 lapis validasi backend"}
    G -->|"Gagal"| R1["Tampilkan kode + alasan<br/>mis. RULE_EXPIRED,<br/>STALE_TELEMETRY, MODE_MANUAL"]
    G -->|"Lolos"| H["command_id, status SENT<br/>countdown expires_in"]
    H --> I{"ACK diterima<br/>≤ 90 s?"}
    I -->|"Tidak"| T["status EXPIRED/UNKNOWN<br/>'Status tidak diketahui —<br/>periksa di lokasi'"]
    I -->|"ACK reject"| J["status REJECTED + alasan perangkat<br/>(interlock, HMAC, posisi)"]
    I -->|"ACK accept"| K["status ACKNOWLEDGED<br/>menunggu posisi aktual"]
    K --> L{"Telemetri posisi<br/>dalam toleransi ±3%?"}
    L -->|"Ya"| M["EXECUTED + entri ledger"]
    L -->|"Tidak, ≤ 2 siklus"| L
    L -->|"Tidak, > 2 siklus"| N["ENCODER_MISMATCH alert<br/>+ status DIVERGED"]
```

Aturan yang tidak boleh dilanggar:

- Tombol **tidak** pernah menampilkan "berhasil" sebelum `EXECUTED`.
- Tidak ada tombol "coba lagi" untuk command `EXPIRED`/`UNKNOWN`; pengguna harus
  membuat command baru (yang berarti validasi ulang penuh).
- Tidak ada aksi dari peta, dari notifikasi, atau dari bulk action.

---

## 4. Siklus hidup aturan air (governance)

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Pekaseh membuat draft<br/>(referensi Paruman wajib)
    DRAFT --> DRAFT: edit (boleh, versi belum aktif)
    DRAFT --> IN_REVIEW: submit<br/>(validasi kelengkapan)
    IN_REVIEW --> DRAFT: kembalikan untuk revisi
    IN_REVIEW --> APPROVED: approve oleh Pekaseh<br/>(bukan pembuat, bila kebijakan 4-eyes)
    IN_REVIEW --> REJECTED: reject + alasan (wajib)
    APPROVED --> PUBLISHED: publish (menetapkan effective_from)
    PUBLISHED --> SUPERSEDED: ada versi baru yang published
    PUBLISHED --> EXPIRED: effective_to terlewati
    APPROVED --> EXPIRED: tidak dipublikasikan sampai effective_from
    REJECTED --> [*]
    EXPIRED --> [*]
    SUPERSEDED --> [*]
```

```mermaid
flowchart LR
    A["Draft v1"] -->|"submit"| B["In review"]
    B -->|"approve"| C["Approved v1"]
    C -->|"publish"| D["Published v1<br/>(aktif 1-15 Nov)"]
    D -->|"butuh perubahan"| E["Draft v2<br/>(salinan v1, immutable link)"]
    E -->|"submit → approve → publish"| F["Published v2"]
    F --> G["v1 → SUPERSEDED<br/>(tetap dapat dibaca)"]
```

Aturan:

- Setiap perubahan = record baru di `water_rule_versions` dengan `version_no + 1`.
- `PUT`/`PATCH` pada rule `PUBLISHED` ditolak `409 RULE_IMMUTABLE`.
- Publish menolak bila: tidak ada approval valid, `effective_from` di masa lalu,
  entitlement total > 100% (bila mode proporsi), atau gate target tidak ada di site.
- Profil pemisahan tugas: pembuat rule **tidak** dapat menyetujui rule-nya sendiri
  bila `separation_of_duties=true` (default untuk pilot, dapat dimatikan PO).

---

## 5. Jadwal distribusi (sudut pandang Petani)

```mermaid
flowchart TD
    A["/schedule"] --> B["Pilih tanggal (default hari ini, WITA)"]
    B --> C["GET /schedule?date=&site_id="]
    C --> D{"Ada rule published<br/>yang mencakup tanggal?"}
    D -->|"Tidak"| E["'Tidak ada jadwal berlaku'<br/>+ info rule terakhir & kontak Pekaseh"]
    D -->|"Ya"| F["Timeline giliran per tempek:<br/>jam mulai–selesai, gate, hak air"]
    F --> G["Baris 'giliran Anda' disorot<br/>bila user terhubung ke tempek"]
    G --> H["Lihat realisasi:<br/>debit terukur vs target, deviasi"]
    H --> I["Unduh ringkasan (PDF) /<br/>tambahkan ke kalender (.ics)"]
```

---

## 6. Water Ledger: verifikasi & koreksi

```mermaid
flowchart TD
    A["/ledger"] --> B["Filter site, periode, jenis"]
    B --> C["Daftar entri + hash pendek"]
    C --> D{"Verifikasi?"}
    D -->|"Ya"| E["GET /ledger/verify?from=&to="]
    E --> F{"rantai utuh?"}
    F -->|"Ya"| G["Tampilkan: n entri,<br/>seal harian cocok,<br/>hash terakhir"]
    F -->|"Tidak"| H["ALERT KRITIKAL:<br/>entri mana, sejak kapan,<br/>eskalasi ke admin + Pekaseh"]
    C --> I{"Perlu koreksi?"}
    I -->|"Ya, ada permission<br/>ledger.correct"| J["Form entri kompensasi<br/>(bukan edit): alasan,<br/>referensi entri asal"]
    J --> K["Entri baru COMPENSATION<br/>menunjuk original_entry_id"]
    K --> L["Kedua entri tetap terlihat;<br/>saldo/volume disesuaikan"]
    C --> M["Ekspor CSV/PDF<br/>(disertai hash chain potongan)"]
```

Aturan: tidak ada endpoint `PATCH /ledger/:id` dan tidak ada `DELETE`.
Entri kompensasi wajib punya `reason` ≥ 20 karakter dan `original_entry_id`.

---

## 7. Batas AI/anomalytics (advisory-only)

```mermaid
flowchart LR
    T["telemetry"] --> AN["Analytics worker<br/>threshold · rolling avg · z-score"]
    AN --> AD["anomaly_insights<br/>(jenis, evidence, confidence)"]
    AD --> AL["alerts (severity dari anomali)"]
    AD --> UI["Kartu 'Indikasi Anomali'<br/>di dashboard & detail gate"]
    AN -.->|"TIDAK ADA JALUR"| CMD["command service"]
    style CMD fill:#ffe6e6,stroke:#b83a3a
    style AN fill:#e9f3ec,stroke:#0f7a6b
```

Kontrol arsitektural: modul `analytics` tidak mengimpor `command_service` (dijaga oleh
import-linter di CI). Rekomendasi anomali hanya menyentuh tabel `alerts` dan
`anomaly_insights`; keduanya tidak dibaca oleh jalur eksekusi command.

---

## 8. Offline & pemulihan koneksi (PWA)

```mermaid
flowchart TD
    A["Aplikasi terbuka"] --> B{"online?"}
    B -->|"Ya"| C["Fetch normal + WS connect"]
    B -->|"Tidak"| D["Tampilkan data terakhir dari cache<br/>+ badge OFFLINE + timestamp"]
    D --> E{"Aksi pengguna"}
    E -->|"Lihat data"| F["Baca cache (read-only)"]
    E -->|"Kirim command"| G["Tombol nonaktif:<br/>'Perintah memerlukan koneksi'"]
    E -->|"Filter/grafik"| H["Boleh, dari cache<br/>(label STALE)"]
    C --> I{"Koneksi pulih"}
    I --> J["Reconnect WS + resubscribe"]

    J --> K["Refetch snapshot terkini<br/>(bukan replay)"]
    K --> L["Hapus antrean yang tidak ada:<br/><b>tidak ada antrean command</b>"]
    L --> M["Tampilkan: 'Terhubung kembali · data 14:35 WITA'"]
```

Hal yang **tidak** terjadi saat kembali online: pengiriman ulang command, replay
mutasi, atau penanda "berhasil" pada aksi yang tidak pernah terkirim.

---

## 9. Provisioning & commissioning perangkat (Admin)

```mermaid
flowchart TD
    A["/admin/devices → Tambah"] --> B["Input devEUI, tipe, capability"]
    B --> C["Status UNPROVISIONED<br/>data_mode=SIMULATION"]
    C --> D["Assign ke site & gate"]
    D --> E["Generate device secret<br/>(ditampilkan sekali, disimpan ke secret store)"]
    E --> F["Kirim konfigurasi ke ChirpStack<br/>(profil perangkat, keys via API)"]
    F --> G["Uji uplink pertama<br/>→ device_health LIVE?"]
    G -->|"Tidak"| H["Troubleshoot: RSSI, join, FCnt,<br/>ACL topic"]
    G -->|"Ya"| I["Kalibrasi: offset level/flow,<br/>calibration_records v1"]
    I --> J["Uji command aman<br/>(gerak kecil, area steril, pengawas)"]
    J --> K["Commissioning checklist ditandatangani"]
    K --> L["data_mode=LIVE,<br/>device ACTIVE"]
```

Verifikasi fisik (E-STOP, limit switch, handwheel) adalah **prasyarat** dan bukan bagian
dari alur software; hasilnya dicatat sebagai `commissioning_records` + audit.
