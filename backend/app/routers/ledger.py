"""Water Ledger: baca entri dan verifikasi hash-chain."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CurrentUser, require
from app.models import Gate, LedgerEntry
from app.presenters import ledger_out
from app.services.ledger import verify_chain

router = APIRouter(prefix="/ledger", tags=["ledger"])


@router.get("")
def list_entries(
    site_id: str,
    limit: int = Query(50, ge=1, le=200),
    before_seq: int | None = Query(None),
    user: CurrentUser = Depends(require("ledger.view")),
    db: Session = Depends(get_db),
) -> dict:
    user.scope().require(site_id, "VIEW")
    stmt = select(LedgerEntry).where(LedgerEntry.site_id == site_id)
    if before_seq is not None:
        stmt = stmt.where(LedgerEntry.seq < before_seq)
    rows = list(db.scalars(stmt.order_by(LedgerEntry.seq.desc()).limit(limit)))
    gate_codes = {
        gate.id: gate.code
        for gate in db.scalars(select(Gate).where(Gate.site_id == site_id))
    }
    data = []
    for entry in rows:
        code = None
        if entry.ref_type == "GATE" and entry.ref_id:
            code = gate_codes.get(entry.ref_id)
        data.append(ledger_out(entry, code))
    return {
        "data": data,
        "page": {"next_cursor": str(rows[-1].seq) if rows else None, "has_more": len(rows) == limit},
    }


@router.get("/verify")
def verify(
    site_id: str,
    user: CurrentUser = Depends(require("ledger.view")),
    db: Session = Depends(get_db),
) -> dict:
    user.scope().require(site_id, "VIEW")
    result = verify_chain(db, site_id)
    result["verified_by"] = user.email
    return result
