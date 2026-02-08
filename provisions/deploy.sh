#!/bin/sh
# Deploy GenieACS provisions, virtual parameters, and presets via NBI API.
# Usage: deploy.sh [--nbi-url URL] [--vendors LIST] [--dry-run]
#
# Works both inside Docker (provision-deployer container) and locally.
# Default NBI_URL from env or http://localhost:7557

set -e

# --- Configuration ---
NBI_URL="${NBI_URL:-http://localhost:7557}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false
VENDORS="all"
MAX_RETRIES=30
RETRY_INTERVAL=2

# --- Parse arguments ---
while [ $# -gt 0 ]; do
  case "$1" in
    --nbi-url) NBI_URL="$2"; shift 2 ;;
    --vendors) VENDORS="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== GenieACS Provision Deployer ==="
echo "NBI URL: $NBI_URL"
echo "Vendors: $VENDORS"
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

# --- Helper: check if vendor is selected ---
vendor_selected() {
  local vendor="$1"
  if [ "$VENDORS" = "all" ]; then
    return 0
  fi
  echo "$VENDORS" | grep -qw "$vendor"
}

# --- Deploy Virtual Parameters ---
echo ""
echo "--- Virtual Parameters ---"
deploy_file "virtual_parameters" "wifi_ssid_2g" "virtual-parameters/wifi_ssid_2g.js"
deploy_file "virtual_parameters" "wifi_password_2g" "virtual-parameters/wifi_password_2g.js"
deploy_file "virtual_parameters" "wan_status" "virtual-parameters/wan_status.js"
deploy_file "virtual_parameters" "wan_ip" "virtual-parameters/wan_ip.js"
deploy_file "virtual_parameters" "wifi_ssid_5g" "virtual-parameters/wifi_ssid_5g.js"
deploy_file "virtual_parameters" "wifi_password_5g" "virtual-parameters/wifi_password_5g.js"
deploy_file "virtual_parameters" "wifi_ssid_6g" "virtual-parameters/wifi_ssid_6g.js"
deploy_file "virtual_parameters" "wifi_password_6g" "virtual-parameters/wifi_password_6g.js"
deploy_file "virtual_parameters" "optical_rx_power" "virtual-parameters/optical_rx_power.js"

# --- Deploy Universal Provisions ---
echo ""
echo "--- Universal Provisions ---"
deploy_file "provisions" "universal-auto-tag" "universal/universal-auto-tag.js"
deploy_file "provisions" "dynamic-wifi-config" "universal/dynamic-wifi-config.js"
deploy_file "provisions" "universal-wifi-config" "universal/universal-wifi-config.js"
deploy_file "provisions" "universal-optical-monitor" "universal/universal-optical-monitor.js"
deploy_file "provisions" "universal-firmware-log" "universal/universal-firmware-log.js"

# --- Deploy Huawei Provisions ---
if vendor_selected "huawei"; then
  echo ""
  echo "--- Huawei Provisions ---"
  deploy_file "provisions" "huawei-auto-tag" "huawei/huawei-auto-tag.js"
  # huawei-wifi-config: Replaced by dynamic-wifi-config (kept on disk for reference)
  deploy_file "provisions" "huawei-wan-pppoe" "huawei/huawei-wan-pppoe.js"
  deploy_file "provisions" "huawei-wan-dhcp" "huawei/huawei-wan-dhcp.js"
  deploy_file "provisions" "huawei-firmware-upgrade" "huawei/huawei-firmware-upgrade.js"
  deploy_file "provisions" "huawei-voip" "huawei/huawei-voip.js"
  deploy_file "provisions" "huawei-port-forward" "huawei/huawei-port-forward.js"
fi

# --- Deploy ZTE Provisions ---
if vendor_selected "zte"; then
  echo ""
  echo "--- ZTE Provisions ---"
  deploy_file "provisions" "zte-auto-tag" "zte/zte-auto-tag.js"
  # zte-wifi-config: Replaced by dynamic-wifi-config (kept on disk for reference)
  deploy_file "provisions" "zte-wan-pppoe" "zte/zte-wan-pppoe.js"
  deploy_file "provisions" "zte-wan-dhcp" "zte/zte-wan-dhcp.js"
  deploy_file "provisions" "zte-optical-monitor" "zte/zte-optical-monitor.js"
  deploy_file "provisions" "zte-voip" "zte/zte-voip.js"
  deploy_file "provisions" "zte-port-forward" "zte/zte-port-forward.js"
fi

# --- Deploy Nokia Provisions ---
if vendor_selected "nokia"; then
  echo ""
  echo "--- Nokia Provisions ---"
  deploy_file "provisions" "nokia-detect-model" "nokia/nokia-detect-model.js"
  deploy_file "provisions" "nokia-auto-tag" "nokia/nokia-auto-tag.js"
  # nokia-wifi-config: Replaced by dynamic-wifi-config (kept on disk for reference)
  deploy_file "provisions" "nokia-wan-pppoe" "nokia/nokia-wan-pppoe.js"
  deploy_file "provisions" "nokia-optical-monitor" "nokia/nokia-optical-monitor.js"
  deploy_file "provisions" "nokia-voip" "nokia/nokia-voip.js"
  deploy_file "provisions" "nokia-alu-migration" "nokia/nokia-alu-migration.js"
  deploy_file "provisions" "nokia-firmware-check" "nokia/nokia-firmware-check.js"
fi

# --- Deploy Presets ---
echo ""
echo "--- Presets ---"
deploy_file "presets" "universal-bootstrap" "presets/universal-bootstrap.json"
deploy_file "presets" "universal-firmware-log" "presets/universal-firmware-log.json"

# Universal WiFi preset (replaces vendor-specific huawei-wifi, zte-wifi, nokia-wifi-098, nokia-wifi-181)
deploy_file "presets" "wifi-default" "presets/wifi-default.json"

if vendor_selected "huawei"; then
  deploy_file "presets" "huawei-wan" "presets/huawei-wan.json"
  deploy_file "presets" "huawei-voip" "presets/huawei-voip.json"
fi

if vendor_selected "zte"; then
  deploy_file "presets" "zte-wan" "presets/zte-wan.json"
  deploy_file "presets" "zte-optical" "presets/zte-optical.json"
  deploy_file "presets" "zte-voip" "presets/zte-voip.json"
fi

if vendor_selected "nokia"; then
  deploy_file "presets" "nokia-bootstrap" "presets/nokia-bootstrap.json"
  deploy_file "presets" "nokia-wan-098" "presets/nokia-wan-098.json"
  deploy_file "presets" "nokia-wan-181" "presets/nokia-wan-181.json"
  deploy_file "presets" "nokia-optical" "presets/nokia-optical.json"
  deploy_file "presets" "nokia-voip" "presets/nokia-voip.json"
fi

# --- Summary ---
echo ""
echo "=== Deployment Summary ==="
echo "Deployed: $DEPLOYED"
echo "Failed:   $FAILED"
echo "Skipped:  $SKIPPED"

if [ $FAILED -gt 0 ]; then
  echo ""
  echo "WARNING: $FAILED deployments failed. Check NBI logs."
  exit 1
fi

echo ""
echo "Deployment complete."
