# 09 — RBAC Permission Matrix

**SUBAKO Web-PWA v0.1** · Role-Based Access Control + site scoping

---

## 1. Model otorisasi

Dua dimensi yang **selalu** dievaluasi bersama:

```text
izin = permission(role) AND site_scope(user, site) >= level_yang_dibutuhkan
```

1. **Role** menentukan *jenis* tindakan yang boleh dilakukan (global).
2. **Site access** menentukan *di mana* tindakan itu boleh dilakukan (per site).
3. **Atribut objek** (mode gate, status rule, kepemilikan) menentukan apakah tindakan
   itu sah pada objek tersebut (dicek di service, bukan di router).

Tidak ada role yang otomatis mendapat akses ke seluruh site, termasuk Administrator
teknis: akses site untuk admin juga eksplisit (kecuali `site.manage` untuk membuat site
baru).

---

## 2. Role

| Kode | Nama | Deskripsi | Cakupan khas |
|---|---|---|---|
| `VIEWER` | Petani / Anggota | Melihat kondisi air, jadwal, histori, gangguan relevan | 1–2 site (site sendiri) |
| `OPERATOR` | Operator Subak | Monitoring + ack alert + command yang diotorisasi | 1 site, level `OPERATE` |
| `PEKASEH` | Pekaseh | Tata kelola air: rule, approval, laporan, ledger, user lokal | 1 site, level `GOVERN` |
| `ADMIN` | Administrator Teknis (Mikiko) | Provisioning, firmware, kalibrasi, audit teknis, kesehatan sistem | Semua site, level `ADMIN` |

Role bersifat **kumulatif ke bawah** hanya untuk *melihat*: `ADMIN` tidak otomatis
memperoleh `rule.approve`. Pemisahan otoritas teknis dan tata kelola dijaga secara
eksplisit, bukan warisan.

---

## 3. Site access level

| Level | Arti | Contoh kemampuan |
|---|---|---|
| `VIEW` | Baca data site | dashboard, telemetri, jadwal, ledger (baca) |
| `OPERATE` | Baca + operasional | ack alert, kirim command yang diotorisasi |
| `GOVERN` | Operasional + tata kelola | buat/setujui/publish rule, kelola user lokal, koreksi ledger |
| `ADMIN` | Teknis penuh | provisioning, kalibrasi, firmware, audit teknis |

Pemberian level dilakukan oleh `GOVERN` (untuk `VIEW`/`OPERATE`) dan `ADMIN` (untuk
`ADMIN`). Seorang Pekaseh tidak dapat memberi level `ADMIN` kepada siapa pun.

---

## 4. Permission code

| Domain | Permission | Deskripsi |
|---|---|---|
| Dashboard | `dashboard.view` | melihat ringkasan dashboard |
| Site | `site.view` | melihat daftar & detail site |
| Site | `site.manage` | membuat/mengubah site, koordinat, pengaturan |
| Telemetri | `telemetry.read` | membaca sensor & histori |
| Perangkat | `device.read` | melihat status & health perangkat |
| Perangkat | `device.manage` | register, provisioning, assignment, nonaktifkan |
| Perangkat | `calibration.manage` | mencatat/menerapkan kalibrasi |
| Perangkat | `gateway.manage` | mengelola gateway |
| Perangkat | `firmware.manage` | mengelola versi firmware & rollout |
| Pintu | `gate.read` | melihat gate, state, event |
| Pintu | `gate.command` | mengirim command aktuasi |
| Pintu | `gate.command_override` | command di luar rule aktif / melepas HOLD |
| Jadwal | `schedule.view` | melihat jadwal distribusi |
| Rule | `rule.view` | melihat rule & versi |
| Rule | `rule.create` | membuat/mengubah draft, submit |
| Rule | `rule.approve` | menyetujui/menolak |
| Rule | `rule.publish` | menerbitkan versi |
| Ledger | `ledger.view` | membaca entri & verifikasi |
| Ledger | `ledger.export` | mengekspor ledger |
| Ledger | `ledger.correct` | membuat entri kompensasi |
| Alert | `alert.view` | melihat alert |
| Alert | `alert.acknowledge` | acknowledge |
| Alert | `alert.resolve` | resolve |
| Laporan | `report.view` | melihat laporan |
| Laporan | `report.export` | ekspor PDF/Excel |
| User | `user.manage` | kelola pengguna & site access |
| Audit | `audit.read` | membaca audit teknis |
| Sistem | `system.health` | kesehatan sistem & integritas ledger |

---

## 5. Matriks role × permission

`✓` = diberikan · `—` = tidak diberikan · `S` = diberikan dengan syarat site scope level
tertentu (lihat kolom terakhir).

