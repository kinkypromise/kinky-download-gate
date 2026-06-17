# Gate Setup Guide

A self-hosted SoundCloud download gate. Fans authenticate via SoundCloud, then the backend follows your artist profile, likes and reposts the track, and posts their comment. In exchange they get a 15-minute download link.

---

## Prerequisites

1. A VPS or server with Docker and Docker Compose installed.
2. A public domain name pointing to the server.
3. TLS certificate (use your provider, certbot, or a reverse proxy that terminates TLS).
4. A SoundCloud account with an Artist or Artist Pro subscription.

---

## 1. Register a SoundCloud app

1. Go to `https://soundcloud.com/you/apps` and create a new app.
2. Set the **Redirect URI** to exactly: `https://your-domain.com/callback`
3. If the form shows a "Use PKCE" option, leave it enabled. The app handles PKCE internally.
4. Copy the **Client ID** and **Client Secret** for the next step.

Important rules:

- Create one SoundCloud app per artist account. Do not reuse the same Client ID across multiple gates or domains.
- The redirect URI must match the `SC_REDIRECT_URI` value character for character. A trailing slash mismatch will break OAuth.
- SoundCloud apps are tied to the account that created them. The artist profile you want fans to follow must own the app.

---

## 2. Resolve your artist URN

Run the helper script from the project root and paste your artist profile URL when prompted:

```bash
npx tsx scripts/resolve-urn.ts
```

Copy only the printed `soundcloud:users:...` value into `SC_ARTIST_URN`.

---

## 3. Server prerequisites

### nginx

If you run behind nginx, set these in the server block for your domain:

```nginx
client_max_body_size 220m;

location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`X-Forwarded-For` is required so the rate limiter sees the real fan IP instead of `127.0.0.1`.

### Upload size

The app streams WAV/MP3 uploads in ~8 MB chunks, but nginx will reject large bodies unless `client_max_body_size` is raised. 220 MB covers most mastered tracks.

---

## 4. Install and configure

1. Clone the repo (do **not** fork it — use it as a template, then push to a fresh private repo):

```bash
git clone https://github.com/your-org/gate-template.git your-gate
cd your-gate
```

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Fill in all values in `.env`. See `.env.example` for field descriptions.

4. Apply the database migration:

```bash
npx prisma migrate deploy
npx prisma generate
```

5. Build and start:

```bash
npm install
npm run build
npm start
```

Or use Docker:

```bash
docker compose up --build
```

---

### Docker note

If you run via `docker compose up --build`, the compose file overrides `DATABASE_URL` with an absolute path (`file:/app/data/gate.db`) so the SQLite file is created inside the mounted `./data` volume. Without this override, Prisma would place it under `prisma/data/` in the container and it would be lost on every restart.

The database and uploaded audio files live in the `./data` and `./storage` directories. Back them up; do not delete them between deploys. The container path for the DB is `/app/data/gate.db`.

## 5. First-run wizard

1. Open `https://your-domain.com/setup` in a browser.
2. Choose a strong admin password (10+ characters), confirm it, and fill in the branding fields:
   - Artist name
   - Label name (optional)
   - Instagram URL (optional)
   - Spotify URL (optional)
   - Accent color
   - BPM (drives the logo glitch animation)
   - Runtime port (default 3000; use a different port for each gate on the same VPS)
3. Submit. The wizard creates the admin user, stores the branding, and redirects to `/admin`.
4. After setup, `/setup` automatically redirects to `/admin`.

### Logo

You can upload a custom logo (PNG, JPG, WebP, or SVG, max 2 MB) from `/admin/settings`. When a logo is uploaded, it replaces the glitch animation on both the admin and gate pages. To use the built-in glitch logo instead, remove the uploaded logo in settings or replace `public/logo.svg` with your own black-frame SVG mask (viewBox `0 0 1920 1080`).

---

## 6. Create your first gate

1. Log in at `https://your-domain.com/admin`.
2. Click **New gate**.
3. Paste the SoundCloud track URL and wait for the URN to resolve, or enter it manually (`soundcloud:tracks:...`).
4. Upload a WAV or MP3.
5. Save and copy the gate link.
6. Share the gate link with fans.

---

## 7. Go-live checklist

- [ ] `.env` is in place and contains real values.
- [ ] `npx prisma migrate deploy` ran successfully.
- [ ] `npx next build` exits with code 0.
- [ ] nginx has `client_max_body_size 220m` and forwards `X-Forwarded-For`.
- [ ] TLS is active and the redirect URI matches `SC_REDIRECT_URI`.
- [ ] The first-run wizard completed and created the admin password.
- [ ] `public/logo.svg` is replaced with your own logo mask.
- [ ] A test gate was created and a full unlock flow was run end to end.
- [ ] No `.env`, `data/gate.db`, or uploaded files are committed to git.

---

## Support notes

- The app is designed for a single artist per deployment.
- The admin password is stored in the database. The `ADMIN_PASSWORD_HASH` env fallback is only for manual setups.
- Uploaded files live in `STORAGE_DIR` and are not tracked by git.
- SoundCloud API endpoints use `Authorization: OAuth <token>`, not Bearer.
- The comment posted by the unlock flow is an untimed track comment so each unlock stands alone in the comment list.
