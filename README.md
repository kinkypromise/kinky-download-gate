# SoundCloud Download Gate

A self-hosted Next.js app that gives fans a free download in exchange for a SoundCloud follow, like, repost, and comment. One artist per deployment. Branding is configured through a first-run web wizard; SoundCloud credentials live only in `.env`.

This README is written for people who have never self-hosted anything before. If you already know your way around a VPS, skip to the commands.

---

## What you need

- A domain name you control (e.g. `music.yourartist.com`)
- A VPS (virtual private server) with Ubuntu or Debian
- A SoundCloud account with an **Artist** or **Artist Pro** subscription
- About 30 minutes

If you do not have a VPS yet, any cheap Linux VPS works. You need root SSH access and a public IP.

---

## The big picture

1. You rent a VPS and point your domain to it.
2. You install Node.js and a reverse proxy (nginx or Apache) on the VPS.
3. You copy this app to the VPS and fill in your SoundCloud credentials.
4. You start the app, open the first-run wizard, and set your artist name, password, and port.
5. You create a "gate" for each track you want to give away.
6. Fans visit the gate link, leave a comment, connect SoundCloud, and get a download.

---

## Step 1 — Prepare your domain and VPS

### Point your domain to the VPS

In your domain provider's DNS settings, create an A record:

```
Type: A
Name: music (or @ for the root domain)
Value: 1.2.3.4   <-- your VPS public IP
TTL: 3600
```

DNS can take a few minutes to a few hours to propagate. You can check it with:

```bash
nslookup music.yourartist.com
```

When it returns your VPS IP, you are ready.

### Connect to your VPS

On macOS or Linux, open Terminal and run:

```bash
ssh root@1.2.3.4
```

Replace `1.2.3.4` with your VPS IP. On Windows, use PuTTY or the Windows Terminal.

You may be asked for a password. Type it and press Enter. If your provider gave you an SSH key, use that instead.

### Update the server

Once you are logged in, run:

```bash
apt update && apt upgrade -y
```

This updates the server's software.

---

## Step 2 — Install Node.js

This app needs Node.js 22 or newer.

```bash
# Install NodeSource repository for Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Check the versions
node -v
npm -v
```

You should see something like `v22.x.x` and `10.x.x`.

Also install a few tools we need later:

```bash
apt install -y git sqlite3 curl
```

---

## Step 3 — Install and configure a reverse proxy

The app runs on a private port like `3000`. nginx (or Apache) listens on the public ports `80` and `443` and forwards traffic to the app. It also handles HTTPS.

### Option A — nginx (recommended)

Install nginx and certbot for free HTTPS certificates:

```bash
apt install -y nginx certbot python3-certbot-nginx
```

Create a new site config:

```bash
nano /etc/nginx/sites-available/music.yourartist.com
```

Paste this inside (replace `music.yourartist.com` with your domain and `3000` with the port you will choose in the setup wizard):

```nginx
server {
    listen 80;
    server_name music.yourartist.com;

    client_max_body_size 220m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`.

Enable the site:

```bash
ln -s /etc/nginx/sites-available/music.yourartist.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Get a free HTTPS certificate:

```bash
certbot --nginx -d music.yourartist.com
```

Follow the prompts. certbot will edit the nginx config for HTTPS automatically.

### Option B — Apache

If your VPS uses Plesk or you prefer Apache, the idea is the same: create a vhost that proxies everything to `http://127.0.0.1:3000` and set `X-Forwarded-For` / `X-Forwarded-Proto` headers. Set `ProxyPass / http://127.0.0.1:3000/` inside the SSL vhost and raise any upload limits to at least 220 MB.

---

## Step 4 — Get SoundCloud credentials

1. Log in to the SoundCloud account that owns the artist profile you want fans to follow.
2. Go to `https://soundcloud.com/you/apps`.
3. Click **New application**.
4. Set the **Redirect URI** to exactly:

   ```
   https://music.yourartist.com/callback
   ```

   If the form shows a **Use PKCE** option, leave it enabled.
