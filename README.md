# PureFxAi Landing Site

Thai/English landing page for selling AI courses (`index.html`) plus a Node.js backend (`server/`).

## Run
```bash
cd server
npm install
GEMINI_API_KEY=your_key npm start      # http://localhost:8080
```
Optional env vars: `PORT` (8080), `GEMINI_MODEL` (default `gemini-3.8-flash`), `GEMINI_LIVE_MODEL` (default `gemini-3.8-live`; verified against the API's model list on 2026-10-20).

Without `GEMINI_API_KEY` the site still works: the chat falls back to built-in auto-replies, and "Call AI" shows a "not configured" message.

## Backend endpoints
- `GET /api/status`: `{configured: bool}`
- `POST /api/chat` `{messages:[{role,text}]}`: proxies to Gemini `generateContent` with a PureFxAi system prompt
- `WS /api/live`: relays to the Gemini Live API (BidiGenerateContent). The server adds the key and sends the setup/system prompt. The browser sends 16 kHz PCM, gets 24 kHz PCM audio back. **The API key never reaches the browser.**

The system prompt is `SYSTEM` in `server/server.js` (prices and other details are placeholders).

## Customize (placeholders)
- Videos: `EPISODES` array in index.html (`yt` = YouTube ID or `mp4` = URL)
- Tutor lessons/quiz: `LESSONS`; pricing: `PLANS`; texts: `T.th` / `T.en`
- Prices `฿X,XXX`, instructor bio, contact channels, testimonials are all placeholders.

## Notes
- The 3D hero uses three.js from the jsDelivr CDN. If WebGL or the CDN fails, or the user prefers reduced motion, it falls back to the CSS gradient.
- Mic access needs HTTPS or localhost.
- Gemini text chat and Live sessions tested server-side 2026-10-20 (browser mic flow not tested).

## Shorts (vertical series)
- Config: the `SHORTS` array in index.html. Each episode has `clips` (played one after another, then auto-advances to the next episode that has clips) and a `cover`.
- EP1 expects `shorts/ep01/ep01.mp4` and `shorts/ep01/cover.jpg`. You can list 8 clips (`clip-01.mp4` ...) instead of one file.
- Script: `shorts/ep01/script.md`.
- API: `GET /api/shorts/:ep`, `POST /api/shorts/:ep/like` `{unlike?}`, `POST /api/shorts/:ep/comments` `{name<=40, text 1-300}`.
  - Rate limit: 5 POSTs per minute per IP for each action.
  - Comment text is HTML-escaped on the server.
  - Data is saved to `server/data/shorts.json`.

## LMS (member classroom + admin)
- Member pages: `/learn.html` (signup/login, My Courses, classroom, bank-transfer checkout, orders).
- Admin: `/admin.html`.
  - Admin email is `ADMIN_EMAIL`, default `pureai.com@gmail.com`.
  - Admin password: set `ADMIN_PASSWORD` in the environment and restart the server.
  - If no password is set, the server prints a one-time setup token to its log, and the first visit to /admin.html can set a password (stored as a bcrypt hash).
- Storage:
  - Member and course data: `server/data/lms.json` (JSON).
  - Transfer slips: `server/data/slips/`, outside the public folder and served only to admins.
  - Lesson videos: `server/lms-media/lessons/<course>/<lesson>.mp4`. They are streamed with Range support, and only to members with access. A review clip is used as a stand-in until a file exists (see `server/LESSON-MANIFEST.md`).
- Package prices start at 0 ("not set"); set them under admin > Prices.
- Bank details are in `server/lms.js` (`BANK`).
- Security:
  - Passwords use bcrypt; sessions are httpOnly SameSite=Lax cookies (set `COOKIE_SECURE=1` behind HTTPS).
  - Every POST requires the custom header `x-pfx: 1` (CSRF protection).
  - Signup, login, slip upload and admin login are rate-limited.
  - Slips are type-checked by magic bytes (JPG/PNG/WEBP/PDF) with a 5 MB limit.
- Password reset is a stub: the reset link is printed to the server log (no email sending yet).
- Certificates: `/api/lms/cert/<course>` renders an HTML certificate once the course is 100% complete; use the browser's "Save as PDF".

## Deploy on Render (free web service)
- Blueprint: `render.yaml` (root dir `server`, `npm start`, Node 20). Static site files are served by `server.js` from the repo root.
- Set secrets in the Render dashboard: `GEMINI_API_KEY`, `ADMIN_PASSWORD`, `PUBLIC_BASE_URL` (e.g. https://purefxai.onrender.com). `ADMIN_EMAIL` defaults to pureai.com@gmail.com.
- `PORT` is provided by Render automatically.
- Data (members, orders, slips, certificates, shorts likes/comments) is stored in `DATA_DIR` (default `server/data`). **Render free disk is ephemeral**: data is lost on each redeploy/restart and the service sleeps after ~15 min idle. For production use a paid instance with a persistent Disk (`DATA_DIR=/var/data`) or move to a database (e.g. Postgres/Supabase) + object storage for slips.
