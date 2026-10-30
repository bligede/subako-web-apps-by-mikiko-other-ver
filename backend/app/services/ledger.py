"""Ledger hash-chain: hash chain + entri append-only, bukan blockchain."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import LedgerEntry
from app.security import utcnow

GENESIS_HASH = "0" * 64


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def canonical(
    *,
    prev_hash: str,
    seq: int,
    site_id: str,
    ts: datetime,
    kind: str,
    ref_id: str | None,
    summary: str,
    payload: dict[str, Any] | None,
) -> str:
    body = "|".join(
        [
            prev_hash,
            str(seq),
            site_id,
            as_utc(ts).isoformat(),
            kind,
            ref_id or "",
            summary,
            json.dumps(payload or {}, sort_keys=True, separators=(",", ":"), default=str),
        ]
    )
    return hashlib.sha256(body.encode()).hexdigest()


def last_entry(db: Session, site_id: str) -> LedgerEntry | None:
    return db.scalars(
        select(LedgerEntry)
        .where(LedgerEntry.site_id == site_id)
        .order_by(LedgerEntry.seq.desc())
        .limit(1)
    ).first()


def append_entry(
    db: Session,
    *,
    site_id: str,
    kind: str,
    summary: str,
    ref_type: str | None = None,
    ref_id: str | None = None,
    actor_id: str | None = None,
    data_mode: str = "SIMULATION",
    payload: dict[str, Any] | None = None,
    ts: datetime | None = None,
) -> LedgerEntry:
    previous = last_entry(db, site_id)
    seq = (previous.seq + 1) if previous else 1
    prev_hash = previous.hash if previous else GENESIS_HASH
    occurred = ts or utcnow()
    entry = LedgerEntry(
        site_id=site_id,
        seq=seq,
        ts=occurred,
        kind=kind,
        ref_type=ref_type,
        ref_id=ref_id,
        summary=summary,
        actor_id=actor_id,
        data_mode=data_mode,
        payload=payload,
        prev_hash=prev_hash,
        hash=canonical(
            prev_hash=prev_hash,
            seq=seq,
            site_id=site_id,
            ts=occurred,
            kind=kind,
            ref_id=ref_id,
            summary=summary,
            payload=payload,
        ),
    )
    db.add(entry)
    db.flush()
    return entry


def verify_chain(db: Session, site_id: str) -> dict[str, Any]:
    entries = list(
        db.scalars(
            select(LedgerEntry)
            .where(LedgerEntry.site_id == site_id)
            .order_by(LedgerEntry.seq.asc())
        )
    )
    prev = GENESIS_HASH
    broken: int | None = None
    for entry in entries:
        expected = canonical(
            prev_hash=prev,
            seq=entry.seq,
            site_id=entry.site_id,
            ts=entry.ts,
            kind=entry.kind,
            ref_id=entry.ref_id,
            summary=entry.summary,
            payload=entry.payload,
        )
        if entry.prev_hash != prev or entry.hash != expected:
            broken = entry.seq
            break
        prev = entry.hash
    return {
        "site_id": site_id,
        "from": as_utc(entries[0].ts).isoformat() if entries else utcnow().isoformat(),
        "to": as_utc(entries[-1].ts).isoformat() if entries else utcnow().isoformat(),
        "entries_checked": len(entries),
        "status": "VALID" if broken is None else "INVALID",
        "first_broken_seq": broken,
        "seals_checked": 0,
        "seals_matched": 0,
        "last_entry_hash": entries[-1].hash if entries else GENESIS_HASH,
        "verified_at": utcnow().isoformat(),
    }
