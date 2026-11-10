# Deployment

This document covers how the Gemstone Selections marketplace runs in production, the two supported hosting paths,
backups, the full environment reference, the migration step, and the go-live checklist.

Note on terms: "SSL" in this document means the TLS certificate that secures HTTPS. The "SSL-related options" in the
client brief is a product question and is unrelated (see the checklist).

## 1. Architecture

| Part | What it does | Notes |
| --- | --- | --- |
| **app** | Next.js 16 server (`node server.js` from the standalone build). Serves pages, server actions, route handlers. | Port 3000. Bind to localhost behind a reverse proxy. |
| **worker** | Long-running Node process (`npm run worker`, which runs `scripts/worker.ts` with tsx). Runs scheduled jobs. | One replica only is expected; advisory locks make a second replica safe but idle. |
| **migrate** | One-off job: `prisma migrate deploy`. | Runs before app and worker start. |
| **PostgreSQL 16** | All application data, rate-limit counters, job locks. | Not exposed to the internet. |
| **Object storage** | Private files: seller documents, listing media, valuation media. | Local disk (`STORAGE_PROVIDER=local`) for a single VPS, or an S3-compatible bucket (`STORAGE_PROVIDER=s3`: AWS S3, Cloudflare R2, DigitalOcean Spaces). Bucket must block public access. |
| **Reverse proxy** | Nginx: TLS termination, HTTP to HTTPS redirect, forwards `X-Forwarded-For`. | Set `TRUSTED_PROXY_COUNT=1`. |
| **Email / SMS** | Resend (email) and MSG91 (SMS). | Console providers are refused in production. |

Jobs run by the worker (times are IST, UTC+05:30):

| Job | Schedule | Purpose |
| --- | --- | --- |
| notify-flush | every 5 minutes | Sends batched message notification emails. |
| analytics-rollup | daily at 00:30 IST | Aggregates finished days; prunes raw events older than 90 days. Idempotent. |
| newsletter-campaigns | every minute | Sends due newsletter campaigns. |
| content-publish | every minute | Publishes scheduled articles. |
| newsletter-weekly-digest | hourly check | Sends the weekly digest when due. |
| rate-limit-cleanup | hourly | Deletes rate-limit rows untouched for 24 hours. |

The worker ticks every 30 seconds, runs each due job under a Postgres advisory lock, and keeps going when a job fails.
Last successful run times are kept in `.data/worker-state.json`. If that file is lost, daily jobs run once more, which is
safe because the rollup is idempotent.

## 2. Path A: VPS with Docker, Nginx and certbot

Assumes a fresh Ubuntu 24.04 LTS server with a public IPv4 address and a DNS `A` record for the site.

### 2.1 Server setup

1. Create a non-root sudo user and disable password SSH logins (`PasswordAuthentication no` in `sshd_config`).
2. Firewall: allow only SSH, HTTP and HTTPS.
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow OpenSSH
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```
   Port 3000 and 5432 must not be open. The compose file binds the app to `127.0.0.1` and publishes no database port.
3. Unattended security upgrades:
   ```bash
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```
4. Install Docker Engine and the Compose plugin from Docker's official repository, then add your user to the `docker` group.
5. Install Nginx and certbot:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

### 2.2 Application

1. Clone the repository to `/srv/gemstone` (deploy key, read-only).
2. Create the env file outside the repository, readable by root and the deploy user only:
   ```bash
   sudo mkdir -p /etc/gemstone && sudo touch /etc/gemstone/app.env && sudo chmod 600 /etc/gemstone/app.env
   ```
   Fill it using the reference in section 5. Generate secrets with `openssl rand -base64 48` (AUTH_SECRET) and a strong
   random password for `POSTGRES_PASSWORD` (URL-safe characters only).
3. Build and start (the migrate job runs first):
   ```bash
   cd /srv/gemstone
   docker compose -f docker-compose.prod.yml --env-file /etc/gemstone/app.env up -d --build
   docker compose -f docker-compose.prod.yml --env-file /etc/gemstone/app.env ps
   ```
4. Check the health endpoint on the server: `curl -s http://127.0.0.1:3000/api/health` should return
   `{"status":"ok","database":"ok","version":"0.1.0"}`.

### 2.3 Nginx

`/etc/nginx/sites-available/gemstone`:

