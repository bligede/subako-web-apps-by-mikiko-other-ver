# 11 — Keputusan Terbuka (butuh persetujuan Product Owner)

Setiap item berisi: **pertanyaan**, **opsi**, **rekomendasi tim**, **dampak bila salah**,
dan **kapan dibutuhkan**.

Prioritas:

- 🔴 **BLOCKING** — harus dijawab sebelum Phase 1 bisa dimulai.
- 🟡 **PERLU SEGERA** — dibutuhkan dalam 2 sprint pertama; ada asumsi sementara.
- 🟢 **DAPAT DITUNDA** — tidak menahan implementasi.

---

## K-01 🔴 Sumber otoritas Paruman & bentuk referensinya

**Pertanyaan.** Bagaimana Paruman/Pekaseh mendokumentasikan keputusan hak air, dan
apakah SUBAKO harus menyimpan salinan dokumennya?

**Opsi.**

| Opsi | Deskripsi | Konsekuensi |
|---|---|---|
| A | Hanya referensi teks (nomor + tanggal rapat + judul) | Cepat, tetapi tidak ada bukti dokumen |
| B | Referensi + unggah scan/PDF (object storage) | Jejak lebih kuat, perlu kebijakan retensi & akses file |
| C | Referensi + tanda tangan digital Pekaseh | Paling kuat, butuh infrastruktur TTE |

**Rekomendasi:** **B** untuk v0.1 (unggah PDF opsional, maks 10 MB), C dievaluasi
setelah pilot.

**Dampak bila salah:** tanpa referensi, ledger tidak dapat membuktikan dasar hukum
eksekusi; audit tata kelola lemah.

**Dibutuhkan:** sebelum Phase 5 (minggu 11).

---

## K-02 🔴 Model hak air: proporsi, volume, atau jadwal giliran?

**Pertanyaan.** Apakah Subak pilot menggunakan pembagian **proporsional (%)**,
**kuota volume (m³/hari)**, **giliran waktu (rotasi)**, atau kombinasi?

**Opsi.**

| Opsi | Data minimum | Catatan |
|---|---|---|
| A Proporsi | `entitlement_pct` per tempek, total = 100% | Paling umum di Subak; mudah diverifikasi dari debit |
| B Kuota volume | `entitlement_m3_per_day` | Butuh pengukuran debit akurat sepanjang waktu |
| C Rotasi waktu | `water_schedules` (mulai/selesai) | Tidak butuh flow meter, hanya gate + level |
| D Kombinasi A+C | Proporsi + jendela waktu | Realistis, tetapi UI lebih kompleks |

**Rekomendasi:** **D**, dengan v0.1 mengimplementasikan C lebih dulu (paling sedikit
ketergantungan sensor), lalu A. Skema DB sudah mendukung keduanya.

**Dampak bila salah:** rule tidak dapat dipakai di lapangan → Pekaseh kembali ke catatan
manual, dan adopsi gagal.

**Dibutuhkan:** sebelum Phase 5; workshop SME di Phase 1.

---

## K-03 🔴 Ketersediaan sensor debit (flow) di pilot

**Pertanyaan.** Apakah node pilot memiliki sensor debit, atau hanya level + posisi gate?

**Opsi.**

| Opsi | Konsekuensi UI/ledger |
|---|---|
| A Ada flow meter per gate | Volume tercatat `MEASURED`; laporan deviasi kuat |
| B Tanpa flow meter | Volume `ESTIMATED` dari bukaan + level (dengan rumus yang disepakati) atau `MISSING` |
| C Flow hanya di bangunan bagi utama | Volume dibagi proporsional; ditandai `ESTIMATED` |

**Rekomendasi:** rancang untuk **A** tetapi **jangan** menampilkan angka estimasi
sebagai terukur. Bila B, ledger memakai `measurement_status='ESTIMATED'` dan laporan
menampilkan disclaimer.

**Dampak bila salah:** menampilkan volume estimasi seolah terukur = pelanggaran
Pasal 6 & 15.

**Dibutuhkan:** sebelum Phase 5 (bentuk laporan), idealnya sebelum Phase 3.

---

