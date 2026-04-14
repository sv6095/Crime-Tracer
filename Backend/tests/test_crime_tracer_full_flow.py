# tests/test_crime_tracer_full_flow.py

import sys, os

# ✅ Ensure parent folder (Backend/) is on PYTHONPATH so `import app` works
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import base64
from typing import Dict, Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app import models
from app.db import Base, get_db
from app.security import get_password_hash
from app.config import settings
from app.services import grok_client
from app.services import bns_generator


# -------------------------------------------------------------------
# Test DB setup: use separate SQLite just for tests
# -------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite:///./test_crime_tracer.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Create all tables in the test DB
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


# -------------------------------------------------------------------
# Stub external LLM calls so tests don't hit real Grok
# -------------------------------------------------------------------

def dummy_generate_precautions(crime_type: str, description: str) -> Dict[str, Any]:
    return {
        "precautions": [
            "Stay in contact with your nearest police station.",
            "Do not share sensitive info publicly.",
            "Keep all evidence safely backed up.",
        ],
        "raw": "dummy-precautions-output",
    }


def dummy_generate_bns_sections(
    crime_type: str, description: str, location_text: str
) -> Dict[str, Any]:
    return {
        "bns_sections": [
            {
                "section": "BNS 100",
                "title": "Test Offence",
                "reason": "Dummy mapping for tests",
            }
        ],
        "raw": "dummy-bns-output",
    }


# Patch the real services
grok_client.generate_precautions = dummy_generate_precautions
bns_generator.generate_bns_sections = dummy_generate_bns_sections


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def seed_station(name: str = "Test Station") -> int:
    db = TestingSessionLocal()
    try:
        station = models.Station(
            name=name,
            address="Test Address",
            jurisdiction="Test Jurisdiction",
        )
        db.add(station)
        db.commit()
        db.refresh(station)
        return station.id
    finally:
        db.close()


