"""Login, refresh token (cookie httpOnly), logout, dan profil efektif."""

from __future__ import annotations

from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import CurrentUser, get_current_user
from app.errors import AppError
from app.models import SiteAccess, User, UserSession
from app.presenters import me_out
from app.schemas import LoginInput
from app.security import (
    create_access_token,
    hash_refresh_token,
    new_refresh_token,
    utcnow,
    verify_password,
)
from app.services.audit import log_audit

router = APIRouter(prefix="/auth", tags=["auth"])
REFRESH_COOKIE = "subako_refresh"
COOKIE_PATH = "/api/v1/auth"
MAX_FAILED = 5
LOCK_MINUTES = 15


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw,
        max_age=settings.refresh_ttl_s,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        path=COOKIE_PATH,
    )


def _as_utc(value):
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


@router.post("/login")
def login(
    body: LoginInput,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    email = body.email.strip().lower()
    user = db.scalars(select(User).where(User.email == email)).first()
    now = utcnow()

    if user is None:
        raise AppError("INVALID_CREDENTIALS", 401, "Email atau kata sandi salah.")

    if user.locked_until and _as_utc(user.locked_until) > now:
        raise AppError(
            "ACCOUNT_LOCKED",
            423,
            "Akun terkunci sementara karena percobaan masuk gagal. Coba lagi nanti.",
        )

    if not user.is_active:
        raise AppError("ACCOUNT_INACTIVE", 403, "Akun tidak aktif.")

    if not verify_password(body.password, user.password_hash):
        user.failed_login_count += 1
        if user.failed_login_count >= MAX_FAILED:
            user.locked_until = now + timedelta(minutes=LOCK_MINUTES)
            user.failed_login_count = 0
        log_audit(
            db,
            actor_id=user.id,
            actor_label=email,
            action="LOGIN_FAILED",
            summary="Kata sandi salah",
            request_id=getattr(request.state, "request_id", None),
        )
        db.commit()
        raise AppError("INVALID_CREDENTIALS", 401, "Email atau kata sandi salah.")

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now

    raw, refresh_hash = new_refresh_token()
    session = UserSession(
        user_id=user.id,
        refresh_hash=refresh_hash,
        user_agent=(request.headers.get("user-agent") or "")[:250],
        ip=request.client.host if request.client else None,
        created_at=now,
        expires_at=now + timedelta(seconds=settings.refresh_ttl_s),
    )
    db.add(session)
    log_audit(
        db,
        actor_id=user.id,
        actor_label=user.email,
        action="LOGIN_SUCCESS",
        summary=f"Masuk sebagai {user.role}",
        request_id=getattr(request.state, "request_id", None),
    )
    db.commit()

    access, expires_in = create_access_token(user.id, user.role)
    _set_refresh_cookie(response, raw)
    sites = {
        row.site_id: row.level
        for row in db.scalars(select(SiteAccess).where(SiteAccess.user_id == user.id))
    }
    return {
        "access_token": access,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": me_out(db, user, sites),
    }


@router.post("/refresh")
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise AppError("NO_SESSION", 401, "Sesi tidak ditemukan. Silakan masuk kembali.")
    if request.headers.get("x-subako-client") != "web":
        raise AppError("CSRF_GUARD", 403, "Permintaan refresh tidak valid.")

    session = db.scalars(
        select(UserSession).where(UserSession.refresh_hash == hash_refresh_token(raw))
    ).first()
    now = utcnow()
    if (
        session is None
        or session.revoked_at is not None
        or _as_utc(session.expires_at) <= now
    ):
        raise AppError("SESSION_EXPIRED", 401, "Sesi berakhir. Silakan masuk kembali.")

    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        session.revoked_at = now
        db.commit()
        raise AppError("ACCOUNT_INACTIVE", 401, "Akun tidak aktif.")

    session.revoked_at = now
    new_raw, new_hash = new_refresh_token()
    db.add(
        UserSession(
            user_id=user.id,
            refresh_hash=new_hash,
            user_agent=(request.headers.get("user-agent") or "")[:250],
            ip=request.client.host if request.client else None,
            created_at=now,
            expires_at=now + timedelta(seconds=settings.refresh_ttl_s),
        )
    )
    db.commit()

    access, expires_in = create_access_token(user.id, user.role)
    _set_refresh_cookie(response, new_raw)
    sites = {
        row.site_id: row.level
        for row in db.scalars(select(SiteAccess).where(SiteAccess.user_id == user.id))
    }
    return {
        "access_token": access,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": me_out(db, user, sites),
    }


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        session = db.scalars(
            select(UserSession).where(UserSession.refresh_hash == hash_refresh_token(raw))
        ).first()
        if session and session.revoked_at is None:
            session.revoked_at = utcnow()
            log_audit(
                db,
                actor_id=session.user_id,
                actor_label="user",
                action="LOGOUT",
                summary="Sesi dicabut",
                request_id=getattr(request.state, "request_id", None),
            )
            db.commit()
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
    return {"status": "ok"}


@router.get("/me")
def me(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    db_user = db.get(User, user.id)
    if db_user is None:
        raise AppError("UNAUTHENTICATED", 401, "Pengguna tidak ditemukan.")
    return me_out(db, db_user, user.sites)
