# SoundCloud Download Gate

Self-hosted Next.js app that gives fans a free download in exchange for a SoundCloud follow, like, repost, and comment. A single artist per deployment. Branding is configured through a first-run web wizard; SoundCloud credentials live only in `.env`.

## Use this template

Click **Use this template** on GitHub, create a fresh private repo, and clone that. Do not fork the template repo directly.

## Setup

Full setup instructions are in SETUP.md. The short version:

```bash
cp .env.example .env
# fill in .env
npx prisma migrate deploy
npx prisma generate
npm install
npm run build
npm start
```

Then open `https://your-domain.com/setup` and complete the first-run wizard.

## Required environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite path, e.g. `file:./data/gate.db` |
| `SC_CLIENT_ID` | SoundCloud app Client ID |
| `SC_CLIENT_SECRET` | SoundCloud app Client Secret |
| `SC_REDIRECT_URI` | Must match the app redirect URI exactly |
| `SC_ARTIST_URN` | URN of the artist profile to follow |
| `SESSION_SECRET` | 32-byte hex secret for admin session cookies |
| `DOWNLOAD_TOKEN_SECRET` | 32-byte hex secret for download token signing |
| `STORAGE_DIR` | Writable directory for uploaded audio files |

`ADMIN_PASSWORD_HASH` is optional; the first-run wizard stores the password in the database.

See `.env.example` for the hash-paste note when bcrypt hashes contain `$` signs and for the URN resolver script.

## Upload limits

The admin upload endpoint receives files in ~8 MB chunks. If you run behind nginx, set:

```nginx
client_max_body_size 220m;
```

and make sure nginx sets/overwrites `X-Forwarded-For` itself so the backend rate limiter sees the real client IP.

## Fan flow

1. Fan visits `/gate/:id` and sees the track embed + a comment textarea.
2. Fan writes a comment (1–280 chars) and clicks **Unlock Download via SoundCloud**.
3. HTML form posts to `/api/auth/start`, which redirects to SoundCloud with PKCE.
4. Fan authorizes on SoundCloud and is redirected back to `/callback`.
5. Backend sequentially: follow artist → like track → repost track → post comment.
6. Fan is redirected back to `/gate/:id?status=unlocked&dl=TOKEN` with a 15-minute download link.

## Development

```bash
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```

## Deployment

```bash
docker compose up --build
```

## Admin area

- `/admin` — login
- `/admin/dashboard` — list, toggle, and create gates
- `/admin/settings` — edit branding, consent/privacy text, BPM, accent color, admin password

## Security notes

- `/api/settings/public` returns only display fields. It never exposes `adminPasswordHash`, `isConfigured`, or any `.env` value.
- SoundCloud API calls use `Authorization: OAuth <token>`.
- The posted comment is an untimed track comment so each unlock appears as its own entry in the comment list.
- Do not commit `.env`, `data/gate.db`, or uploaded files to git.