```nginx
server {
    listen 80;
    server_name gemstones.example www.gemstones.example;

    client_max_body_size 40m;   # uploads: up to 35 MB per form post, server action limit is 35 MB

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        # Append the address this proxy received. The app takes the entry appended by the
        # nearest trusted proxy (TRUSTED_PROXY_COUNT=1), so client-supplied entries are ignored.
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Enable it, then issue the certificate with certbot (Let's Encrypt):

```bash
sudo ln -s /etc/nginx/sites-available/gemstone /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d gemstones.example -d www.gemstones.example --redirect
sudo certbot renew --dry-run
```

certbot installs a systemd timer that renews certificates automatically. Check it with `systemctl list-timers | grep certbot`.
Certificates expire after 90 days; the dry run confirms renewal works. Nginx then serves the HTTPS site, and the app sends
`Strict-Transport-Security` because `NODE_ENV=production`.

### 2.4 Backups

See section 6.

## 3. Path B: Vercel with managed Postgres and a separate worker

Vercel can host the Next.js app, but it does not run long-lived processes, so **the worker must run elsewhere**. Without
it, notifications, scheduled articles, newsletter sends and the analytics rollup do not run.

Requirements for this path:

- **Database:** managed PostgreSQL 16 (for example Neon, Supabase or RDS). Use a connection string with TLS, and set
  `DATABASE_URL` in Vercel's project environment.
- **Storage:** must be `STORAGE_PROVIDER=s3`. Vercel's filesystem is not persistent, so `local` cannot be used.
- **Worker:** run on a small VM (for example the VPS in path A, or a 1 GB instance) with the same env file, using
  `npm run worker`, or as a `docker compose` service with only the `worker` service and `migrate` enabled.
  The worker and the app share one database, so the job locks work across hosts.
- **Alternative (weaker):** a cron service (for example Vercel Cron or an external scheduler) calling a protected route
  every minute. This route does not exist yet. If you use it, add a route that checks a secret header and runs the same
  job functions, and accept that daily jobs depend on the scheduler's reliability. Prefer the VM worker.
- **Trusted proxies:** Vercel sits in front of the app. Set `TRUSTED_PROXY_COUNT` to the number of proxies Vercel adds
  before the function, and confirm it by checking the audit log IP values for a test request.
- **Migrations:** run `npx prisma migrate deploy` from a CI job or a laptop with the production `DATABASE_URL`, before
  deploying the new app version.

## 4. Migrations

Run migrations before starting the new version, never after:

```bash
# Docker path (automatic): the migrate service runs `prisma migrate deploy` and must exit 0 before app and worker start.
# Manual path:
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

`migrate deploy` applies pending migrations and never resets data. Do not run `prisma migrate dev`, `prisma migrate reset`
or any `db:seed:*` script against production. The demo seeds refuse to run in production, and `ALLOW_DEMO_SEED` must be
`false`.

## 5. Environment reference

Set these in the env file (Docker) or the hosting provider's environment. Values are validated at server start;
`instrumentation.ts` lists every problem at once and refuses to start.

"Production" means `NODE_ENV=production`. Compose sets `NODE_ENV` for you.

