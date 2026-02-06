#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== GenieACS CPE Simulator Launcher ==="
echo ""

# Check if GenieACS stack is running
if ! docker compose ps --status running genieacs-cwmp 2>/dev/null | grep -q genieacs-cwmp; then
  echo "GenieACS stack is not running. Starting it first..."
  docker compose up -d
  echo "Waiting 10s for GenieACS to initialize..."
  sleep 10
fi

echo "GenieACS stack is running."
echo ""

# Build simulator image
echo "Building simulator image..."
docker compose -f docker-compose.simulator.yml build

# Start all vendor simulators
echo ""
echo "Starting 9 simulated CPE devices (3 per vendor)..."
echo "  - Huawei HG8245H  (serial offset 1000)"
echo "  - ZTE F660         (serial offset 2000)"
echo "  - Nokia G-240W-A   (serial offset 3000)"
echo ""

docker compose -f docker-compose.simulator.yml up --force-recreate

echo ""
echo "=== Simulator sessions complete ==="
echo ""
echo "Verify in GenieACS UI: http://localhost:3001"
echo "  - Devices tab: should show 9 devices"
echo "  - Faults tab: should be empty"
echo ""
echo "Verify via NBI API:"
echo "  curl -s 'http://localhost:7557/devices/?query={\"_tags\":\"huawei\"}' | jq length"
echo "  curl -s 'http://localhost:7557/devices/?query={\"_tags\":\"zte\"}' | jq length"
echo "  curl -s 'http://localhost:7557/devices/?query={\"_tags\":\"nokia\"}' | jq length"
