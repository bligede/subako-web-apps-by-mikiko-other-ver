from __future__ import annotations

import os

os.environ["SUBAKO_DATABASE_URL"] = "sqlite:////tmp/subako_test.db"
os.environ["SUBAKO_SIMULATION_ENABLED"] = "false"
os.environ["SUBAKO_SEED_DEMO"] = "true"
os.environ["SUBAKO_JWT_SECRET"] = "test-secret-only"

import pytest
from fastapi.testclient import TestClient

from app.db import Base, SessionLocal, engine
from app.main import app
from app.seed import DEMO_PASSWORD, seed_demo


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo(db)
    yield


@pytest.fixture
def auth(client):
    def _login(email: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
        response = client.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _login


@pytest.fixture
def site_id(client, auth):
    headers = auth("operator@demo")
    sites = client.get("/api/v1/sites", headers=headers).json()["data"]
    return next(site["id"] for site in sites if site["code"] == "SUBAK-SARI")


@pytest.fixture
def gate_id(client, auth, site_id):
    headers = auth("operator@demo")
    gates = client.get(f"/api/v1/gates?site_id={site_id}", headers=headers).json()["data"]
    return next(gate["id"] for gate in gates if gate["code"] == "GATE-01")
