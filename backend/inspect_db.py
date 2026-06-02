import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

async def main():
    cols = await db.list_collection_names()
    print("Collections:", cols)
    for col_name in ["users", "user_sessions"]:
        if col_name in cols:
            print(f"\n--- Sample from {col_name} ---")
            doc = await db[col_name].find_one()
            print(doc)
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
