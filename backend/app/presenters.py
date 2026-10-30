"""Serializer respons agar bentuk JSON konsisten dengan docs/api/openapi.yaml."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Alert, Device, Gate, GateState, LedgerEntry, Rule, Site, User, UserSession
from app.services.commands import freshness
from app.services.ledger import as_utc


def iso(value: datetime | None) -> str | None:
    return as_utc(value).isoformat() if value else None


def site_out(site: Site) -> dict[str, Any]:
    return {
        "id": site.id,
        "code": site.code,
        "name": site.name,
        "regency": site.regency,
        "village": site.village,
        "latitude": site.lat,
        "longitude": site.lon,
        "data_mode": site.data_mode,
        "status": site.status,
        "separation_of_duties": site.separation_of_duties,
        "unit_pref": "m",
        "timezone": site.timezone,
    }


def gate_state_out(state: GateState | None) -> dict[str, Any] | None:
    if state is None:
        return None
    return {
        "gate_id": state.gate_id,
        "mode": state.mode,
        "position_pct": state.position_pct,
        "target_pct": state.target_pct,
        "actuator_state": "FAULT" if state.mode == "FAULT" else "IDLE",
        "motor_current_a": 2.84 if state.mode == "FAULT" else 1.24,
        "limit_open": state.position_pct >= 99.5,
        "limit_closed": state.position_pct <= 0.5,
        "estop": False,
        "mode_reported_at": iso(state.updated_at),
        "updated_at": iso(state.updated_at),
        "last_command_id": state.last_command_id,
    }


def gate_out(
    gate: Gate,
    state: GateState | None,
    device: Device | None,
    *,
    flow_lps: float | None = None,
    level_m: float | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    latest = device.last_seen_at if device else None
    state_freshness, age = freshness(latest, now)
    data: dict[str, Any] = {
        "id": gate.id,
        "site_id": gate.site_id,
        "code": gate.code,
        "name": gate.name,
        "tempek_name": None,
        "gate_type": "SLUICE" if gate.gate_type.startswith("SLUICE") else gate.gate_type,
        "max_opening_pct": gate.max_opening_pct,
        "design_flow_lps": gate.design_flow_lps,
        "state": gate_state_out(state),
        "device_freshness": state_freshness,
        "device_id": device.device_id if device else None,
        "battery_pct": device.battery_pct if device else None,
        "flow_lps": flow_lps,
        "level_m": level_m,
        "age_s": age,
        "is_active": gate.is_active,
    }
    return data


def alert_out(alert: Alert, actor_label: str | None = None) -> dict[str, Any]:
    return {
        "id": alert.id,
        "site_id": alert.site_id,
        "gate_id": alert.gate_id,
        "device_id": alert.device_id,
        "alert_type": alert.code,
        "severity": alert.severity,
        "status": alert.status,
        "title": alert.title,
        "first_seen_at": iso(alert.opened_at),
        "last_seen_at": iso(alert.opened_at),
        "evidence": {"message": alert.message},
        "suggested_action": None,
        "assigned_to": actor_label,
        "acknowledged_at": iso(alert.acknowledged_at),
        "resolved_at": iso(alert.resolved_at),
        "resolution_note": alert.resolution_note,
        "data_mode": "SIMULATION",
    }


def ledger_out(entry: LedgerEntry, gate_code: str | None = None) -> dict[str, Any]:
    payload = entry.payload or {}
    return {
        "id": entry.id,
        "site_id": entry.site_id,
        "seq": entry.seq,
        "occurred_at": iso(entry.ts),
        "entry_type": entry.kind,
        "kind": entry.kind,
        "summary": entry.summary,
        "gate_code": gate_code or payload.get("gate_code"),
        "tempek_name": payload.get("tempek_name"),
        "rule_version": payload.get("rule_version"),
        "entitlement_pct": payload.get("entitlement_pct"),
        "volume_m3": payload.get("volume_m3"),
        "position_before": payload.get("position_before"),
        "position_after": payload.get("position_after"),
        "measurement_status": payload.get("measurement_status"),
        "actor_type": "USER" if entry.actor_id else "SYSTEM",
        "actor_id": entry.actor_id,
        "actor_label": payload.get("actor_label"),
        "original_entry_id": payload.get("original_entry_id"),
        "reason": payload.get("reason"),
        "prev_hash": entry.prev_hash,
        "entry_hash": entry.hash,
        "data_mode": entry.data_mode,
    }


def rule_out(rule: Rule, actor_names: dict[str, str] | None = None) -> dict[str, Any]:
    payload = rule.payload or {}
    actors = actor_names or {}
    return {
        "id": rule.id,
        "site_id": rule.site_id,
        "code": rule.code,
        "version": rule.version,
        "version_no": rule.version,
        "status": rule.status,
        "effective_from": rule.effective_from.isoformat() if isinstance(rule.effective_from, date) else rule.effective_from,
        "effective_to": rule.effective_to.isoformat() if rule.effective_to else None,
        "allocation_mode": payload.get("allocation_mode", "PROPORTIONAL"),
        "tolerance_pct": payload.get("tolerance_pct", 10),
        "checksum": payload.get("checksum"),
        "meeting_reference": payload.get("meeting_reference"),
        "entitlements": payload.get("entitlements", []),
        "schedules": payload.get("schedules", []),
        "published_at": iso(rule.published_at),
        "published_by": actors.get(rule.approved_by or "", None),
        "approved_by": actors.get(rule.approved_by or "", None),
        "approved_at": iso(rule.approved_at),
        "created_by": actors.get(rule.created_by, rule.created_by),
        "created_by_id": rule.created_by,
        "created_at": iso(rule.created_at),
        "notes": rule.notes,
    }


def user_sites(db: Session, user: User) -> list[dict[str, Any]]:
    from app.models import SiteAccess

    rows = db.execute(
        select(SiteAccess, Site)
        .join(Site, Site.id == SiteAccess.site_id)
        .where(SiteAccess.user_id == user.id)
        .order_by(Site.name)
    ).all()
    return [
        {"id": site.id, "name": site.name, "level": access.level, "data_mode": site.data_mode}
        for access, site in rows
    ]


def user_out(db: Session, user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "sites": user_sites(db, user),
        "last_login_at": iso(user.last_login_at),
    }


def me_out(db: Session, user: User, sites: dict[str, str]) -> dict[str, Any]:
    from app.permissions import permissions_for

    rows = db.execute(
        select(Site).where(Site.id.in_(list(sites.keys())))
    ).scalars()
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "permissions": sorted(permissions_for(user.role)),
        "sites": [
            {"id": site.id, "name": site.name, "level": sites[site.id], "data_mode": site.data_mode}
            for site in rows
        ],
        "requires_password_change": False,
    }


def active_sessions_count(db: Session, user_id: str) -> int:
    now = datetime.now(timezone.utc)
    rows = db.scalars(
        select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
    )
    return len(list(rows))
