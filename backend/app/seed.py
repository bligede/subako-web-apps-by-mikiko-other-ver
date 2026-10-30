"""Seed demo Phase 1 — satu site lengkap, data SIMULATION, ledger terisi."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Alert,
    Command,
    Device,
    DeviceCapability,
    Gate,
    GateEvent,
    GateState,
    Rule,
    ScheduleSlot,
    SensorReading,
    Site,
    SiteAccess,
    Tempek,
    User,
)
from app.security import hash_password, utcnow
from app.services.ledger import append_entry
from app.services.simulation import seed_history

DEMO_PASSWORD = "Subako#2026"


def _checksum(payload: dict) -> str:
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def seed_demo(db: Session, now: datetime | None = None) -> bool:
    if db.scalars(select(Site).where(Site.code == "SUBAK-SARI")).first():
        return False
    now = now or utcnow()
    password = hash_password(DEMO_PASSWORD)

    site = Site(
        code="SUBAK-SARI",
        name="Subak Sari",
        regency="Tabanan",
        village="Sari",
        lat=-8.3952,
        lon=115.1184,
        data_mode="SIMULATION",
        status="ACTIVE",
        separation_of_duties=True,
    )
    site2 = Site(
        code="SUBAK-KEDAMPAL",
        name="Subak Kedampal",
        regency="Jembrana",
        village="Kedampal",
        lat=-8.3631,
        lon=114.6422,
        data_mode="SIMULATION",
        status="ACTIVE",
        separation_of_duties=True,
    )
    db.add_all([site, site2])
    db.flush()

    pekaseh = User(
        email="pekaseh@demo",
        full_name="Wayan Sudira",
        password_hash=password,
        role="PEKASEH",
        last_login_at=now - timedelta(hours=1),
    )
    pekaseh2 = User(
        email="pekaseh2@demo",
        full_name="Made Wirawan",
        password_hash=password,
        role="PEKASEH",
    )
    operator = User(
        email="operator@demo",
        full_name="Ni Luh Sari",
        password_hash=password,
        role="OPERATOR",
        last_login_at=now - timedelta(hours=2),
    )
    operator2 = User(
        email="operator2@demo",
        full_name="Ketut Budi",
        password_hash=password,
        role="OPERATOR",
        is_active=False,
        last_login_at=now - timedelta(days=18),
    )
    petani = User(
        email="petani@demo",
        full_name="I Made Arta",
        password_hash=password,
        role="VIEWER",
        last_login_at=now - timedelta(hours=12),
    )
    admin = User(
        email="admin@mikiko.id",
        full_name="Admin Mikiko",
        password_hash=password,
        role="ADMIN",
        last_login_at=now - timedelta(minutes=20),
    )
    db.add_all([pekaseh, pekaseh2, operator, operator2, petani, admin])
    db.flush()

    db.add_all(
        [
            SiteAccess(user_id=pekaseh.id, site_id=site.id, level="GOVERN", granted_by=admin.id),
            SiteAccess(user_id=pekaseh2.id, site_id=site.id, level="GOVERN", granted_by=admin.id),
            SiteAccess(user_id=operator.id, site_id=site.id, level="OPERATE", granted_by=pekaseh.id),
            SiteAccess(user_id=operator2.id, site_id=site2.id, level="OPERATE", granted_by=admin.id),
            SiteAccess(user_id=petani.id, site_id=site.id, level="VIEW", granted_by=pekaseh.id),
            SiteAccess(user_id=admin.id, site_id=site.id, level="ADMIN", granted_by=admin.id),
            SiteAccess(user_id=admin.id, site_id=site2.id, level="ADMIN", granted_by=admin.id),
        ]
    )

    utama = Tempek(site_id=site.id, name="Tempek Utama", member_count_est=84)
    kedua = Tempek(site_id=site.id, name="Tempek Kedua", member_count_est=61)
    db.add_all([utama, kedua])
    db.flush()

    for day in range(7):
        db.add_all(
            [
                ScheduleSlot(site_id=site.id, tempek_id=utama.id, day_of_week=day,
                             start_minute=360, end_minute=600, share_pct=55),
                ScheduleSlot(site_id=site.id, tempek_id=kedua.id, day_of_week=day,
                             start_minute=600, end_minute=840, share_pct=45),
                ScheduleSlot(site_id=site.id, tempek_id=utama.id, day_of_week=day,
                             start_minute=840, end_minute=1080, share_pct=55),
            ]
        )

    gate_specs = [
        ("GATE-01", "Pintu Utama Sari", 100, 60, 34.0, 40.0, "AUTO"),
        ("GATE-02", "Pintu Tempek Kedua", 100, 45, 0.0, 0.0, "FAULT"),
        ("GATE-03", "Pintu Barat", 100, 50, 22.5, 22.5, "AUTO"),
        ("GATE-04", "Pintu Selatan", 100, 40, 0.0, 0.0, "IDLE"),
        ("GATE-05", "Pintu Timur", 100, 35, 15.0, 18.0, "AUTO"),
        ("GATE-06", "Pintu Cadangan", 80, 50, 40.0, 40.0, "IDLE"),
    ]
    gates: list[Gate] = []
    for code, name, max_open, design_flow, position, target, mode in gate_specs:
        gate = Gate(
            site_id=site.id,
            code=code,
            name=name,
            gate_type="SLUICE",
            max_opening_pct=max_open,
            design_flow_lps=design_flow,
        )
        db.add(gate)
        gates.append(gate)
    db.flush()
    for gate, spec in zip(gates, gate_specs):
        db.add(
            GateState(
                gate_id=gate.id,
                mode=spec[6],
                position_pct=spec[4],
                target_pct=spec[5],
                updated_at=now - timedelta(minutes=8),
            )
        )

    devices: list[Device] = []
    for idx, gate in enumerate(gates, start=1):
        device = Device(
            site_id=site.id,
            device_id=f"subako-gate-0{idx}",
            dev_eui=f"ac1f09{idx:02d}3b7e4c81",
            kind="GATE_NODE",
            status="ACTIVE",
            data_mode="SIMULATION",
            firmware_version="1.0.0" if idx < 5 else "0.9.2",
            battery_pct=92.0 if idx == 1 else max(38, 88 - idx * 6),
            rssi_dbm=-76 - idx,
            expected_interval_s=60,
            last_seen_at=now - timedelta(seconds=15),
            gate_id=gate.id,
        )
        db.add(device)
        devices.append(device)
    measure7 = Device(
        site_id=site.id,
        device_id="SIM-NODE-07",
        dev_eui="ac1f09aa11bb22cc",
        kind="MEASURE_NODE",
        status="ACTIVE",
        data_mode="SIMULATION",
        firmware_version="1.0.0",
        battery_pct=42.0,
        rssi_dbm=-91,
        expected_interval_s=300,
        last_seen_at=now - timedelta(minutes=2),
    )
    measure11 = Device(
        site_id=site.id,
        device_id="SIM-NODE-11",
        dev_eui="ac1f09dd33ee44ff",
        kind="MEASURE_NODE",
        status="QUARANTINED",
        data_mode="SIMULATION",
        firmware_version="0.9.2",
        battery_pct=63.0,
        rssi_dbm=None,
        expected_interval_s=300,
        last_seen_at=now - timedelta(minutes=21),
    )
    measure12 = Device(
        site_id=site.id,
        device_id="subako-node-12",
        dev_eui="ac1f095566778899",
        kind="MEASURE_NODE",
        status="UNPROVISIONED",
        data_mode="SIMULATION",
        firmware_version=None,
        expected_interval_s=300,
    )
    db.add_all([measure7, measure11, measure12])
    db.flush()

    for device in devices:
        capabilities = ["gate_position_pct", "flow", "water_level", "battery", "motor_current"]
        if device.device_id == "subako-gate-04":
            capabilities.remove("gate_position_pct")
        for capability in capabilities:
            db.add(
                DeviceCapability(device_id=device.id, capability=capability, enabled=True)
            )
    for device in (measure7, measure11):
        db.add(DeviceCapability(device_id=device.id, capability="water_level", enabled=True))

    entitlements = [
        {"tempek_name": "Tempek Utama", "entitlement_pct": 55.0, "entitlement_m3_per_day": None, "priority": 1},
        {"tempek_name": "Tempek Kedua", "entitlement_pct": 45.0, "entitlement_m3_per_day": None, "priority": 2},
    ]
    schedules = [
        {"gate_code": "GATE-01", "tempek_name": "Tempek Utama", "starts_at": "06:00", "ends_at": "10:00", "target_flow_lps": 33.0, "entitlement_pct": 55.0},
        {"gate_code": "GATE-02", "tempek_name": "Tempek Kedua", "starts_at": "10:00", "ends_at": "14:00", "target_flow_lps": 20.3, "entitlement_pct": 45.0},
        {"gate_code": "GATE-03", "tempek_name": "Tempek Utama", "starts_at": "14:00", "ends_at": "18:00", "target_flow_lps": 27.5, "entitlement_pct": 55.0},
    ]
    payload = {
        "allocation_mode": "PROPORTIONAL",
        "tolerance_pct": 10,
        "entitlements": entitlements,
        "schedules": schedules,
        "meeting_reference": {
            "reference_no": "PARUMAN-2026-10-28-03",
            "meeting_date": "2026-10-28",
            "title": "Paruman Subak Sari — penetapan giliran Nov 2026",
        },
    }
    payload["checksum"] = _checksum(payload)

    rule_v1 = Rule(
        site_id=site.id, code="SUBAK-AIR-021", version=1, status="SUPERSEDED",
        effective_from=(now - timedelta(days=60)).date(), created_by=pekaseh.id,
        approved_by=pekaseh2.id, approved_at=now - timedelta(days=61),
        published_at=now - timedelta(days=60), payload=payload, notes="Versi awal Oktober.",
    )
    rule_v2 = Rule(
        site_id=site.id, code="SUBAK-AIR-021", version=2, status="SUPERSEDED",
        effective_from=(now - timedelta(days=30)).date(), created_by=pekaseh.id,
        approved_by=pekaseh2.id, approved_at=now - timedelta(days=31),
        published_at=now - timedelta(days=30), payload=payload, notes="Penyesuaian musim kemarau.",
    )
    rule_v3 = Rule(
        site_id=site.id, code="SUBAK-AIR-021", version=3, status="PUBLISHED",
        effective_from=(now - timedelta(days=1)).date(), created_by=pekaseh.id,
        approved_by=pekaseh2.id, approved_at=now - timedelta(days=2),
        published_at=now - timedelta(days=1, hours=3), payload=payload,
        notes="Berlaku 1–15 November 2026.",
    )
    draft_payload = dict(payload)
    draft_payload["tolerance_pct"] = 8
    draft_payload["checksum"] = _checksum(
        {k: v for k, v in draft_payload.items() if k != "checksum"}
    )
    rule_v4 = Rule(
        site_id=site.id, code="SUBAK-AIR-021", version=4, status="DRAFT",
        effective_from=(now + timedelta(days=7)).date(), created_by=pekaseh.id,
        payload=draft_payload, notes="Draf untuk Paruman berikutnya; belum diajukan.",
    )
    db.add_all([rule_v1, rule_v2, rule_v3, rule_v4])
    db.flush()

    alert_fault = Alert(
        site_id=site.id, gate_id=gates[1].id, device_id=devices[1].id,
        severity="CRITICAL", code="MOTOR_OVERCURRENT",
        title="Motor overcurrent", message="Arus motor 2,84 A melebihi ambang 2,50 A.",
        status="OPEN", opened_at=now - timedelta(minutes=26),
    )
    alert_battery = Alert(
        site_id=site.id, device_id=measure7.id,
        severity="WARNING", code="BATTERY_LOW",
        title="Baterai rendah", message="Baterai SIM-NODE-07 tersisa 42%.",
        status="ACKNOWLEDGED", opened_at=now - timedelta(hours=3),
        acknowledged_by=operator.id, acknowledged_at=now - timedelta(hours=2, minutes=40),
    )
    alert_stale = Alert(
        site_id=site.id, device_id=measure11.id,
        severity="WARNING", code="TELEMETRY_STALE",
        title="Data tidak segar", message="Tidak ada uplink selama 21 menit.",
        status="OPEN", opened_at=now - timedelta(minutes=19),
    )
    alert_resolved = Alert(
        site_id=site.id, gate_id=gates[2].id,
        severity="INFO", code="FLOW_DEVIATION",
        title="Penyimpangan debit", message="Deviasi −6,2% masih dalam toleransi 10%.",
        status="RESOLVED", opened_at=now - timedelta(hours=8),
        resolved_by=operator.id, resolved_at=now - timedelta(hours=7, minutes=30),
        resolution_note="Penyimpangan wajar akibat fluktuasi debit hulu.",
    )
    db.add_all([alert_fault, alert_battery, alert_stale, alert_resolved])
    db.flush()

    seeded_commands: list[Command] = []
    for idx, (gate, target, hours_ago) in enumerate(
        [(gates[0], 40.0, 5), (gates[2], 22.5, 9), (gates[0], 34.0, 7)]
    ):
        issued = now - timedelta(hours=hours_ago)
        command = Command(
            site_id=site.id, gate_id=gate.id, requested_by=operator.id,
            type="SET_POSITION", target_pct=target, reason="Penyesuaian jadwal giliran.",
            status="EXECUTED", idempotency_key=f"seed-command-{idx+1}",
            created_at=issued, expires_at=issued + timedelta(seconds=90),
            acked_at=issued + timedelta(seconds=4), executed_at=issued + timedelta(seconds=9),
            rule_version="3", payload_hash=_checksum({"seed": idx}),
        )
        db.add(command)
        seeded_commands.append(command)
        db.add(
            GateEvent(
                site_id=site.id, gate_id=gate.id, ts=issued + timedelta(seconds=9),
                kind="COMMAND_EXECUTED",
                message=f"SET_POSITION dieksekusi · target {target:.1f}%",
                data={"command_id": command.id, "target_pct": target},
            )
        )
    db.flush()

    ledger_seed = [
        (26, "RULE_PUBLISHED", "Rule SUBAK-AIR-021 v3 diterbitkan", "RULE", rule_v3.id,
         {"rule_version": 3, "actor_label": "Pekaseh Wayan"}),
        (22, "DISTRIBUTION", "Distribusi GATE-01 · Tempek Utama 06:00–10:00", "GATE", gates[0].id,
         {"gate_code": "GATE-01", "tempek_name": "Tempek Utama", "volume_m3": 182.4,
          "measurement_status": "MEASURED", "rule_version": 3}),
        (17, "GATE_ACTIVITY", "GATE-03 dibuka manual ke 22,5%", "GATE", gates[2].id,
         {"gate_code": "GATE-03", "position_before": 0.0, "position_after": 22.5,
          "actor_label": "Operator Sari"}),
        (14, "DISTRIBUTION", "Distribusi GATE-02 · Tempek Kedua 10:00–14:00", "GATE", gates[1].id,
         {"gate_code": "GATE-02", "tempek_name": "Tempek Kedua", "volume_m3": 96.8,
          "measurement_status": "MEASURED", "rule_version": 3}),
        (9, "COMMAND_EXECUTED", "GATE-01: SET_POSITION dieksekusi 34,0% → 40,0%", "COMMAND",
         seeded_commands[0].id, {"gate_code": "GATE-01", "position_before": 34.0,
                                  "position_after": 40.0, "actor_label": "Operator Sari"}),
        (7, "ALERT_RESOLVED", "Menyelesaikan alert: Penyimpangan debit", "ALERT", alert_resolved.id,
         {"gate_code": "GATE-03", "reason": "Penyimpangan wajar akibat fluktuasi debit hulu.",
          "actor_label": "Operator Sari"}),
        (5, "COMMAND_EXECUTED", "GATE-03: SET_POSITION dieksekusi 0,0% → 22,5%", "COMMAND",
         seeded_commands[1].id, {"gate_code": "GATE-03", "position_before": 0.0,
                                  "position_after": 22.5, "actor_label": "Operator Sari"}),
        (3, "SYSTEM_NOTE", "Verifikasi hash-chain harian selesai: 7/7 seal valid", "SYSTEM", None,
         {"measurement_status": "MEASURED"}),
        (2, "GATE_ACTIVITY", "GATE-02 masuk mode FAULT (motor overcurrent)", "GATE", gates[1].id,
         {"gate_code": "GATE-02", "actor_label": "Sistem"}),
        (1, "LEDGER_SEAL", "Seal harian dibuat untuk 118 entri", "SYSTEM", None,
         {"measurement_status": "MEASURED"}),
    ]
    for hours_ago, kind, summary, ref_type, ref_id, payload_extra in ledger_seed:
        append_entry(
            db,
            site_id=site.id,
            kind=kind,
            summary=summary,
            ref_type=ref_type,
            ref_id=ref_id,
            actor_id=operator.id if "Operator" in str(payload_extra.get("actor_label")) else None,
            payload=payload_extra,
            ts=now - timedelta(hours=hours_ago),
        )

    seed_history(db, [site, site2], now)
    db.commit()
    return True
