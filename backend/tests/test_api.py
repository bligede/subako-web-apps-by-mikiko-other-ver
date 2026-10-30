"""Tes kontrak Phase 1: RBAC nyata, siklus command, integritas ledger."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import text, update

from app.db import SessionLocal, engine
from app.models import Gate, GateState, SensorReading, Site, User
from app.security import utcnow
from app.services.ledger import verify_chain
from app.services.simulation import advance_commands


def _site_by_code(code: str) -> str:
    with SessionLocal() as db:
        return db.query(Site).filter(Site.code == code).one().id


def _gate_by_code(code: str) -> Gate:
    with SessionLocal() as db:
        return db.query(Gate).filter(Gate.code == code).one()


def _command(client, gate_id, headers, *, action="SET_POSITION", target=55.0,
             key="test-key-0001", reason="Uji otomatis aktuasi pintu"):
    return client.post(
        f"/api/v1/gates/{gate_id}/commands",
        headers={**headers, "Idempotency-Key": key},
        json={"action": action, "target_pct": target, "reason": reason},
    )


def test_permission_matrix_enforced(client, auth):
    admin = client.get("/api/v1/auth/me", headers=auth("admin@mikiko.id")).json()
    assert "gate.command" not in admin["permissions"]
    assert "rule.approve" not in admin["permissions"]
    assert "audit.read" in admin["permissions"]

    pekaseh = client.get("/api/v1/auth/me", headers=auth("pekaseh@demo")).json()
    assert {"rule.approve", "gate.command", "gate.command_override"} <= set(pekaseh["permissions"])
    assert "system.health" not in pekaseh["permissions"]

    operator = client.get("/api/v1/auth/me", headers=auth("operator@demo")).json()
    assert "gate.command" in operator["permissions"]
    assert "rule.create" not in operator["permissions"]

    viewer = client.get("/api/v1/auth/me", headers=auth("petani@demo")).json()
    assert "ledger.view" in viewer["permissions"]
    assert "device.read" not in viewer["permissions"]


def test_viewer_cannot_send_command(client, auth, gate_id):
    response = _command(client, gate_id, auth("petani@demo"))
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_admin_cannot_send_command(client, auth, gate_id):
    response = _command(client, gate_id, auth("admin@mikiko.id"))
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_operator_cannot_read_audit(client, auth):
    response = client.get("/api/v1/admin/audit", headers=auth("operator@demo"))
    assert response.status_code == 403


def test_site_scope_blocks_cross_site_read(client, auth):
    other_site = _site_by_code("SUBAK-KEDAMPAL")
    operator = auth("operator@demo")
    response = client.get(f"/api/v1/sites/{other_site}/overview", headers=operator)
    assert response.status_code == 403
    assert response.json()["code"] == "SITE_FORBIDDEN"

    admin = auth("admin@mikiko.id")
    assert client.get(f"/api/v1/sites/{other_site}/overview", headers=admin).status_code == 200


def test_command_lifecycle_writes_ledger(client, auth, gate_id):
    operator = auth("operator@demo")
    response = _command(client, gate_id, operator)
    assert response.status_code == 202, response.text
    command = response.json()
    assert command["status"] == "SENT"
    assert command["action"] == "SET_POSITION"

    with SessionLocal() as db:
        advance_commands(db, utcnow() + timedelta(seconds=1))
        db.commit()
    status = client.get(f"/api/v1/gates/{gate_id}/commands", headers=operator).json()["data"][0]
    assert status["status"] == "ACKNOWLEDGED"

    with SessionLocal() as db:
        advance_commands(db, utcnow() + timedelta(seconds=6))
        db.commit()
    detail = client.get(f"/api/v1/gates/{gate_id}", headers=operator).json()
    assert detail["state"]["position_pct"] == 55.0
    commands = client.get(f"/api/v1/gates/{gate_id}/commands", headers=operator).json()["data"]
    assert commands[0]["status"] == "EXECUTED"

    site = client.get("/api/v1/sites", headers=operator).json()["data"][0]["id"]
    verification = client.get(f"/api/v1/ledger/verify?site_id={site}", headers=operator).json()
    assert verification["status"] == "VALID"
    entries = client.get(f"/api/v1/ledger?site_id={site}", headers=operator).json()["data"]
    assert any(entry["entry_type"] == "COMMAND_EXECUTED" for entry in entries)


def test_idempotency_key_replays_same_command(client, auth, gate_id):
    operator = auth("operator@demo")
    first = _command(client, gate_id, operator, key="idem-key-abc123")
    second = _command(client, gate_id, operator, key="idem-key-abc123", target=55.0)
    assert first.status_code == 202 and second.status_code == 202
    assert first.json()["id"] == second.json()["id"]
    assert second.headers.get("Idempotent-Replayed") == "true"


def test_fault_gate_rejected(client, auth):
    gate = _gate_by_code("GATE-02")
    response = _command(client, gate.id, auth("operator@demo"), action="OPEN", target=None,
                        key="fault-key-001")
    assert response.status_code == 409
    assert response.json()["code"] == "MODE_BLOCKED"


def test_hold_release_requires_override(client, auth):
    gate = _gate_by_code("GATE-03")
    with SessionLocal() as db:
        state = db.get(GateState, gate.id)
        state.mode = "HOLD"
        db.commit()

    operator = _command(client, gate.id, auth("operator@demo"), action="RELEASE_HOLD",
                        target=None, key="hold-op-0001")
    assert operator.status_code == 403
    assert operator.json()["code"] == "OVERRIDE_REQUIRED"

    pekaseh = _command(client, gate.id, auth("pekaseh@demo"), action="RELEASE_HOLD",
                       target=None, key="hold-pk-0001")
    assert pekaseh.status_code == 202, pekaseh.text


def test_stale_telemetry_blocks_command(client, auth):
    gate = _gate_by_code("GATE-05")
    with SessionLocal() as db:
        db.execute(
            update(SensorReading)
            .where(SensorReading.gate_id == gate.id)
            .values(ts=utcnow() - timedelta(hours=1))
        )
        db.commit()
    response = _command(client, gate.id, auth("operator@demo"), key="stale-key-001")
    assert response.status_code == 409
    assert response.json()["code"] == "TELEMETRY_STALE"


def test_ledger_tamper_is_detected(client, auth, site_id):
    operator = auth("operator@demo")
    assert client.get(f"/api/v1/ledger/verify?site_id={site_id}", headers=operator).json()[
        "status"
    ] == "VALID"
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE ledger_entries SET summary = 'diubah langsung' WHERE site_id = :s AND seq = 3"),
            {"s": site_id},
        )
    result = client.get(f"/api/v1/ledger/verify?site_id={site_id}", headers=operator).json()
    assert result["status"] == "INVALID"
    assert result["first_broken_seq"] == 3


def test_deactivated_user_token_rejected(client, auth):
    headers = auth("petani@demo")
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == "petani@demo").one()
        user.is_active = False
        db.commit()
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_admin_cannot_deactivate_last_admin(client, auth):
    admin = auth("admin@mikiko.id")
    me = client.get("/api/v1/auth/me", headers=admin).json()
    response = client.patch(
        f"/api/v1/admin/users/{me['id']}", headers=admin, json={"is_active": False}
    )
    assert response.status_code == 409
    assert response.json()["code"] == "LAST_ADMIN"


def test_operator_can_resolve_alert_but_viewer_cannot(client, auth, site_id):
    alerts = client.get(f"/api/v1/alerts?site_id={site_id}", headers=auth("operator@demo")).json()
    open_alert = next(alert for alert in alerts["data"] if alert["status"] == "OPEN")
    payload = {"note": "Diperiksa langsung di lokasi, arus kembali normal."}

    denied = client.post(
        f"/api/v1/alerts/{open_alert['id']}/resolve",
        headers=auth("petani@demo"),
        json=payload,
    )
    assert denied.status_code == 403

    resolved = client.post(
        f"/api/v1/alerts/{open_alert['id']}/resolve",
        headers=auth("operator@demo"),
        json=payload,
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "RESOLVED"


def test_overview_and_history_are_populated(client, auth, site_id):
    headers = auth("petani@demo")
    overview = client.get(f"/api/v1/sites/{site_id}/overview", headers=headers).json()
    assert overview["gates_total"] == 6
    assert overview["gates"] and overview["gates"][0]["flow_lps"] is not None

    history = client.get(
        f"/api/v1/telemetry/history?site_id={site_id}&channel=flow&granularity=1h",
        headers=headers,
    ).json()
    assert len(history["data"]) > 10
    assert history["meta"]["data_mode"] == "SIMULATION"


def test_ledger_is_valid_after_seed(site_id):
    with SessionLocal() as db:
        result = verify_chain(db, site_id)
    assert result["status"] == "VALID"
    assert result["entries_checked"] >= 10