## K-04 🟡 Apakah Petani dibatasi per tempek?

**Pertanyaan.** Apakah `VIEWER` boleh melihat seluruh site, atau hanya tempek-nya?

**Opsi.** A) Seluruh site (transparansi penuh) · B) Hanya tempek-nya (privasi antar
petani) · C) Seluruh site untuk data air, tempek sendiri untuk data pribadi.

**Rekomendasi:** **C** — data air transparan (sesuai semangat Subak), data pribadi
dibatasi. Implementasi: `ledger.view` site-wide; `members` hanya untuk tempek sendiri.

**Dampak:** mempengaruhi query filter dan jumlah test otorisasi (+1 hari).

**Dibutuhkan:** Phase 2 (UI) / Phase 3 (filter).

---

## K-05 🟡 Apakah VIEWER boleh mengekspor Water Ledger?

**Pertanyaan.** `ledger.export` saat ini hanya untuk Operator ke atas.

**Opsi.** A) Ya, ekspor per periode milik tempek-nya · B) Tidak, hanya lihat di aplikasi
· C) Ya, tetapi hanya ringkasan PDF (bukan CSV mentah).

**Rekomendasi:** **C** — transparansi tanpa membuka data mentah untuk disalahgunakan.

**Dampak:** kecil; hanya permission + endpoint.

**Dibutuhkan:** Phase 5.

---

## K-06 🔴 Siapa pemegang secret perangkat dan bagaimana signing dilakukan?

**Pertanyaan.** Baseline engineering menyebut HMAC-SHA256 per perangkat dan kemungkinan
tool signing offline. Apakah signing dilakukan server (secret di server) atau tetap
offline?

**Opsi.**

| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| A Server memegang secret device (`DEVICE_SECRET_STORE=file|vault`) | Operasional normal, latency rendah | Server menjadi target bernilai tinggi |
| B Tool signing offline di workstation admin | Secret tidak di server | Tidak scalable, latency menit, tidak cocok untuk operasi harian |
| C HSM/KMS dengan key per device | Paling aman | Biaya & kompleksitas untuk pilot |

**Rekomendasi:** **A** untuk pilot dengan kontrol: file secret terenkripsi (age/sops)
di Docker secret, akses root-only, audit setiap pemakaian, rotasi saat commissioning
ulang. Desain service boundary memungkinkan pindah ke C tanpa mengubah kontrak.

**Dampak bila salah:** bila PO memilih B, seluruh alur command harian menjadi manual —
harus diketahui sekarang, bukan setelah Phase 3.

**Dibutuhkan:** **sebelum Phase 3** (minggu 7–9).

---

## K-07 🟡 Kanal notifikasi

**Pertanyaan.** Apakah cukup Web Push (browser) atau perlu WhatsApp/SMS?

**Opsi.** A) Web Push saja · B) Web Push + email · C) Tambah WhatsApp Business API.

**Rekomendasi:** **B** untuk v0.1. C memerlukan biaya per pesan, verifikasi template,
dan persetujuan; ditunda.

**Dampak:** menambah dependensi eksternal + biaya; mempengaruhi `notification_dispatch`.

**Dibutuhkan:** Phase 3 (worker notifikasi).

---

## K-08 🟢 Delegasi peran saat Pekaseh berhalangan

**Pertanyaan.** Perlukah mekanisme "Pekaseh pengganti" untuk jangka waktu tertentu?

**Rekomendasi:** belum di v0.1. Bila dibutuhkan, implementasi `role_delegations`
(`valid_from`, `valid_to`, audit) — 3 hari kerja.

---

## K-09 🟡 Persetujuan penyimpangan palet brand untuk aksesibilitas

**Pertanyaan.** Tombol utama memakai `--teal-700 #0F7A6B` (kontras 5,2:1) bukan
`#159D8A` (3,4:1, gagal AA untuk teks putih).

**Opsi.** A) Setujui penyimpangan (teal-700 untuk fill) · B) Pertahankan #159D8A dengan
teks gelap `#172C30` · C) Pertahankan persis seperti brand, abaikan AA.

