"""Bilingual (English + Mexican Spanish) test suite.

Covers: daily question lang switching, trivia categories i18n,
bilingual trivia generation + per-viewer language fetch, weekly
challenge generation in Spanish.
"""
import requests

SESSION = requests.Session()


def _get(base, path, headers, params=None, timeout=30):
    return SESSION.get(f"{base}{path}", headers=headers, params=params, timeout=timeout)


def _post(base, path, headers, json=None, timeout=60):
    return SESSION.post(f"{base}{path}", headers=headers, json=json, timeout=timeout)


# ============================================================================
# Daily Question — bilingual switching
# ============================================================================
class TestDailyQuestionI18n:
    def test_question_en_vs_es_same_question_id_different_text(
        self, base_url, headers_a, linked_couple
    ):
        en = _get(base_url, "/api/daily/question", headers_a, params={"lang": "en"})
        es = _get(base_url, "/api/daily/question", headers_a, params={"lang": "es"})
        assert en.status_code == 200 and es.status_code == 200, (en.text, es.text)
        en_body, es_body = en.json(), es.json()
        # Same index, parallel banks => same question_id
        assert en_body["question_id"] == es_body["question_id"], (
            f"question_id differs: en={en_body['question_id']} es={es_body['question_id']}"
        )
        # Text must differ between languages
        assert en_body["question"] != es_body["question"], (
            "English and Spanish question text should not be identical"
        )
        # Spanish text should look Spanish: at least one likely-Spanish marker
        es_text = es_body["question"]
        spanish_markers = ["¿", "ñ", "á", "é", "í", "ó", "ú", " tu ", " tú ", " es ", " la "]
        assert any(m in es_text for m in spanish_markers), (
            f"Spanish question does not look Spanish: {es_text!r}"
        )


# ============================================================================
# Trivia Categories — bilingual labels
# ============================================================================
class TestTriviaCategoriesI18n:
    def test_categories_es_returns_spanish_labels(
        self, base_url, headers_a, linked_couple
    ):
        r = _get(base_url, "/api/daily/trivia/categories", headers_a, params={"lang": "es"})
        assert r.status_code == 200, r.text
        body = r.json()
        cats = body.get("categories")
        assert isinstance(cats, list) and len(cats) >= 5
        # Every entry must be {key, label}
        for c in cats:
            assert "key" in c and "label" in c, c
        labels_by_key = {c["key"]: c["label"] for c in cats}
        # Expected Spanish labels per content.py
        assert labels_by_key.get("Movies & TV") == "Cine y TV"
        assert labels_by_key.get("Geography") == "Geografía"
        assert labels_by_key.get("Music") == "Música"

    def test_categories_en_returns_english_labels(
        self, base_url, headers_a, linked_couple
    ):
        r = _get(base_url, "/api/daily/trivia/categories", headers_a, params={"lang": "en"})
        assert r.status_code == 200, r.text
        labels_by_key = {c["key"]: c["label"] for c in r.json()["categories"]}
        assert labels_by_key.get("Movies & TV") == "Movies & TV"
        assert labels_by_key.get("Geography") == "Geography"


# ============================================================================
# Bilingual Trivia — per-viewer language
# ============================================================================
class TestBilingualTrivia:
    def test_generate_es_then_partners_see_each_in_own_language(
        self, base_url, headers_a, headers_b, linked_couple, mongo_db
    ):
        # Force regeneration
        mongo_db.trivia.delete_many({})
        gen = _post(
            base_url, "/api/daily/trivia/generate", headers_a,
            json={"category": "Geography", "lang": "es"}, timeout=90,
        )
        assert gen.status_code == 200, gen.text

        # Partner A views in Spanish
        a_es = _get(base_url, "/api/daily/trivia", headers_a, params={"lang": "es"})
        # Partner B views in English
        b_en = _get(base_url, "/api/daily/trivia", headers_b, params={"lang": "en"})
        assert a_es.status_code == 200 and b_en.status_code == 200
        a_body, b_body = a_es.json(), b_en.json()

        assert a_body["exists"] is True and b_body["exists"] is True
        # Both must have 4 options and same correct_index meaning (hidden until answer,
        # so we compare via the underlying doc).
        assert len(a_body["options"]) == 4 and len(b_body["options"]) == 4
        # Text must differ between languages
        assert a_body["question"] != b_body["question"], (
            f"ES and EN question should differ. ES={a_body['question']!r}, EN={b_body['question']!r}"
        )
        # Options must also differ (at least one element)
        assert a_body["options"] != b_body["options"], (
            "ES and EN options should not be identical lists"
        )
        # Spanish view should contain at least one Spanish marker
        es_text = a_body["question"] + " " + " ".join(a_body["options"])
        assert any(m in es_text for m in ["¿", "ñ", "á", "é", "í", "ó", "ú"]), (
            f"ES trivia does not look Spanish: {es_text!r}"
        )
        # Category label should be translated for ES viewer
        assert a_body["category"] == "Geografía", a_body["category"]
        assert b_body["category"] == "Geography", b_body["category"]

        # Underlying doc must have a single shared correct_index
        doc = mongo_db.trivia.find_one({})
        assert "correct_index" in doc
        assert doc.get("question_en") and doc.get("question_es")
        assert len(doc.get("options_en", [])) == 4
        assert len(doc.get("options_es", [])) == 4


# ============================================================================
# Weekly Challenge — Spanish generation
# ============================================================================
class TestWeeklyChallengeI18n:
    def test_challenge_es_returns_spanish_text(
        self, base_url, headers_a, linked_couple, mongo_db
    ):
        mongo_db.challenges.delete_many({})
        r = _get(base_url, "/api/weekly/challenge", headers_a,
                 params={"lang": "es"}, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        text = body["mine"]["challenge_text"]
        assert text, "Challenge text empty"
        # Likely Spanish markers (accents, common short words). LLM-generated so be lenient.
        markers = ["¿", "ñ", "á", "é", "í", "ó", "ú", " tu ", " que ", " una ", " de "]
        assert any(m in text.lower() or m in text for m in markers), (
            f"Weekly challenge does not look Spanish: {text!r}"
        )
