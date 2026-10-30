"""Jadwal giliran tempek (WITA) untuk dashboard."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CurrentUser, require
from app.models import Gate, ScheduleSlot, Site, Tempek
from app.security import utcnow

router = APIRouter(prefix="/schedule", tags=["schedule"])
WITA = timezone(timedelta(hours=8))


def _minutes_label(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


@router.get("")
def schedule(
    site_id: str,
    user: CurrentUser = Depends(require("schedule.view")),
    db: Session = Depends(get_db),
) -> dict:
    user.scope().require(site_id, "VIEW")
    site = db.get(Site, site_id)
    if site is None:
        return {"data": [], "current": None}
    now_local = utcnow().astimezone(WITA)
    weekday = now_local.weekday()
    minute = now_local.hour * 60 + now_local.minute

    rows = list(
        db.scalars(
            select(ScheduleSlot).where(
                ScheduleSlot.site_id == site_id, ScheduleSlot.day_of_week == weekday
            )
        )
    )
    tempeks = {t.id: t.name for t in db.scalars(select(Tempek).where(Tempek.site_id == site_id))}
    gates = list(db.scalars(select(Gate).where(Gate.site_id == site_id).order_by(Gate.code)))
    gate_codes = [g.code for g in gates]

    data = []
    current = None
    base = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    for idx, slot in enumerate(sorted(rows, key=lambda s: s.start_minute)):
        gate_code = gate_codes[idx % len(gate_codes)] if gate_codes else None
        item = {
            "gate_code": gate_code,
            "tempek_name": tempeks.get(slot.tempek_id, "Tempek"),
            "starts_at": (base + timedelta(minutes=slot.start_minute)).isoformat(),
            "ends_at": (base + timedelta(minutes=slot.end_minute)).isoformat(),
            "entitlement_pct": slot.share_pct,
            "time_label": f"{_minutes_label(slot.start_minute)}–{_minutes_label(slot.end_minute)} WITA",
        }
        data.append(item)
        if slot.start_minute <= minute < slot.end_minute:
            progress = (minute - slot.start_minute) / max(1, slot.end_minute - slot.start_minute)
            current = {**item, "progress_pct": round(progress * 100, 1)}
    return {"data": data, "current": current, "server_time_wita": now_local.isoformat()}
