# Running hermes-hudui Locally on the Laptop

This is a laptop-only dev guide for hacking on **both** the frontend and backend of
`hermes-hudui` against a **local snapshot** of the live agent's data. The live server
agent (`rsanchez@100.109.101.96:~/.hermes/`) is **never** touched — the local backend
reads and writes only the copied snapshot.

- Repo: `~/hermes-hudui` (GitHub `texas697/hermes-hud`)
- Data snapshot: `~/hermes-data-snapshot/` (kept **outside** the repo, never committed)
- Backend: FastAPI on `http://localhost:3001` (auto-reload with `--dev`)
- Frontend (dev): Vite/React on `http://localhost:5173` (HMR, proxies `/api` + `/ws` → `:3001`)

---

## Dev vs production — read this first

Two URLs look similar but behave very differently:

| URL | Mode | Frontend source | When to use |
|-----|------|-----------------|-------------|
| **http://localhost:5173** | **Dev** | Vite dev server + HMR | **Always use this while editing UI** |
| http://localhost:3001 | Production | Baked `backend/static/` bundle | Backend-only testing, or after `npm run build` |

**Common mistake:** opening `:3001` and wondering why frontend edits (CSS, React, pipeline
flow, Skills borders, etc.) don't show up. That port serves the **last built** static
assets, not your working tree.

**How to tell which mode you're in:**

- **Dev (`:5173`):** View Source shows `@vite/client` and `/src/...` module URLs.
- **Prod (`:3001`):** View Source shows `/assets/index-*.js` and `/assets/index-*.css`.

While developing:

- Edit files under `frontend/src/` → save → Vite hot-reloads automatically.
- **Do not** run `npm run build` or copy to `backend/static/` unless you're testing the
  production bundle on purpose.

To ship UI changes to the prod-served path:

```sh
cd ~/hermes-hudui/frontend && npm run build && cd ..
rm -rf backend/static/assets/* && cp -r frontend/dist/* backend/static/
```

Then restart `hermes-hudui` (without `--dev` is fine) and open `:3001`.

---

## Why a snapshot (and not a live mount)

The HUD has **write** endpoints (`backend/api/memory.py`) that do file-locked atomic
writes to memory files. Pointing the local backend at the live server data risks
corrupting the production agent. An SSHFS live-mount was also rejected: inotify doesn't
fire over SSHFS (kills the WebSocket live-refresh) and the ~3 GB SQLite is slow over the
network. So: **copy the data locally, work on the copy.**

---

## Prerequisites (already satisfied on this laptop)

- Python 3.11+ (laptop has 3.12), Node 18+ (laptop has v24), npm, `rsync`
- SSH access to the server: `ssh rsanchez@100.109.101.96` (Tailscale) or
  `ssh rsanchez@192.168.4.25` (LAN)

---

## 1. One-time install

```sh
cd ~/hermes-hudui
./install.sh
```

Creates `venv/`, installs the backend in editable mode, runs `npm install`, and builds
the frontend into `backend/static/` (that build is for prod-serving only; day-to-day UI
work uses Vite on `:5173`).

---

## 2. Snapshot the agent data (one-time; re-run to refresh)

The server `~/.hermes/` is ~30 GB, but most of it (`hermes-agent/`, `home/`, `venvs/`,
`state-snapshots/`, `music-pipeline/`, caches) is **not** read by the dashboard. This
`rsync` pulls only what the collectors actually use (~5 GB, dominated by `state.db`):

```sh
mkdir -p ~/hermes-data-snapshot
rsync -a --info=progress2 --no-inc-recursive \
  --exclude 'hermes-agent/' \
  --exclude 'home/' \
  --exclude 'venvs/' \
  --exclude 'state-snapshots/' \
  --exclude 'music-pipeline/' \
  --exclude 'audio_cache/' \
  --exclude 'captures/' \
  --exclude '*.tmp' \
  rsanchez@100.109.101.96:/home/rsanchez/.hermes/ \
  ~/hermes-data-snapshot/
```

Includes everything the HUD reads: `state.db`, `config.yaml`, `gateway_state.json`,
`memories/{MEMORY.md,USER.md}`, `skills/`, `profiles/`, `cron/`, `logs/`, `plugins/`,
`state/`. A `some files vanished (code 24)` warning is normal — the server dir is live.