| Variable | Required | Default | Production notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | none | PostgreSQL URL. Compose builds it from `POSTGRES_PASSWORD`. Use a URL-safe password or percent-encode it. |
| `POSTGRES_PASSWORD` | Docker only | none | Password for the compose `db` service. Must match the URL. |
| `NODE_ENV` | no | `development` | Set to `production` (compose does). Enables the production rule set. |
| `APP_URL` | yes in production | `http://localhost:3000` | Public address, for example `https://gemstones.example`. Must be https in production. Used in email links and referral codes. |
| `AUTH_SECRET` | yes in production | none | At least 32 characters. Signs sessions and derives analytics salts. Generate with `openssl rand -base64 48`. Changing it signs everyone out. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | no | none | Used by the base seed (`prisma db seed`) only to create the first admin. Rotate the password after first login (see checklist). |
| `EMAIL_PROVIDER` | yes in production | `console` | Must be `resend`. `console` is refused unless `ALLOW_NON_DELIVERING_PROVIDERS=true`. |
| `RESEND_API_KEY` | yes if resend | none | Resend API key. |
| `EMAIL_FROM` | yes if resend | none | Verified sender, for example `Gemstone Selections <no-reply@your-domain>`. The domain must be verified in Resend. |
| `RESEND_WEBHOOK_SECRET` | no | none | Svix signing secret for the Resend webhook. Must start with `whsec_` when set. |
| `SMS_PROVIDER` | yes in production | `console` | Must be `msg91`. `console` is refused unless `ALLOW_NON_DELIVERING_PROVIDERS=true`. |
| `MSG91_AUTH_KEY` | yes if msg91 | none | MSG91 auth key. |
| `MSG91_SENDER_ID` | yes if msg91 | none | Six-character DLT-registered sender ID. |
| `MSG91_TEMPLATE_ID` | yes if msg91 | none | DLT-approved Flow template ID. |
| `ALLOW_NON_DELIVERING_PROVIDERS` | no | `false` | **Test only.** Lets the console providers run in production mode for the end-to-end suite. Never set on a real host. |
| `STORAGE_PROVIDER` | no | `local` | `local` or `s3`. Use `s3` for Vercel and for any multi-host setup. |
| `STORAGE_DIR` | local only | `./.data/uploads` | Root for local files. Must not be inside `public/`. In Docker it is a named volume at `/app/.data/uploads`. |
| `S3_BUCKET` | yes if s3 | none | Private bucket. Block public access. Enable versioning (section 6). |
| `S3_REGION` | no | `us-east-1` (AWS) or `auto` (with an endpoint) | Region for AWS. R2 uses `auto`. |
| `S3_ENDPOINT` | R2 and Spaces | none | For example `https://<account>.r2.cloudflarestorage.com` or `https://<region>.digitaloceanspaces.com`. |
| `S3_ACCESS_KEY_ID` | yes if s3 | none | Key with read, write and delete on the bucket only. |
| `S3_SECRET_ACCESS_KEY` | yes if s3 | none | Secret for the key above. |
| `S3_FORCE_PATH_STYLE` | no | `false` | Set `true` for some S3-compatible providers that require path-style URLs. |
| `UPLOAD_MAX_MB` | no | `10` | Per-file upload limit, 1 to 50. |
| `TRUSTED_PROXY_COUNT` | no | `1` | Number of reverse proxies in front of the app, 0 to 5. `1` for the Nginx setup. `0` ignores `X-Forwarded-For` (use only with no proxy). |
| `ALLOW_DEMO_SEED` | no | `false` | Must be `false`. `true` is refused in production. |
| `SENTRY_DSN` | no | none | Enables error reporting to Sentry (`https://<key>@<host>/<project>`). Off when unset. Requests, cookies and personal data are scrubbed. |

Notes:

- Empty values (for example copied from `.env.example`) count as unset.
- Keep the env file out of git. `.gitignore` and `.dockerignore` already exclude `.env*`.
- The image contains no secrets. Nothing is baked in at build time.

## 6. Backups and restore

### 6.1 Database: daily `pg_dump` to off-site storage

Run from the host (or a sidecar container) at 02:30 local time, as a cron job for the deploy user:

```bash
#!/usr/bin/env bash
# /usr/local/bin/gemstone-backup.sh  (chmod 700, owned by root)
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/var/backups/gemstone/gemstone-$STAMP.dump
docker compose -f /srv/gemstone/docker-compose.prod.yml --env-file /etc/gemstone/app.env \
  exec -T db pg_dump -U gemstone -d gemstone --format=custom --no-owner > "$OUT"
gzip -9 "$OUT" 2>/dev/null || true
# Off-site copy: any S3-compatible bucket with object lock or a separate account.
rclone copy /var/backups/gemstone/ offsite:gemstone-db-backups/ --min-age 0
# Keep 14 local days.
find /var/backups/gemstone -name '*.dump*' -mtime +14 -delete
```

Schedule with `crontab -e` as root: `30 2 * * * /usr/local/bin/gemstone-backup.sh >> /var/log/gemstone-backup.log 2>&1`.
Keep off-site copies for at least 30 days (set a bucket lifecycle rule). Encrypt the off-site copies (for example with
`rclone crypt`) because they contain personal data.

### 6.2 Restore test (do this before go-live, then monthly)

1. Start a throwaway Postgres 16 container on a different port, never the production one.
2. Restore the latest dump: `pg_restore --clean --if-exists --no-owner -d "postgresql://..." latest.dump`.
3. Run `npx prisma migrate status` against it (it should report the schema is up to date) and compare row counts of
   `User` and `Gemstone` with production.
