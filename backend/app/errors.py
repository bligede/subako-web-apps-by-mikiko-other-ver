"""Kesalahan aplikasi dengan format `Problem` (docs/08-api-specification.md)."""

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(
        self,
        code: str,
        status: int,
        detail: str,
        errors: list[dict[str, str]] | None = None,
    ) -> None:
        super().__init__(detail)
        self.code = code
        self.status = status
        self.detail = detail
        self.errors = errors


def problem(
    status: int,
    code: str,
    detail: str,
    request_id: str | None,
    errors: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "type": "about:blank",
        "title": code.replace("_", " ").title(),
        "status": status,
        "code": code,
        "detail": detail,
        "instance": request_id,
        "request_id": request_id,
    }
    if errors:
        body["errors"] = errors
    return body


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content=problem(
            exc.status,
            exc.code,
            exc.detail,
            getattr(request.state, "request_id", None),
            exc.errors,
        ),
    )


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    raw = getattr(exc, "errors", lambda: [])()
    errors = [
        {
            "field": ".".join(str(p) for p in e.get("loc", ())[1:]) or "body",
            "message": e.get("msg", "nilai tidak valid"),
        }
        for e in raw
    ]
    return JSONResponse(
        status_code=422,
        content=problem(
            422,
            "VALIDATION_ERROR",
            "Data yang dikirim tidak valid.",
            getattr(request.state, "request_id", None),
            errors,
        ),
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=problem(
            500,
            "INTERNAL_ERROR",
            "Terjadi kesalahan internal. Hubungi administrator.",
            getattr(request.state, "request_id", None),
        ),
    )