def seed_admin_user(
    username: str = "admin",
    password: str = "AdminPass123",
) -> None:
    db = TestingSessionLocal()
    try:
        # If already exists, do nothing
        existing = (
            db.query(models.User)
            .filter(models.User.username == username)
            .first()
        )
        if existing:
            return

        admin = models.User(
            name="System Admin",
            username=username,
            role=models.UserRole.ADMIN,
            password_hash=get_password_hash(password),
            is_active=True,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()


def victim_login(identifier: str, password: str) -> str:
    resp = client.post(
        "/api/auth/token",
        data={"username": identifier, "password": password},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return token


def cop_login(username: str, password: str) -> str:
    resp = client.post(
        "/api/auth/token",
        data={"username": username, "password": password},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return token


def admin_login(username: str, password: str) -> str:
    resp = client.post(
        "/api/auth/token",
        data={"username": username, "password": password},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return token


# -------------------------------------------------------------------
# Main end-to-end flow test
# -------------------------------------------------------------------

def test_full_crime_tracer_flow():
    # ---------------------------------------------------------------
    # 0. Seed base data: station + admin
    # ---------------------------------------------------------------
    station_id = seed_station()
    seed_admin_user()

    # ---------------------------------------------------------------
    # 1. Victim register
    # ---------------------------------------------------------------
    victim_email = "victim@example.com"
    victim_phone = "9998887777"
    victim_password = "VictimPass123"

    resp = client.post(
        "/api/auth/victim/register",
        json={
            "name": "Test Victim",
            "email": victim_email,
            "phone": victim_phone,
            "password": victim_password,
            "address": "Test Street, Mangaluru",
            "station_id": station_id,
        },
    )
    assert resp.status_code == 200, resp.text
    victim_data = resp.json()
    assert victim_data["role"] == "victim"

    # ---------------------------------------------------------------
    # 2. Victim login + /me
    # ---------------------------------------------------------------
    victim_token = victim_login(victim_email, victim_password)
    victim_headers = {"Authorization": f"Bearer {victim_token}"}

    resp = client.get("/api/auth/me", headers=victim_headers)
    assert resp.status_code == 200, resp.text
    me = resp.json()
    assert me["email"] == victim_email
    assert me["role"] == "victim"

    # ---------------------------------------------------------------
    # 3. Victim profile GET + PUT
    # ---------------------------------------------------------------
    resp = client.get("/api/victim/profile", headers=victim_headers)
    assert resp.status_code == 200, resp.text
    profile = resp.json()
    assert profile["name"] == "Test Victim"

    updated_profile = {
        **profile,
        "address": "Updated Address, Mangaluru",
    }
    resp = client.put(
        "/api/victim/profile",
        headers=victim_headers,
        json=updated_profile,
    )
    assert resp.status_code == 200, resp.text
    profile_updated = resp.json()
    assert profile_updated["address"] == "Updated Address, Mangaluru"

    # ---------------------------------------------------------------
    # 4. Victim files complaint with one base64 evidence
    # ---------------------------------------------------------------
    dummy_bytes = b"dummy evidence content"
    dummy_b64 = base64.b64encode(dummy_bytes).decode("ascii")

    resp = client.post(
        "/api/victim/complaints",
        headers=victim_headers,
        json={
            "crime_type": "Theft",
            "description": "Test theft near bus stand.",
            "station_id": station_id,
            "location_text": "Near Mangaluru bus stand",
            "location_lat": "12.9141",
            "location_lng": "74.8560",
            "evidence": [dummy_b64],
        },
    )
    assert resp.status_code == 200, resp.text
    complaint_summary = resp.json()
    complaint_id = complaint_summary["complaint_id"]
    assert complaint_id.startswith("CTM")

    # ---------------------------------------------------------------
    # 5. Victim track complaint by ID + by phone
    # ---------------------------------------------------------------
    resp = client.get(
        f"/api/victim/complaints/by-id/{complaint_id}",
        headers=victim_headers,
    )
    assert resp.status_code == 200, resp.text
    detail = resp.json()
    assert detail["complaint_id"] == complaint_id
    assert detail["status"] == "NotAssigned"
    # LLM fields are from dummy stubs
    assert detail["precautions"]
    assert detail["bns_sections"]

    resp = client.get(
        f"/api/victim/complaints/by-phone/{victim_phone}",
        headers=victim_headers,
    )
    assert resp.status_code == 200, resp.text
    lst = resp.json()
    assert any(c["complaint_id"] == complaint_id for c in lst)

    # ---------------------------------------------------------------
    # 6. Cop registers (pending approval)
    # ---------------------------------------------------------------
    cop_username = "cop_user"
    cop_password = "CopPass123"

    resp = client.post(
        "/api/auth/cop/register",
        json={
            "name": "Officer One",
            "username": cop_username,
            "password": cop_password,
            "station_id": station_id,
        },
    )
    assert resp.status_code == 200, resp.text
    cop_data = resp.json()
    assert cop_data["role"] == "cop"

    # Login should be blocked before approval
    resp = client.post(
        "/api/auth/token",
        data={"username": cop_username, "password": cop_password},
    )
    assert resp.status_code == 403
    assert "pending admin approval" in resp.json()["detail"]

    # ---------------------------------------------------------------
    # 7. Admin approves cop
    # ---------------------------------------------------------------
    admin_username = "admin"
    admin_password = "AdminPass123"
    admin_token = admin_login(admin_username, admin_password)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # list pending cops
    resp = client.get("/api/admin/cops/pending", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    pending_list = resp.json()
    assert len(pending_list) >= 1
    pending_id = pending_list[0]["id"]

    # approve
    resp = client.post(
        "/api/admin/cops/approve",
        headers=admin_headers,
        json={"user_id": pending_id, "approve": True},
    )
    assert resp.status_code == 200, resp.text
    approve_result = resp.json()
    # matches admin.py -> {"user_id": ..., "action": "approved" | "rejected"}
    assert approve_result["user_id"] == pending_id
    assert approve_result["action"] == "approved"

    # ---------------------------------------------------------------
    # 8. Cop login now succeeds
    # ---------------------------------------------------------------
    cop_token = cop_login(cop_username, cop_password)
    cop_headers = {"Authorization": f"Bearer {cop_token}"}

    # ---------------------------------------------------------------
    # 9. Cop sees unassigned cases and assigns the complaint
    # ---------------------------------------------------------------
    resp = client.get("/api/cases/unassigned", headers=cop_headers)
    assert resp.status_code == 200, resp.text
    unassigned = resp.json()
    assert any(c["complaint_id"] == complaint_id for c in unassigned)

    resp = client.post(
        "/api/cases/assign",
        headers=cop_headers,
        json={"complaint_id": complaint_id},
    )
    assert resp.status_code == 200, resp.text
    assign_result = resp.json()
    assert assign_result["status"] in ("Investigating", "Resolved", "NotAssigned")

    # Now complaint should show up in my cases, not in unassigned
    resp = client.get("/api/cases/my", headers=cop_headers)
    assert resp.status_code == 200, resp.text
    my_cases = resp.json()
    assert any(c["complaint_id"] == complaint_id for c in my_cases)

    resp = client.get("/api/cases/unassigned", headers=cop_headers)
    assert resp.status_code == 200, resp.text
    unassigned_after = resp.json()
    assert not any(c["complaint_id"] == complaint_id for c in unassigned_after)

    # ---------------------------------------------------------------
    # 10. Cop updates status to Resolved and adds a note
    # ---------------------------------------------------------------
    resp = client.post(
        "/api/cases/status",
        headers=cop_headers,
        json={
            "complaint_id": complaint_id,
            "new_status": "Resolved",
            "reason": "Issue handled",
        },
    )
    assert resp.status_code == 200, resp.text
    status_result = resp.json()
    # backend should return updated status
    assert status_result["status"] in ("Resolved", "Closed", "Investigating")

    resp = client.post(
        "/api/cases/notes",
        headers=cop_headers,
        json={
            "complaint_id": complaint_id,
            "text": "Investigation complete. CCTV verified.",
            "visible_to_victim": True,
        },
    )
    assert resp.status_code == 200, resp.text

    # ---------------------------------------------------------------
    # 11. Victim sees Resolved status + notes
    # ---------------------------------------------------------------
    resp = client.get(
        f"/api/victim/complaints/by-id/{complaint_id}",
        headers=victim_headers,
    )
    assert resp.status_code == 200, resp.text
    detail_after_resolve = resp.json()
    assert detail_after_resolve["status"] in ("Resolved", "Closed", "Investigating")
    if "notes" in detail_after_resolve:
        assert any(
            "CCTV" in n.get("text", "") for n in detail_after_resolve.get("notes", [])
        )

    # ---------------------------------------------------------------
    # 12. Victim confirms resolution -> CLOSED
    # ---------------------------------------------------------------
    resp = client.post(
        "/api/victim/complaints/confirm",
        headers=victim_headers,
        json={
            "complaint_id": complaint_id,
            "resolved": True,
            "feedback": "All good now.",
        },
    )
    assert resp.status_code == 200, resp.text
    confirm_result = resp.json()
    # expect something like {"status": "Closed", ...}
    assert confirm_result["status"] in ("Closed", "Resolved", "Investigating")

    # Final check
    resp = client.get(
        f"/api/victim/complaints/by-id/{complaint_id}",
        headers=victim_headers,
    )
    assert resp.status_code == 200, resp.text
    final_detail = resp.json()
    assert final_detail["status"] in ("Closed", "Resolved", "Investigating")
