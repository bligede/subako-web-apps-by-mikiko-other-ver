"""Simulator telemetri + eksekutor command (Phase 1, mode SIMULATION).

Tidak ada koneksi MQTT/ChirpStack di sini: data diberi label SIMULATION dan tidak
pernah dipakai untuk mengklaim kondisi lapangan.
"""

from __future__ import annotations

import asyncio
import math
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Command, Device, Gate, GateEvent, GateState, SensorReading, Site
from app.security import utcnow
from app.services.ledger import append_entry, as_utc

CHANNELS = {
    "flow": ("L/s", 2),
    "water_level_up": ("m", 3),
    "gate_position": ("%", 1),
    "battery": ("%", 0),
    "motor_current": ("A", 2),
}


def _noise(seed: str, minute: int) -> float:
    rng = random.Random(f"{seed}:{minute}")
    return rng.uniform(-1.0, 1.0)


def _reading(
    db: Session,
    *,
    site_id: str,
    device_id: str,
    gate_id: str | None,
    ts: datetime,
    channel: str,
    value: float,
    quality: str = "MEASURED",
    derived: bool = False,
) -> None:
    unit, digits = CHANNELS[channel]
    db.add(
        SensorReading(
            site_id=site_id,
            device_id=device_id,
            gate_id=gate_id,
            ts=ts,
            channel=channel,
            value=round(value, digits),
            unit=unit,
            quality=quality,
            data_mode="SIMULATION",
            seq=int(ts.timestamp()),
            derived=derived,
        )
    )


