"""Shared fixtures for Daily Dose of Me backend tests."""
import os
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

# Load backend env so we can directly clean test collections between flows
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Resolve base URL: prefer EXPO_BACKEND_URL, fall back to frontend's EXPO_PUBLIC_BACKEND_URL
BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://dose-journal-2.preview.emergentagent.com"
).rstrip("/")

TOKEN_A = "testtoken_partner_a"
TOKEN_B = "testtoken_partner_b"
USER_A_ID = "user_test_aaa1"
USER_B_ID = "user_test_bbb2"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def headers_a():
    return {"Authorization": f"Bearer {TOKEN_A}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def headers_b():
    return {"Authorization": f"Bearer {TOKEN_B}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    yield db
    client.close()


@pytest.fixture
def clean_couple_state(mongo_db):
    """Drop couple-dependent collections so create/join tests run fresh.
    Users + sessions are kept (they are seeded)."""
    for col in ["couples", "memories", "trivia", "challenges", "wagers", "question_answers"]:
        mongo_db[col].delete_many({})
    yield


@pytest.fixture
def linked_couple(mongo_db, base_url, headers_a, headers_b):
    """Ensure both seeded users are linked into a single couple. Returns couple dict."""
    # Wipe any half-formed state
    for col in ["couples", "memories", "trivia", "challenges", "wagers", "question_answers"]:
        mongo_db[col].delete_many({})
    r1 = requests.post(f"{base_url}/api/couple/create", headers=headers_a, timeout=30)
    assert r1.status_code == 200, r1.text
    invite = r1.json()["invite_code"]
    r2 = requests.post(
        f"{base_url}/api/couple/join",
        headers=headers_b,
        json={"invite_code": invite},
        timeout=30,
    )
    assert r2.status_code == 200, r2.text
    couple = r2.json()
    assert couple["is_linked"] is True
    return couple