**Rekomendasi:** **A**. Palet brand tetap dipakai untuk grafik, aksen, dan indikator
(3,4:1 cukup untuk elemen non-teks).

**Dampak:** konsistensi brand vs kepatuhan aksesibilitas; C ditolak tim.

**Dibutuhkan:** Phase 2.

---

## K-10 🟡 Zona waktu operasional & batas hari

**Pertanyaan.** Apakah "hari" untuk laporan dan seal ledger adalah 00:00–24:00 WITA?

**Rekomendasi:** ya, WITA (UTC+8) untuk semua batas hari; penyimpanan tetap UTC.
Seal harian dibuat 00:05 WITA untuk hari sebelumnya.

**Dampak:** salah zona = laporan harian tidak cocok dengan catatan Pekaseh.

**Dibutuhkan:** Phase 3.

---

## K-11 🟡 Kepatuhan data pribadi (UU PDP)

**Pertanyaan.** Data apa saja tentang petani/anggota yang boleh disimpan?

**Rekomendasi:** minimal — nama, peran lokal, tempek, luas lahan (opsional), nomor
telepon (opsional, hanya bila notifikasi diaktifkan). **Tidak** menyimpan NIK, alamat
rumah, atau data sensitif lain. Retensi: selama keanggotaan aktif + 1 tahun.

**Dampak:** mempengaruhi form user management, kebijakan ekspor, dan isi user manual.

**Dibutuhkan:** Phase 3 (user management).

---

## K-12 🟢 Ambang freshness default

**Pertanyaan.** Interval telemetri default 60 s → `STALE` > 120 s, `OFFLINE` > 300 s.

**Rekomendasi:** setujui sebagai default; dapat diubah per device saat provisioning.

**Dampak:** terlalu ketat = alert palsu; terlalu longgar = data basi dianggap live.

---

## K-13 🟡 Kebutuhan "hold" operasional

**Pertanyaan.** Siapa yang boleh melepas `HOLD` — hanya Pekaseh, atau juga Operator
dengan alasan?

**Rekomendasi:** hanya Pekaseh (`gate.command_override`), karena HOLD biasanya
dipakai saat kondisi khusus (upacara, perbaikan, konflik air).

**Dampak:** mempengaruhi RBAC (sudah tercermin di matriks) dan alur UI gate detail.

---

## K-14 🟢 Nama & domain produksi

**Pertanyaan.** Domain final (mis. `subako.mikiko.id`) dan nama tampilan aplikasi.

**Rekomendasi:** `subako.mikiko.id`; nama "SUBAKO" dengan tagline di halaman login.

---

## Ringkasan tindakan yang diminta

| # | Prioritas | Keputusan | Target |
|---|---|---|---|
| K-01 | 🔴 | Bentuk referensi Paruman (A/B/C) | sebelum minggu 11 |
| K-02 | 🔴 | Model hak air (A/B/C/D) | sebelum minggu 11, workshop di minggu 1 |
| K-03 | 🔴 | Ketersediaan flow meter | sebelum minggu 11 |
| K-06 | 🔴 | Pemegang secret & metode signing | **sebelum minggu 7** |
| K-04 | 🟡 | Batas akses Petani per tempek | sebelum minggu 5 |
| K-05 | 🟡 | Ekspor ledger untuk Petani | sebelum minggu 11 |
| K-07 | 🟡 | Kanal notifikasi | sebelum minggu 10 |
| K-09 | 🟡 | Palet tombol (aksesibilitas) | sebelum minggu 4 |
| K-10 | 🟡 | Batas hari WITA | sebelum minggu 8 |
| K-11 | 🟡 | Data pribadi yang disimpan | sebelum minggu 10 |
| K-13 | 🟡 | Wewenang melepas HOLD | sebelum minggu 9 |
| K-08, K-12, K-14 | 🟢 | — | kapan saja |

**Asumsi sementara yang dipakai bila keputusan belum ada** (agar pekerjaan tidak
berhenti): K-01=B, K-02=C lalu A, K-03=A (dengan status `ESTIMATED` bila tidak ada),
K-06=A, K-07=B, K-09=A, K-10=WITA, K-11=minimal, K-13=Pekaseh saja.