| Permission | VIEWER | OPERATOR | PEKASEH | ADMIN | Scope minimum |
|---|:--:|:--:|:--:|:--:|---|
| `dashboard.view` | ✓ | ✓ | ✓ | ✓ | VIEW |
| `site.view` | ✓ | ✓ | ✓ | ✓ | VIEW |
| `site.manage` | — | — | — | ✓ | ADMIN |
| `telemetry.read` | ✓ | ✓ | ✓ | ✓ | VIEW |
| `device.read` | — | ✓ | ✓ | ✓ | VIEW |
| `device.manage` | — | — | — | ✓ | ADMIN |
| `calibration.manage` | — | — | — | ✓ | ADMIN |
| `gateway.manage` | — | — | — | ✓ | ADMIN |
| `firmware.manage` | — | — | — | ✓ | ADMIN |
| `gate.read` | ✓ | ✓ | ✓ | ✓ | VIEW |
| `gate.command` | — | ✓ | ✓ | — | OPERATE |
| `gate.command_override` | — | — | ✓ | — | GOVERN |
| `schedule.view` | ✓ | ✓ | ✓ | ✓ | VIEW |
| `rule.view` | ✓ | ✓ | ✓ | ✓ | VIEW |
| `rule.create` | — | — | ✓ | — | GOVERN |
| `rule.approve` | — | — | ✓ | — | GOVERN |
| `rule.publish` | — | — | ✓ | — | GOVERN |
| `ledger.view` | ✓ | ✓ | ✓ | ✓ | VIEW |
| `ledger.export` | — | ✓ | ✓ | ✓ | VIEW |
| `ledger.correct` | — | — | ✓ | — | GOVERN |
| `alert.view` | ✓ | ✓ | ✓ | ✓ | VIEW |
| `alert.acknowledge` | — | ✓ | ✓ | ✓ | OPERATE |
| `alert.resolve` | — | ✓ | ✓ | ✓ | OPERATE |
| `report.view` | ✓ | ✓ | ✓ | ✓ | VIEW |
| `report.export` | — | ✓ | ✓ | ✓ | VIEW |
| `user.manage` | — | — | ✓ | ✓ | GOVERN |
| `audit.read` | — | — | — | ✓ | ADMIN |
| `system.health` | — | — | — | ✓ | ADMIN |

**Catatan penting**

1. `ADMIN` **tidak** memiliki `gate.command`, `rule.create`, `rule.approve`,
   `rule.publish`. Administrator teknis tidak dapat menggerakkan pintu atau mengubah hak
   air dari aplikasi — sesuai Pasal 7 dan Pasal 11.
2. `ADMIN` tetap dapat `alert.resolve` untuk gangguan teknis perangkat, tetapi
   penyelesaian yang menyentuh distribusi air wajib disertai catatan dan akan muncul di
   laporan aktivitas.
3. `VIEWER` dapat melihat `ledger.view` (transparansi) tetapi tidak dapat mengekspor
   massal (`ledger.export`) — kebijakan ini dapat diubah PO (lihat K-05).
4. `device.read` tidak diberikan ke `VIEWER` karena memuat RSSI/firmware/arus motor yang
   tidak relevan dan berpotensi membingungkan; `VIEWER` tetap melihat status ringkas
   perangkat pada halaman gate (online/offline) karena itu memengaruhi kepercayaan data.

---

## 6. Aturan objek (dicek di service, bukan router)

| Aksi | Syarat tambahan |
|---|---|
| `POST /gates/{id}/commands` | `gate_states.mode ∈ {AUTO, IDLE}`; `HOLD` butuh `gate.command_override`; `MANUAL`/`FAULT` selalu ditolak; freshness `LIVE`; tidak ada command in-flight |
| `POST /rules/{id}/approve` | `separation_of_duties = true` → approver ≠ `created_by`; role `PEKASEH`; site level `GOVERN` |
| `POST /rules/{id}/publish` | Ada ≥ 1 approval `APPROVED`; `effective_from ≥ today(WITA)`; entitlement total ≤ 100% (mode proporsional) |
| `PATCH /rules/{id}` | Hanya bila `current_status = DRAFT` |
| `POST /alerts/{id}/resolve` | Alert belum `RESOLVED`; `resolution` ≥ 10 karakter |
| `POST /ledger/compensations` | `original_entry_id` ada di site yang sama; `reason` ≥ 20 karakter |
| `POST /devices/{id}/provision` | Device `UNPROVISIONED`; site `PROVISIONING`; tidak mengaktifkan `LIVE` otomatis |
| `PATCH /admin/users/{id}` | Tidak dapat menurunkan role diri sendiri; tidak dapat menonaktifkan admin terakhir |
| `GET /admin/audit` | Filter site hanya untuk site dalam scope `ADMIN` |

