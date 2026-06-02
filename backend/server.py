from fastapi import FastAPI, APIRouter, Header, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import random
import json
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta, date
import httpx

from content import (
    DAILY_QUESTIONS,
    DAILY_QUESTIONS_ES,
    TRIVIA_CATEGORIES,
    CATEGORY_LABELS,
    CHALLENGE_FALLBACKS,
    CHALLENGE_FALLBACKS_ES,
)


def norm_lang(lang: Optional[str]) -> str:
    return "es" if (lang or "en").lower().startswith("es") else "en"

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY')
OPENROUTER_MODEL = os.environ.get('OPENROUTER_MODEL', 'deepseek/deepseek-v4-flash')
EMERGENT_SESSION_API = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ----------------------------- Helpers ---------------------------------------

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_str() -> str:
    return now_utc().strftime("%Y-%m-%d")


def week_monday_str(d: Optional[date] = None) -> str:
    d = d or now_utc().date()
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def gen_invite_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(6))


async def call_openrouter(system: str, user: str, max_tokens: int = 800) -> Optional[str]:
    """Call DeepSeek V4 Flash via OpenRouter. Returns text content or None on failure."""
    if not OPENROUTER_API_KEY:
        return None
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dailydoseofme.app",
        "X-Title": "Daily Dose of Me",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.9,
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as http:
            resp = await http.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers, json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"OpenRouter call failed: {e}")
        return None


def extract_json(text: str) -> Optional[Any]:
    if not text:
        return None
    text = text.strip()
    # strip code fences
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return None
    return None


# ----------------------------- Models ----------------------------------------

class SessionRequest(BaseModel):
    access_token: str


class JoinCoupleRequest(BaseModel):
    invite_code: str


class CoupleSettingsRequest(BaseModel):
    anniversary_date: Optional[str] = None  # YYYY-MM-DD
    couple_name: Optional[str] = None
    mood: Optional[str] = None


class MemoryCreate(BaseModel):
    date: str  # YYYY-MM-DD
    media: List[str] = Field(default_factory=list)  # base64 data URIs (1-5)
    caption: Optional[str] = ""
    voice_note: Optional[str] = None  # base64 audio data URI
    voice_duration: Optional[int] = 0


class AnswerQuestionRequest(BaseModel):
    answer: str


class GenerateTriviaRequest(BaseModel):
    category: str
    lang: Optional[str] = "en"


class AnswerTriviaRequest(BaseModel):
    choice_index: int


class WagerCreate(BaseModel):
    stake: str


# ----------------------------- Auth -------------------------------------------

async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < now_utc():
            raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_my_couple(user: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return await db.couples.find_one({"member_ids": user["user_id"]}, {"_id": 0})


def require_couple(couple: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not couple:
        raise HTTPException(status_code=400, detail="You are not linked with a partner yet")
    return couple


@api_router.post("/auth/session")
async def auth_session(req: SessionRequest):
    # Verify the access token directly with Google UserInfo API
    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {req.access_token}"}
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error(f"Google Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google Access Token")

    email = data.get("email")
    name = data.get("name")
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=401, detail="Email not provided by Google")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = gen_id("user")
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": now_utc(),
        })

    session_token = secrets.token_hex(32)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc(),
        }},
        upsert=True,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user}



@api_router.get("/auth/me")
async def auth_me(user: Dict[str, Any] = Depends(get_current_user)):
    couple = await get_my_couple(user)
    return {"user": user, "has_couple": couple is not None}


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ----------------------------- Couple -----------------------------------------

async def serialize_couple(couple: Dict[str, Any]) -> Dict[str, Any]:
    members = []
    for uid in couple.get("member_ids", []):
        u = await db.users.find_one({"user_id": uid}, {"_id": 0})
        if u:
            members.append({
                "user_id": u["user_id"],
                "name": u.get("name"),
                "picture": u.get("picture"),
                "email": u.get("email"),
                "points": couple.get("points", {}).get(uid, 0),
            })
    days_together = None
    if couple.get("anniversary_date"):
        try:
            anni = datetime.strptime(couple["anniversary_date"], "%Y-%m-%d").date()
            days_together = (now_utc().date() - anni).days
        except Exception:
            days_together = None
    return {
        "couple_id": couple["couple_id"],
        "invite_code": couple.get("invite_code"),
        "couple_name": couple.get("couple_name"),
        "anniversary_date": couple.get("anniversary_date"),
        "days_together": days_together,
        "members": members,
        "points": couple.get("points", {}),
        "is_linked": len(couple.get("member_ids", [])) >= 2,
    }


