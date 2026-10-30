"""Alert: daftar, acknowledge, resolve (dengan jejak ledger)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CurrentUser, require
from app.errors import AppError
from app.models import Alert
from app.presenters import alert_out
from app.schemas import AlertAcknowledgeInput, AlertResolveInput
from app.security import utcnow
from app.services.audit import log_audit
from app.services.ledger import append_entry

router = APIRouter(prefix="/alerts", tags=["alerts"])


def get_alert(db: Session, alert_id: str) -> Alert:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise AppError("ALERT_NOT_FOUND", 404, "Peringatan tidak ditemukan.")
    return alert


@router.get("")
def list_alerts(
    site_id: str,
    status: str | None = None,
    user: CurrentUser = Depends(require("alert.view")),
    db: Session = Depends(get_db),
) -> dict:
    user.scope().require(site_id, "VIEW")
    stmt = select(Alert).where(Alert.site_id == site_id)
    if status:
        stmt = stmt.where(Alert.status == status)
    rows = list(db.scalars(stmt.order_by(Alert.opened_at.desc()).limit(100)))
    return {"data": [alert_out(row) for row in rows]}


@router.get("/summary")
def summary(
    site_id: str,
    user: CurrentUser = Depends(require("alert.view")),
    db: Session = Depends(get_db),
) -> dict:
    user.scope().require(site_id, "VIEW")
    rows = list(db.scalars(select(Alert).where(Alert.site_id == site_id)))
    return {
        "open": sum(1 for a in rows if a.status == "OPEN"),
        "acknowledged": sum(1 for a in rows if a.status == "ACKNOWLEDGED"),
        "resolved": sum(1 for a in rows if a.status == "RESOLVED"),
        "critical": sum(1 for a in rows if a.severity == "CRITICAL" and a.status != "RESOLVED"),
        "warning": sum(1 for a in rows if a.severity == "WARNING" and a.status != "RESOLVED"),
        "info": sum(1 for a in rows if a.severity in {"INFO", "LOW"} and a.status != "RESOLVED"),
    }


@router.post("/{alert_id}/acknowledge")
def acknowledge(
    alert_id: str,
    body: AlertAcknowledgeInput,
    request: Request,
    user: CurrentUser = Depends(require("alert.acknowledge")),
    db: Session = Depends(get_db),
) -> dict:
    alert = get_alert(db, alert_id)
    user.scope().require(alert.site_id, "OPERATE")
    if alert.status != "OPEN":
        raise AppError("ALERT_NOT_OPEN", 409, "Hanya alert berstatus OPEN yang dapat diakui.")
    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_by = user.id
    alert.acknowledged_at = utcnow()
    log_audit(
        db,
        actor_id=user.id,
        actor_label=user.email,
        action="ALERT_ACKNOWLEDGED",
        summary=f"Mengakui alert: {alert.title}",
        site_id=alert.site_id,
        entity_type="alert",
        entity_id=alert.id,
        permission="alert.acknowledge",
        request_id=getattr(request.state, "request_id", None),
    )
    db.commit()
    return alert_out(alert, user.full_name)


@router.post("/{alert_id}/resolve")
def resolve(
    alert_id: str,
    body: AlertResolveInput,
    request: Request,
    user: CurrentUser = Depends(require("alert.resolve")),
    db: Session = Depends(get_db),
) -> dict:
    alert = get_alert(db, alert_id)
    user.scope().require(alert.site_id, "OPERATE")
    if alert.status == "RESOLVED":
        raise AppError("ALERT_ALREADY_RESOLVED", 409, "Alert sudah diselesaikan.")
    now = utcnow()
    alert.status = "RESOLVED"
    alert.resolved_by = user.id
    alert.resolved_at = now
    alert.resolution_note = body.note
    append_entry(
        db,
        site_id=alert.site_id,
        kind="ALERT_RESOLVED",
        ref_type="ALERT",
        ref_id=alert.id,
        actor_id=user.id,
        summary=f"Menyelesaikan alert: {alert.title}",
        payload={"reason": body.note, "actor_label": user.full_name},
        ts=now,
    )
    log_audit(
        db,
        actor_id=user.id,
        actor_label=user.email,
        action="ALERT_RESOLVED",
        summary=f"Alert diselesaikan: {alert.title}",
        site_id=alert.site_id,
        entity_type="alert",
        entity_id=alert.id,
        permission="alert.resolve",
        request_id=getattr(request.state, "request_id", None),
        data={"note": body.note},
    )
    db.commit()
    return alert_out(alert, user.full_name)
