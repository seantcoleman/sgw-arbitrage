# SGW Arbitrage — multi-tenant deploy notes (Oracle + Supabase + Vercel)

## 1. Supabase

1. Create a project at https://supabase.com
2. SQL editor → paste and run `supabase/migrations/20260915000000_multi_tenant.sql`
3. Auth → enable Email + (optional) Google provider
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` connection string → `DATABASE_URL` (use the **session pooler** URI on port 5432 for the Oracle workers)
   - JWT Secret (Settings → API) → `SUPABASE_JWT_SECRET`

## 2. Credential encryption key (Oracle only)

```bash
cd ~/sgw-arbitrage/backend
./venv/bin/python -c 'from crypto_creds import generate_key_b64; print(generate_key_b64())'
```

Add to `/home/ubuntu/sgw-arbitrage/backend/.env`:

```
CREDENTIAL_ENC_KEY=<output>
DATABASE_URL=postgresql://...
SUPABASE_JWT_SECRET=...
SUPABASE_URL=https://xxxx.supabase.co
AUTH_DISABLED=false
```

Generate a key once and never commit it.

## 3. Migrate existing SQLite data

1. Sign up in the new UI → copy your user UUID from Supabase Auth → Users
2. On Oracle:

```bash
export OWNER_USER_ID=<uuid>
cd ~/sgw-arbitrage/backend && ./venv/bin/python migrate_sqlite_to_postgres.py
```

3. Connect your SGW account at `/account` (replaces env-only bidding for your user)

## 4. Bind API to localhost + named Cloudflare tunnel

`/etc/systemd/system/sgw-backend.service` — change ExecStart host:

```
ExecStart=.../uvicorn api:app --host 127.0.0.1 --port 8000
```

Replace `sgw-tunnel.service` quick tunnel with a **named** tunnel:

```bash
cloudflared tunnel login
cloudflared tunnel create sgw-api
cloudflared tunnel route dns sgw-api api.yourdomain.com
# config: ~/.cloudflared/config.yml → ingress service http://127.0.0.1:8000
sudo systemctl enable --now cloudflared
```

Oracle security list: remove public ingress on port 8000 (keep 22).

```bash
sudo ufw deny 8000/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

Point Vercel `BACKEND_URL=https://api.yourdomain.com`.

## 5. Worker fleet + shared scanner

Install units from `backend/deploy/`:

```bash
sudo cp backend/deploy/sgw-worker@.service /etc/systemd/system/
sudo cp backend/deploy/sgw-scanner.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sgw-worker@1 sgw-worker@2 sgw-worker@3 sgw-worker@4
sudo systemctl enable --now sgw-scanner
```

Set `EXTERNAL_SCANNER=1` in the API `.env` so uvicorn does not double-schedule scans.

Optional: stop spawning an in-process sniper from the API (`SNIPER_IN_API=0`) once workers are live.

## 6. Scale Oracle VM (free tier)

Oracle Cloud → Compute → instance → Edit → shape **VM.Standard.A1.Flex** to **4 OCPU / 24 GB**.

## 8. Observability (optional)

Structured request logs already include `user_id` when a JWT is present.

For Sentry:

```bash
# backend .env
SENTRY_DSN=https://...@o....ingest.sentry.io/...

# Vercel env
NEXT_PUBLIC_SENTRY_DSN=  # or use @sentry/nextjs when you wire it
```

Install later with `pip install sentry-sdk[fastapi]` and init in `api.py` when you have a DSN.
