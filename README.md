# SoundCloud Download Gate

A self-hosted download gate: fans get a free track download in exchange for following you on SoundCloud and liking, reposting, and commenting on the track. One artist per deployment, all branding set up through a first-run web wizard — no code editing required.

This repository is a **template**. Each artist runs their own copy on their own server with their own SoundCloud app. The guide below walks you through it from scratch; the [Reference](#reference) section at the end has the technical details.

---

## What it does

A fan opens your gate link, writes a short comment, and clicks **Unlock**. They log in with SoundCloud, and the server — acting once on their behalf — makes them follow you, like the track, repost it, and post their comment. Only then do they get a time-limited link to download the audio file, which is served from **your own server**, never from SoundCloud.

The fan's SoundCloud login is used once and immediately thrown away. No fan data is stored — no emails, no profiles, nothing about who unlocked what (just an anonymous counter). It's clean by design, and it respects your fans.

---

## A note on support

I built this to be self-explanatory: the guide below covers the whole setup, and the [Troubleshooting](#troubleshooting) section lists the errors people actually hit. I can't offer 1:1 support — but you don't need it.

**Setting this up with an AI assistant?** Paste this README into any decent LLM (ChatGPT, Claude, Gemini), tell it where you're stuck, and include the exact error you're seeing. With this README as context, it can walk you through every step and decode almost any error message. That's genuinely the fastest way through — faster than waiting on me.

---

## Intended use & SoundCloud's terms

This exists because the commercial gate services (Hypeddit and the like) run into SoundCloud's API terms: SoundCloud does **not** permit commercial services that provide download gates as a product. What SoundCloud **does** permit is using the API to promote **your own** content on **your own** account. That's exactly what this is built for.

**Use this to gate your own tracks, on your own SoundCloud account, on your own server.** That's the legitimate, terms-compliant use.

**Do not use it to run a gating service for other artists.** The moment you operate gates on behalf of others as a service, you're in the commercial use SoundCloud prohibits — the same line the big platforms are now hitting. Self-hosting doesn't change that; the use does.

This decentralized, self-hosted approach is the most robust way to keep a working gate, because there's no central service for SoundCloud to shut off — each artist runs their own. That said, it still depends on SoundCloud's API, and SoundCloud can change their rules. This is the safest available option, not a permanent guarantee. Use it for what it's for and you're on solid ground.

---

# Setup guide

Budget about an hour, maybe a bit more the first time. You don't need to be a programmer, but you'll need a little courage with the command line. If something jams, the [Troubleshooting](#troubleshooting) section near the end covers the usual suspects.

## Before you start

You'll need four things in place:

- **A SoundCloud account with Artist Pro** — required to register a SoundCloud app. There's no way around this one.
- **A small server (VPS)** with a persistent disk — somewhere like Hetzner, Netcup, or DigitalOcean, a few euros a month, smallest tier is fine. The gate stores its database and your audio files on disk, so normal web hosting and serverless platforms (Vercel, Netlify) **won't** work. If a VPS feels like too much, ask [YOUR NAME] — your gate might be able to run on my setup.
- **A domain or subdomain** (e.g. `gate.yourname.com`) pointing at your server, secured with HTTPS. SoundCloud login requires an exact-match HTTPS address.
- **Your track** as a WAV or MP3 file — what the fans will download.

## Step 1 — Set up the server

Any Linux works, but **Ubuntu Server 24.04 LTS** is the easiest path and what this guide assumes.

**First, point your domain at the server.** In your domain provider's DNS settings, create an A record:

```
Type: A
Name: gate   (or @ for the root domain)
Value: 1.2.3.4   <-- your VPS public IP
TTL: 3600
```

DNS can take a few minutes to a few hours to propagate. Check it with `nslookup gate.yourname.com` — when it returns your VPS IP, you're ready.

**Then connect to the server** via SSH (`ssh root@1.2.3.4`, replacing the IP with yours; on Windows use PuTTY or Windows Terminal) and install Git, Docker, and Node:

```bash
# System packages: Git + prerequisites
sudo apt update
sudo apt install -y git ca-certificates curl

# Docker Engine + Compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sudo sh
# let your user run docker without sudo (log out and back in afterwards)
sudo usermod -aG docker $USER

# Node.js 22 LTS via NodeSource (Ubuntu's own apt Node is too old for Next.js 16)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# verify
node -v      # should be 20.9+ (22.x recommended)
docker -v
```

> Don't just run `sudo apt install nodejs` on its own — Ubuntu's default Node is too old and the app won't build. The NodeSource step above is what gets you a current version.

You don't install the app's own libraries (Next.js, Prisma, React, etc.) by hand — those come automatically in a later step.

## Step 2 — Set up the reverse proxy (HTTPS)

The app runs on a private port (`3000` by default); a reverse proxy listens on the public ports `80`/`443`, forwards traffic to it, and handles HTTPS. SoundCloud login **requires** HTTPS, so this isn't optional.

> **Running more than one gate on this server?** Each gate needs its own port. Pick one here and remember it — you'll set the same number as `HOST_PORT` in Step 5. The examples below use `3000`; for a second gate use `3001`, a third `3002`, and so on. See [Running multiple gates](#running-multiple-gates-on-one-server) in the Reference for the full pattern.

> **Heads up:** after this step your domain will show an error page (502 / "bad gateway") until you actually start the app in Step 7. That's expected — the proxy is forwarding to a port where nothing is listening yet. Don't worry about it until Step 7.

Install nginx and certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create a site config (`sudo nano /etc/nginx/sites-available/gate.yourname.com`) and paste this, replacing the domain with yours:

```nginx
server {
    listen 80;
    server_name gate.yourname.com;

    client_max_body_size 220m;          # allow large WAV/MP3 uploads

    location / {
        proxy_pass http://127.0.0.1:3000;          # match your HOST_PORT (3001, 3002, … for additional gates)
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;     # real client IP for rate limiting
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it and get a free HTTPS certificate:

```bash
sudo ln -s /etc/nginx/sites-available/gate.yourname.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d gate.yourname.com    # certbot edits the config for HTTPS automatically
```

> Using Apache or a panel like Plesk instead? Same idea: proxy everything to `http://127.0.0.1:3000`, forward `X-Forwarded-For` / `X-Forwarded-Proto`, and raise the upload limit to at least 220 MB. If you're on **Plesk**, see the dedicated section just below.

### If you use Plesk instead of command-line nginx

Plesk users don't edit config files by hand — you do it in the panel. The app itself still runs via Docker (Steps 3–7 below); Plesk only handles the public domain, HTTPS, and forwarding traffic to the app's port.

Plesk domains come in two flavors, and which one you have decides where you paste the proxy config. Open **Domains → your-domain → Hosting & DNS → Apache & nginx Settings** and look at what's there:

**Case A — there's an "nginx settings" section with a "Proxy mode" checkbox:**

1. **Uncheck "Proxy mode"** and click **Apply**. This is the most common thing people miss — if you leave it on, you'll get a `duplicate location "/"` error when you add the directives below.
2. In **Additional nginx directives**, paste:
   ```nginx
   client_max_body_size 220m;
   location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $remote_addr;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
3. Click **Apply**.

**Case B — there's only "Additional Apache directives" (two boxes, HTTP and HTTPS), no nginx section:**

This is a pure-Apache domain. Use Apache's proxy syntax instead. Paste the **same block into both boxes** ("Additional directives for HTTP" *and* "Additional directives for HTTPS"), so it works before and after the certificate is installed:

```apache
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/
RequestHeader set X-Forwarded-Proto "https"
LimitRequestBody 230686720
```

- `ProxyPass` / `ProxyPassReverse` forward everything to the app on port 3000 (change the port if you changed it).
- `LimitRequestBody 230686720` raises the upload limit to ~220 MB so large WAV/MP3 files go through (the number is bytes).
- Click **OK** to save and reload Apache.

> For this to work, Apache needs its `proxy` and `proxy_http` modules enabled — on Plesk they normally are. If the site shows a Plesk default page or a 500 after saving, that's the first thing to check (under **Tools & Settings → Apache modules**), along with confirming the app is actually running on port 3000 (`docker compose ps`).

**HTTPS for either case:** use Plesk's built-in Let's Encrypt — **Domains → your-domain → SSL/TLS Certificates → Install a free basic certificate**. Plesk renews it automatically. Do this *before* testing the SoundCloud login, since it requires HTTPS.

## Step 3 — Copy the project

On the template's GitHub page there's a green **"Use this template"** button at the top. Click it and GitHub creates a fresh copy of the project that's entirely yours, independent of the original. Give it a name like `my-gate`, then clone it onto your server:

```bash
git clone https://github.com/your-username/my-gate.git
cd my-gate
```

> Use **"Use this template"**, not "Fork" — fork is for something else.

## Step 4 — Register a SoundCloud app

This is the fiddliest part, so take your time. Go to the [SoundCloud developer page](https://developers.soundcloud.com) and create a new app:

- **App name:** something like "[Your Artist Name] Gate"
- **Website:** your SoundCloud profile is fine
- **Redirect URI:** the delicate bit. Enter **exactly** `https://gate.yourname.com/callback` — your real domain, no trailing slash. Typos here are the single most common cause of failure later.

SoundCloud then shows you a **Client ID** and a **Client Secret**. You'll need both in a moment. Treat the secret like a password — never share it, never put it in a screenshot.

Two traps worth knowing up front: SoundCloud allows only **one app per account**, and if you ever change your domain you must update the redirect URI here too.

## Step 5 — Install and configure

Install the dependencies, then create your config file:

```bash
# install dependencies (needed before the setup scripts work)
npm install

# create your config from the template
cp .env.example .env
```

Now open `.env` in an editor and fill in your values. You don't have to invent the secret keys — a helper script generates them:

```bash
# generates the security secrets + admin password hash; paste its output into .env
npx tsx scripts/setup-env.ts
```

Into `.env` you put: the **Client ID** and **Client Secret** from Step 3, your **domain** in `SC_REDIRECT_URI`, and the generated secrets. Leave `SC_ARTIST_URN` empty for now — that's the next step.

**If you chose a port other than 3000 in Step 2** (because another gate already uses 3000), set the matching `HOST_PORT` here, e.g. `HOST_PORT=3001`. It must be the same number your reverse proxy forwards to. If this is your only gate, leave it at `3000`.

(Every variable is explained in the [Reference](#environment-variables) below.)

## Step 6 — Get your artist ID

The gate needs to know whom fans should follow (you). A one-time script figures that out:

```bash
npx tsx scripts/resolve-urn.ts
```

It prints a link — open it, log in with **your own** SoundCloud account, then copy the `code` from the address bar back into the terminal. Paste the resulting URN (looks like `soundcloud:users:1234567`) into `SC_ARTIST_URN` in `.env`.

> When copying the code, take **only** the part between `code=` and `&state`. Grabbing the whole URL is a classic trip-up that causes an `invalid_request` error.

## Step 7 — Start it

```bash
docker compose up --build -d
```

Docker builds and runs everything — the app, the database, the storage volumes. Give it a minute, then open `https://your-domain.com`.

> Don't use `npm start` — this project builds in standalone mode and `next start` doesn't work with it. Docker is the way; for a manual start it'd be `node .next/standalone/server.js`.

## Step 8 — The first-run wizard

The first time you open the site, you land in a setup wizard. Here you set, all from the browser:

- **Admin password** (gets you into the dashboard later)
- **Artist name**, optional **label name**
- **Instagram** and **Spotify** links — optional; leave blank to hide those buttons
- **Accent color** — the color of the animated logo and buttons (pink, green, whatever's you)
- **BPM** — the logo pulses to the beat, so set your typical tempo

Then swap the logo: in the `public/` folder there's a placeholder `logo.svg`. Replace it with your own — same construction, a solid black rectangle with your wordmark/shape knocked out (transparent). Need help with that? Give me a shout.

After the wizard you're taken to the dashboard, and the wizard locks itself. You can change all of this later under **Settings**.

## Step 9 — Create your first gate

Log into `/admin` with your password and create a release:

- the track title
- the SoundCloud track URL (or ID)
- the audio file to upload

Save it and you get a shareable link like `gate.yourname.com/gate/abc123`. That's what you give your fans — SoundCloud bio, stories, everywhere.

## Step 10 — Test it yourself first

Before handing out the link, open it in a **different browser or an incognito window** (so you're not logged in as yourself) and click all the way through — ideally with a second account. Does the account now follow you? Are the like, repost, and comment there? Does the file download? If yes, you're live. Hand out the link, and send me your gate link when it's up! 🖤

---

# Reference

Technical details for when you want to look something up or dig deeper.

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Node.js | 20.9+ (LTS 20 or 22) | Required by Next.js 16 |
| npm | ships with Node | Installs dependencies |
| Docker + Compose | recent | Build/run, handles DB + volumes |
| Git | any | Clone your template copy |

App libraries (Next.js, Prisma, React, Three.js, bcrypt…) install via `npm install` from `package.json` — never by hand. The setup scripts run through `tsx` (a dev dependency), which is why `npm install` must come before them.

## Environment variables

| Variable | What it is | How to get it |
|----------|------------|---------------|
| `DATABASE_URL` | SQLite database location | Keep `file:./data/gate.db` for local dev. **In Docker this is overridden** by `docker-compose.yml` to an absolute path in the mounted volume — leave that as-is. |
| `SC_CLIENT_ID` | SoundCloud app Client ID | From your registered SoundCloud app |
| `SC_CLIENT_SECRET` | SoundCloud app Client Secret | Same place; treat like a password |
| `SC_REDIRECT_URI` | OAuth callback URL | Must match the SoundCloud app's redirect URI exactly, e.g. `https://your-domain.com/callback` (no trailing slash) |
| `SC_ARTIST_URN` | Your profile in URN form | Output of `scripts/resolve-urn.ts`, e.g. `soundcloud:users:1234567` |
| `SESSION_SECRET` | Signs admin session cookies | `scripts/setup-env.ts` (or `openssl rand -base64 32`) |
| `DOWNLOAD_TOKEN_SECRET` | Signs download tokens | Same |
| `STORAGE_DIR` | Where uploaded audio is stored | Keep default `./storage/downloads` |
| `HOST_PORT` | The port this gate listens on, on the host | Default `3000`. Give each gate on a shared server its own port (3000, 3001, …) and forward the reverse proxy to it. |
| `ADMIN_PASSWORD_HASH` | *(optional)* admin password hash | Normally set by the wizard; only for manual/headless setups |

> **bcrypt `$` gotcha:** if you ever paste a bcrypt hash into `.env` by hand, escape every `$` as `\$`. Next.js expands `.env` variables and will silently mangle an unescaped hash, so your password then never matches. Using the wizard avoids this entirely.

## Running & developing

```bash
# Production (recommended)
docker compose up --build -d     # start
docker compose logs -f           # logs
docker compose down              # stop, keeps data (see Data & persistence)

# Local development
npm install
npx prisma migrate dev
npx prisma generate
npm run dev                      # http://localhost:3000
```

For local dev, set `SC_REDIRECT_URI="http://localhost:3000/callback"` and add that same URL to your SoundCloud app's redirect URIs.

## Running multiple gates on one server

You can host several gates (your own, or for different artists) on one VPS. Each one is a **separate clone in its own folder** with its own `.env`, its own port, and its own domain. The key is that nothing is shared between them:

```
~/gates/
  artist-a/        # git clone #1 — HOST_PORT=3000, gate-a.com
  artist-b/        # git clone #2 — HOST_PORT=3001, gate-b.com
  artist-c/        # git clone #3 — HOST_PORT=3002, gate-c.com
```

For each gate:

1. Clone the template into its own folder and `cd` into it.
2. In its `.env`, set a unique `HOST_PORT` (3000, 3001, 3002, …) and that gate's own `SC_*` values (each artist registers their own SoundCloud app).
3. Give each gate its own domain and a reverse-proxy config that forwards to that gate's `HOST_PORT` (Step 2 — repeat per domain).
4. `docker compose up -d` in each folder. Because each folder has its own `data/` and `storage/`, their databases and audio files never collide.

Because each folder is its own Docker Compose project, they start, stop, and update independently. One artist re-deploying doesn't touch the others.

## Admin area

- `/admin` — login
- `/admin/dashboard` — list, activate/deactivate, and create gates
- `/admin/settings` — branding, consent & privacy text, BPM, accent color, change password

## How the fan flow works

1. Fan opens `/gate/:id` — track artwork, animated logo, comment field.
2. Fan writes a comment (1-280 chars) and clicks **Unlock Download via SoundCloud**.
3. A native HTML form posts to `/api/auth/start`, which redirects to SoundCloud via OAuth 2.1 + PKCE.
4. Fan authorizes; SoundCloud redirects back to `/callback`.
5. Server loads the gate, then sequentially: **follow → like → repost → comment**. Follow/like/repost are required; a failed comment is best-effort and doesn't block the download.
6. Fan is redirected to `/gate/:id?status=unlocked&dl=…` with a **15-minute** signed download link. Audio is streamed from your storage; there's no guessable direct file URL.

## Data & persistence

Two things must survive restarts and deploys — both are Docker volumes in `docker-compose.yml`:

- **`./data`** → the SQLite database (settings, gates, unlock counts). In the container: `/app/data/gate.db`.
- **`./storage`** → your uploaded audio files.

`docker compose down` then `up` **without** the `-v` flag keeps these. **Never** pass `-v` to compose down unless you mean to wipe everything. Back up both folders. After a restart you should still be configured (land on `/admin`, not the wizard) and your gates should still be there.

Behind nginx, raise the upload limit and forward the real client IP:

```nginx
client_max_body_size 220m;
# also make nginx set/overwrite X-Forwarded-For so rate limiting sees the real IP
```

## Security notes

- `/api/settings/public` returns **only** display fields. It never exposes the admin password hash, the `isConfigured` flag, or any `.env` value.
- SoundCloud API calls use `Authorization: OAuth <token>` (not `Bearer`).
- The fan's access token is used once for the four actions, then discarded. No fan PII is stored.
- The posted comment is **untimed**, so each unlock appears as its own entry rather than threading under the first.
- Download links are HMAC-signed, expire after 15 minutes, and stream through an authenticated route — never a public path.
- Never commit `.env`, the contents of `data/`, or uploaded files. They're in `.gitignore`; keep them there.

## Troubleshooting

> **Stuck on something not listed here?** Paste this README and your exact error message into an AI assistant (ChatGPT, Claude, Gemini) — with this file as context it can diagnose almost anything. That's the fastest path.

- **`redirect_uri_mismatch` at login** — `SC_REDIRECT_URI` and the redirect URI in your SoundCloud app must match character-for-character (scheme, host, path, no trailing slash).
- **Admin login always fails** — likely an unescaped `$` in a bcrypt hash in `.env`. Escape each `$` as `\$`, or just use the wizard.
- **Data gone after restart** — the `data`/`storage` volumes aren't mounted right, or you ran `docker compose down -v`. Check the volume mounts and confirm `gate.db` shows up in the host `./data/` folder.
- **`next start` 500s** — expected; this project uses standalone output. Use Docker or `node .next/standalone/server.js`.
- **502 / "bad gateway" after setting up the proxy** — normal if the app isn't running yet (before Step 7), or the proxy points at the wrong port. Confirm the container is up (`docker compose ps`) and that the proxy's port matches your `HOST_PORT`.
- **Second gate won't start / port already in use** — two gates can't share a port. Give each its own `HOST_PORT` in its own `.env`, in its own folder.
- **`resolve-urn.ts` fails with `invalid_request`** — you pasted too much of the URL. Paste only the value between `code=` and `&state`.

## Project structure

```
src/
  app/
    gate/[id]/        Fan-facing gate page
    callback/         OAuth callback — runs the 4 SoundCloud actions
    setup/            First-run wizard (gated until configured)
    admin/            Login, dashboard, settings
    api/
      auth/start/     Begins the PKCE OAuth flow (POST)
      download/       Streams the file against a signed token
      settings/public Display-only branding for the gate page
      setup/          Wizard submission
      admin/          Login, gate CRUD, settings (session-protected)
  components/
    LogoGlitch.tsx    Animated, accent-colored logo (loads /logo.svg)
  lib/
    settings.ts       Reads the single Settings row (Node runtime)
    session-edge.ts   Edge-safe session verification (no Prisma)
    sc-client.ts      SoundCloud API calls
    crypto.ts         PKCE, token signing, timing-safe compares
scripts/
  setup-env.ts        Generates secrets + admin hash
  resolve-urn.ts      One-time: resolves your artist URN
```

---

Built with Next.js (App Router), Prisma + SQLite, Three.js, and Docker.
