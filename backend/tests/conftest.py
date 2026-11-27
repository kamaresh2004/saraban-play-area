"""Test configuration: isolated SQLite database per test session."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TEST_DIR = Path(tempfile.mkdtemp(prefix="saraban-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TEST_DIR / 'test.db').as_posix()}"
os.environ["SECRET_KEY"] = "saraban-test-secret-key-with-32-plus-bytes"
os.environ["ENVIRONMENT"] = "test"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def admin_token(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def reception_token(client):
    response = client.post(
        "/api/auth/login", json={"username": "reception", "password": "reception123"}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]
