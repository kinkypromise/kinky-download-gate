# ESCA Download Gate

Fans can download a track after authenticating via SoundCloud. The backend then
acts on their behalf to: (a) follow the artist profile, (b) like the track,
(c) repost the track, and (d) post a comment on it. Optionally, an Instagram
follow button is shown on the unlocked page.

## Setup

Copy the environment template and fill in all values:

```bash
cp .env.example .env
```

Required environment variables (all checks are lazy; missing values only fail
at request time):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite path, e.g. `file:./data/gate.db` |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password |
| `SESSION_SECRET` | 32-byte hex secret for session cookies |
| `DOWNLOAD_TOKEN_SECRET` | 32-byte hex secret for download token signing |
| `SC_CLIENT_ID` | SoundCloud app client ID |
| `SC_CLIENT_SECRET` | SoundCloud app client secret |
| `SC_REDIRECT_URI` | Must match the app redirect URI, e.g. `https://your-domain.com/callback` |
| `SC_ARTIST_URN` | URN of the artist profile to follow, e.g. `soundcloud:users:1234567` |

## Upload limits

The admin upload endpoint loads the entire file into memory (deliberate
trade-off for simplicity). The server will accept up to ~200 MB. If you run
behind nginx, set:

```nginx
client_max_body_size 220m;
```

and make sure nginx sets/overwrites `X-Forwarded-For` itself so the backend
rate limiter sees the real client IP.

## Fan flow

1. Fan visits `/gate/:id` and sees the track embed + a comment textarea.
2. Fan writes a comment (1–280 chars) and clicks **Unlock Download via SoundCloud**.
3. Classic HTML form `POST`s to `/api/auth/start` (no fetch/XHR), which
   redirects to SoundCloud with PKCE.
4. Fan authorizes on SoundCloud and is redirected back to `/callback`.
5. Backend sequentially: follow artist → like track → repost track → post comment.
6. Fan is redirected back to `/gate/:id?status=unlocked&dl=TOKEN` with a
   15-minute download link.
7. After downloading, the fan sees an optional **Follow <ARTIST> on Instagram** link.

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

## Admin dashboard

`/admin` — login with the hashed password. `/admin/dashboard` — list, toggle,
and create gates.
