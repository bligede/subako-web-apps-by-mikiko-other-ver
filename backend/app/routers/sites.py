"""Site + agregat overview untuk dashboard."""

from __future__ import annotations

from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CurrentUser, require, require_site
from app.errors import AppError
from app.models import Alert, Device, Gate, GateState, SensorReading, Site
from app.presenters import gate_out, iso, site_out
from app.security import utcnow
from app.services.commands import freshness

router = APIRouter(prefix="/sites", tags=["sites"])


def get_site(db: Session, site_id: str) -> Site:
    site = db.get(Site, site_id)
    if site is None:
        raise AppError("SITE_NOT_FOUND", 404, "Site tidak ditemukan.")
    return site


@router.get("")
def list_sites(
    user: CurrentUser = Depends(require("site.view")),
    db: Session = Depends(get_db),
) -> dict:
    sites = list(db.scalars(select(Site).where(Site.id.in_(list(user.sites))).order_by(Site.name)))
    return {"data": [site_out(site) for site in sites]}


@router.get("/{site_id}")
def get_site_detail(
    site_id: str,
    user: CurrentUser = Depends(require("site.view")),
    db: Session = Depends(get_db),
) -> dict:
    user.scope().require(site_id, "VIEW")
    return site_out(get_site(db, site_id))


@router.get("/{site_id}/overview")
def site_overview(
    site_id: str,
    user: CurrentUser = Depends(require("dashboard.view")),
    db: Session = Depends(get_db),
) -> dict:
    user.scope().require(site_id, "VIEW")
    site = get_site(db, site_id)
    gates = list(db.scalars(select(Gate).where(Gate.site_id == site.id, Gate.is_active.is_(True))))
    devices = list(db.scalars(select(Device).where(Device.site_id == site.id)))
    now = utcnow()

    gate_rows: list[dict] = []
    flows: list[float] = []
    levels: list[float] = []
    latest_site_ts = None
    for gate in gates:
        device = next((d for d in devices if d.gate_id == gate.id), None)
        flow = db.scalars(
            select(SensorReading.value)
            .where(SensorReading.gate_id == gate.id, SensorReading.channel == "flow")
            .order_by(SensorReading.ts.desc())
            .limit(1)
        ).first()
        level = db.scalars(
            select(SensorReading.value)
            .where(SensorReading.gate_id == gate.id, SensorReading.channel == "water_level_up")
            .order_by(SensorReading.ts.desc())
            .limit(1)
        ).first()
        ts = db.scalars(
            select(SensorReading.ts)
            .where(SensorReading.site_id == site.id)
            .order_by(SensorReading.ts.desc())
            .limit(1)
        ).first()
        if ts and (latest_site_ts is None or ts > latest_site_ts):
            latest_site_ts = ts
        if flow is not None:
            flows.append(float(flow))
        if level is not None:
            levels.append(float(level))
        gate_rows.append(
            gate_out(
                gate,
                db.get(GateState, gate.id),
                device,
                flow_lps=flow,
                level_m=level,
                now=now,
            )
        )

    state_freshness, _ = freshness(latest_site_ts, now)
    active_devices = [d for d in devices if d.status == "ACTIVE"]
    online = [
        d
        for d in active_devices
        if d.last_seen_at and (now - (d.last_seen_at if d.last_seen_at.tzinfo else d.last_seen_at.replace(tzinfo=timezone.utc))).total_seconds() <= 300
    ]
    open_alerts = list(
        db.scalars(
            select(Alert).where(Alert.site_id == site.id, Alert.status != "RESOLVED")
        )
    )
    batteries = [d.battery_pct for d in active_devices if d.battery_pct is not None]

    return {
        "site_id": site.id,
        "site_name": site.name,
        "data_mode": site.data_mode,
        "gates_total": len(gates),
        "gates_online": sum(1 for g in gate_rows if g["device_freshness"] != "OFFLINE"),
        "gates_fault": sum(1 for g in gate_rows if (g["state"] or {}).get("mode") == "FAULT"),
        "devices_online": len(online),
        "devices_total": len(devices),
        "avg_level_m": round(sum(levels) / len(levels), 3) if levels else None,
        "total_flow_lps": round(sum(flows), 2),
        "lowest_battery_pct": min(batteries) if batteries else None,
        "alerts_open": len(open_alerts),
        "alerts_critical": sum(1 for a in open_alerts if a.severity == "CRITICAL"),
        "schedule_compliance_pct": None,
        "freshness": state_freshness,
        "last_updated": iso(latest_site_ts),
        "gates": gate_rows,
    }
