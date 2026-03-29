---
name: diagnose
description: >
  Investigates user-submitted diagnostic reports. Downloads the report bundle,
  cross-references recommendations against analysis code and constants,
  identifies root cause, and proposes fix + user reply. Use when reviewing
  a diagnostic report from a user who reported bad tuning results.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# Diagnostic Report Investigator

Investigate a user-submitted diagnostic report and propose a fix.

## Argument Parsing

Parse `$ARGUMENTS` for **environment** and **reportId**. Arguments can appear in any order.

- **Environment**: `dev` or `prod` — defaults to **`prod`**
- **Report ID**: UUID format (required)

Examples:
- `/diagnose abc12345-...` → prod, report abc12345-...
- `/diagnose dev abc12345-...` → dev, report abc12345-...

## Investigation Flow

### Step 1: Fetch report

```bash
export PIDLAB_ENV=<env>
source infrastructure/scripts/_env.sh
curl -sf -H "X-Admin-Key: $PIDLAB_TELEMETRY_ADMIN_KEY" \
  "$PIDLAB_TELEMETRY_API_URL/admin/diagnostics/<reportId>" \
  | jq . > /tmp/diagnostic-report.json
```

Mark as reviewing:
```bash
curl -sf -X PATCH -H "X-Admin-Key: $PIDLAB_TELEMETRY_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"reviewing"}' \
  "$PIDLAB_TELEMETRY_API_URL/admin/diagnostics/<reportId>"
```

Check if BBL flight data is available:
```bash
# Check metadata.hasBbl in the fetched report
HAS_BBL=$(jq -r '.metadata.hasBbl // false' /tmp/diagnostic-report.json)
if [ "$HAS_BBL" = "true" ]; then
  echo "BBL available ($(jq -r '.metadata.bblSizeBytes' /tmp/diagnostic-report.json) bytes)"
  curl -sf -H "X-Admin-Key: $PIDLAB_TELEMETRY_ADMIN_KEY" \
    "$PIDLAB_TELEMETRY_API_URL/admin/diagnostics/<reportId>/bbl" \
    -o /tmp/diagnostic-flight.bbl
  echo "Downloaded to /tmp/diagnostic-flight.bbl"
fi
```

### Step 2: Read the report

Read `/tmp/diagnostic-report.json` and extract:
- `metadata.preview` — mode, droneSize, bfVersion, dataQualityTier, recCount, userNote
- `bundle.recommendations[]` — each with ruleId, setting, currentValue, recommendedValue, confidence, explanation
- `bundle.filterAnalysis` / `bundle.pidAnalysis` / `bundle.transferFunction` — what the analysis engine saw
- `bundle.dataQuality` — overall score, tier, warnings
- `bundle.cliDiffBefore` / `bundle.cliDiffAfter` — FC settings before/after tuning
- `bundle.verification` — if verification flight was done, the improvement metrics
- `bundle.events[]` — telemetry events from this session (errors, phase changes)

### Step 3: Understand context

- **Drone size** → look up `QUAD_SIZE_BOUNDS` in `src/main/analysis/constants.ts` to check if bounds are appropriate
- **BF version** → check `docs/BF_VERSION_POLICY.md` for compatibility notes
- **Data quality** → if tier is "fair" or "poor", recommendations may be unreliable
- **Flight style** → check if style-specific thresholds apply (e.g., `BANDWIDTH_LOW_HZ_BY_STYLE`)

### Step 3b: Parse BBL data (if available)

When BBL flight data was downloaded in Step 1, use it for deeper investigation:

1. **Parse the BBL** using the app's parser for offline analysis:
   - Run `npx vitest run src/main/blackbox/BlackboxParser.test.ts` to verify parser health
   - The BBL file can be imported into Betaflight Blackbox Explorer for visual inspection
   - Check gyro noise floor, motor traces, setpoint tracking quality

2. **Cross-reference with analysis results**:
   - Compare raw gyro spectrum against the `bundle.filterAnalysis.spectrum`
   - Verify peak detection against actual BBL data
   - Check if step response metrics match what the raw setpoint/gyro data shows

3. **When BBL is NOT available** but needed:
   - Set report status to `needs-bbl` — this notifies the user to re-submit with "Include flight data" checked
   - The user will see the needs-bbl status and can re-submit from the same tuning session

