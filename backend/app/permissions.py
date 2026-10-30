"""Sumber kebenaran RBAC Phase 1 (docs/09-rbac-matrix.md)."""

from __future__ import annotations

VIEWER = "VIEWER"
OPERATOR = "OPERATOR"
PEKASEH = "PEKASEH"
ADMIN = "ADMIN"
ROLES = (VIEWER, OPERATOR, PEKASEH, ADMIN)

ROLE_LABEL = {
    VIEWER: "Petani / Anggota",
    OPERATOR: "Operator Subak",
    PEKASEH: "Pekaseh",
    ADMIN: "Administrator Teknis",
}

_VIEWER = {
    "dashboard.view",
    "site.view",
    "telemetry.read",
    "gate.read",
    "schedule.view",
    "rule.view",
    "ledger.view",
    "alert.view",
    "report.view",
}

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    VIEWER: frozenset(_VIEWER),
    OPERATOR: frozenset(
        _VIEWER
        | {
            "device.read",
            "gate.command",
            "ledger.export",
            "alert.acknowledge",
            "alert.resolve",
            "report.export",
        }
    ),
    PEKASEH: frozenset(
        _VIEWER
        | {
            "device.read",
            "gate.command",
            "gate.command_override",
            "rule.create",
            "rule.approve",
            "rule.publish",
            "ledger.export",
            "ledger.correct",
            "alert.acknowledge",
            "alert.resolve",
            "report.export",
            "user.manage",
        }
    ),
    ADMIN: frozenset(
        {
            "dashboard.view",
            "site.view",
            "site.manage",
            "telemetry.read",
            "device.read",
            "device.manage",
            "calibration.manage",
            "gateway.manage",
            "firmware.manage",
            "gate.read",
            "schedule.view",
            "rule.view",
            "ledger.view",
            "ledger.export",
            "alert.view",
            "alert.acknowledge",
            "alert.resolve",
            "report.view",
            "report.export",
            "user.manage",
            "audit.read",
            "system.health",
        }
    ),
}

SITE_LEVELS = ("VIEW", "OPERATE", "GOVERN", "ADMIN")
SITE_LEVEL_ORDER = {level: idx for idx, level in enumerate(SITE_LEVELS)}

PERMISSION_MIN_SCOPE: dict[str, str] = {
    "gate.command": "OPERATE",
    "gate.command_override": "GOVERN",
    "rule.create": "GOVERN",
    "rule.approve": "GOVERN",
    "rule.publish": "GOVERN",
    "ledger.correct": "GOVERN",
    "alert.acknowledge": "OPERATE",
    "alert.resolve": "OPERATE",
    "user.manage": "GOVERN",
    "device.manage": "ADMIN",
    "calibration.manage": "ADMIN",
    "gateway.manage": "ADMIN",
    "firmware.manage": "ADMIN",
    "site.manage": "ADMIN",
    "audit.read": "ADMIN",
    "system.health": "ADMIN",
}


def permissions_for(role: str) -> frozenset[str]:
    return ROLE_PERMISSIONS.get(role, frozenset())


def min_scope(permission: str) -> str:
    return PERMISSION_MIN_SCOPE.get(permission, "VIEW")


def scope_allows(level: str | None, required: str) -> bool:
    if level is None:
        return False
    return SITE_LEVEL_ORDER.get(level, -1) >= SITE_LEVEL_ORDER[required]
