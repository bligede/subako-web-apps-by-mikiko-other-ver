"""Telemetri terbaru dan riwayat (agregasi aman untuk chart)."""

from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CurrentUser, require
from app.errors import AppError
from app.models import Device, Gate, SensorReading
from app.presenters import iso
from app.security import utcnow
from app.services.commands import freshness

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


def _ensure_site(user: CurrentUser, site_id: str) -> None:
    user.scope().require(site_id, "VIEW")


@router.get("/latest")
def latest(
    site_id: str,
    user: CurrentUser = Depends(require("telemetry.read")),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_site(user, site_id)
    now = utcnow()
    devices = list(
        db.scalars(select(Device).where(Device.site_id == site_id, Device.status == "ACTIVE"))
    )
    gate_codes = {
        gate.id: gate.code for gate in db.scalars(select(Gate).where(Gate.site_id == site_id))
    }
    out = []
    for device in devices:
        cutoff = now - timedelta(minutes=15)
        rows = list(
            db.scalars(
                select(SensorReading)
                .where(SensorReading.device_id == device.device_id, SensorReading.ts >= cutoff)
                .order_by(SensorReading.ts.desc())
                .limit(80)
            )
        )
        if not rows:
            continue
        latest_by_channel: dict[str, SensorReading] = {}
        for row in rows:
            latest_by_channel.setdefault(row.channel, row)
        ts = max(row.ts for row in rows)
        state_freshness, age = freshness(ts, now)
        out.append(
            {
                "device_id": device.id,
                "device_code": device.device_id,
                "gate_id": device.gate_id,
                "gate_code": gate_codes.get(device.gate_id or ""),
                "site_id": site_id,
                "ts": iso(ts),
                "freshness": state_freshness,
                "age_s": age,
                "channels": {
                    channel: {
                        "ts": iso(row.ts),
                        "value": row.value,
                        "unit": row.unit,
                        "quality": row.quality,
                    }
                    for channel, row in latest_by_channel.items()
                },
            }
        )
    return {"data": out}


@router.get("/history")
def history(
    site_id: str,
    channel: str = Query("flow"),
    gate_id: str | None = None,
    device_id: str | None = None,
    from_ts: datetime | None = Query(None, alias="from"),
    to_ts: datetime | None = Query(None, alias="to"),
    granularity: str = Query("1m", pattern="^(raw|1m|1h)$"),
    limit: int = Query(300, ge=1, le=2000),
    user: CurrentUser = Depends(require("telemetry.read")),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_site(user, site_id)
    now = utcnow()
    start = from_ts or (now - timedelta(hours=24))
    end = to_ts or now
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    stmt = select(SensorReading).where(
        SensorReading.site_id == site_id,
        SensorReading.channel == channel,
        SensorReading.ts >= start,
        SensorReading.ts <= end,
    )
    if gate_id:
        stmt = stmt.where(SensorReading.gate_id == gate_id)
    if device_id:
        stmt = stmt.where(SensorReading.device_id == device_id)
    rows = list(db.scalars(stmt.order_by(SensorReading.ts.asc())))

    if not rows:
        return {
            "data": [],
            "meta": {
                "server_time": now.isoformat(),
                "data_mode": "SIMULATION",
                "freshness_policy": {"interval_s": 60, "stale_after_s": 120, "offline_after_s": 300},
                "channel": channel,
                "unit": None,
                "quality": {"MEASURED": 0, "ESTIMATED": 0},
            },
        }

    unit = rows[-1].unit
    bucket_seconds = 0 if granularity == "raw" else (60 if granularity == "1m" else 3600)
    points: OrderedDict[int, dict] = OrderedDict()
    for row in rows:
        ts = row.ts if row.ts.tzinfo else row.ts.replace(tzinfo=timezone.utc)
        key = int(ts.timestamp()) // bucket_seconds * bucket_seconds if bucket_seconds else int(
            ts.timestamp()
        )
        bucket = points.setdefault(
            key,
            {"ts": datetime.fromtimestamp(key, tz=timezone.utc), "sum": 0.0, "n": 0, "estimated": 0},
        )
        bucket["sum"] += row.value
        bucket["n"] += 1
        bucket["estimated"] += 1 if row.quality == "ESTIMATED" else 0

    aggregate = channel in {"flow", "volume"}
    data = []
    for bucket in points.values():
        value = bucket["sum"] if aggregate else bucket["sum"] / bucket["n"]
        data.append(
            {
                "ts": bucket["ts"].isoformat(),
                "value": round(value, 3),
                "quality": "ESTIMATED" if bucket["estimated"] else "OK",
                "derived": bucket["estimated"] > 0,
            }
        )
    if len(data) > limit:
        step = max(1, len(data) // limit)
        data = data[::step][:limit]

    quality_count = {
        "MEASURED": sum(1 for row in rows if row.quality == "MEASURED"),
        "ESTIMATED": sum(1 for row in rows if row.quality == "ESTIMATED"),
    }
    return {
        "data": data,
        "meta": {
            "server_time": now.isoformat(),
            "data_mode": "SIMULATION",
            "freshness_policy": {"interval_s": 60, "stale_after_s": 120, "offline_after_s": 300},
            "channel": channel,
            "unit": unit,
            "quality": quality_count,
            "granularity": granularity,
        },
    }
