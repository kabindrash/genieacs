#!/bin/sh
# Deploy GenieACS provisions, virtual parameters, and presets via NBI API.
# Usage: deploy.sh [--nbi-url URL] [--dry-run]
#
# Universal policy-driven architecture v2.0
# All vendor logic handled by dynamic-* provisions with JSON policy args.
# Works both inside Docker (provision-deployer container) and locally.
# Default NBI_URL from env or http://localhost:7557

set -e

# --- Configuration ---
NBI_URL="${NBI_URL:-http://localhost:7557}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false
MAX_RETRIES=30
RETRY_INTERVAL=2

# --- Parse arguments ---
while [ $# -gt 0 ]; do
  case "$1" in
    --nbi-url) NBI_URL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== GenieACS Provision Deployer v2.0 ==="
echo "NBI URL: $NBI_URL"
echo "Dry run: $DRY_RUN"
echo ""

# --- Wait for NBI to be ready ---
echo "Waiting for NBI service..."
attempt=0
while [ $attempt -lt $MAX_RETRIES ]; do
  if curl -sf "${NBI_URL}/provisions/" > /dev/null 2>&1; then
    echo "NBI is ready."
    break
  fi
  attempt=$((attempt + 1))
  echo "  Attempt $attempt/$MAX_RETRIES - NBI not ready, retrying in ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

if [ $attempt -ge $MAX_RETRIES ]; then
  echo "ERROR: NBI did not become ready after $MAX_RETRIES attempts."
  exit 1
fi

# --- Counters ---
DEPLOYED=0
FAILED=0
SKIPPED=0

# --- Deploy a single file ---
deploy_file() {
  local type="$1"    # provisions, virtual_parameters, presets
  local name="$2"
  local file="$3"
  local filepath="${SCRIPT_DIR}/${file}"

  if [ ! -f "$filepath" ]; then
    echo "  SKIP $type/$name (file not found: $file)"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "  DRY-RUN $type/$name <- $file"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  local content_type=""
  if [ "$type" = "presets" ]; then
    content_type="-H Content-Type:application/json"
  fi

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    $content_type \
    --data-binary "@${filepath}" \
    "${NBI_URL}/${type}/${name}")

  if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
    echo "  OK   $type/$name"
    DEPLOYED=$((DEPLOYED + 1))
  else
    echo "  FAIL $type/$name (HTTP $http_code)"
    FAILED=$((FAILED + 1))
  fi
}

# --- Deploy Virtual Parameters (9 total) ---
echo ""
echo "--- Virtual Parameters ---"
deploy_file "virtual_parameters" "wifi_ssid_2g" "virtual-parameters/wifi_ssid_2g.js"
deploy_file "virtual_parameters" "wifi_password_2g" "virtual-parameters/wifi_password_2g.js"
deploy_file "virtual_parameters" "wifi_ssid_5g" "virtual-parameters/wifi_ssid_5g.js"
deploy_file "virtual_parameters" "wifi_password_5g" "virtual-parameters/wifi_password_5g.js"
deploy_file "virtual_parameters" "wifi_ssid_6g" "virtual-parameters/wifi_ssid_6g.js"
deploy_file "virtual_parameters" "wifi_password_6g" "virtual-parameters/wifi_password_6g.js"
deploy_file "virtual_parameters" "wan_status" "virtual-parameters/wan_status.js"
deploy_file "virtual_parameters" "wan_ip" "virtual-parameters/wan_ip.js"
deploy_file "virtual_parameters" "optical_rx_power" "virtual-parameters/optical_rx_power.js"

# --- Deploy Universal Provisions (7 total) ---
echo ""
echo "--- Universal Provisions ---"
deploy_file "provisions" "universal-auto-tag" "universal/universal-auto-tag.js"
deploy_file "provisions" "universal-firmware-log" "universal/universal-firmware-log.js"
deploy_file "provisions" "dynamic-wifi-config" "universal/dynamic-wifi-config.js"
deploy_file "provisions" "dynamic-wan-config" "universal/dynamic-wan-config.js"
deploy_file "provisions" "dynamic-voip-config" "universal/dynamic-voip-config.js"
deploy_file "provisions" "dynamic-optical-monitor" "universal/dynamic-optical-monitor.js"
deploy_file "provisions" "dynamic-port-forward" "universal/dynamic-port-forward.js"

# --- Deploy Vendor-Specific Provisions (3 total — firmware/migration only) ---
echo ""
echo "--- Vendor-Specific Provisions ---"
deploy_file "provisions" "nokia-alu-migration" "nokia/nokia-alu-migration.js"
deploy_file "provisions" "nokia-firmware-check" "nokia/nokia-firmware-check.js"
deploy_file "provisions" "huawei-firmware-upgrade" "huawei/huawei-firmware-upgrade.js"

# --- Deploy Presets (6 total) ---
echo ""
echo "--- Presets ---"
deploy_file "presets" "universal-bootstrap" "presets/universal-bootstrap.json"
deploy_file "presets" "universal-firmware-log" "presets/universal-firmware-log.json"
deploy_file "presets" "wifi-default" "presets/wifi-default.json"
deploy_file "presets" "wan-default" "presets/wan-default.json"
deploy_file "presets" "voip-default" "presets/voip-default.json"
deploy_file "presets" "optical-default" "presets/optical-default.json"

# --- Summary ---
echo ""
echo "=== Deployment Summary ==="
echo "Deployed: $DEPLOYED"
echo "Failed:   $FAILED"
echo "Skipped:  $SKIPPED"
echo ""
echo "Expected: 10 provisions, 9 VPs, 6 presets = 25 total"

if [ $FAILED -gt 0 ]; then
  echo ""
  echo "WARNING: $FAILED deployments failed. Check NBI logs."
  exit 1
fi

echo ""
echo "Deployment complete."