5. Copy the **Client ID** and **Client Secret**. Keep them secret.

Important:

- Create one SoundCloud app per artist. Do not reuse the same Client ID for multiple gates.
- The redirect URI must match your `SC_REDIRECT_URI` character for character. A trailing slash mismatch will break login.

### Find your artist URN

You need the internal SoundCloud identifier for the artist profile. Run this helper from the project folder later:

```bash
npx tsx scripts/resolve-urn.ts
```

Paste your artist profile URL when asked, for example `https://soundcloud.com/your-artist`. The script prints:

```
soundcloud:users:123456789
```

Copy that value for the next step.

---

## Step 5 — Install the app

Back on the VPS, choose where to put the app. A common place is `/var/www`:

```bash
cd /var/www
git clone https://github.com/escadesign/esca-gate-template.git music-gate
cd music-gate
```

Create the environment file:

```bash
cp .env.example .env
nano .env
```

Fill in these values:

```bash
DATABASE_URL="file:./data/gate.db"
SC_CLIENT_ID="your-client-id"
SC_CLIENT_SECRET="your-client-secret"
SC_REDIRECT_URI="https://music.yourartist.com/callback"
SC_ARTIST_URN="soundcloud:users:your-artist-urn"
SESSION_SECRET="replace-with-64-random-hex-characters"
DOWNLOAD_TOKEN_SECRET="replace-with-64-different-random-hex-characters"
STORAGE_DIR="./storage/downloads"
PORT=3000
```

Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it twice and copy each output into `SESSION_SECRET` and `DOWNLOAD_TOKEN_SECRET`.

`ADMIN_PASSWORD_HASH` can be left empty — the first-run wizard will store the password in the database.

Save `.env` and exit nano.

Install dependencies and build the app:

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
```

If this is the first time, `npx prisma migrate deploy` creates the SQLite database at `./data/gate.db`.

---

## Step 6 — Start the app

The simplest way is:

```bash
PORT=3000 npm start
```

But this stops when you close the terminal. For a real server, use a process manager like `pm2` or `systemd`.

### Keep it running with pm2 (easiest)

Install pm2 globally:

```bash
npm install -g pm2
```

Start the app:

```bash
pm2 start npm --name "music-gate" -- start
pm2 save
pm2 startup
```

Run the command that `pm2 startup` prints, so the app starts automatically after reboots.

### If you want to host several gates on the same VPS

Each gate needs its own directory, its own database, its own port, and its own SoundCloud app.

Example:

```bash
cd /var/www
git clone https://github.com/escadesign/esca-gate-template.git artist-a-gate
git clone https://github.com/escadesign/esca-gate-template.git artist-b-gate
```

For each gate:

1. Edit its `.env` with unique secrets and a unique `PORT` (for example `3000`, `3001`, `3002`).
2. Build it.
3. Create a separate nginx vhost that proxies to the matching port.
4. During the first-run wizard, choose the same port you put in `.env`.

The wizard writes the chosen port into `.env.local` automatically, but you must restart the app for the new port to take effect.

---

## Step 7 — First-run wizard

Open your domain in a browser:

```
https://music.yourartist.com/setup
```

You will see a form. Fill it in:

- **Admin password**: at least 10 characters. This is the password you use to log in to `/admin`.
- **Confirm password**: type it again.
- **Artist name**: your artist name.
- **Label name**: optional.
- **Instagram URL**: optional, must start with `https://`.
- **Spotify URL**: optional, must start with `https://`.
- **Accent color**: click the color picker.
- **BPM**: a number between 60 and 220. It controls the speed of the logo glitch animation.
- **Runtime port**: the port the app listens on. Default is `3000`. Change this only if you are hosting multiple gates on the same VPS.