4. Record the date, the dump used, and the time taken in the ops log. A restore that has never been tested is not a backup.

### 6.3 Object storage

- **S3-compatible:** enable bucket versioning, so a deleted or overwritten object can be recovered. Add a lifecycle rule
  that expires noncurrent versions after 90 days. Keep public access blocked.
- **Local disk:** include `/var/lib/docker/volumes/gemstone_uploads` in the host backup, with the same off-site copy.

## 7. Monitoring basics

- **Health check:** `GET /api/health` returns 200 when the database answers and 503 `{"status":"degraded","database":"down"}`
  otherwise. It returns no hostnames, env values or error details. Point an uptime monitor (external, from another
  region) at it, every minute, alerting after two failures.
- **Worker logs:** one JSON line per job run: `{"job":"...","outcome":"ok|error|skipped","durationMs":...}`. Alert when
  `outcome` is `error` for the same job twice in a row, or when no `analytics-rollup` line with `ok` appears for 26 hours.
  Read them with `docker compose -f docker-compose.prod.yml logs -f worker`.
- **App logs:** `docker compose ... logs -f app`. Error boundary events log only a digest. Full errors go to Sentry when
  `SENTRY_DSN` is set.
- **Disk:** alert at 80 percent on the database volume and the uploads volume.

## 8. Updating

1. Take a database backup (section 6.1).
2. `git pull` on the server, then `docker compose ... up -d --build`. The migrate job runs first.
3. Check `/api/health` and the worker logs.
4. Rollback: revert the commit, rebuild, and restore the database only if the migration cannot be reversed. Prisma
   migrations are forward-only, so a rollback after a destructive migration needs the backup.

## 9. Go-live checklist

Every item must be done and recorded before public launch.

- [ ] **MSG91 DLT registration:** the sender ID and the Flow template are approved on DLT for every OTP and notification
      text sent. Test one real SMS to an Indian mobile before go-live.
- [ ] **Resend domain verification:** the sending domain shows verified in Resend (SPF, DKIM and DMARC records in place).
      Send a test email to an external mailbox and confirm it lands in the inbox, not spam.
- [ ] **Strong admin password, and rotate the seeded one:** the admin account created from `ADMIN_EMAIL` and
      `ADMIN_PASSWORD` must get a new, strong password after first sign-in. Remove `ADMIN_PASSWORD` from the env file
      afterwards.
- [ ] **No demo data:** `ALLOW_DEMO_SEED=false`. Do not run `npm run db:seed:demo` or any `db:seed:m*` script. Check the
      reference prices and content are the client's real data, not demo rows (demo rows are flagged `isDemo`).
- [ ] **Legal review of the four legal pages:** terms, privacy, cookie notice and seller agreement. The pages under
      `/legal/*` carry a "Draft" banner until counsel approves them. Replace every bracketed placeholder, including the
      company name, address, grievance officer and contact emails.
- [ ] **Real reference prices:** import the client's reference price CSV in the admin valuation prices page. Confirm the
      valuation outputs on a sample of stones.
- [ ] **Client-confirmed membership rules:** tier limits, featured slots, fees and unlock thresholds are placeholders
      until the client confirms them. Update the tier rules in the admin memberships page, then update the legal text.
- [ ] **Open question, "SSL-related options":** the client brief does not define these. They are treated as SSEF lab
      certificates until the client confirms. Do not launch a feature for them without confirmation.
- [ ] **Sitemap and robots:** `/sitemap.xml` lists only public URLs and `robots.txt` is correct for the live domain.
- [ ] **Security headers:** check `https://<site>` with a header scanner. CSP is enforced (see the M6 platform report for
      the trade-off on `unsafe-inline` scripts).
- [ ] **Backups:** a restore test has passed (section 6.2), and the first off-site backup exists.
- [ ] **Monitoring:** uptime monitor on `/api/health`; worker log alert; disk alerts.
- [ ] **Error reporting:** `SENTRY_DSN` is set, or the team accepts that errors are only in the server logs.
- [ ] **TLS:** certbot renewal dry run passes; HTTP redirects to HTTPS; `APP_URL` is the https address.
- [ ] **Environment check:** the app starts without errors in production mode. Any missing or unsafe variable stops it
      with a list of problems.
