# PIDlab Infrastructure

Cloud infrastructure for PIDlab backend services. All services run on **Cloudflare** (Workers, R2, D1).

## Services

| Service | Status | Description | Design Doc |
|---------|--------|-------------|------------|
| **Telemetry Worker** | Planned | Anonymous usage data collection (`POST /v1/collect`) | [docs/TELEMETRY_COLLECTION.md](../docs/TELEMETRY_COLLECTION.md) |
| **Telemetry Cron** | Planned | Daily aggregation + email report via Resend | [docs/TELEMETRY_COLLECTION.md](../docs/TELEMETRY_COLLECTION.md) |
| **License Worker** | Planned | Offline-first license key validation | [docs/LICENSE_KEY_SYSTEM.md](../docs/LICENSE_KEY_SYSTEM.md) |
| **Payment Worker** | Planned | Stripe checkout + invoice generation | [docs/PAYMENT_AND_INVOICING.md](../docs/PAYMENT_AND_INVOICING.md) |

## Directory Structure

```
infrastructure/
├── README.md              ← this file
├── telemetry-worker/      ← CF Worker: upload endpoint + admin stats (Task 3-4)
├── telemetry-cron/        ← CF Worker Cron: daily report (Task 5)
├── license-worker/        ← CF Worker: license validation + D1
├── payment-worker/        ← CF Worker: Stripe webhooks + checkout
└── scripts/               ← Admin CLI scripts (Task 6)
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

## Deployment

Workers will be deployed via Wrangler CLI. Each service has its own `wrangler.toml`.

```bash
cd infrastructure/telemetry-worker
npx wrangler deploy
```

## Development

No infrastructure is required for local development. The app runs fully offline.
Demo mode (`npm run dev:demo`) skips all uploads.