### Step 4: Analyze each recommendation

For each recommendation in `bundle.recommendations[]`:

1. **Find the rule in source code**:
   - Filter rules (F-*): `src/main/analysis/FilterRecommender.ts`
   - PID rules (P-*): `src/main/analysis/PIDRecommender.ts`
   - TF rules (TF-*): `src/main/analysis/TransferFunctionEstimator.ts`
   - Constants: `src/main/analysis/constants.ts`

2. **Check triggering conditions** against the analysis data:
   - For filter rules: does noise floor / peak data actually warrant this change?
   - For PID rules: do overshoot / rise time metrics justify the recommendation?
   - For TF rules: do bandwidth / phase margin values support the recommendation?

3. **Check thresholds** in constants.ts:
   - Are they appropriate for the reported drone size?
   - Are safety bounds reasonable for this configuration?

4. **Check edge cases**:
   - Very small quads (1"-3") have different noise profiles
   - High-KV setups may have electrical noise
   - RPM filter status affects filter recommendations
   - D-min / TPA active affects PID recommendations

### Step 5: Check FC configuration

Parse `bundle.cliDiffBefore`:
- RPM filter active? (`rpm_filter_harmonics`)
- Dynamic notch settings? (`dyn_notch_count`, `dyn_notch_q`)
- D-min active? (`d_min_roll`, etc.)
- TPA active? (`tpa_rate`, `tpa_breakpoint`)
- Are current settings already reasonable for this quad?

### Step 6: Check telemetry events

Look at `bundle.events[]` for:
- `error.analysis_failed` — analysis code crashed?
- `error.apply_failed` — changes couldn't be applied?
- `workflow.phase_changed` — did user skip phases?
- `error.msp_disconnect` — FC disconnected during tuning?

### Step 7: Identify root cause

Classify into one of:
- **Rule too aggressive**: threshold/step size needs adjustment in constants.ts
- **Rule too conservative**: not catching a real problem
- **Wrong rule fired**: conditions matched incorrectly
- **Data quality issue**: bad flight data led to unreliable analysis
- **Parser issue**: BBL data may have been misinterpreted (suggest requesting BBL via needs-bbl status)
- **Edge case**: drone config outside tested parameters (suggest adding to QUAD_SIZE_BOUNDS)
- **User error**: settings were already optimal, user expected different result
- **FC config conflict**: e.g., RPM filter disabled but recommendations assume it's on

### Step 8: Generate report

Output this format:

```markdown
## Diagnostic Report: <reportId>

### Context
- Mode: <mode> | Drone: <size> | BF: <version>
- Data Quality: <tier> (<score>/100)
- User note: "<note>"

### Findings
<numbered list of issues found, with specific code references>

### Root Cause
<classification> — <detailed explanation>

### Proposed Fix
<specific code change with file:line references>
OR "No code change needed — <explanation>"

### Suggested User Reply
<draft message for the user, if email was provided>
<leave blank if no email>

### Recommended Resolution
<fixed | user-error | known-limitation | wontfix | needs-bbl>
```

### Step 9: Offer to resolve

Ask the user if they want to:
1. Apply the proposed fix (if code change needed)
2. Resolve the report with the suggested resolution
3. Request BBL data (set status to needs-bbl)
4. Add an internal note

If the user confirms resolution, run:
```bash
export PIDLAB_ENV=<env>
source infrastructure/scripts/_env.sh
curl -sf -X PATCH -H "X-Admin-Key: $PIDLAB_TELEMETRY_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved","resolution":"<resolution>","resolutionMessage":"<message>"}' \
  "$PIDLAB_TELEMETRY_API_URL/admin/diagnostics/<reportId>"
```

## Important Notes

- NEVER expose user email addresses in output — refer to "user" generically
- Always check data quality tier first — poor data → unreliable recommendations
- Reference specific lines in analysis code when suggesting fixes
- If the issue requires BBL file for reproduction, set status to `needs-bbl` instead of guessing
- When BBL is available (`metadata.hasBbl: true`), always download and inspect it — raw data is the ground truth
- BBL files have 30-day retention — if `metadata.bblExpiredAt` is set, the file has been cleaned up
- Be honest about confidence level — if you're unsure, say so
