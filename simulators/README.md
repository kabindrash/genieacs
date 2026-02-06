# GenieACS CPE Simulator

TR-069 CPE device simulators using [genieacs-sim](https://github.com/zaidka/genieacs-sim) for testing provision scripts without real hardware.

## What It Does

Simulates 9 CPE devices (3 per vendor) that connect to the GenieACS CWMP service and trigger the full provisioning pipeline:

| Vendor | Model | Data Model | Serial Offset | Vendor Extensions |
|--------|-------|------------|---------------|-------------------|
| Huawei | HG8245H | TR-098 | 1000 | X_HW_VLANMuxID, X_HW_VLAN_CoS |
| ZTE | ZXHN F660 | TR-098 | 2000 | X_ZTE-COM_VLANID, X_ZTE-COM_GponInterfaceConfig |
| Nokia | G-240W-A | TR-098 | 3000 | X_ALU_COM.OntOpticalParam |

Each CSV data model includes all parameters referenced by the deployed provision scripts: WiFi, WAN (PPPoE/DHCP), VoIP, port forwarding, optical monitoring, and vendor-specific extensions.

## Quick Start

```bash
# Ensure GenieACS stack is running
docker compose up -d

# Run all simulators
./simulators/run-all.sh
```

Or manually:

```bash
# Build and run via compose
docker compose -f docker-compose.simulator.yml build
docker compose -f docker-compose.simulator.yml up
```

## Run Individual Vendors

```bash
# Just Huawei devices
docker compose -f docker-compose.simulator.yml up sim-huawei

# Just ZTE devices
docker compose -f docker-compose.simulator.yml up sim-zte

# Just Nokia devices
docker compose -f docker-compose.simulator.yml up sim-nokia
```

## Adjust Device Count

Edit `docker-compose.simulator.yml` and change the `-p` flag:

```yaml
command: ["-u", "http://genieacs-cwmp:7547/", "-m", "/data-models/huawei-hg8245h.csv", "-p", "5", "-s", "1000"]
#                                                                                            ^^^
#                                                                                        devices per vendor
```

## Verification

After running simulators:

1. **GenieACS UI** (http://localhost:3001) - Devices tab should show 9 devices
2. **Faults tab** - Should be empty (provisions executed without errors)
3. **NBI API**:
   ```bash
   curl -s 'http://localhost:7557/devices/?query={"_tags":"huawei"}' | jq length  # 3
   curl -s 'http://localhost:7557/devices/?query={"_tags":"zte"}' | jq length     # 3
   curl -s 'http://localhost:7557/devices/?query={"_tags":"nokia"}' | jq length   # 3
   ```

## How It Works

genieacs-sim performs a single TR-069 session per device:

1. Sends CWMP Inform (with DeviceID from CSV)
2. GenieACS matches presets and runs provisions
3. Simulator responds to GetParameterValues/SetParameterValues RPCs
4. Session completes and simulator exits

It does **not** loop with periodic Inform. Re-run to trigger another session.

## Data Model Files

Each CSV follows the genieacs-sim format:

```
Parameter,Object,Writable,Value,Value type
```

- `Object=true` for container nodes (paths that have children)
- `Object=false` for leaf parameters
- `Writable=true` if the ACS can set the value
- Value types: `xsd:string`, `xsd:boolean`, `xsd:int`, `xsd:unsignedInt`, `xsd:dateTime`

### Vendor-Specific Differences

| Feature | Huawei | ZTE | Nokia |
|---------|--------|-----|-------|
| WiFi password path | PreSharedKey.1.KeyPassphrase | KeyPassphrase | PreSharedKey.1.KeyPassphrase |
| VLAN extension | X_HW_VLANMuxID | X_ZTE-COM_VLANID | N/A |
| Optical monitoring | Not exposed | X_ZTE-COM_GponInterfaceConfig | X_ALU_COM.OntOpticalParam |
| 5GHz WLAN instance | 5 | 5 | 5 |
