#!/bin/sh
# Verify GenieACS provision deployment via NBI API.
# Usage: verify.sh [--nbi-url URL]
#
# Universal policy-driven architecture v2.0
# Expected: 10 provisions, 9 virtual parameters, 6 presets

set -e

NBI_URL="${NBI_URL:-http://localhost:7557}"

while [ $# -gt 0 ]; do
  case "$1" in
    --nbi-url) NBI_URL="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== GenieACS Provision Verification v2.0 ==="
echo "NBI URL: $NBI_URL"
echo ""

ERRORS=0

# --- Check provisions (10 total) ---
echo "--- Provisions (expected: 10) ---"
provisions=$(curl -sf "${NBI_URL}/provisions/" 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "ERROR: Cannot reach NBI at $NBI_URL"
  exit 1
fi

expected_provisions="universal-auto-tag universal-firmware-log dynamic-wifi-config dynamic-wan-config dynamic-voip-config dynamic-optical-monitor dynamic-port-forward nokia-alu-migration nokia-firmware-check huawei-firmware-upgrade"

for name in $expected_provisions; do
  if echo "$provisions" | grep -q "\"$name\""; then
    echo "  OK   $name"
  else
    echo "  MISS $name"
    ERRORS=$((ERRORS + 1))
  fi
done

# --- Check virtual parameters (9 total) ---
echo ""
echo "--- Virtual Parameters (expected: 9) ---"
vparams=$(curl -sf "${NBI_URL}/virtual_parameters/" 2>/dev/null)

expected_vparams="wifi_ssid_2g wifi_password_2g wifi_ssid_5g wifi_password_5g wifi_ssid_6g wifi_password_6g wan_status wan_ip optical_rx_power"

for name in $expected_vparams; do
  if echo "$vparams" | grep -q "\"$name\""; then
    echo "  OK   $name"
  else
    echo "  MISS $name"
    ERRORS=$((ERRORS + 1))
  fi
done

# --- Check presets (6 total) ---
echo ""
echo "--- Presets (expected: 6) ---"
presets=$(curl -sf "${NBI_URL}/presets/" 2>/dev/null)

expected_presets="universal-bootstrap universal-firmware-log wifi-default wan-default voip-default optical-default"

for name in $expected_presets; do
  if echo "$presets" | grep -q "\"$name\""; then
    echo "  OK   $name"
  else
    echo "  MISS $name"
    ERRORS=$((ERRORS + 1))
  fi
done

# --- Check for deprecated provisions still deployed ---
echo ""
echo "--- Deprecated Provision Check ---"
deprecated_provisions="huawei-wan-pppoe zte-wan-pppoe nokia-wan-pppoe huawei-wan-dhcp zte-wan-dhcp huawei-voip zte-voip nokia-voip huawei-port-forward zte-port-forward huawei-auto-tag zte-auto-tag nokia-auto-tag nokia-detect-model zte-optical-monitor nokia-optical-monitor universal-optical-monitor universal-wifi-config huawei-wifi-config zte-wifi-config nokia-wifi-config"

for name in $deprecated_provisions; do
  if echo "$provisions" | grep -q "\"$name\""; then
    echo "  WARN deprecated provision still deployed: $name"
  fi
done

# --- Summary ---
echo ""
echo "=== Verification Summary ==="
if [ $ERRORS -eq 0 ]; then
  echo "All 10 provisions, 9 virtual parameters, and 6 presets verified."
  exit 0
else
  echo "ERRORS: $ERRORS items missing. Run deploy.sh to fix."
  exit 1
fi
