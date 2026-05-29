# Daily Dose of Me — PRD

A private couples app for two linked partners to capture date-night memories and play
lighthearted daily/weekly games together.

## Stack
- Frontend: React Native (Expo SDK 54) + expo-router (file-based)
- Backend: FastAPI + MongoDB (motor)
- Auth: Emergent-managed Google OAuth (Bearer session tokens, 7-day expiry)
- AI: DeepSeek V4 Flash via OpenRouter (`deepseek/deepseek-v4-flash`) for daily trivia + weekly challenge generation
- Media: device photo library + camera (expo-image-picker, base64); voice notes (expo-audio, up to 60s)
- Fonts: Outfit (headings) + Nunito (body); soft premium pink theme

## Core Features
1. **Couple linking** — Google login → create an invite code or join with a partner's code.
2. **Home / Calendar** — month grid with a solid dot on days that have a logged memory; tap a day → detail sheet. Days-together counter + points.
3. **Memory vault** — per date: 1–5 photos + caption (≤1500 chars) + voice note (≤1 min).
4. **Daily Question** (0 pts) — deterministic per-day question from a cleaned, forward-looking bank; both answer; partner answer hidden until you answer.
5. **Daily Trivia** (+1 pt) — a partner picks a category; DeepSeek generates a 4-option question; both answer; correct = 1 point.
6. **Weekly Secret Mission / Challenge** (+5 pts) — drops every Monday, PRIVATE & hidden from the partner; accept or skip; honor-system "mark done"; partner only sees it once completed (revealed).
7. **Weekly Wager** — one partner proposes a stake; the OTHER must accept/decline; bragging rights if none.
8. **Profile / Us** — avatars, leaderboard, anniversary, sign out.

## Key Endpoints (prefix /api)
- Auth: POST /auth/session, GET /auth/me, POST /auth/logout
- Couple: POST /couple/create, POST /couple/join, GET /couple, PUT /couple/settings
- Memories: POST /memories, GET /memories?month=YYYY-MM, GET /memories/by-date/{d}, DELETE /memories/{id}
- Daily: GET/POST /daily/question(/answer), GET /daily/trivia, POST /daily/trivia/generate, POST /daily/trivia/answer
- Weekly: GET /weekly/challenge, POST /weekly/challenge/{accept|decline|complete}; GET/POST /weekly/wager, POST /weekly/wager/{accept|decline}

## Notes
- Voice-note background playback / recording while locked requires a native build (not Expo Go).
- Google Photos API key was provided by user but Library API needs OAuth scopes; current implementation uses the device photo picker (reliable in Expo Go).
