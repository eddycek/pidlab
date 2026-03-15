#!/bin/bash
# Usage: ./generate-key.sh <email> [type] [note]
# Requires: PIDLAB_LICENSE_API_URL, PIDLAB_ADMIN_KEY env vars
set -euo pipefail

EMAIL="$1"
TYPE="${2:-paid}"
NOTE="${3:-}"

API_URL="${PIDLAB_LICENSE_API_URL:?Set PIDLAB_LICENSE_API_URL}"
ADMIN_KEY="${PIDLAB_ADMIN_KEY:?Set PIDLAB_ADMIN_KEY}"

curl -s -X POST \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"type\":\"$TYPE\",\"note\":\"$NOTE\"}" \
  "$API_URL/admin/keys/generate" | jq .
