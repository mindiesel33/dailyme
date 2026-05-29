"""Idempotent seed of two test users + sessions for API testing.
Google OAuth can't be automated, so we insert known Bearer tokens directly.
Run: python seed_test.py
"""
import asyncio
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

USERS = [
    {"user_id": "user_test_aaa1", "email": "partner.a@test.com", "name": "Alex Rivera",
     "picture": "https://i.pravatar.cc/150?img=12", "token": "testtoken_partner_a"},
    {"user_id": "user_test_bbb2", "email": "partner.b@test.com", "name": "Sam Lee",
     "picture": "https://i.pravatar.cc/150?img=45", "token": "testtoken_partner_b"},
]


async def main():
    for u in USERS:
        await db.users.update_one(
            {"email": u["email"]},
            {"$set": {"user_id": u["user_id"], "email": u["email"], "name": u["name"],
                      "picture": u["picture"], "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        await db.user_sessions.update_one(
            {"session_token": u["token"]},
            {"$set": {"session_token": u["token"], "user_id": u["user_id"],
                      "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                      "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        print(f"Seeded {u['email']} -> token {u['token']}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
