"""SUBAKO API — Phase 1 (auth, RBAC, telemetry simulasi, command, ledger)."""

from __future__ import annotations

import asyncio
import contextlib
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal, create_all
from app.errors import (
    AppError,
    app_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.routers import admin, alerts, auth, gates, ledger, rules, schedule, sites, telemetry
from app.seed import seed_demo
from app.services.simulation import run_simulator


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_all()
    if settings.seed_demo:
        with SessionLocal() as db:
            created = seed_demo(db)
            if created:
                print("[seed] data demo dibuat (mode SIMULATION)")
    stop = asyncio.Event()
    task: asyncio.Task | None = None
    if settings.simulation_enabled:
        task = asyncio.create_task(run_simulator(stop))
    try:
        yield
    finally:
        stop.set()
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


app = FastAPI(
    title="SUBAKO API",
    version=settings.version,
    description=(
        "Smart Irrigation Management Platform untuk subak Bali. Phase 1: fondasi "
        "autentikasi, RBAC, telemetri SIMULATION, command aktuasi, dan Water Ledger."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Subako-Client"],
    expose_headers=["X-Request-ID", "Idempotent-Replayed"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = uuid.uuid4().hex[:12]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/healthz", tags=["ops"])
def healthz() -> dict:
    db_ok = True
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "version": settings.version,
        "env": settings.env,
        "database": "ok" if db_ok else "error",
        "simulation": settings.simulation_enabled,
        "data_mode": "SIMULATION",
    }


for router in (
    auth.router,
    sites.router,
    telemetry.router,
    gates.router,
    rules.router,
    schedule.router,
    ledger.router,
    alerts.router,
    admin.router,
):
    app.include_router(router, prefix="/api/v1")
