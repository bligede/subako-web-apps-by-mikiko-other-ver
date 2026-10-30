"""Helper audit trail (append-only)."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent
from app.security import utcnow


def log_audit(
    db: Session,
    *,
    actor_id: str | None,
    actor_label: str,
    action: str,
    summary: str,
    site_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    permission: str | None = None,
    request_id: str | None = None,
    data: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        ts=utcnow(),
        actor_id=actor_id,
        actor_label=actor_label,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        site_id=site_id,
        permission=permission,
        request_id=request_id,
        summary=summary,
        data=data,
    )
    db.add(event)
    return event
