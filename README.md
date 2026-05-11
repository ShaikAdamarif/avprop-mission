# AV PROP MISSION — Self-hosted (Node + SQLite)

Runs your full app from a single Node server with a SQLite database.
All data (admin1, HRs, users, projects, etc.) is stored in `data/avprop.db`
and synced in real time to every connected device via Server-Sent Events.

## Run locally

```
npm install
npm start
```

Open http://localhost:3000

The database file is created at `./data/avprop.db`.

## Deploy to a public URL (free, with persistent disk) — Render.com

Netlify cannot host this (it has no persistent disk). Use **Render** instead —
it's free and supports persistent storage.

1. Create a free account at https://render.com
2. Push this folder to a GitHub repo (or use Render's "Deploy from ZIP" via
   their Blueprint feature).
3. In Render dashboard → **New + → Blueprint** → point to the repo.
   `render.yaml` is already included and will:
   - Run `npm install` and `npm start`
   - Mount a 1 GB persistent disk at `/var/data` (where the SQLite file lives)
4. Click **Apply**. After ~2 minutes you'll get a public URL like
   `https://avprop-mission.onrender.com`
5. Open that URL on any device — admin1, HRs, users all sync in real time.

### Other hosts that work the same way
- **Railway.app** — `railway up`, add a volume at `/var/data`
- **Fly.io** — `fly launch`, attach a volume
- **A VPS** (DigitalOcean, Hetzner, etc.) — `node server.js` behind nginx

### Hosts that will NOT work
- Netlify, Vercel, Cloudflare Pages — no persistent disk for SQLite.

## Login
Admin credentials are baked into `public/app.js` (admin1 / the password you set
earlier). HR and user accounts you create are saved in the SQLite DB and
visible to admin1 from any device.
