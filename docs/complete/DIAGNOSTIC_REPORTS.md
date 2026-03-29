# Diagnostic Reports

> **Status**: Complete (PRs #310–#338)

## Problem

When users get bad tuning recommendations, we have no way to investigate what went wrong. Telemetry gives aggregate metrics but not the specific analysis results, recommendations, or FC configuration that led to the problem.

## Solution

One-click "Report Issue" button that bundles diagnostic data from the tuning session and uploads it for investigation. Available only to users with a valid license key (Pro or Tester). Optionally includes raw BBL flight data for deeper analysis.

## Architecture

```
User clicks "Report Issue"
  → DiagnosticBundleBuilder assembles data
  → IPC handler uploads JSON bundle to Worker
  → If "Include flight data" checked → uploads BBL via PUT to Worker → R2
  → Worker stores in R2, sends email notification
  → Developer investigates via /diagnose skill (downloads BBL if available)
  → Resolves report → user gets email (if provided)
  → Cron cleans up BBL files after 30 days
```

### R2 Layout

```
diagnostics/{reportId}/
  ├─ metadata.json    (status, preview, timestamps, hasBbl, bblSizeBytes)
  ├─ bundle.json      (full diagnostic data, ~100 KB)
  └─ flight.bbl       (optional — raw BBL flight log, up to 50 MB, 30-day retention)
```

### Bundle Contents (~100 KB)

- Session context (mode, drone size, BF version, flight style)
- Analysis results (noise floors, peaks, spectrum, step response metrics)
- Full recommendation list with ruleId, confidence, explanation
- FC configuration (CLI diff before/after)
- Data quality score and warnings
- Verification results (if available)
- Related telemetry events
- User's email (optional) and note (optional)

### Worker Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/diagnostic` | Submit report (rate limit: 5/hr/install) |
| PATCH | `/v1/diagnostic/{id}` | Merge user details into existing auto-report (auth: X-Installation-Id) |
| PUT | `/v1/diagnostic/{id}/bbl` | Upload BBL flight data (auth: X-Installation-Id) |
| GET | `/admin/diagnostics` | List reports (?status=new) |
| GET | `/admin/diagnostics/{id}` | Full bundle + metadata |
| GET | `/admin/diagnostics/{id}/bbl` | Download BBL file (admin auth) |
| PATCH | `/admin/diagnostics/{id}` | Update status + send reply email |
| GET | `/admin/diagnostics/summary` | Counts for daily report |

### BBL Upload Flow

1. User checks "Include flight data" checkbox in ReportIssueModal
2. IPC handler submits the JSON bundle first (POST)
3. On success, reads the BBL file from disk (verification log preferred, then analysis log)
4. Uploads BBL via PUT to `/v1/diagnostic/{reportId}/bbl` with streaming body
5. Worker validates: report exists, `X-Installation-Id` matches creator, size ≤ 50 MB
6. Worker streams request body directly to R2 (no buffering)
7. Metadata updated with `hasBbl: true`, `bblSizeBytes`, `bblUploadedAt`
8. BBL upload failure is non-blocking — report still succeeds, `bblUploaded: false` returned

**Size limits**: 50 MB max (configurable via `BBL_MAX_SIZE_BYTES` env var). Upload timeout: 2 minutes (client-side AbortController).

**Security**: Only the report creator (matched by `X-Installation-Id`) can upload BBL. Admin download requires `X-Admin-Key` header.

**Idempotent**: If BBL already uploaded for a report, returns OK without re-uploading.

### BBL Retention (30-Day Cron)

Daily cron job (`cleanupExpiredBBLFiles`) runs alongside the telemetry report:
1. Scans all diagnostic reports with `hasBbl: true`
2. If `bblUploadedAt` is older than 30 days, deletes `flight.bbl` from R2
3. Updates metadata: `hasBbl: false`, `bblExpiredAt: <timestamp>`
4. Metadata and bundle JSON are preserved indefinitely

### Email Notifications

- **New report**: Sent to developer via Resend (subject, mode, preview, user note)
- **Resolution**: Sent to user (if email provided) with resolution message

### License Gating

Report button visible only when `licenseManager.isPro()` returns true:
- Pro license (paid) — yes
- Tester license — yes
- Free (no key) — no
- Demo/dev mode — yes (for testing)

### Auto-Report on Apply Verification Failure

When `verifyAppliedConfig()` detects mismatches after applying tuning changes, an auto-diagnostic report is submitted (Pro license required, skipped in demo mode).

**Flow:**
```
Apply recommendations → FC reboots → reconnect → verifyAppliedConfig()
  → Reads full PID + filter config via MSP (not just applied changes)
  → Compares ALL readable values against expected state
  → Runs sanity checks (P/I/D=0, filter bypassed)
  → On PID mismatch: retries write+readback once via MSP
  → If mismatches remain:
    → sendAutoReport() in DiagnosticReportService.ts
    → POST bundle with autoReported: true, applyVerification: {expected, actual, mismatches, suspicious}
    → autoReportId stored on TuningSession
    → If user later clicks "Report Issue", PATCH merges email/note into existing auto-report
```

**PATCH merge flow:** When a session already has `autoReportId`, the UI calls `DIAGNOSTIC_PATCH_REPORT` IPC instead of creating a new report. The worker's `PATCH /v1/diagnostic/{reportId}` endpoint merges `userEmail` and `userNote` into the existing report metadata (auth: X-Installation-Id must match the original creator).

**Auto-report bundle contents:**
- `autoReported: true` flag
- `autoReportReason: 'apply_mismatch'`
- `applyVerification: { expected, actual, mismatches, suspicious }` — full config maps
- Session recommendations (from `recommendationTraces`)
- Profile context (drone size, flight style, BF version, board target)
- CLI diff before tuning (from baseline snapshot)

### `/diagnose` Skill

Claude Code skill that fetches a diagnostic report, cross-references recommendations against analysis code (FilterRecommender, PIDRecommender, constants), identifies root cause, and proposes a fix + user reply. When BBL is available (`metadata.hasBbl: true`), downloads it for deeper analysis. Can set status to `needs-bbl` to request flight data from user.

## Implementation Details

### Phase 1: Core (PRs #310–#325)

1. **Types + bundle builder + tests** — `DiagnosticBundle`, `DiagnosticReportInput`, `DiagnosticReportResult` in `src/shared/types/diagnostic.types.ts`. `DiagnosticBundleBuilder` in `src/main/diagnostic/`
2. **IPC handler + upload + preload bridge** — `diagnosticHandlers.ts` registers `DIAGNOSTIC_SEND_REPORT`, builds bundle, uploads via `net.fetch()`, optional BBL upload with AbortController timeout
3. **Worker endpoints + Resend notifications** — 7 endpoints in `infrastructure/telemetry-worker/src/diagnostic.ts`. Rate limiting (configurable, default 5/hr). R2 storage with metadata/bundle/BBL separation
4. **UI** — `ReportIssueButton` (Pro gate via `useLicense`), `ReportIssueModal` (email, note, flight data checkbox, dynamic privacy note). Integrated in `TuningCompletionSummary` and `TuningSessionDetail`

### Phase 2: Tooling (PRs #326–#330)

5. **Admin scripts** — `infrastructure/scripts/diagnostic-{list,review,resolve,note}.sh`
6. **`/diagnose` skill** — `.claude/skills/diagnose/SKILL.md` with BBL download + cross-reference flow
7. **Daily cron integration** — Diagnostic summary in daily Resend email

### Phase 3: BBL Upload (PR #338)

7. **Worker streaming upload** — `PUT /v1/diagnostic/{id}/bbl` streams request body to R2 via `R2Bucket.put()` (no buffering). Admin download via `GET /admin/diagnostics/{id}/bbl`. Metadata fields: `hasBbl`, `bblSizeBytes`, `bblUploadedAt`, `bblExpiredAt`
8. **UI toggle** — "Include flight data (BBL log)" checkbox in `ReportIssueModal`, checked by default. Dynamic privacy note shows "Raw flight recording (BBL file)" when checked. `hasFlightData` prop propagated from `TuningSessionDetail` and `TuningCompletionSummary` based on record log IDs
9. **30-day retention cron** — `cleanupExpiredBBLFiles()` in `cron.ts`, runs daily. Deletes expired `flight.bbl` objects, preserves metadata/bundle. Logs cleanup count
10. **IPC handler BBL logic** — `getLogIdForRecord()` selects verification log > analysis log. `uploadBBL()` reads file, checks size (50 MB max), uploads with `X-Installation-Id` header and 2-minute timeout. Failure is non-blocking
11. **`/diagnose` skill BBL support** — Step 1 checks `metadata.hasBbl`, downloads BBL. Step 3b guides through BBL parsing and cross-referencing
