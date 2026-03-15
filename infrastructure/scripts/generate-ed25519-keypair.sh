#!/bin/bash
# Generate Ed25519 keypair for license signing.
# Output: base64-encoded PKCS8 private key and SPKI public key
# Store as CF Worker secrets: ED25519_PRIVATE_KEY, ED25519_PUBLIC_KEY

set -euo pipefail

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Generate private key (PKCS8 DER)
openssl genpkey -algorithm Ed25519 -outform DER -out "$TMPDIR/private.der"

# Extract public key (SPKI DER)
openssl pkey -in "$TMPDIR/private.der" -inform DER -pubout -outform DER -out "$TMPDIR/public.der"

# Base64 encode
PRIVATE_B64=$(base64 < "$TMPDIR/private.der" | tr -d '\n')
PUBLIC_B64=$(base64 < "$TMPDIR/public.der" | tr -d '\n')

echo "=== Ed25519 Keypair ==="
echo ""
echo "ED25519_PRIVATE_KEY (store as CF secret, NEVER commit):"
echo "$PRIVATE_B64"
echo ""
echo "ED25519_PUBLIC_KEY (store as CF secret AND bundle in Electron app):"
echo "$PUBLIC_B64"
echo ""
echo "To set as CF Worker secrets:"
echo "  echo '$PRIVATE_B64' | wrangler secret put ED25519_PRIVATE_KEY"
echo "  echo '$PUBLIC_B64' | wrangler secret put ED25519_PUBLIC_KEY"
