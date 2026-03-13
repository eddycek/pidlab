# PIDlab Infrastructure

Cloud infrastructure for PIDlab backend services. All services run on **Cloudflare** (Workers, R2, D1).

## Services

| Service | Status | Description | Design Doc |
|---------|--------|-------------|------------|
| **Telemetry Worker** | Ready | Upload + admin stats + cron report (`telemetry-worker/`) | [docs/TELEMETRY_COLLECTION.md](../docs/TELEMETRY_COLLECTION.md) |
| **License Worker** | Planned | Offline-first license key validation | [docs/LICENSE_KEY_SYSTEM.md](../docs/LICENSE_KEY_SYSTEM.md) |
| **Payment Worker** | Planned | Stripe checkout + invoice generation | [docs/PAYMENT_AND_INVOICING.md](../docs/PAYMENT_AND_INVOICING.md) |

## Directory Structure

```
infrastructure/
├── README.md
├── telemetry-worker/      ← CF Worker: upload, admin stats, daily cron report
│   ├── wrangler.toml
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts       ← Router + CORS + cron entry
│       ├── types.ts       ← Env bindings, bundle schema, aggregation types
│       ├── upload.ts      ← POST /v1/collect (validate, rate-limit, R2 write)
│       ├── admin.ts       ← GET /admin/stats/* (authenticated, R2 scan)
│       ├── validation.ts  ← UUID, schema, size, rate-limit checks
│       └── cron.ts        ← Daily 07:00 UTC aggregation → Resend email
├── license-worker/        ← (planned)
└── payment-worker/        ← (planned)

scripts/
├── telemetry-stats.sh     ← Quick summary via admin API
└── telemetry-report.sh    ← Full report with all breakdowns
```

## Telemetry Worker

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/collect` | None | Upload telemetry bundle (gzip, rate-limited 1/hr) |
| `GET` | `/admin/stats` | `X-Admin-Key` | Summary: installs, active 24h/7d/30d, modes |
| `GET` | `/admin/stats/versions` | `X-Admin-Key` | BF version distribution |
| `GET` | `/admin/stats/drones` | `X-Admin-Key` | Drone size + flight style distribution |
| `GET` | `/admin/stats/quality` | `X-Admin-Key` | Quality score histogram (5 buckets) |
| `GET` | `/health` | None | Health check |

### R2 Storage Layout

```
pidlab-telemetry/
├── {installationId}/
│   ├── latest.json       ← Most recent bundle (overwritten each upload)
│   └── metadata.json     ← { firstSeen, lastSeen, uploadCount }
└── ...
```

### Secrets (set via `wrangler secret put`)

| Secret | Purpose |
|--------|---------|
| `ADMIN_KEY` | Authentication for `/admin/*` endpoints |
| `RESEND_API_KEY` | Email delivery for daily reports |
| `REPORT_EMAIL` | Recipient address for daily reports |

### First-Time Setup

```bash
cd infrastructure/telemetry-worker
npm install

# Create R2 bucket
npx wrangler r2 bucket create pidlab-telemetry

# Set secrets
npx wrangler secret put ADMIN_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put REPORT_EMAIL

# Deploy
npx wrangler deploy

# Verify
curl https://telemetry.pidlab.app/health
```

## Stack

| Component | Service | Free Tier |
|-----------|---------|-----------|
| API endpoints | CF Workers | 100K req/day |
| Telemetry storage | CF R2 | 10 GB, 1M writes/month |
| License database | CF D1 (SQLite) | 5 GB, 5M reads/day |
| Email reports | Resend | 3K emails/month |
| Payments | Stripe | Pay-as-you-go |

**Estimated cost**: $0/month up to ~5,000 active users.

## Client-Side Integration

The Electron app's `TelemetryManager` (`src/main/telemetry/`) handles:
- Bundle assembly from local managers (profiles, tuning history, blackbox, snapshots)
- FC serial anonymization (SHA-256 salted with installation ID)
- gzip compression + `net.fetch` POST with retry (1s/2s/4s)
- Daily heartbeat on app start, post-session trigger, manual "Send Now"
- Upload endpoint: `TELEMETRY.UPLOAD_URL` in `src/shared/constants.ts`

Uploads silently fail until Workers are deployed (by design).

## Development

No infrastructure is required for local development. The app runs fully offline.
Demo mode (`npm run dev:demo`) skips all uploads.

### Local Worker Testing

```bash
cd infrastructure/telemetry-worker
npm install
npx wrangler dev
# Worker runs at http://localhost:8787
```
