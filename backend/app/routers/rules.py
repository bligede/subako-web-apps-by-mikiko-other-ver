"""Rule tata kelola air (Phase 1: baca; siklus penuh di Phase 4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CurrentUser, require
from app.errors import AppError
from app.models import Rule, User
from app.presenters import rule_out

router = APIRouter(prefix="/rules", tags=["rules"])


def _actors(db: Session, rules: list[Rule]) -> dict[str, str]:
    ids = {r.created_by for r in rules} | {r.approved_by for r in rules if r.approved_by}
    if not ids:
        return {}
    return {u.id: u.full_name for u in db.scalars(select(User).where(User.id.in_(ids)))}


@router.get("")
def list_rules(
    site_id: str,
    status: str | None = Query(None),
    user: CurrentUser = Depends(require("rule.view")),
    db: Session = Depends(get_db),
) -> dict:
    user.scope().require(site_id, "VIEW")
    stmt = select(Rule).where(Rule.site_id == site_id)
    if status:
        stmt = stmt.where(Rule.status == status)
    rules = list(db.scalars(stmt.order_by(Rule.code, Rule.version.desc())))
    actors = _actors(db, rules)
    return {"data": [rule_out(rule, actors) for rule in rules]}


@router.get("/{rule_id}")
def rule_detail(
    rule_id: str,
    user: CurrentUser = Depends(require("rule.view")),
    db: Session = Depends(get_db),
) -> dict:
    rule = db.get(Rule, rule_id)
    if rule is None:
        raise AppError("RULE_NOT_FOUND", 404, "Rule tidak ditemukan.")
    user.scope().require(rule.site_id, "VIEW")
    return rule_out(rule, _actors(db, [rule]))