Submit the form. The wizard stores everything in the database, writes the port to `.env.local`, and redirects you to `/admin`.

After setup, `/setup` will automatically redirect to `/admin`.

---

## Step 8 — Upload your logo (optional)

By default the gate shows an animated glitch logo that loads `public/logo.svg` as a mask.

You have two options:

1. **Upload a logo through the admin UI**: go to `/admin/settings`, click **Upload logo**, and choose a PNG, JPG, WebP, or SVG file up to 2 MB. The uploaded logo replaces the glitch animation on both the admin page and the gate page.
2. **Replace the SVG mask**: replace `public/logo.svg` with your own black-frame SVG. The logo shape should be transparent, the background should be black, and the viewBox should stay `0 0 1920 1080`.

---

## Step 9 — Create your first gate

A gate is one track giveaway.

1. Go to `https://music.yourartist.com/admin` and log in.
2. Click **New gate**.
3. Paste the SoundCloud track URL, for example `https://soundcloud.com/your-artist/track-name`.
4. The URN field should auto-fill. If it does not, paste `soundcloud:tracks:123456789` manually.
5. Upload the final WAV or MP3 file.
6. Save the gate.
7. Copy the gate link and share it.

When a fan visits the link, they leave a comment, authorize SoundCloud, and the backend automatically follows your artist, likes and reposts the track, posts their comment, and gives them a 15-minute download link.

---

## Step 10 — Keep the app alive

After a reboot or if the app crashes, you want it to start again automatically.

If you used pm2, this is already handled after you ran `pm2 startup`.

To check the status:

```bash
pm2 status
pm2 logs music-gate
```

To restart after a code update:

```bash
npm run build
pm2 restart music-gate
```

---

## Security checklist

- Never commit `.env` or `.env.local` to git.
- Never commit the database file `data/gate.db` or uploaded files in `storage/`.
- Use a long, random `SESSION_SECRET` and `DOWNLOAD_TOKEN_SECRET`.
- Keep the VPS operating system and Node.js updated.
- Use HTTPS. certbot does this for free.

---

## Troubleshooting

### The setup page says "Setup has already been completed"

The app is already configured. Visit `/admin` and log in instead. If you forgot the password, reset it by generating a new bcrypt hash and updating the database directly.

### SoundCloud login fails with a redirect URI error

The `SC_REDIRECT_URI` in `.env` does not exactly match the redirect URI in your SoundCloud app. Check both character by character, including `https://` and any trailing slash.

### Uploads fail with "413 Request Entity Too Large"

Your reverse proxy limits upload size. For nginx, make sure `client_max_body_size 220m;` is set in the server block.

### The logo does not show after upload

The uploaded logo is stored in `storage/logos/`. Make sure the `storage/` directory is writable and that your reverse proxy does not block requests to `/storage/logos/*`.

### I want to change the port after setup

The port is stored in the database and in `.env.local`. You can see it in `/admin/settings`, but you must restart the app for a new port to take effect. To change it, edit `PORT` in `.env` or `.env.local`, rebuild if needed, and restart.

---

## Environment variable reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | SQLite path, e.g. `file:./data/gate.db` |
| `SC_CLIENT_ID` | yes | SoundCloud app Client ID |
| `SC_CLIENT_SECRET` | yes | SoundCloud app Client Secret |
| `SC_REDIRECT_URI` | yes | Must match the app redirect URI exactly |
| `SC_ARTIST_URN` | yes | URN of the artist profile fans will follow |
| `SESSION_SECRET` | yes | 32-byte hex secret for admin cookies |
| `DOWNLOAD_TOKEN_SECRET` | yes | 32-byte hex secret for download links |
| `STORAGE_DIR` | yes | Writable directory for uploads |
| `PORT` | yes | Port the app listens on, default `3000` |
| `ADMIN_PASSWORD_HASH` | no | Optional fallback if you skip the wizard |

---

## License

MIT
