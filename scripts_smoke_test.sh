#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "[1/5] Merge conflict marker check"
if rg -n '^(<<<<<<<|=======|>>>>>>>)' app.js index.html styles.css README.md >/dev/null; then
  echo "Conflict markers detected. Please resolve before deployment."
  exit 1
fi

echo "[2/5] JavaScript syntax check"
node --check app.js

echo "[3/5] JSON validity checks"
python -m json.tool app-data.json >/dev/null
python -m json.tool data/app-data.json >/dev/null
python -m json.tool rules/labor/2026.json >/dev/null

echo "[4/5] ERP/birthday/labor rule UI IDs present"
rg -q 'id="view-erp"' index.html
rg -q 'data-action="save-birthday-rule"' index.html
rg -q 'data-action="run-birthday-grant"' index.html
rg -q 'data-action="load-labor-rule"' index.html
rg -q 'data-action="activate-labor-rule"' index.html

echo "[5/5] Event handlers wired in app.js"
rg -q 'saveBirthdayRule' app.js
rg -q 'runBirthdayHalfDayGrant' app.js
rg -q 'loadLaborRule' app.js
rg -q 'activateLaborRuleYear' app.js

echo "All smoke checks passed."
