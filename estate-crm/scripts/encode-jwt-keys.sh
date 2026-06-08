#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────────────────────────
# Encode JWT PEM keys to base64 for Dokploy deployment.
# Paste the output as single-line values.
# ─────────────────────────────────────────────────────────────

PRIVATE_KEY_FILE="${PRIVATE_KEY_FILE:-./private.pem}"
PUBLIC_KEY_FILE="${PUBLIC_KEY_FILE:-./public.pem}"

echo ""
echo "=========================================="
echo "JWT_PRIVATE_KEY_B64  (paste in Dokploy):"
echo "=========================================="
base64 -w 0 "$PRIVATE_KEY_FILE"
echo ""
echo ""
echo "=========================================="
echo "JWT_PUBLIC_KEY_B64   (paste in Dokploy):"
echo "=========================================="
base64 -w 0 "$PUBLIC_KEY_FILE"
echo ""
echo ""
