#!/bin/sh
# Verify GenieACS provision deployment via NBI API.
# Usage: verify.sh [--nbi-url URL]

set -e

NBI_URL="${NBI_URL:-http://localhost:7557}"

while [ $# -gt 0 ]; do
  case "$1" in
    --nbi-url) NBI_URL="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== GenieACS Provision Verification ==="
echo "NBI URL: $NBI_URL"
echo ""

ERRORS=0

# --- Check provisions ---
echo "--- Provisions ---"
provisions=$(curl -sf "${NBI_URL}/provisions/" 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "ERROR: Cannot reach NBI at $NBI_URL"
  exit 1
fi

expected_provisions="universal-auto-tag universal-wifi-config universal-optical-monitor universal-firmware-log huawei-auto-tag huawei-wifi-config huawei-wan-pppoe huawei-wan-dhcp huawei-firmware-upgrade huawei-voip huawei-port-forward zte-auto-tag zte-wifi-config zte-wan-pppoe zte-wan-dhcp zte-optical-monitor zte-voip zte-port-forward nokia-detect-model nokia-auto-tag nokia-wifi-config nokia-wan-pppoe nokia-optical-monitor nokia-voip nokia-alu-migration nokia-firmware-check"

for name in $expected_provisions; do
  if echo "$provisions" | grep -q "\"$name\""; then
    echo "  OK   $name"
  else
    echo "  MISS $name"
    ERRORS=$((ERRORS + 1))
  fi
done

# --- Check virtual parameters ---
echo ""
echo "--- Virtual Parameters ---"
vparams=$(curl -sf "${NBI_URL}/virtual_parameters/" 2>/dev/null)

expected_vparams="wifi_ssid_2g wifi_password_2g wan_status wan_ip optical_rx_power"

for name in $expected_vparams; do
  if echo "$vparams" | grep -q "\"$name\""; then
    echo "  OK   $name"
  else
    echo "  MISS $name"
    ERRORS=$((ERRORS + 1))
  fi
done

# --- Check presets ---
echo ""
echo "--- Presets ---"
presets=$(curl -sf "${NBI_URL}/presets/" 2>/dev/null)

expected_presets="universal-bootstrap universal-firmware-log huawei-wifi huawei-wan huawei-voip zte-wifi zte-wan zte-optical zte-voip nokia-bootstrap nokia-wifi-098 nokia-wifi-181 nokia-wan-098 nokia-wan-181 nokia-optical nokia-voip"

for name in $expected_presets; do
  if echo "$presets" | grep -q "\"$name\""; then
    echo "  OK   $name"
  else
    echo "  MISS $name"
    ERRORS=$((ERRORS + 1))
  fi
done

# --- Summary ---
echo ""
echo "=== Verification Summary ==="
if [ $ERRORS -eq 0 ]; then
  echo "All provisions, virtual parameters, and presets verified."
  exit 0
else
  echo "ERRORS: $ERRORS items missing. Run deploy.sh to fix."
  exit 1
fi