@api_router.post("/couple/create")
async def couple_create(user: Dict[str, Any] = Depends(get_current_user)):
    existing = await get_my_couple(user)
    if existing:
        return await serialize_couple(existing)
    couple = {
        "couple_id": gen_id("couple"),
        "member_ids": [user["user_id"]],
        "invite_code": gen_invite_code(),
        "couple_name": None,
        "anniversary_date": None,
        "points": {user["user_id"]: 0},
        "created_at": now_utc(),
    }
    await db.couples.insert_one(couple)
    return await serialize_couple(couple)


@api_router.post("/couple/join")
async def couple_join(req: JoinCoupleRequest, user: Dict[str, Any] = Depends(get_current_user)):
    existing = await get_my_couple(user)
    if existing:
        raise HTTPException(status_code=400, detail="You are already linked with a partner")
    code = req.invite_code.strip().upper()
    couple = await db.couples.find_one({"invite_code": code})
    if not couple:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    if user["user_id"] in couple.get("member_ids", []):
        return await serialize_couple(await db.couples.find_one({"couple_id": couple["couple_id"]}, {"_id": 0}))
    if len(couple.get("member_ids", [])) >= 2:
        raise HTTPException(status_code=400, detail="This couple is already full")
    points = couple.get("points", {})
    points[user["user_id"]] = 0
    await db.couples.update_one(
        {"couple_id": couple["couple_id"]},
        {"$push": {"member_ids": user["user_id"]}, "$set": {"points": points}},
    )
    updated = await db.couples.find_one({"couple_id": couple["couple_id"]}, {"_id": 0})
    return await serialize_couple(updated)


@api_router.get("/couple")
async def couple_get(user: Dict[str, Any] = Depends(get_current_user)):
    couple = await get_my_couple(user)
    if not couple:
        return {"has_couple": False}
    out = await serialize_couple(couple)
    out["has_couple"] = True
    return out


