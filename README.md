# The DGym — Membership, NFC Access Control & Retention Platform

Production web portal, FastAPI backend, NFC tap/WebSocket live monitor, Xendit online checkout, and member churn analytics for **The DGym Rosario Batangas**.

---

## Architecture

- **`web`** (`nginx:1.27-alpine`, built via [deploy/nginx/Dockerfile](deploy/nginx/Dockerfile)): Serves the React/Vite SPA, terminates TLS, enforces HTML security headers & CSP, forwards `/api/*` and WebSocket `/api/access/ws/*` to `backend`.
- **`backend`** (`python:3.13-slim`, [backend/Dockerfile](backend/Dockerfile)): Single-worker Uvicorn/FastAPI process (required while rate-limit buckets and live-feed WebSocket connections reside in process memory). Persists uploads in `dgym_uploads` (`/app/uploads`).
- **`db`** (`postgres:16-alpine`): Internal PostgreSQL 16 database persisted on the `pgdata` volume.
- **`certbot`** (optional `tls` Compose profile): Let's Encrypt certificate issuance and renewal via HTTP-01 webroot.

---

## Local Development

### Backend
```bash
cd backend
cp .env.example .env
# Python 3.13 venv
python -m venv venv
# Activate venv, then:
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
With `ENVIRONMENT=development`, startup uses local SQLite (`backend/dgym.db`) unless `DATABASE_URL` is set, and seeds baseline plans + demo accounts.

### Frontend
```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

### Verification Suites
```bash
# Frontend
cd frontend && npm run lint && npx tsc --noEmit && npm run build

# Backend (hermetic; uses isolated temp DB or TEST_DATABASE_URL)
cd backend
python verify_config.py
python verify_xendit_payments.py
python verify_security_and_scale.py
python verify_gym_workflows.py
```

---

## Production Deployment (VPS + Docker Compose + Nginx + TLS)

### 1. Prepare server configuration
```bash
cp .env.prod.example .env.prod
chmod 600 .env.prod
```
Fill in `.env.prod`:
- Set `SITE_DOMAIN` (default `thedgym.com`), `VITE_SITE_URL`, and `CORS_ORIGINS`.
- Set a URL-safe `POSTGRES_PASSWORD`.
- Generate `JWT_SECRET_KEY`:
  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(64))"
  ```
- Keep `TRUSTED_PROXY_IPS=127.0.0.1,::1,172.16.0.0/12` so `backend` trusts Nginx's Docker bridge `X-Forwarded-For` header cleanly.
- Set `XENDIT_SECRET_KEY` and `XENDIT_WEBHOOK_VERIFICATION_TOKEN` (required when `ENVIRONMENT=production`).

### 2. Boot the stack
On first start without Let's Encrypt certificates yet, [15-tls-bootstrap.sh](deploy/nginx/15-tls-bootstrap.sh) creates a temporary self-signed certificate so Nginx boots cleanly with ACME HTTP-01 ready on port 80:
```bash
docker compose --env-file .env.prod up -d --build
```
Verify internal health:
```bash
docker compose --env-file .env.prod ps
docker compose --env-file .env.prod exec -T backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/health').read().decode())"
```

### 3. Issue Let's Encrypt TLS certificate
Ensure DNS `A` records for `thedgym.com` and `www.thedgym.com` point to the VPS and ports `80`/`443` are open:
```bash
docker compose --env-file .env.prod --profile tls run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d thedgym.com -d www.thedgym.com \
  --email YOUR_EMAIL@thedgym.com --agree-tos --no-eff-email

docker compose --env-file .env.prod restart web
```
Add a root cron job (`crontab -e`) for automated renewal + Nginx reload:
```cron
15 3 * * * cd /opt/The_D_gym && docker compose --env-file .env.prod --profile tls run --rm certbot renew --quiet && docker compose --env-file .env.prod exec -T web nginx -s reload
```

### 4. Bootstrap the first Admin user
Production (`ENVIRONMENT=production`) never seeds demo accounts. Create the initial admin cleanly:
```bash
docker compose --env-file .env.prod exec backend \
  python scripts/create_admin.py --email owner@thedgym.com --full-name "DGym Owner"
```

### 5. Xendit Sandbox -> Live Cutover
1. Verify sandbox checkout & webhook end-to-end with `XENDIT_SECRET_KEY=xnd_development_...` and your sandbox callback URL set in the Xendit Dashboard to:
   `https://thedgym.com/api/payments/webhook/xendit`
2. Once Xendit live mode is approved, update `XENDIT_SECRET_KEY=xnd_production_...` and `XENDIT_WEBHOOK_VERIFICATION_TOKEN` in `.env.prod`, then recreate `backend`:
   ```bash
   docker compose --env-file .env.prod up -d backend
   ```
   Confirm live mode via `/api/payments/status` (`"is_test_mode": false`).

---

## Nightly Backups & Restore Drill

Both scripts target the running Docker Compose stack cleanly (`pg_dump --format=custom` + `/app/uploads` tarball + SHA-256 verification). Ensure scripts are executable (`chmod +x deploy/scripts/backup.sh deploy/scripts/restore.sh`).

### Configure nightly backup cron (02:30 UTC daily, 14-day retention)
```cron
30 2 * * * /opt/The_D_gym/deploy/scripts/backup.sh >> /var/log/dgym-backup.log 2>&1
```

### Manual backup & verified restore
```bash
# Run backup now
./deploy/scripts/backup.sh

# Test or perform point-in-time restore from a backup snapshot
./deploy/scripts/restore.sh ./backups/YYYYMMDD_HHMMSS
```
Periodically copy `./backups/` offsite (e.g. encrypted `rclone`/`rsync`) and run a test restore in staging to verify backup integrity end-to-end.
