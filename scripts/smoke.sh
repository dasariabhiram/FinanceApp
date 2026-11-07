#!/usr/bin/env bash
set -euo pipefail
API_URL="${API_URL:-http://localhost:3001}"
curl -fsS "${API_URL}/health/integrations" | grep -q '"success":true'
echo "smoke: integrations ok"
