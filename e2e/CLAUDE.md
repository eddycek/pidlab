# Playwright E2E Tests

E2E tests launch the real Electron app in demo mode via Playwright's `_electron.launch()`.

## Commands

```bash
npm run test:e2e              # Build + run E2E tests (37 total across 7 specs)
npm run test:e2e:ui           # Build + Playwright UI
npm run demo:generate-history            # Build + generate 5 mixed sessions
npm run demo:generate-history 20         # Build + generate 20 mixed sessions
npm run demo:generate-history:filter     # Build + generate 5 filter tune sessions
npm run demo:generate-history:pid        # Build + generate 5 pid tune sessions
npm run demo:generate-history:flash      # Build + generate 5 flash tune sessions
```

## Architecture

- `electron-app.ts` — Shared fixture: `launchDemoApp()`, isolated `.e2e-userdata/` dir, screenshot helpers
- `E2E_USER_DATA_DIR` env var → `app.setPath('userData', ...)` in `src/main/index.ts` for test isolation
- Clean state: `.e2e-userdata/` is wiped before each test file
- `test:e2e` uses `--grep-invert 'generate \d+'` to exclude slow generators
- 7 spec files: smoke (4), Filter Tune cycle (7), PID Tune cycle (7), Flash Tune cycle (7), diagnostic report (7), history generator (4), stress test (1)
- `vitest.config.ts` excludes `e2e/` to prevent Vitest from picking up Playwright specs
- `advancePastVerification()` in MockMSPClient keeps flight type cycling correct when verification is skipped

## Common Pitfalls

- Strict mode violations: multiple matching elements → use `exact: true` or `.last()`
- Text case sensitivity: use regex like `/Tuning Complete/i`
- Toast dismiss button conflicts with other buttons