> Re-run this any time to pull fresh data. Because it's a copy, local edits (including
> memory writes) never affect the running server agent.

---

## 3. (Optional) Chat tab support

Only needed if you're editing/using the live chat tab, which spawns the `hermes` CLI:

```sh
cd ~/hermes-hudui && source venv/bin/activate
pip install 'hermes-hudui[chat]'   # or: pip install hermes-agent
```

Skip otherwise — the chat tab just shows "Hermes CLI not available".

---

## 4. Run the backend (Terminal 1)

```sh
cd ~/hermes-hudui && source venv/bin/activate
hermes-hudui --dev --hermes-dir ~/hermes-data-snapshot
```

- `--dev` → Uvicorn auto-reload on `backend/` changes
- `--hermes-dir` → **required**; points the backend at the snapshot. Without it the
  backend looks for a non-existent `~/.hermes/` and renders an empty dashboard.

If you see `Address already in use` on `:3001`, a backend is already running. Either use
it (if it was started with the same `--hermes-dir`) or stop the old process first:

```sh
ss -ltnp | rg ':3001'
# kill <pid>   # only if you intend to restart
```

---

## 5. Run the frontend (Terminal 2)

```sh
cd ~/hermes-hudui/frontend
npm run dev
```

Serves **http://localhost:5173** with HMR. The proxy in `frontend/vite.config.ts` sends
`/api` and `/ws` to `localhost:3001` — no edit needed.

If `:5173` is taken, Vite picks the next free port (e.g. `:5174`) and prints the URL in
the terminal — use **that** URL, not `:3001`.

---

## 6. Open and verify

Open **http://localhost:5173** (not `:3001`).

- Working tabs: memory, skills, sessions, patterns, costs, health, gateway, plugins, etc.
- Media-server-only tabs behave differently off-server:
  - **Music** (`/api/pipeline/music`), **Docker** (`/api/services/docker`) → degrade
    gracefully (empty/alert, HTTP 200).
  - **Debrid** (`/api/pipeline/debrid`) → may return **HTTP 500** off-server when
    `/opt/media-stack/plex-debrid/config/settings.json` is absent. Harmless to the rest
    of the app.

Quick smoke test from the CLI:

```sh
curl -s -o /dev/null -w "frontend proxy: %{http_code}\n" http://localhost:5173/api/state   # expect 200
curl -s -o /dev/null -w "backend direct: %{http_code}\n" http://localhost:3001/api/state    # expect 200
```

---

## Stopping

`Ctrl-C` in each terminal. Nothing persists between runs except the snapshot dir.

---

## Troubleshooting

**UI changes not visible**

1. Confirm you're on **http://localhost:5173**, not `:3001`.
2. Check View Source for `@vite/client` (dev) vs `/assets/index-*.js` (prod).
3. On `:3001` only: hard refresh (`Ctrl+Shift+R`) after a static rebuild.

**"Address already in use"**

- `:3001` — backend already running; reuse it or kill and restart with `--dev`.
- `:5173` — another Vite instance running; use the URL Vite prints, or stop the duplicate.

**Backend edits not picked up**

- Backend must be started with `--dev` (Uvicorn reload). Restart if you launched without it.

**Frontend edits not picked up on `:5173`**

- Ensure `npm run dev` is running in `frontend/`.
- Check the terminal for Vite errors after save.

---

## IntelliJ (optional convenience)

- **Backend run config:** Python target = `~/hermes-hudui/venv/bin/hermes-hudui`,
  args = `--dev --hermes-dir <home>/hermes-data-snapshot`, interpreter = the venv.
- **Frontend run config:** npm script `dev` in `~/hermes-hudui/frontend`.
- Combine both into one Compound run config to start them together.
- Browser bookmark: **http://localhost:5173** (dev), not `:3001`.

---

## Safety / housekeeping

- Keep `~/hermes-data-snapshot/` **outside** the repo tree (it is, at `~`). Don't commit
  it or any snapshot path.
- Nothing in this workflow modifies the server, the live `~/.hermes/`, or the shared
  `Rudy_Media_Server_Project` docs.
- Always run the backend with `--hermes-dir` pointing at the snapshot.
