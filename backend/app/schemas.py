"""Schema Pydantic untuk payload yang divalidasi ketat."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=8, max_length=128)


class CommandInput(BaseModel):
    action: Literal["SET_POSITION", "OPEN", "CLOSE", "HOLD", "RELEASE_HOLD"]
    target_pct: float | None = Field(default=None, ge=0, le=100)
    rule_version_id: str | None = None
    expected_rule_checksum: str | None = None
    reason: str = Field(min_length=10, max_length=500)


class AlertResolveInput(BaseModel):
    note: str = Field(min_length=10, max_length=500)


class AlertAcknowledgeInput(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class UserPatchInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str | None = None
    is_active: bool | None = None


class SiteAccessInput(BaseModel):
    level: Literal["VIEW", "OPERATE", "GOVERN", "ADMIN"]


class RuleDraftInput(BaseModel):
    code: str = Field(min_length=3, max_length=40)
    title: str = Field(min_length=3, max_length=160)
    effective_from: date
    tolerance_pct: float = Field(default=10, ge=0, le=50)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict[str, Any]


class Paginated(BaseModel):
    data: list[Any]
    page: dict[str, Any] = Field(default_factory=lambda: {"next_cursor": None, "has_more": False})


class MetaOut(BaseModel):
    server_time: datetime
    data_mode: str = "SIMULATION"
    freshness_policy: dict[str, int] = Field(
        default_factory=lambda: {"interval_s": 60, "stale_after_s": 120, "offline_after_s": 300}
    )
