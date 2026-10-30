"""Administrasi teknis: pengguna, audit, kesehatan sistem, perangkat."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CurrentUser, require
from app.errors import AppError
from app.models import (
    AuditEvent,
    Command,
    Device,
    Gate,
    LedgerEntry,
    SensorReading,
    Site,
    SiteAccess,
    User,
)
from app.permissions import ADMIN, ROLES, permissions_for
from app.presenters import iso, user_out
from app.schemas import UserPatchInput
from app.security import utcnow
from app.services.audit import log_audit
from app.services.ledger import verify_chain
from app.services.simulation import advance_commands, sample_telemetry

router = APIRouter(prefix="/admin", tags=["admin"])


def _manageable_user(db: Session, actor: CurrentUser, user_id: str) -> User:
    target = db.get(User, user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", 404, "Pengguna tidak ditemukan.")
    if actor.role == "PEKASEH":
        if target.role == ADMIN:
            raise AppError("ROLE_ESCALATION", 403, "Pekaseh tidak dapat mengubah admin teknis.")
        shared = db.scalars(
            select(SiteAccess).where(
                SiteAccess.user_id == target.id,
                SiteAccess.site_id.in_(list(actor.sites)),
            )
        ).first()
        if shared is None:
            raise AppError("SITE_FORBIDDEN", 403, "Pengguna di luar site Anda.")
    return target


@router.get("/users")
def list_users(
    actor: CurrentUser = Depends(require("user.manage")),
    db: Session = Depends(get_db),
) -> dict:
    users = list(db.scalars(select(User).order_by(User.full_name)))
    if actor.role != ADMIN:
        ids = set(
            db.scalars(
                select(SiteAccess.user_id).where(SiteAccess.site_id.in_(list(actor.sites)))
            )
        )
        users = [u for u in users if u.id in ids]
    return {"data": [user_out(db, user) for user in users]}


@router.patch("/users/{user_id}")
def patch_user(
    user_id: str,
    body: UserPatchInput,
    request: Request,
    actor: CurrentUser = Depends(require("user.manage")),
    db: Session = Depends(get_db),
) -> dict:
    target = _manageable_user(db, actor, user_id)
    if body.role is None and body.is_active is None:
        raise AppError("NO_CHANGES", 422, "Tidak ada perubahan yang dikirim.")

    if body.role is not None and body.role not in ROLES:
        raise AppError("INVALID_ROLE", 422, f"Role harus salah satu dari {', '.join(ROLES)}.")
    if body.role == ADMIN and actor.role != ADMIN:
        raise AppError("ROLE_ESCALATION", 403, "Hanya admin yang dapat memberikan role ADMIN.")

    active_admins = db.scalar(
        select(func.count()).select_from(User).where(User.role == ADMIN, User.is_active.is_(True))
    )
    demoting_admin = target.role == ADMIN and (
        (body.role is not None and body.role != ADMIN) or body.is_active is False
    )
    if demoting_admin and target.id == actor.id:
        raise AppError(
            "LAST_ADMIN",
            409,
            "Anda tidak dapat menurunkan atau menonaktifkan akun admin sendiri.",
        )
    if demoting_admin and (active_admins or 0) <= 1:
        raise AppError("LAST_ADMIN", 409, "Harus ada minimal satu admin aktif.")

    changes = {}
    if body.role is not None and body.role != target.role:
        changes["role"] = {"from": target.role, "to": body.role}
        target.role = body.role
    if body.is_active is not None and body.is_active != target.is_active:
        changes["is_active"] = {"from": target.is_active, "to": body.is_active}
        target.is_active = body.is_active

    log_audit(
        db,
        actor_id=actor.id,
        actor_label=actor.email,
        action="USER_UPDATED",
        summary=f"Memperbarui {target.email}: {', '.join(changes) or 'tanpa perubahan'}",
        entity_type="user",
        entity_id=target.id,
        permission="user.manage",
        request_id=getattr(request.state, "request_id", None),
        data=changes,
    )
    db.commit()
    return user_out(db, target)


@router.get("/audit")
def audit_log(
    limit: int = 100,
    actor: CurrentUser = Depends(require("audit.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows = list(
        db.scalars(select(AuditEvent).order_by(AuditEvent.ts.desc()).limit(min(limit, 200)))
    )
    return {
        "data": [
            {
                "id": row.id,
                "occurred_at": iso(row.ts),
                "actor_id": row.actor_id,
                "actor_label": row.actor_label,
                "action": row.action,
                "entity_type": row.entity_type,
                "entity_id": row.entity_id,
                "site_id": row.site_id,
                "permission": row.permission,
                "request_id": row.request_id,
                "summary": row.summary,
            }
            for row in rows
        ]
    }


@router.get("/system-health")
def system_health(
    actor: CurrentUser = Depends(require("system.health")),
    db: Session = Depends(get_db),
) -> dict:
    now = utcnow()
    sites = list(db.scalars(select(Site)))
    devices = list(db.scalars(select(Device)))
    reading_count = db.scalar(select(func.count()).select_from(SensorReading)) or 0
    latest_reading = db.scalar(select(func.max(SensorReading.ts)))
    open_commands = db.scalar(select(func.count()).select_from(Command)) or 0
    ledgers = [
        {
            "site_id": site.id,
            "site_name": site.name,
            "entries": db.scalar(
                select(func.count()).select_from(LedgerEntry).where(LedgerEntry.site_id == site.id)
            )
            or 0,
            "status": verify_chain(db, site.id)["status"],
        }
        for site in sites
    ]
    return {
        "server_time": now.isoformat(),
        "version": "0.1.0-phase1",
        "components": [
            {"name": "API", "status": "OK"},
            {"name": "Database", "status": "OK"},
            {
                "name": "Simulator",
                "status": "ACTIVE",
                "detail": "mode SIMULATION · tanpa koneksi perangkat nyata",
            },
            {"name": "MQTT/ChirpStack", "status": "NOT_CONFIGURED", "detail": "Phase 3"},
        ],
        "counts": {
            "sites": len(sites),
            "devices": len(devices),
            "devices_active": sum(1 for d in devices if d.status == "ACTIVE"),
            "readings": reading_count,
            "commands": open_commands,
        },
        "last_reading_at": iso(latest_reading),
        "ledger": ledgers,
    }


@router.get("/devices")
def list_devices(
    site_id: str,
    actor: CurrentUser = Depends(require("device.read")),
    db: Session = Depends(get_db),
) -> dict:
    actor.scope().require(site_id, "VIEW")
    rows = list(db.scalars(select(Device).where(Device.site_id == site_id).order_by(Device.device_id)))
    gates = {g.id: g.code for g in db.scalars(select(Gate).where(Gate.site_id == site_id))}
    return {
        "data": [
            {
                "id": d.id,
                "device_id": d.device_id,
                "dev_eui": d.dev_eui,
                "site_id": d.site_id,
                "gate_id": d.gate_id,
                "gate_code": gates.get(d.gate_id or ""),
                "kind": d.kind,
                "status": d.status,
                "data_mode": d.data_mode,
                "firmware_version": d.firmware_version,
                "expected_interval_s": d.expected_interval_s,
                "battery_pct": d.battery_pct,
                "rssi_dbm": d.rssi_dbm,
                "last_communication_at": iso(d.last_seen_at),
            }
            for d in rows
        ]
    }


@router.post("/simulator/tick")
def simulator_tick(
    actor: CurrentUser = Depends(require("system.health")),
    db: Session = Depends(get_db),
) -> dict:
    """Hanya admin: memaksa satu siklus simulasi (dipakai untuk demo/uji)."""
    inserted = sample_telemetry(db)
    advanced = advance_commands(db)
    db.commit()
    return {"readings_inserted": inserted, "commands_advanced": advanced}


@router.get("/permissions")
def permission_catalog(
    actor: CurrentUser = Depends(require("user.manage")),
) -> dict:
    return {
        "roles": {
            role: sorted(permissions_for(role))
            for role in ROLES
        }
    }
