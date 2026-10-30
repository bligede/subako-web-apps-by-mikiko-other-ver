"""Autentikasi request + penegakan RBAC berlapis."""

from __future__ import annotations

from dataclasses import dataclass, field

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models import AuditEvent, SiteAccess, User
from app.permissions import min_scope, permissions_for, scope_allows
from app.security import decode_access_token

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    full_name: str
    role: str
    permissions: frozenset[str]
    sites: dict[str, str] = field(default_factory=dict)

    def can(self, permission: str) -> bool:
        return permission in self.permissions

    def scope(self) -> "SiteScope":
        return SiteScope(self.sites, self.email)


@dataclass(frozen=True)
class SiteScope:
    levels: dict[str, str]
    actor: str

    def require(self, site_id: str, level: str = "VIEW") -> None:
        if not scope_allows(self.levels.get(site_id), level):
            raise AppError(
                "SITE_FORBIDDEN",
                403,
                "Anda tidak memiliki akses yang cukup ke site ini.",
            )

    def level(self, site_id: str) -> str | None:
        return self.levels.get(site_id)


def _unauthorized(detail: str = "Autentikasi diperlukan.") -> AppError:
    return AppError("UNAUTHENTICATED", 401, detail)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise _unauthorized()
    payload = decode_access_token(credentials.credentials)
    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise _unauthorized("Akun tidak aktif atau tidak ditemukan.")
    if user.role != payload.get("role"):
        raise _unauthorized("Role akun berubah. Silakan masuk kembali.")

    access = {
        row.site_id: row.level
        for row in db.scalars(select(SiteAccess).where(SiteAccess.user_id == user.id))
    }
    return CurrentUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        permissions=permissions_for(user.role),
        sites=access,
    )


def require(permission: str):
    """Dependency factory: permission + audit penolakan."""

    def _dep(
        request: Request,
        user: CurrentUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> CurrentUser:
        if not user.can(permission):
            db.add(
                AuditEvent(
                    actor_id=user.id,
                    actor_label=user.email,
                    action="ACCESS_DENIED",
                    permission=permission,
                    entity_type="endpoint",
                    request_id=getattr(request.state, "request_id", None),
                    summary=f"403: role {user.role} tidak memiliki {permission}",
                )
            )
            db.commit()
            raise AppError(
                "FORBIDDEN",
                403,
                f"Role {user.role} tidak memiliki izin '{permission}'.",
            )
        return user

    return _dep


def require_site(scope: SiteScope, site_id: str, permission: str) -> None:
    """Cek izin site dengan level minimum sesuai permission."""
    scope.require(site_id, min_scope(permission))
