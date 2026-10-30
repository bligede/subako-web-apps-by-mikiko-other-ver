"""Query bantu untuk nilai terakhir per pintu."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SensorReading


def attach_gate_values(db: Session, gate_id: str) -> tuple[float | None, float | None]:
    flow = db.scalars(
        select(SensorReading.value)
        .where(SensorReading.gate_id == gate_id, SensorReading.channel == "flow")
        .order_by(SensorReading.ts.desc())
        .limit(1)
    ).first()
    level = db.scalars(
        select(SensorReading.value)
        .where(SensorReading.gate_id == gate_id, SensorReading.channel == "water_level_up")
        .order_by(SensorReading.ts.desc())
        .limit(1)
    ).first()
    return (
        round(float(flow), 2) if flow is not None else None,
        round(float(level), 3) if level is not None else None,
    )
