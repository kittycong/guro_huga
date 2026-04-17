#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "[1/4] JavaScript syntax check"
node --check app.js

echo "[2/4] JSON validity checks"
python -m json.tool app-data.json >/dev/null
python -m json.tool data/app-data.json >/dev/null
python -m json.tool rules/labor/2026.json >/dev/null

echo "[3/4] ERP/birthday/labor rule UI IDs present"
rg -q 'id="view-erp"' index.html
rg -q 'data-action="save-birthday-rule"' index.html
rg -q 'data-action="run-birthday-grant"' index.html
rg -q 'data-action="load-labor-rule"' index.html
rg -q 'data-action="activate-labor-rule"' index.html

echo "[4/4] Event handlers wired in app.js"
rg -q 'saveBirthdayRule' app.js
rg -q 'runBirthdayHalfDayGrant' app.js
rg -q 'loadLaborRule' app.js
rg -q 'activateLaborRuleYear' app.js

echo "All smoke checks passed."