def sample_telemetry(db: Session, now: datetime | None = None) -> int:
    now = now or utcnow()
    minute = int(now.timestamp() // 60)
    inserted = 0

    gate_nodes = list(
        db.scalars(select(Device).where(Device.kind == "GATE_NODE", Device.status == "ACTIVE"))
    )
    for device in gate_nodes:
        gate = db.get(Gate, device.gate_id) if device.gate_id else None
        if gate is None:
            continue
        state = db.get(GateState, gate.id)
        position = state.position_pct if state else 0.0
        fault = state is not None and state.mode == "FAULT"
        wave = math.sin(minute / 12) * 0.05
        flow = gate.design_flow_lps * (position / 100.0) * (0.94 + wave) if not fault else 0.0
        level = 0.82 + math.sin(minute / 40) * 0.06 + _noise(device.device_id, minute) * 0.01
        current = 2.84 if fault else 1.24 + _noise(device.device_id, minute) * 0.08
        battery = device.battery_pct if device.battery_pct is not None else 88.0

        for channel, value, quality in (
            ("flow", flow, "MEASURED"),
            ("water_level_up", level, "MEASURED"),
            ("gate_position", position, "MEASURED"),
            ("motor_current", current, "MEASURED"),
            ("battery", battery, "MEASURED"),
        ):
            _reading(
                db,
                site_id=device.site_id,
                device_id=device.device_id,
                gate_id=gate.id,
                ts=now,
                channel=channel,
                value=value,
                quality=quality,
            )
            inserted += 1

        device.last_seen_at = now
        device.battery_pct = max(5.0, battery - 0.01)
        device.rssi_dbm = -78 + int(_noise(device.device_id, minute) * 6)

    measure_nodes = list(
        db.scalars(
            select(Device).where(
                Device.kind == "MEASURE_NODE", Device.status == "ACTIVE"
            )
        )
    )
    for device in measure_nodes:
        battery = device.battery_pct if device.battery_pct is not None else 60.0
        _reading(
            db,
            site_id=device.site_id,
            device_id=device.device_id,
            gate_id=None,
            ts=now,
            channel="battery",
            value=battery,
        )
        _reading(
            db,
            site_id=device.site_id,
            device_id=device.device_id,
            gate_id=None,
            ts=now,
            channel="water_level_up",
            value=0.74 + math.sin(minute / 33) * 0.05,
        )
        inserted += 2
        device.last_seen_at = now
        device.battery_pct = max(5.0, battery - 0.005)

    return inserted


def _mark(db: Session, command: Command, status: str, **fields) -> None:
    command.status = status
    for key, value in fields.items():
        setattr(command, key, value)


def advance_commands(db: Session, now: datetime | None = None) -> int:
    """Mendorong state machine command: SENT → ACKNOWLEDGED → EXECUTED."""
    now = now or utcnow()
    changed = 0
    pending = list(
        db.scalars(select(Command).where(Command.status.in_(("SENT", "ACKNOWLEDGED"))))
    )
    for command in pending:
        gate = db.get(Gate, command.gate_id)
        state = db.get(GateState, command.gate_id)
        if gate is None or state is None:
            continue

        if command.status == "SENT":
            if as_utc(command.expires_at) < now:
                _mark(db, command, "EXPIRED", error_code="COMMAND_EXPIRED",
                      error_message="Tidak ada ACK sebelum batas waktu.")
                db.add(GateEvent(site_id=command.site_id, gate_id=gate.id, ts=now,
                                 kind="COMMAND_EXPIRED", message="Command kedaluwarsa tanpa ACK"))
                append_entry(
                    db,
                    site_id=command.site_id,
                    kind="COMMAND_EXPIRED",
                    ref_type="COMMAND",
                    ref_id=command.id,
                    actor_id=None,
                    summary=f"{gate.code}: command {command.type} kedaluwarsa",
                    payload={"command_id": command.id, "action": command.type},
                )
                changed += 1
                continue
            _mark(db, command, "ACKNOWLEDGED", acked_at=now, attempts=command.attempts + 1)
            db.add(GateEvent(site_id=command.site_id, gate_id=gate.id, ts=now,
                             kind="COMMAND_ACKNOWLEDGED",
                             message=f"{command.type} diterima perangkat"))
            append_entry(
                db,
                site_id=command.site_id,
                kind="COMMAND_ACKNOWLEDGED",
                ref_type="COMMAND",
                ref_id=command.id,
                actor_id=command.requested_by,
                summary=f"{gate.code}: ACK {command.type}",
                payload={"command_id": command.id, "status": "ACCEPTED"},
            )
            changed += 1
            continue

        # ACKNOWLEDGED
        acked_at = as_utc(command.acked_at) if command.acked_at else now
        if now < acked_at + timedelta(seconds=2):
            continue

        before = state.position_pct
        if command.type in {"OPEN", "CLOSE", "SET_POSITION"}:
            target = 100.0 if command.type == "OPEN" else 0.0 if command.type == "CLOSE" else (
                command.target_pct or 0.0
            )
            target = min(target, gate.max_opening_pct)
            state.position_pct = target
            state.target_pct = target
            state.mode = "AUTO"
        elif command.type == "HOLD":
            state.mode = "HOLD"
        elif command.type == "RELEASE_HOLD":
            state.mode = "AUTO"
        state.updated_at = now
        state.last_command_id = command.id

        _mark(db, command, "EXECUTED", executed_at=now)
        db.add(GateEvent(site_id=command.site_id, gate_id=gate.id, ts=now,
                         kind="COMMAND_EXECUTED",
                         message=f"{command.type} dieksekusi · posisi {state.position_pct:.1f}%",
                         data={"before_pct": before, "after_pct": state.position_pct}))
        append_entry(
            db,
            site_id=command.site_id,
            kind="COMMAND_EXECUTED",
            ref_type="COMMAND",
            ref_id=command.id,
            actor_id=command.requested_by,
            summary=(
                f"{gate.code}: {command.type} dieksekusi "
                f"{before:.1f}% → {state.position_pct:.1f}%"
            ),
            payload={
                "command_id": command.id,
                "action": command.type,
                "position_before": before,
                "position_after": state.position_pct,
                "rule_version": command.rule_version,
            },
        )
        changed += 1

    return changed


def seed_history(db: Session, sites: list[Site], now: datetime | None = None) -> int:
    """Riwayat 24 jam (5 menit) supaya dashboard tidak kosong saat pertama dibuka."""
    now = now or utcnow()
    inserted = 0
    for site in sites:
        gates = list(db.scalars(select(Gate).where(Gate.site_id == site.id)))
        for gate in gates:
            device = db.scalars(
                select(Device).where(Device.gate_id == gate.id, Device.kind == "GATE_NODE")
            ).first()
            if device is None:
                continue
            state = db.get(GateState, gate.id)
            position = state.position_pct if state else 0.0
            fault = state is not None and state.mode == "FAULT"
            for i in range(288, -1, -1):
                ts = now - timedelta(minutes=5 * i)
                wave = math.sin(i / 9) * 0.06
                flow = 0.0 if fault else gate.design_flow_lps * (position / 100.0) * (0.93 + wave)
                level = 0.82 + math.sin(i / 34) * 0.05
                quality = "ESTIMATED" if gate.code == "GATE-04" and 40 <= i <= 55 else "MEASURED"
                _reading(db, site_id=site.id, device_id=device.device_id, gate_id=gate.id,
                         ts=ts, channel="flow", value=flow, quality=quality,
                         derived=quality == "ESTIMATED")
                _reading(db, site_id=site.id, device_id=device.device_id, gate_id=gate.id,
                         ts=ts, channel="water_level_up", value=level)
                inserted += 2
    return inserted


async def run_simulator(stop: asyncio.Event) -> None:
    """Loop background: sampling telemetri + progres command."""
    from app.db import SessionLocal

    interval = max(2, settings.simulation_interval_s)
    while not stop.is_set():
        try:
            with SessionLocal() as db:
                sample_telemetry(db)
                advance_commands(db)
                db.commit()
        except Exception as exc:  # noqa: BLE001 - loop tidak boleh mati
            print(f"[simulator] error: {exc}")
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue
