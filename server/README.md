
## AI Content pipeline (server/content.js)
Admin > AI Content: fetch latest from RSS sources (Google AI, DeepMind, OpenAI, Hugging Face, The Verge AI), one-click generate from feed item / URL / topic. Gemini (GEMINI_MODEL, default gemini-3.8-flash) rewrites into original TH+EN articles; drafts can be edited, published to "Latest AI Updates" (source credit appended), or deleted. Daily auto-fetch checkbox (off by default, drafts only, 3/day).
Offline import: drop server/content-import.json; merged within 30 s.

## Free preview
First 2 lessons of every course are free by default (lesson.free true/false overrides; Admin > Categories / Updates > Free preview). Guests can browse courses and play free lesson videos/files; other lessons show a lock + sign up / buy CTA.

## Free Video Engine (/studio.html, server/studio.js)
Public image-to-video page, no login. Env: `COMFY_URL` (private render node URL, required, no default; feature is disabled without it), optional `STUDIO_SALT` (IP-hash salt).
Browser only talks to `/api/studio/*`; errors are generic; uploads are re-encoded with sharp (metadata stripped); outputs re-encoded with ffmpeg (no metadata, small PureFxAi watermark), served by unguessable token for 24 h.
Safeguards: 1 concurrent job, free jobs wait while the render node has any other queued/running job, per-IP/day limit, global daily cap, max queue, prompt filter, terms checkbox. Admin > Free Video Engine: on/off + caps. Requires `npm i` (sharp, busboy) and ffmpeg.