@api_router.put("/couple/settings")
async def couple_settings(req: CoupleSettingsRequest, user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    update = {}
    if req.anniversary_date is not None:
        update["anniversary_date"] = req.anniversary_date
    if req.couple_name is not None:
        update["couple_name"] = req.couple_name
    if req.mood is not None:
        update[f"moods.{user['user_id']}"] = {"mood": req.mood, "at": now_utc().isoformat()}
    if update:
        await db.couples.update_one({"couple_id": couple["couple_id"]}, {"$set": update})
    updated = await db.couples.find_one({"couple_id": couple["couple_id"]}, {"_id": 0})
    return await serialize_couple(updated)


# ----------------------------- Memories ---------------------------------------

async def serialize_memory(m: Dict[str, Any]) -> Dict[str, Any]:
    author = await db.users.find_one({"user_id": m.get("author_id")}, {"_id": 0})
    return {
        "id": m["id"],
        "date": m["date"],
        "media": m.get("media", []),
        "caption": m.get("caption", ""),
        "voice_note": m.get("voice_note"),
        "voice_duration": m.get("voice_duration", 0),
        "author_id": m.get("author_id"),
        "author_name": author.get("name") if author else None,
        "author_picture": author.get("picture") if author else None,
        "created_at": m.get("created_at").isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at"),
    }


@api_router.post("/memories")
async def create_memory(req: MemoryCreate, user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    if len(req.media) > 5:
        raise HTTPException(status_code=400, detail="You can add up to 5 photos")
    caption = (req.caption or "")[:1500]
    duration = min(req.voice_duration or 0, 60)
    mem = {
        "id": gen_id("mem"),
        "couple_id": couple["couple_id"],
        "author_id": user["user_id"],
        "date": req.date,
        "media": req.media,
        "caption": caption,
        "voice_note": req.voice_note,
        "voice_duration": duration,
        "created_at": now_utc(),
    }
    await db.memories.insert_one(mem)
    return await serialize_memory(mem)


@api_router.get("/memories")
async def list_memories(month: Optional[str] = None, user: Dict[str, Any] = Depends(get_current_user)):
    """List memories. If month=YYYY-MM, filter to that month (for calendar dots)."""
    couple = require_couple(await get_my_couple(user))
    query = {"couple_id": couple["couple_id"]}
    if month:
        query["date"] = {"$regex": f"^{re.escape(month)}"}
    cursor = db.memories.find(query, {"_id": 0}).sort("date", -1)
    items = await cursor.to_list(500)
    return [await serialize_memory(m) for m in items]


@api_router.get("/memories/by-date/{d}")
async def memories_by_date(d: str, user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    cursor = db.memories.find({"couple_id": couple["couple_id"], "date": d}, {"_id": 0}).sort("created_at", 1)
    items = await cursor.to_list(50)
    return [await serialize_memory(m) for m in items]


@api_router.delete("/memories/{mem_id}")
async def delete_memory(mem_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    res = await db.memories.delete_one({"id": mem_id, "couple_id": couple["couple_id"], "author_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found or not yours")
    return {"ok": True}


# ----------------------------- Daily Question ---------------------------------

def question_for_date(d: str, lang: str = "en") -> Dict[str, Any]:
    # deterministic question per date; same index across languages
    ordinal = datetime.strptime(d, "%Y-%m-%d").date().toordinal()
    idx = ordinal % len(DAILY_QUESTIONS)
    bank = DAILY_QUESTIONS_ES if norm_lang(lang) == "es" else DAILY_QUESTIONS
    return {"question_id": f"q_{idx}", "text": bank[idx]}


@api_router.get("/daily/question")
async def daily_question(lang: str = "en", user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    d = today_str()
    q = question_for_date(d, lang)
    doc = await db.question_answers.find_one(
        {"couple_id": couple["couple_id"], "date": d, "question_id": q["question_id"]}, {"_id": 0}
    )
    answers = doc.get("answers", {}) if doc else {}
    my_answer = answers.get(user["user_id"])
    # Privacy: hide partner's answer until the viewer has answered.
    visible = answers if my_answer is not None else {
        k: v for k, v in answers.items() if k == user["user_id"]
    }
    return {
        "date": d,
        "question_id": q["question_id"],
        "question": q["text"],
        "answers": visible,
        "my_answer": my_answer,
    }


@api_router.post("/daily/question/answer")
async def answer_daily_question(req: AnswerQuestionRequest, lang: str = "en", user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    d = today_str()
    q = question_for_date(d, lang)
    await db.question_answers.update_one(
        {"couple_id": couple["couple_id"], "date": d, "question_id": q["question_id"]},
        {"$set": {f"answers.{user['user_id']}": req.answer[:500], "updated_at": now_utc()},
         "$setOnInsert": {"question": q["text"], "created_at": now_utc()}},
        upsert=True,
    )
    doc = await db.question_answers.find_one(
        {"couple_id": couple["couple_id"], "date": d, "question_id": q["question_id"]}, {"_id": 0}
    )
    return {"answers": doc.get("answers", {}), "question": q["text"], "date": d, "question_id": q["question_id"]}


# ----------------------------- Daily Trivia -----------------------------------

@api_router.get("/daily/trivia/categories")
async def trivia_categories(lang: str = "en", user: Dict[str, Any] = Depends(get_current_user)):
    lg = norm_lang(lang)
    return {"categories": [{"key": k, "label": CATEGORY_LABELS[k][lg]} for k in TRIVIA_CATEGORIES]}


@api_router.get("/daily/trivia")
async def get_daily_trivia(lang: str = "en", user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    d = today_str()
    doc = await db.trivia.find_one({"couple_id": couple["couple_id"], "date": d}, {"_id": 0})
    if not doc:
        return {"exists": False, "date": d}
    return _trivia_public(doc, user["user_id"], lang)


def _trivia_public(doc: Dict[str, Any], uid: str, lang: str = "en") -> Dict[str, Any]:
    lg = norm_lang(lang)
    answers = doc.get("answers", {})
    my = answers.get(uid)
    both_answered = len(answers) >= 2
    # Bilingual fields stored as question_en/_es + options_en/_es. Fall back to legacy keys.
    question = doc.get(f"question_{lg}") or doc.get("question")
    options = doc.get(f"options_{lg}") or doc.get("options")
    cat = doc.get("category")
    category = CATEGORY_LABELS.get(cat, {}).get(lg, cat)
    return {
        "exists": True,
        "date": doc["date"],
        "category": category,
        "question": question,
        "options": options,
        "chooser_id": doc.get("chooser_id"),
        "my_answer": my,  # {choice_index, correct}
        "answers": answers,
        "both_answered": both_answered,
        # only reveal correct answer once the current user has answered
        "correct_index": doc["correct_index"] if my is not None else None,
    }


@api_router.post("/daily/trivia/generate")
async def generate_trivia(req: GenerateTriviaRequest, user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    lang = norm_lang(req.lang)
    d = today_str()
    existing = await db.trivia.find_one({"couple_id": couple["couple_id"], "date": d}, {"_id": 0})
    if existing:
        return _trivia_public(existing, user["user_id"], lang)

    category = req.category if req.category in TRIVIA_CATEGORIES else random.choice(TRIVIA_CATEGORIES)
    system = (
        "You are a fun trivia master for a couples game. Generate ONE multiple-choice trivia "
        "question in BOTH English and Mexican Spanish. Return STRICT JSON only with keys: "
        "question_en (string), options_en (array of exactly 4 short strings), "
        "question_es (string, Mexican Spanish), options_es (array of exactly 4 short strings, "
        "Mexican Spanish, same order/meaning as options_en), correct_index (integer 0-3). "
        "No commentary, no markdown."
    )
    user_prompt = f"Category: {category}. Make it fun and of moderate difficulty. JSON only."
    text = await call_openrouter(system, user_prompt, max_tokens=600)
    parsed = extract_json(text) if text else None

    valid = (
        parsed
        and len(parsed.get("options_en", []) or []) == 4
        and len(parsed.get("options_es", []) or []) == 4
    )
    if not valid:
        parsed = {
            "question_en": "Which planet is known as the Red Planet?",
            "options_en": ["Venus", "Mars", "Jupiter", "Saturn"],
            "question_es": "¿Qué planeta es conocido como el Planeta Rojo?",
            "options_es": ["Venus", "Marte", "Júpiter", "Saturno"],
            "correct_index": 1,
        }

    doc = {
        "couple_id": couple["couple_id"],
        "date": d,
        "category": category,
        "chooser_id": user["user_id"],
        "question_en": str(parsed["question_en"]),
        "options_en": [str(o) for o in parsed["options_en"]][:4],
        "question_es": str(parsed["question_es"]),
        "options_es": [str(o) for o in parsed["options_es"]][:4],
        "correct_index": int(parsed["correct_index"]) % 4,
        "answers": {},
        "created_at": now_utc(),
    }
    await db.trivia.insert_one(doc)
    return _trivia_public(doc, user["user_id"], lang)


@api_router.post("/daily/trivia/answer")
async def answer_trivia(req: AnswerTriviaRequest, lang: str = "en", user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    d = today_str()
    doc = await db.trivia.find_one({"couple_id": couple["couple_id"], "date": d})
    if not doc:
        raise HTTPException(status_code=404, detail="No trivia for today yet")
    answers = doc.get("answers", {})
    if user["user_id"] in answers:
        raise HTTPException(status_code=400, detail="You already answered today's trivia")
    correct = int(req.choice_index) == int(doc["correct_index"])
    answers[user["user_id"]] = {"choice_index": int(req.choice_index), "correct": correct}
    await db.trivia.update_one({"_id": doc["_id"]}, {"$set": {"answers": answers}})
    if correct:
        await db.couples.update_one(
            {"couple_id": couple["couple_id"]},
            {"$inc": {f"points.{user['user_id']}": 1}},
        )
    fresh = await db.trivia.find_one({"couple_id": couple["couple_id"], "date": d}, {"_id": 0})
    return _trivia_public(fresh, user["user_id"], lang)


# ----------------------------- Weekly Challenge -------------------------------

async def generate_challenge_text(lang: str = "en") -> str:
    lg = norm_lang(lang)
    if lg == "es":
        system = (
            "Genera UN reto corto, juguetón y sano del mundo real para que alguien lo haga en "
            "secreto por su pareja esta semana. Una sola oración, accionable, tierno o chistoso "
            "de forma inofensiva. Usa español mexicano. Devuelve solo la oración, sin comillas ni markdown."
        )
        prompt = "Dame un nuevo reto semanal de pareja."
        fallbacks = CHALLENGE_FALLBACKS_ES
    else:
        system = (
            "You generate ONE short, playful, wholesome real-world challenge for someone to secretly "
            "do for their romantic partner this week. Keep it to a single sentence, actionable, sweet "
            "or harmlessly goofy. Return only the sentence, no quotes, no markdown."
        )
        prompt = "Give me one new weekly couple challenge."
        fallbacks = CHALLENGE_FALLBACKS
    text = await call_openrouter(system, prompt, max_tokens=160)
    if text:
        text = text.strip().strip('"').split("\n")[0]
        if 10 < len(text) < 240:
            return text
    return random.choice(fallbacks)


@api_router.get("/weekly/challenge")
async def get_weekly_challenge(lang: str = "en", user: Dict[str, Any] = Depends(get_current_user)):
    """Returns the current user's private weekly challenge (drops Monday). Auto-generates if missing.
    Also returns the partner's challenge ONLY if it has been completed (revealed)."""
    couple = require_couple(await get_my_couple(user))
    week = week_monday_str()
    uid = user["user_id"]

    mine = await db.challenges.find_one(
        {"couple_id": couple["couple_id"], "user_id": uid, "week_start": week}, {"_id": 0}
    )
    if not mine:
        text = await generate_challenge_text(lang)
        mine = {
            "id": gen_id("ch"),
            "couple_id": couple["couple_id"],
            "user_id": uid,
            "week_start": week,
            "challenge_text": text,
            "status": "pending",  # pending -> accepted/declined -> completed
            "created_at": now_utc(),
            "completed_at": None,
        }
        await db.challenges.insert_one(dict(mine))

    # partner's revealed (completed) challenge
    partner_ids = [m for m in couple["member_ids"] if m != uid]
    partner_completed = None
    if partner_ids:
        pc = await db.challenges.find_one(
            {"couple_id": couple["couple_id"], "user_id": partner_ids[0],
             "week_start": week, "status": "completed"}, {"_id": 0}
        )
        if pc:
            partner_completed = {"challenge_text": pc["challenge_text"], "completed_at": pc.get("completed_at").isoformat() if isinstance(pc.get("completed_at"), datetime) else pc.get("completed_at")}

    return {
        "week_start": week,
        "drops_on": "Monday",
        "mine": {
            "id": mine["id"],
            "challenge_text": mine["challenge_text"],
            "status": mine["status"],
        },
        "partner_revealed": partner_completed,
    }


@api_router.post("/weekly/challenge/{action}")
async def act_weekly_challenge(action: str, lang: str = "en", user: Dict[str, Any] = Depends(get_current_user)):
    if action not in {"accept", "decline", "complete"}:
        raise HTTPException(status_code=400, detail="Invalid action")
    couple = require_couple(await get_my_couple(user))
    week = week_monday_str()
    uid = user["user_id"]
    ch = await db.challenges.find_one({"couple_id": couple["couple_id"], "user_id": uid, "week_start": week})
    if not ch:
        raise HTTPException(status_code=404, detail="No challenge this week yet")

    status_map = {"accept": "accepted", "decline": "declined"}
    if action in status_map:
        if ch["status"] not in ("pending",):
            raise HTTPException(status_code=400, detail="Challenge already responded to")
        await db.challenges.update_one({"_id": ch["_id"]}, {"$set": {"status": status_map[action]}})
    else:  # complete
        if ch["status"] != "accepted":
            raise HTTPException(status_code=400, detail="Accept the challenge before completing it")
        await db.challenges.update_one(
            {"_id": ch["_id"]}, {"$set": {"status": "completed", "completed_at": now_utc()}}
        )
        await db.couples.update_one(
            {"couple_id": couple["couple_id"]}, {"$inc": {f"points.{uid}": 5}}
        )
    return await get_weekly_challenge(lang, user)


# ----------------------------- Weekly Wager -----------------------------------

async def serialize_wager(w: Optional[Dict[str, Any]], uid: str) -> Optional[Dict[str, Any]]:
    if not w:
        return None
    proposer = await db.users.find_one({"user_id": w["proposer_id"]}, {"_id": 0})
    return {
        "id": w["id"],
        "week_start": w["week_start"],
        "stake": w["stake"],
        "status": w["status"],  # pending / accepted / declined
        "proposer_id": w["proposer_id"],
        "proposer_name": proposer.get("name") if proposer else None,
        "is_mine": w["proposer_id"] == uid,
        "can_respond": w["status"] == "pending" and w["proposer_id"] != uid,
    }


@api_router.get("/weekly/wager")
async def get_wager(user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    week = week_monday_str()
    w = await db.wagers.find_one({"couple_id": couple["couple_id"], "week_start": week}, {"_id": 0})
    return {"week_start": week, "wager": await serialize_wager(w, user["user_id"])}


@api_router.post("/weekly/wager")
async def create_wager(req: WagerCreate, user: Dict[str, Any] = Depends(get_current_user)):
    couple = require_couple(await get_my_couple(user))
    if len(couple.get("member_ids", [])) < 2:
        raise HTTPException(status_code=400, detail="Link with your partner first")
    week = week_monday_str()
    existing = await db.wagers.find_one({"couple_id": couple["couple_id"], "week_start": week})
    if existing and existing["status"] != "declined":
        raise HTTPException(status_code=400, detail="There is already a wager this week")
    w = {
        "id": gen_id("wager"),
        "couple_id": couple["couple_id"],
        "week_start": week,
        "proposer_id": user["user_id"],
        "stake": req.stake[:300],
        "status": "pending",
        "created_at": now_utc(),
    }
    await db.wagers.update_one(
        {"couple_id": couple["couple_id"], "week_start": week},
        {"$set": w}, upsert=True,
    )
    return {"week_start": week, "wager": await serialize_wager(w, user["user_id"])}


@api_router.post("/weekly/wager/{action}")
async def respond_wager(action: str, user: Dict[str, Any] = Depends(get_current_user)):
    if action not in {"accept", "decline"}:
        raise HTTPException(status_code=400, detail="Invalid action")
    couple = require_couple(await get_my_couple(user))
    week = week_monday_str()
    w = await db.wagers.find_one({"couple_id": couple["couple_id"], "week_start": week})
    if not w:
        raise HTTPException(status_code=404, detail="No wager to respond to")
    if w["proposer_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="You proposed this wager; your partner must respond")
    if w["status"] != "pending":
        raise HTTPException(status_code=400, detail="Wager already responded to")
    new_status = "accepted" if action == "accept" else "declined"
    await db.wagers.update_one({"_id": w["_id"]}, {"$set": {"status": new_status}})
    fresh = await db.wagers.find_one({"couple_id": couple["couple_id"], "week_start": week}, {"_id": 0})
    return {"week_start": week, "wager": await serialize_wager(fresh, user["user_id"])}


# ----------------------------- App setup --------------------------------------

@api_router.get("/")
async def root():
    return {"message": "Daily Dose of Me API"}


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.couples.create_index("invite_code", unique=True)
        await db.couples.create_index("member_ids")
        await db.memories.create_index([("couple_id", 1), ("date", 1)])
    except Exception as e:
        logger.error(f"Index creation issue: {e}")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
