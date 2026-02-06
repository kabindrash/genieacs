# GenieACS Provision Scripts

Multi-vendor ONT provision scripts for Huawei, ZTE, and Nokia device management.

## Quick Start

### With Docker

```bash
docker compose up -d
# The provision-deployer container automatically deploys all scripts
docker compose logs provision-deployer
```

### Without Docker

```bash
# Start GenieACS services, then deploy provisions
./provisions/deploy.sh --nbi-url http://localhost:7557

# Verify deployment
./provisions/verify.sh --nbi-url http://localhost:7557
```

## Directory Structure

```
provisions/
├── virtual-parameters/    # 5 cross-vendor abstraction scripts
├── universal/             # 4 vendor-agnostic provisions
├── huawei/                # 7 Huawei-specific provisions
├── zte/                   # 7 ZTE-specific provisions
├── nokia/                 # 8 Nokia/ALU-specific provisions
├── presets/               # 16 preset JSON files (routing logic)
├── manifest.json          # File index
├── deploy.sh              # Deployment script
└── verify.sh              # Post-deployment verification
```

## Customization

### WiFi Credentials

Edit the constants at the top of each WiFi provision:

```javascript
// ===== EDIT THESE VALUES =====
const SSID_24 = "MyNetwork";
const SSID_5 = "MyNetwork-5G";
const PASSWORD = "SecurePassword123";
// =============================
```

### WAN / PPPoE Settings

```javascript
const PPP_USER = "user@isp.com";
const PPP_PASS = "password";
const VLAN_ID = 100;
```

### VoIP Settings

```javascript
const SIP_SERVER = "sip.isp.com";
const SIP_PORT = 5060;
const SIP_USER = "1001";
const SIP_PASS = "sippassword";
```

## Preset Weights

| Weight | Purpose | Examples |
|--------|---------|---------|
| 0 | Bootstrap/Monitoring | auto-tag, firmware-log, optical monitors |
| 10 | Configuration | WiFi, WAN |
| 20 | Services | VoIP |

## Selective Deployment

Deploy only specific vendors:

```bash
./provisions/deploy.sh --vendors "huawei zte"
./provisions/deploy.sh --vendors "nokia"
```

Dry run (no changes):

```bash
./provisions/deploy.sh --dry-run
```

## Virtual Parameters

| Name | Type | Writable | Purpose |
|------|------|----------|---------|
| `wifi_ssid_2g` | string | Yes | 2.4GHz WiFi SSID |
| `wifi_password_2g` | string | Yes | 2.4GHz WiFi password |
| `wan_status` | string | No | WAN connection status |
| `wan_ip` | string | No | WAN IP address |
| `optical_rx_power` | string | No | GPON optical RX power |

## Vendor Details

See the vendor guides for parameter paths and quirks:

- `claudedocs/vendor-guides/HUAWEI-ONT-GUIDE.md`
- `claudedocs/vendor-guides/ZTE-ONT-GUIDE.md`
- `claudedocs/vendor-guides/NOKIA-ONT-GUIDE.md`
- `claudedocs/vendor-guides/CROSS-VENDOR-COMPARISON.md`
