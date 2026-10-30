"""Validasi 9 lapis & pembuatan command aktuasi."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import CurrentUser
from app.errors import AppError
from app.models import (
    Command,
    Device,
    DeviceCapability,
    Gate,
    GateEvent,
    GateState,
    Rule,
    SensorReading,
    Site,
)
from app.schemas import CommandInput
from app.security import utcnow
from app.services.audit import log_audit
from app.services.ledger import append_entry

COMMAND_TTL_S = 90
FRESH_STALE_S = 120
FRESH_OFFLINE_S = 300
IN_FLIGHT = ("SENT", "ACKNOWLEDGED")


def as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def latest_ts(db: Session, site_id: str, gate_id: str | None = None) -> datetime | None:
    stmt = select(SensorReading.ts).where(SensorReading.site_id == site_id)
    if gate_id:
        stmt = stmt.where(SensorReading.gate_id == gate_id)
    return db.scalars(stmt.order_by(SensorReading.ts.desc()).limit(1)).first()


def freshness(ts: datetime | None, now: datetime | None = None) -> tuple[str, int | None]:
    if ts is None:
        return "OFFLINE", None
    now = now or utcnow()
    age = int((now - as_utc(ts)).total_seconds())
    if age > FRESH_OFFLINE_S:
        return "OFFLINE", age
    if age > FRESH_STALE_S:
        return "STALE", age
    return "LIVE", age


def active_rule(db: Session, site_id: str) -> Rule | None:
    return db.scalars(
        select(Rule)
        .where(Rule.site_id == site_id, Rule.status == "PUBLISHED")
        .order_by(Rule.published_at.desc())
        .limit(1)
    ).first()


def payload_hash(command: dict[str, Any]) -> str:
    return hashlib.sha256(
        json.dumps(command, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def validate_command(
    db: Session,
    *,
    user: CurrentUser,
    gate: Gate,
    site: Site,
    body: CommandInput,
    now: datetime | None = None,
) -> Rule | None:
    """Lapisan 4–8. Lapisan 1–3 (auth, permission, site scope) ditangani dependency."""
    now = now or utcnow()
    state = db.get(GateState, gate.id)
    if state is None:
        raise AppError("GATE_STATE_MISSING", 409, "State pintu belum tersedia.")

    # Lapisan state safety
    if state.mode in {"MANUAL", "FAULT"}:
        raise AppError(
            "MODE_BLOCKED",
            409,
            f"Pintu dalam mode {state.mode}; aktuasi dari aplikasi ditolak.",
        )
    if state.mode == "HOLD" and body.action != "RELEASE_HOLD":
        raise AppError("MODE_BLOCKED", 409, "Pintu sedang HOLD. Lepas HOLD terlebih dahulu.")
    if body.action == "RELEASE_HOLD" and not user.can("gate.command_override"):
        raise AppError(
            "OVERRIDE_REQUIRED",
            403,
            "Melepas HOLD memerlukan izin gate.command_override dan alasan tercatat.",
        )

    # Lapisan rule validity
    rule = active_rule(db, gate.site_id)
    if rule is None:
        raise AppError("NO_ACTIVE_RULE", 409, "Tidak ada rule aktif untuk site ini.")
    if body.expected_rule_checksum and body.expected_rule_checksum != (rule.payload or {}).get(
        "checksum"
    ):
        raise AppError(
            "RULE_CHANGED",
            409,
            "Rule berubah sejak halaman dimuat. Muat ulang sebelum mengirim perintah.",
        )

    # Lapisan expiry/validity target
    target: float | None = None
    if body.action == "SET_POSITION":
        if body.target_pct is None:
            raise AppError("VALIDATION_ERROR", 422, "target_pct wajib untuk SET_POSITION.")
        target = float(body.target_pct)
    elif body.action == "OPEN":
        target = min(100.0, gate.max_opening_pct)
    elif body.action == "CLOSE":
        target = 0.0
    if target is not None and target > gate.max_opening_pct:
        raise AppError(
            "OUT_OF_RANGE",
            422,
            f"Target melebihi batas bukaan pintu ({gate.max_opening_pct:.0f}%).",
        )

    # Lapisan device capability & availability
    device = (
        db.scalars(
            select(Device).where(Device.gate_id == gate.id, Device.kind == "GATE_NODE")
        ).first()
    )
    if device is None or device.status != "ACTIVE":
        raise AppError("DEVICE_UNAVAILABLE", 409, "Perangkat pintu tidak aktif.")
    capabilities = {
        row.capability
        for row in db.scalars(
            select(DeviceCapability).where(
                DeviceCapability.device_id == device.id, DeviceCapability.enabled.is_(True)
            )
        )
    }
    needed = "gate_position_pct"
    if needed not in capabilities:
        raise AppError(
            "CAPABILITY_UNSUPPORTED",
            422,
            f"Perangkat tidak mendukung capability '{needed}'.",
        )

    # Lapisan freshness
    ts = latest_ts(db, gate.site_id, gate.id)
    state_freshness, age = freshness(ts, now)
    if state_freshness != "LIVE":
        raise AppError(
            "TELEMETRY_STALE",
            409,
            f"Data pintu {state_freshness.lower()} ({age if age is not None else '-'} s). "
            "Perintah hanya diizinkan pada data LIVE.",
        )

    # Lapisan duplicate/replay
    in_flight = db.scalars(
        select(Command)
        .where(
            Command.gate_id == gate.id,
            Command.status.in_(IN_FLIGHT),
            Command.expires_at > now,
        )
        .limit(1)
    ).first()
    if in_flight is not None:
        raise AppError(
            "COMMAND_IN_FLIGHT",
            409,
            "Masih ada perintah berjalan untuk pintu ini. Tunggu ACK atau kedaluwarsa.",
        )

    return rule


def create_command(
    db: Session,
    *,
    user: CurrentUser,
    site: Site,
    gate: Gate,
    body: CommandInput,
    idempotency_key: str,
    request_id: str | None = None,
) -> tuple[Command, bool]:
    existing = db.scalars(
        select(Command).where(Command.idempotency_key == idempotency_key)
    ).first()
    if existing is not None:
        return existing, False

    now = utcnow()
    rule = validate_command(db, user=user, gate=gate, site=site, body=body, now=now)
    digest = payload_hash(
        {
            "gate_id": gate.id,
            "action": body.action,
            "target_pct": body.target_pct,
            "rule_version": rule.version if rule else None,
            "issued_at": now.isoformat(),
        }
    )
    command = Command(
        site_id=gate.site_id,
        gate_id=gate.id,
        requested_by=user.id,
        type=body.action,
        target_pct=body.target_pct,
        reason=body.reason,
        status="SENT",
        idempotency_key=idempotency_key,
        created_at=now,
        expires_at=now + timedelta(seconds=COMMAND_TTL_S),
        rule_version=rule.version if rule else None,
        payload_hash=digest,
    )
    db.add(command)
    db.flush()

    db.add(
        GateEvent(
            site_id=gate.site_id,
            gate_id=gate.id,
            ts=now,
            kind="COMMAND_SENT",
            message=f"{body.action} oleh {user.full_name}",
            data={"command_id": command.id, "target_pct": body.target_pct},
        )
    )
    append_entry(
        db,
        site_id=gate.site_id,
        kind="COMMAND_REQUESTED",
        ref_type="COMMAND",
        ref_id=command.id,
        actor_id=user.id,
        summary=f"{gate.code}: {body.action} diminta oleh {user.full_name}",
        payload={
            "command_id": command.id,
            "action": body.action,
            "target_pct": body.target_pct,
            "reason": body.reason,
            "rule_version": rule.version if rule else None,
            "payload_hash": digest,
        },
    )
    log_audit(
        db,
        actor_id=user.id,
        actor_label=user.email,
        action="COMMAND_SENT",
        summary=f"{gate.code}: {body.action} ({body.target_pct if body.target_pct is not None else '-'}%)",
        site_id=gate.site_id,
        entity_type="gate",
        entity_id=gate.id,
        permission="gate.command",
        request_id=request_id,
        data={"command_id": command.id},
    )
    db.commit()
    db.refresh(command)
    return command, True


def serialize_command(command: Command, actor_label: str | None = None) -> dict[str, Any]:
    now = utcnow()
    expires_at = as_utc(command.expires_at)
    return {
        "id": command.id,
        "gate_id": command.gate_id,
        "action": command.type,
        "target_pct": command.target_pct,
        "status": command.status,
        "rule_version": int(command.rule_version) if (command.rule_version or "").isdigit() else None,
        "rule_checksum": None,
        "issued_at": as_utc(command.created_at).isoformat(),
        "expires_at": expires_at.isoformat(),
        "expires_in_s": max(0, int((expires_at - now).total_seconds())),
        "actor_label": actor_label,
        "requires_ack": True,
        "failure_reason": command.error_message,
        "ack": (
            {"received_at": as_utc(command.acked_at).isoformat(), "status": "ACCEPTED", "reason": None}
            if command.acked_at
            else None
        ),
        "reason": command.reason,
        "payload_hash": command.payload_hash,
    }
