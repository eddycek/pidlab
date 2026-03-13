#!/bin/bash
# Quick telemetry summary
# Usage: PIDLAB_ADMIN_KEY=xxx ./scripts/telemetry-stats.sh [base-url]

set -euo pipefail

API="${1:-https://telemetry.pidlab.app}"
KEY="${PIDLAB_ADMIN_KEY:?Set PIDLAB_ADMIN_KEY environment variable}"

echo "=== PIDlab Telemetry Stats ==="
curl -sf -H "X-Admin-Key: $KEY" "$API/admin/stats" | jq .