---

## 7. Pemisahan tugas (separation of duties)

| Konflik kepentingan | Pencegahan |
|---|---|
| Pembuat rule menyetujui rule sendiri | `separation_of_duties` per site (default `true`) |
| Admin teknis menetapkan hak air | Role `ADMIN` tidak punya permission rule/governance |
| Operator mengubah histori | Tidak ada endpoint mutasi ledger/audit |
| Operator melewati interlock | `gate.command_override` hanya `PEKASEH`, alasan wajib, tercatat di ledger |
| Pekaseh memberi akses admin | Level `ADMIN` hanya dapat diberikan role `ADMIN` |
| Satu orang memegang semua role | Dilarang untuk pilot: aturan `max_roles_per_user = 1` (dapat dilonggarkan PO) |

---

## 8. Penegakan (enforcement)

```python
# backend/app/core/deps.py (ringkas)
def require(permission: str):
    async def _dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if permission not in user.permissions:
            raise AppError("FORBIDDEN", 403, f"Permission '{permission}' diperlukan")
        return user
    return _dep

class SiteScope:
    """Dimuat per request dari user_site_access."""
    def require(self, site_id: UUID, level: str = "VIEW") -> None:
        if self.level(site_id) < ORDER[level]:
            raise AppError("SITE_FORBIDDEN", 403, "Tidak ada akses ke site ini")

# repository wajib menerima scope
async def list_gates(scope: SiteScope, site_id: UUID, ...) -> list[Gate]:
    scope.require(site_id)
    return await session.scalars(
        select(Gate).where(Gate.site_id == site_id, Gate.site_id.in_(scope.site_ids))
    )
```

Penegakan berlapis:

1. **Router** — `Depends(require(...))`.
2. **Service** — `scope.require(...)` + aturan objek (§6).
3. **Repository** — filter `site_id IN scope` wajib.
4. **Database** — unique/trigger menjaga invarian data (bukan otorisasi).
5. **Frontend** — menyembunyikan UI yang tidak relevan (kosmetik saja).

---

## 9. Matriks pengujian otorisasi (wajib di CI)

| # | Skenario | Ekspektasi |
|---|---|---|
| 1 | VIEWER memanggil setiap endpoint mutasi | `403` (semua, parametrized) |
| 2 | OPERATOR memanggil `POST /rules` | `403` |
| 3 | PEKASEH memanggil `POST /devices` | `403` |
| 4 | ADMIN memanggil `POST /gates/{id}/commands` | `403` |
| 5 | ADMIN memanggil `POST /rules/{id}/approve` | `403` |
| 6 | User site A membaca site B (semua endpoint baca) | `403 SITE_FORBIDDEN` |
| 7 | User site A mengirim command ke gate site B | `403` |
| 8 | Pekaseh site A publish rule site B | `403` |
| 9 | Pembuat rule mencoba approve rule sendiri (SOE aktif) | `403 SOE_VIOLATION` |
| 10 | Operator mengirim command saat mode MANUAL | `409 MODE_BLOCKED` |
| 11 | Operator mengirim command saat FAULT | `409 MODE_BLOCKED` |
| 12 | Operator melepas HOLD tanpa `gate.command_override` | `403` |
| 13 | Pekaseh melepas HOLD dengan alasan | `202`, tercatat di ledger |
| 14 | User nonaktif memakai token lama | `401` (sesi di-revoke saat nonaktif) |
| 15 | Admin terakhir menonaktifkan dirinya | `409 LAST_ADMIN` |
| 16 | Akses site tanpa `user_site_access` | `403`, bukan daftar kosong |

---

## 10. Audit otorisasi

Setiap `403` pada endpoint mutasi dicatat (`audit_events.action = 'ACCESS_DENIED'`)
dengan `permission`, `site_id`, dan `request_id`. Ini penting untuk mendeteksi
penyalahgunaan kredensial operator dan untuk membuktikan bahwa sistem menolak, bukan
hanya menyembunyikan tombol.

---

## 11. Perubahan ke depan

- **Delegasi sementara** (Pekaseh berhalangan): direncanakan sebagai `role_delegations`
  dengan `valid_from/valid_to` dan audit — belum di v0.1, lihat K-08.
- **Custom role per site**: ditunda; empat role cukup untuk pilot dan lebih mudah diaudit.
- **ABAC berbasis tempek** (Petani hanya melihat giliran tempek-nya): sudah disiapkan
  lewat relasi `members.tempek_id`; aktivasi menunggu keputusan PO (K-04).
