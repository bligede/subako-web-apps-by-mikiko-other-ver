"""Pintu, status, event, dan command aktuasi."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CurrentUser, require
from app.errors import AppError
from app.models import Command, Device, Gate, GateEvent, GateState, Rule, SensorReading, Site, User
from app.presenters import gate_out, gate_state_out, iso
from app.schemas import CommandInput
from app.security import utcnow
from app.services.commands import (
    create_command,
    freshness,
    serialize_command,
)
from app.services.simulator_helpers import attach_gate_values

router = APIRouter(prefix="/gates", tags=["gates"])


def get_gate(db: Session, gate_id: str) -> Gate:
    gate = db.get(Gate, gate_id)
    if gate is None:
        raise AppError("GATE_NOT_FOUND", 404, "Pintu tidak ditemukan.")
    return gate


def _gate_payload(db: Session, gate: Gate, now=None) -> dict:
    now = now or utcnow()
    state = db.get(GateState, gate.id)
    device = db.scalars(
        select(Device).where(Device.gate_id == gate.id, Device.kind == "GATE_NODE")
    ).first()
    flow, level = attach_gate_values(db, gate.id)
    return gate_out(gate, state, device, flow_lps=flow, level_m=level, now=now)


@router.get("")
def list_gates(
    site_id: str,
    user: CurrentUser = Depends(require("gate.read")),
    db: Session = Depends(get_db),
) -> dict:
    user.scope().require(site_id, "VIEW")
    gates = list(db.scalars(select(Gate).where(Gate.site_id == site_id).order_by(Gate.code)))
    now = utcnow()
    return {"data": [_gate_payload(db, gate, now) for gate in gates]}


@router.get("/{gate_id}")
def gate_detail(
    gate_id: str,
    user: CurrentUser = Depends(require("gate.read")),
    db: Session = Depends(get_db),
) -> dict:
    gate = get_gate(db, gate_id)
    user.scope().require(gate.site_id, "VIEW")
    payload = _gate_payload(db, gate)
    device = db.scalars(
        select(Device).where(Device.gate_id == gate.id, Device.kind == "GATE_NODE")
    ).first()
    rule = db.scalars(
        select(Rule)
        .where(Rule.site_id == gate.site_id, Rule.status == "PUBLISHED")
        .order_by(Rule.published_at.desc())
        .limit(1)
    ).first()
    events = list(
        db.scalars(
            select(GateEvent)
            .where(GateEvent.gate_id == gate.id)
            .order_by(GateEvent.ts.desc())
            .limit(10)
        )
    )
    commands = list(
        db.scalars(
            select(Command)
            .where(Command.gate_id == gate.id)
            .order_by(Command.created_at.desc())
            .limit(10)
        )
    )
    actor_labels = {
        user.id: user.email
        for user in db.scalars(
            select(User).where(User.id.in_([c.requested_by for c in commands] or [""]))
        )
    }
    payload.update(
        {
            "device": (
                {
                    "id": device.id,
                    "device_id": device.device_id,
                    "firmware_version": device.firmware_version,
                    "rssi_dbm": device.rssi_dbm,
                    "snr_db": None,
                    "battery_pct": device.battery_pct,
                    "battery_v": round(3.7 + (device.battery_pct or 0) / 100 * 0.45, 2),
                    "last_communication_at": iso(device.last_seen_at),
                    "status": device.status,
                    "capabilities": [],
                }
                if device
                else None
            ),
            "active_rule_version": (
                {
                    "id": rule.id,
                    "rule_id": rule.id,
                    "version_no": rule.version,
                    "status": rule.status,
                    "effective_from": rule.effective_from.isoformat(),
                    "effective_to": rule.effective_to.isoformat() if rule.effective_to else None,
                    "tolerance_pct": (rule.payload or {}).get("tolerance_pct", 10),
                    "checksum": (rule.payload or {}).get("checksum"),
                    "entitlements": (rule.payload or {}).get("entitlements", []),
                    "schedules": (rule.payload or {}).get("schedules", []),
                }
                if rule
                else None
            ),
            "recent_events": [
                {
                    "id": e.id,
                    "gate_id": e.gate_id,
                    "occurred_at": iso(e.ts),
                    "event_type": e.kind,
                    "message": e.message,
                    "data": e.data,
                }
                for e in events
            ],
            "recent_commands": [
                serialize_command(c, actor_labels.get(c.requested_by)) for c in commands
            ],
        }
    )
    return payload


@router.get("/{gate_id}/status")
def gate_status(
    gate_id: str,
    user: CurrentUser = Depends(require("gate.read")),
    db: Session = Depends(get_db),
) -> dict:
    gate = get_gate(db, gate_id)
    user.scope().require(gate.site_id, "VIEW")
    state = db.get(GateState, gate.id)
    ts = db.scalars(
        select(SensorReading.ts)
        .where(SensorReading.gate_id == gate.id)
        .order_by(SensorReading.ts.desc())
        .limit(1)
    ).first()
    state_freshness, age = freshness(ts)
    data = gate_state_out(state) or {}
    data["freshness"] = state_freshness
    data["age_s"] = age
    return data


@router.get("/{gate_id}/events")
def gate_events(
    gate_id: str,
    user: CurrentUser = Depends(require("gate.read")),
    db: Session = Depends(get_db),
) -> dict:
    gate = get_gate(db, gate_id)
    user.scope().require(gate.site_id, "VIEW")
    rows = list(
        db.scalars(
            select(GateEvent)
            .where(GateEvent.gate_id == gate.id)
            .order_by(GateEvent.ts.desc())
            .limit(50)
        )
    )
    return {
        "data": [
            {
                "id": row.id,
                "gate_id": row.gate_id,
                "occurred_at": iso(row.ts),
                "event_type": row.kind,
                "message": row.message,
                "data": row.data,
            }
            for row in rows
        ]
    }


@router.get("/{gate_id}/commands")
def list_commands(
    gate_id: str,
    user: CurrentUser = Depends(require("gate.read")),
    db: Session = Depends(get_db),
) -> dict:
    gate = get_gate(db, gate_id)
    user.scope().require(gate.site_id, "VIEW")
    rows = list(
        db.scalars(
            select(Command)
            .where(Command.gate_id == gate.id)
            .order_by(Command.created_at.desc())
            .limit(50)
        )
    )
    actors = {
        u.id: u.email
        for u in db.scalars(select(User).where(User.id.in_([r.requested_by for r in rows] or [""])))
    }
    return {
        "data": [serialize_command(row, actors.get(row.requested_by)) for row in rows],
        "page": {"next_cursor": None, "has_more": False},
    }


@router.post("/{gate_id}/commands", status_code=202)
def send_command(
    gate_id: str,
    body: CommandInput,
    request: Request,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=8),
    user: CurrentUser = Depends(require("gate.command")),
    db: Session = Depends(get_db),
):
    gate = get_gate(db, gate_id)
    user.scope().require(gate.site_id, "OPERATE")
    site = db.get(Site, gate.site_id)
    if site is None:
        raise AppError("SITE_NOT_FOUND", 404, "Site tidak ditemukan.")

    command, created = create_command(
        db,
        user=user,
        site=site,
        gate=gate,
        body=body,
        idempotency_key=idempotency_key,
        request_id=getattr(request.state, "request_id", None),
    )
    response = JSONResponse(
        status_code=202,
        content=serialize_command(command, user.email),
    )
    if not created:
        response.headers["Idempotent-Replayed"] = "true"
    return response
