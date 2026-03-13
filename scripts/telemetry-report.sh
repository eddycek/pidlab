#!/bin/bash
# Full telemetry report with all breakdowns
# Usage: PIDLAB_ADMIN_KEY=xxx ./scripts/telemetry-report.sh [base-url]

set -euo pipefail

API="${1:-https://telemetry.pidlab.app}"
KEY="${PIDLAB_ADMIN_KEY:?Set PIDLAB_ADMIN_KEY environment variable}"

echo "=== Summary ==="
curl -sf -H "X-Admin-Key: $KEY" "$API/admin/stats" | jq .

echo ""
echo "=== BF Versions ==="
curl -sf -H "X-Admin-Key: $KEY" "$API/admin/stats/versions" | jq .

echo ""
echo "=== Drone Sizes ==="
curl -sf -H "X-Admin-Key: $KEY" "$API/admin/stats/drones" | jq .

echo ""
echo "=== Quality Scores ==="
curl -sf -H "X-Admin-Key: $KEY" "$API/admin/stats/quality" | jq .
