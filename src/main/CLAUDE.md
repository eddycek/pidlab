# Main Process

Entry point: `src/main/index.ts`. Manages MSPClient, ProfileManager, SnapshotManager, BlackboxManager, TuningSessionManager, TelemetryManager, TelemetryEventCollector.

## Storage System

**Profile Storage** (`ProfileManager.ts`):
- Location: `{userData}/data/profiles/`
- One JSON file per profile: `{profileId}.json`
- Metadata index: `profiles.json` (list of all profiles)
- Current profile ID: `current-profile.txt`

**Snapshot Storage** (`SnapshotManager.ts`):
- Location: `{userData}/data/snapshots/`
- One JSON file per snapshot: `{snapshotId}.json`
- Contains: FC info, CLI diff, timestamp, label, type (baseline/manual/auto)
- Snapshots are linked to profiles via `snapshotIds` array

**Critical**: Snapshot filtering happens server-side (main process) based on current profile's `snapshotIds` array. This prevents snapshots from different profiles mixing in UI.

**Tuning History Storage** (`TuningHistoryManager.ts`):
- Location: `{userData}/data/tuning-history/{profileId}.json`
- Array of `CompletedTuningRecord[]` per profile (oldest-first on disk, newest-first in API)
- Archived from completed sessions with self-contained metrics + applied changes
- Deleted when profile is deleted
- Compact metrics: `FilterMetricsSummary` (noise floor, peaks, 128-bin spectrum, throttle spectrogram), `PIDMetricsSummary` (step response), `TransferFunctionMetricsSummary` (bandwidth, phase margin, dcGain, throttleBands)
- Spectrum downsampling: `downsampleSpectrum()`, `extractThrottleSpectrogram()` in `src/shared/utils/metricsExtract.ts`

**Telemetry Storage** (`TelemetryManager.ts` + `TelemetryEventCollector.ts`):
- Location: `{userData}/data/telemetry-settings.json` (settings), `{userData}/data/telemetry-events.json` (structured events)
- Opt-in only (disabled by default), anonymous UUID v4 installation ID
- Bundle assembly (v3): `TelemetryBundleV3` with per-session `TelemetrySessionRecord[]` including recommendation traces, verification deltas, and structured `TelemetryEvent[]`
- `TelemetryEventCollector`: ring-buffer (max 200 events), persisted to disk, cleared after successful upload
- Upload via Electron `net.fetch()` to CF Worker endpoint (gzipped JSON), skipped in demo mode

**Diagnostic Reports** (Pro only):
- `DiagnosticBundleBuilder.ts` builds gzipped bundles with recommendations, analysis data, FC config
- Optional BBL flight data upload (fire-and-forget, 50 MB max, 120s timeout)
- Endpoints: `POST /v1/diagnostic`, `PUT /v1/diagnostic/{id}/bbl`, `PATCH /v1/diagnostic/{reportId}`
- Auto-reports on apply verification failure (`sendAutoReport()` in `DiagnosticReportService.ts`)
- Rate-limited 1/hour per installation

**License Storage** (`LicenseManager.ts`):
- Location: `{userData}/license.json`
- Signed license object (Ed25519) for offline verification
- Free tier: 1 profile limit enforced in profileHandlers
- Demo mode + dev mode: auto-Pro

**Auto-Updater** (`src/main/updater.ts`):
- Uses `electron-updater` with GitHub Releases as provider
- Checks 10s after launch (packaged builds only, skip dev/demo)
- Silent background download, `autoInstallOnAppQuit = true`

## Auto-Apply Recommendations

**Apply Flow** (orchestrated in `TUNING_APPLY_RECOMMENDATIONS` IPC handler):
0. Pre-apply: `validateRecommendationBounds()` checks all filter/FF values against `BF_SETTING_RANGES` — rejects entire apply if any value is out of Betaflight-valid range
1. Stage 1: Apply PID changes via MSP (must happen before CLI mode). Saves `currentConfig` for rollback
2. Stage 2: Enter CLI mode
3. Stage 3: Apply filter changes via CLI `set` commands. On failure: attempts automatic PID rollback to `currentConfig` before surfacing error
4. Stage 4: Save to EEPROM and reboot FC

**Important**: Stage ordering matters — MSP commands must execute before CLI mode, because FC only processes CLI input while in CLI mode (MSP timeouts).

**Auto-Snapshot Strategy** (2 per tuning cycle):
- `Pre-tuning #N (Type)` — created by Start Tuning (rollback safety net)
- `Post-tuning #N (Type)` — created on reconnect after PID/Quick apply (final tuned result)

Snapshots carry tuning metadata (`tuningSessionNumber`, `tuningType`, `snapshotRole`) for contextual labels and smart Compare matching by session number.

## Snapshot Restore (Rollback)

**Restore Flow** (orchestrated in `SNAPSHOT_RESTORE` IPC handler):
1. Load snapshot and parse `cliDiff` — extract restorable CLI commands
2. Stage 1 (backup): Create "Pre-restore (auto)" safety snapshot
3. Stage 2 (cli): Enter CLI mode, send each command (resilient — continues on error, collects failures)
4. Stage 3 (save): Save and reboot FC

**Resilient restore**: If a CLI command fails (e.g., out-of-range value), the handler logs the failure, collects the command in `failedCommands[]`, and continues with remaining commands.

**Restorable commands**: `set`, `feature`, `serial`, `aux`, `beacon`, `map`, `resource`, `timer`, `dma`, `profile` (context switch), `rateprofile` (context switch) — everything except identity and control commands.

## SD Card Blackbox Support

- `BlackboxInfo.storageType`: `'flash' | 'sdcard' | 'none'` — detection is automatic
- SD card logs cannot be read via MSP — download uses MSC (Mass Storage Class) mode
- MSC workflow: `MSP_REBOOT(type=2)` → FC re-enumerates as USB drive → copy .bbl files → eject → FC reboots
- `MSCManager` (`src/main/msc/`) orchestrates the full MSC download/erase cycle
- MSC disconnect is expected — `mscModeActive` flag prevents profile clear on disconnect
- Design doc: `docs/SD_CARD_BLACKBOX_SUPPORT.md`

## Smart Reconnect Detection

- On reconnect with existing profile, checks if tuning session is in `*_flight_pending` phase
- If flash has data (`bbInfo.hasLogs && bbInfo.usedSize > 0`), auto-transitions to `*_log_ready`
- Implemented in `src/main/index.ts` after `createBaselineIfMissing()`

## Post-Apply Verification

On smart reconnect after apply, `verifyAppliedConfig()` (`src/main/utils/verifyAppliedConfig.ts`) reads back full PID and filter configuration from FC via MSP, compares ALL readable values (not just applied changes), and runs sanity checks (P/I/D=0, filter bypassed). Retries PID write+readback once on mismatch (10s timeout). Results stored on `TuningSession.applyVerified`, `applyMismatches`, `applyExpected`, `applyActual`, `applySuspicious`, and `autoReportId`. On failure, auto-submits diagnostic report (Pro only).
