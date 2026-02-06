# GenieACS ZTE ONT Management Guide

## Overview

ZTE ZXHN-series ONTs are among the most widely deployed FTTH (Fiber to the Home) terminals globally. These devices use the **TR-098** data model with `InternetGatewayDevice` as the root object. ZTE extends the standard TR-069 data model with vendor-specific parameters under the `X_ZTE-COM_` prefix, though some firmware versions use the `X_ZTE_COM_` variant (underscore instead of hyphen).

**Data Model**: TR-098 (`InternetGatewayDevice` root path)

**Vendor Extension Prefix**: `X_ZTE-COM_` (primary), `X_ZTE_COM_` (legacy firmware)

**Common OUI Values**: `ZTEG`, `000000` (varies by ISP firmware and region)

**Key Differentiator**: ZTE uses `KeyPassphrase` directly on the `WLANConfiguration` object rather than `PreSharedKey.1.KeyPassphrase`, which is the path most other vendors implement. This is the single most important detail when writing cross-vendor provisions.

**Related Documentation**:
- `claudedocs/specs/CWMP-SPEC.md` - TR-069 protocol handling
- `claudedocs/specs/PROVISIONING-SPEC.md` - Provision script API (`declare()`, `commit()`, `ext()`)
- `claudedocs/specs/NBI-API-SPEC.md` - REST API for device management
- `claudedocs/vendor-guides/CROSS-VENDOR-COMPARISON.md` - Multi-vendor parameter mapping

---

## Supported Models

The following ZTE ZXHN models have been validated with GenieACS TR-069 management. Capabilities vary by firmware version and ISP customization.

| Model | Type | WiFi | PON Standard | Ports | Notes |
|-------|------|------|--------------|-------|-------|
| ZXHN F601 | Bridge | None | GPON | 1 GE | Basic bridge ONT, no routing capability |
| ZXHN F609 | Router | 2.4GHz | GPON | 4 FE, 2 FXS | Early generation router model |
| ZXHN F612W | Router | 2.4GHz | GPON | 1 GE, 1 FE | Budget WiFi router ONT |
| ZXHN F620 | Router | 2.4GHz | GPON | 4 GE, 2 FXS | Mid-range single-band |
| ZXHN F650 | Router | 2.4GHz | EPON | 4 FE, 2 FXS | EPON variant for non-GPON networks |
| ZXHN F660 | Router | 2.4GHz | GPON | 4 GE, 2 FXS, 1 USB | Popular router ONT |
| ZXHN F663N | Router | 2.4/5GHz | GPON | 4 GE, 1 FXS | Dual-band mid-range |
| ZXHN F663NV9 | Router | 2.4/5GHz AC | GPON | 4 GE, 1 FXS | V9 hardware revision with AC WiFi |
| ZXHN F668 | Router | 2.4/5GHz | GPON | 4 GE, 2 FXS | Dual-band router |
| ZXHN F670 | Router | 2.4/5GHz | GPON | 4 GE, 2 FXS | Predecessor to F670L |
| ZXHN F670L | Router | 2.4/5GHz AC | GPON | 4 GE, 2 FXS | AC WiFi, widely deployed worldwide |
| ZXHN F680 | Router | 2.4/5GHz AC | GPON | 4 GE, 2 FXS, 1 USB | Premium model with USB storage |
| ZXHN F6600 | Router | WiFi 6 | GPON/XG-PON | 4 GE, 1 2.5G, 2 FXS | Next-gen WiFi 6 ONT |
| ZXHN F8648P | Router | WiFi 6 | XGS-PON | 4 GE, 1 10G | High-end XGS-PON model |

### Model Selection Notes

- **Bridge ONTs** (F601): Minimal TR-069 parameter tree. No WiFi, WAN routing, or VoIP parameters.
- **Single-band routers** (F609, F612W, F620, F660): One WLAN instance. Simpler provisioning.
- **Dual-band routers** (F663N, F668, F670, F670L, F680): Two WLAN radios with separate instance numbering.
- **WiFi 6 models** (F6600, F8648P): Support `ax` standard. May expose additional vendor extensions.
- **EPON models** (F650): EPON-specific parameters replace GPON optical monitoring paths.

---

## TR-069 Parameter Paths

### Device Information

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `InternetGatewayDevice.DeviceInfo.Manufacturer` | string | No | Returns "ZTE" |
| `InternetGatewayDevice.DeviceInfo.ManufacturerOUI` | string | No | Varies by model and ISP firmware |
| `InternetGatewayDevice.DeviceInfo.ModelName` | string | No | Model identifier (e.g., "ZXHN F670L") |
| `InternetGatewayDevice.DeviceInfo.SerialNumber` | string | No | Device serial number |
| `InternetGatewayDevice.DeviceInfo.HardwareVersion` | string | No | Hardware revision string |
| `InternetGatewayDevice.DeviceInfo.SoftwareVersion` | string | No | Current firmware version |
| `InternetGatewayDevice.DeviceInfo.UpTime` | uint | No | Seconds since last boot |
| `InternetGatewayDevice.DeviceInfo.ProvisioningCode` | string | Yes | ISP provisioning code |

### WiFi Configuration

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.Enable` | boolean | Yes | Enable or disable radio |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.SSID` | string | Yes | Network name |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.Channel` | uint | Yes | WiFi channel (0 for auto) |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.BeaconType` | string | Yes | "None", "WPA", "11i", "WPAand11i" |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.WPAEncryptionModes` | string | Yes | "AESEncryption" |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.WPAAuthenticationMode` | string | Yes | "PSKAuthentication" |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.KeyPassphrase` | string | Yes | WiFi password (ZTE-specific path) |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.SSIDAdvertisementEnabled` | boolean | Yes | Broadcast SSID visibility |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.Standard` | string | Yes | "b", "g", "n", "ac", "ax" |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.X_ZTE-COM_BandWidth` | string | Yes | Channel bandwidth |

**WLAN Instance Numbering**: On dual-band ZTE models, instance 1 corresponds to the 2.4GHz radio, and instance 5 corresponds to the 5GHz radio. Guest network SSIDs typically use instances 2-4 (on 2.4GHz) and 6-8 (on 5GHz).

**WiFi Password Path**: ZTE uses `KeyPassphrase` directly on the `WLANConfiguration` object. This differs from vendors like Huawei and Nokia, which place it at `PreSharedKey.1.KeyPassphrase`. Some ZTE firmware versions accept both paths, but `KeyPassphrase` is the reliable choice.

### WAN Configuration

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.{i}.WANIPConnection.{j}.Enable` | boolean | Yes | Enable IP connection |
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.{i}.WANIPConnection.{j}.ExternalIPAddress` | string | No | Assigned IP address |
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.{i}.WANIPConnection.{j}.ConnectionType` | string | Yes | "IP_Routed" |
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.Username` | string | Yes | PPPoE username |
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.Password` | string | Yes | PPPoE password |
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.ExternalIPAddress` | string | No | PPP assigned IP |
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.ConnectionStatus` | string | No | Connection state |
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.{i}.X_ZTE-COM_VLANID` | uint | Yes | VLAN ID (vendor extension) |

### GPON Optical Monitoring

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.TxPower` | string | No | Optical TX power (dBm) |
| `InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.RxPower` | string | No | Optical RX power (dBm) |
| `InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.Temperature` | string | No | SFP module temperature |
| `InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.Voltage` | string | No | SFP module voltage |
| `InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.BiasCurrent` | string | No | Laser bias current |

**Note**: Optical monitoring values are returned as strings. Use `parseFloat()` to convert them for threshold comparison in provision scripts.

### LAN Configuration

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.DHCPServerEnable` | boolean | Yes | Enable DHCP server |
| `InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.MinAddress` | string | Yes | DHCP range start |
| `InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.MaxAddress` | string | Yes | DHCP range end |
| `InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.SubnetMask` | string | Yes | LAN subnet mask |
| `InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress` | string | Yes | LAN gateway IP address |

### ZTE Vendor Extensions (X_ZTE-COM_)

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `InternetGatewayDevice.X_ZTE-COM_RemoteManage.HTTPEnable` | boolean | Yes | Remote HTTP access |
| `InternetGatewayDevice.X_ZTE-COM_RemoteManage.HTTPPort` | uint | Yes | Remote HTTP port |
| `InternetGatewayDevice.X_ZTE-COM_RemoteManage.TelnetEnable` | boolean | Yes | Remote Telnet access |
| `InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.*` | varies | No | GPON optical statistics |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.X_ZTE-COM_BandWidth` | string | Yes | Channel bandwidth setting |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.{i}.X_ZTE-COM_MaxAssociatedDevices` | uint | Yes | Maximum WiFi clients per SSID |
| `InternetGatewayDevice.X_ZTE-COM_TTNET.*` | varies | varies | ISP-specific extensions (Turkish Telecom) |

### VoIP Configuration

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServer` | string | Yes | SIP proxy server address |
| `InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServerPort` | uint | Yes | SIP proxy port |
| `InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.SIP.RegistrarServer` | string | Yes | SIP registrar address |
| `InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.AuthUserName` | string | Yes | SIP authentication username |
| `InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.AuthPassword` | string | Yes | SIP authentication password |
| `InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.URI` | string | Yes | SIP URI (phone number) |
| `InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.Line.{i}.Enable` | string | Yes | "Enabled" or "Disabled" |

---

## Provision Scripts

All provision scripts use the GenieACS `declare()` API. For full API documentation, see `claudedocs/specs/PROVISIONING-SPEC.md`.

### WiFi Configuration

```javascript
// Provision: zte-wifi-config
// Configure WiFi SSID and password on ZTE ONTs
// Note: ZTE uses KeyPassphrase directly, not PreSharedKey.1.KeyPassphrase

const now = Date.now();

// 2.4GHz radio (instance 1)
const wlan24 = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1";
declare(wlan24 + ".Enable", {value: now}, {value: true});
declare(wlan24 + ".SSID", {value: now}, {value: "MyNetwork"});
declare(wlan24 + ".BeaconType", {value: now}, {value: "11i"});
declare(wlan24 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
declare(wlan24 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
declare(wlan24 + ".KeyPassphrase", {value: now}, {value: "SecurePassword123"});

// 5GHz radio (instance 5 on dual-band models)
const wlan5 = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5";
declare(wlan5 + ".Enable", {value: now}, {value: true});
declare(wlan5 + ".SSID", {value: now}, {value: "MyNetwork-5G"});
declare(wlan5 + ".BeaconType", {value: now}, {value: "11i"});
declare(wlan5 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
declare(wlan5 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
declare(wlan5 + ".KeyPassphrase", {value: now}, {value: "SecurePassword123"});
```

### WAN PPPoE Configuration

```javascript
// Provision: zte-wan-pppoe
// Configure PPPoE WAN connection on ZTE ONTs

const now = Date.now();
const pppUser = "user@isp.com";
const pppPass = "password";
const vlanId = 100;

const connPath = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1";
declare(connPath + ".WANPPPConnection.1.Enable", {value: now}, {value: true});
declare(connPath + ".WANPPPConnection.1.Username", {value: now}, {value: pppUser});
declare(connPath + ".WANPPPConnection.1.Password", {value: now}, {value: pppPass});
declare(connPath + ".WANPPPConnection.1.ConnectionType", {value: now}, {value: "IP_Routed"});

// Set VLAN (ZTE vendor extension)
declare(connPath + ".X_ZTE-COM_VLANID", {value: now}, {value: vlanId});
```

### WAN DHCP Configuration

```javascript
// Provision: zte-wan-dhcp
// Configure DHCP WAN connection

const now = Date.now();
const connPath = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1";

declare(connPath + ".WANIPConnection.1.Enable", {value: now}, {value: true});
declare(connPath + ".WANIPConnection.1.ConnectionType", {value: now}, {value: "IP_Routed"});
declare(connPath + ".WANIPConnection.1.AddressingType", {value: now}, {value: "DHCP"});
```

### GPON Optical Power Monitoring

```javascript
// Provision: zte-optical-monitor
// Monitor optical power levels on ZTE GPON ONTs

const now = Date.now();
const gponBase = "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig";

let rxPower = declare(gponBase + ".RxPower", {value: now});
let txPower = declare(gponBase + ".TxPower", {value: now});
let temperature = declare(gponBase + ".Temperature", {value: now});

if (rxPower.size && rxPower.value[0]) {
  let rx = parseFloat(rxPower.value[0]);
  log("ZTE GPON RX Power: " + rx + " dBm");

  if (rx < -28) {
    declare("Tags.optical_critical", null, {value: true});
    log("CRITICAL: Low optical RX power");
  } else if (rx < -25) {
    declare("Tags.optical_warning", null, {value: true});
    declare("Tags.optical_critical", null, {value: false});
  } else {
    declare("Tags.optical_warning", null, {value: false});
    declare("Tags.optical_critical", null, {value: false});
  }
}

if (temperature.size && temperature.value[0]) {
  log("ZTE GPON Temperature: " + temperature.value[0] + " C");
}
```

### VoIP Configuration

```javascript
// Provision: zte-voip
// Configure SIP VoIP on ZTE ONTs

const now = Date.now();
const sipServer = "sip.isp.com";
const sipPort = 5060;
const sipUser = "1001";
const sipPass = "sippassword";

const voipBase = "InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1";

declare(voipBase + ".SIP.ProxyServer", {value: now}, {value: sipServer});
declare(voipBase + ".SIP.ProxyServerPort", {value: now}, {value: sipPort});
declare(voipBase + ".SIP.RegistrarServer", {value: now}, {value: sipServer});
declare(voipBase + ".SIP.RegistrarServerPort", {value: now}, {value: sipPort});

declare(voipBase + ".Line.1.Enable", {value: now}, {value: "Enabled"});
declare(voipBase + ".Line.1.SIP.AuthUserName", {value: now}, {value: sipUser});
declare(voipBase + ".Line.1.SIP.AuthPassword", {value: now}, {value: sipPass});
declare(voipBase + ".Line.1.SIP.URI", {value: now}, {value: sipUser});
```

### Port Forwarding

```javascript
// Provision: zte-port-forward
// Add a port forwarding rule on ZTE ONTs

const now = Date.now();
const natBase = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.PortMapping";

let rules = declare(natBase + ".*", {path: now});
let nextIdx = rules.size + 1;

let rulePath = natBase + "." + nextIdx;
declare(rulePath + ".PortMappingEnabled", {value: now}, {value: true});
declare(rulePath + ".PortMappingProtocol", {value: now}, {value: "TCP"});
declare(rulePath + ".ExternalPort", {value: now}, {value: 8080});
declare(rulePath + ".InternalPort", {value: now}, {value: 80});
declare(rulePath + ".InternalClient", {value: now}, {value: "192.168.1.100"});
declare(rulePath + ".PortMappingDescription", {value: now}, {value: "Web Server"});
```

---

## Vendor-Specific Quirks and Workarounds

### Vendor Prefix Inconsistency

ZTE uses two distinct vendor prefix formats across different firmware versions:

- **`X_ZTE-COM_`** (with hyphen) -- the most common format on current firmware
- **`X_ZTE_COM_`** (with underscore) -- found on older firmware versions

Always discover the actual prefix by refreshing the device tree before writing provisions that depend on vendor extensions. When writing provisions that must support both variants, use a fallback pattern:

```javascript
const now = Date.now();
// Try hyphen version first (most common)
let gpon = declare("InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.RxPower", {value: now});
if (!gpon.size) {
  // Fallback to underscore version (older firmware)
  gpon = declare("InternetGatewayDevice.WANDevice.1.X_ZTE_COM_GponInterfaceConfig.RxPower", {value: now});
}
```

### WiFi Password Path Difference

This is the most common source of cross-vendor provisioning failures:

| Vendor | WiFi Password Path |
|--------|--------------------|
| ZTE | `WLANConfiguration.{i}.KeyPassphrase` |
| Huawei | `WLANConfiguration.{i}.PreSharedKey.1.KeyPassphrase` |
| Nokia | `WLANConfiguration.{i}.PreSharedKey.1.KeyPassphrase` |

When writing multi-vendor provisions, detect the manufacturer and branch accordingly. Some ZTE firmware versions also support the `PreSharedKey` path for backward compatibility, but `KeyPassphrase` directly on the `WLANConfiguration` object is the reliable choice.

### WLAN Instance Numbering

On dual-band ZTE models, the WLAN instance numbering follows a specific pattern:

| Instance | Band | Typical Use |
|----------|------|-------------|
| 1 | 2.4GHz | Primary SSID |
| 2 | 2.4GHz | Guest SSID 1 |
| 3 | 2.4GHz | Guest SSID 2 |
| 4 | 2.4GHz | Guest SSID 3 |
| 5 | 5GHz | Primary SSID |
| 6 | 5GHz | Guest SSID 1 |
| 7 | 5GHz | Guest SSID 2 |
| 8 | 5GHz | Guest SSID 3 |

Verify instances with a wildcard discovery before configuring:

```javascript
let wlans = declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.*", {path: Date.now()});
log("WLAN instances found: " + wlans.size);
```

### Reboot Requirements

Some ZTE parameter changes require a device reboot to take effect. The following table summarizes common behaviors:

| Change Type | Reboot Required | Notes |
|-------------|-----------------|-------|
| VLAN ID changes | Yes | Almost always needs reboot |
| WAN connection type | Yes | PPPoE to DHCP or vice versa |
| WiFi SSID / password | No | Applies immediately on most models |
| WiFi channel | No | May cause brief disconnection |
| LAN IP / DHCP range | Sometimes | Model-dependent |
| VoIP configuration | Sometimes | Registration may update without reboot |
| Remote management | Yes | HTTP/Telnet enable/disable |

Issue a reboot task via the NBI API after critical changes:

```bash
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"reboot"}'
```

### GPON Optical Monitoring Notes

- ZTE exposes GPON optical parameters under the `X_ZTE-COM_GponInterfaceConfig` subtree
- All values are returned as **strings**, not numbers. Always use `parseFloat()` for comparisons
- **RX power below -28 dBm** indicates critical signal degradation and likely service impact
- **RX power between -25 and -28 dBm** is a warning zone warranting investigation
- Temperature values help detect overheating SFP modules in enclosed installations
- Bridge models (F601) may not expose GPON statistics via TR-069 on all firmware versions

### ISP-Specific Extensions

Some ISPs deploy ZTE ONTs with customized firmware that adds proprietary parameter subtrees:

- **`X_ZTE-COM_TTNET`**: Turkish Telecom (Turk Telekom) specific extensions
- Other ISP-specific subtrees may exist under `X_ZTE-COM_` depending on region

These parameters may not exist on generic or retail firmware. ISP-customized firmware may also restrict write access to certain standard parameters, causing fault code 9001 (Request denied) on set operations.

### Connection Request Reliability

- ZTE ONTs generally respond well to connection requests from GenieACS
- When deployed behind NAT, connection requests may fail; use periodic inform as a fallback
- Some ZTE ONTs require explicit `ManagementServer.ConnectionRequestAuthentication` configuration
- Set periodic inform interval to 300-600 seconds as a safety net for missed connection requests

---

## Troubleshooting

### ONT Not Appearing in GenieACS

1. Verify the ACS URL configured on the ONT (web GUI is typically at `192.168.1.1`)
2. Confirm network connectivity to the GenieACS CWMP port (default 7547)
3. Check firewall rules between the ONT and the GenieACS server
4. Determine whether the ONT has an ISP-locked ACS URL (may require factory reset to change)
5. Monitor CWMP service logs for incoming connections:

```bash
journalctl -u genieacs-cwmp -f
```

### Parameter Does Not Exist Errors

- **Check vendor prefix**: Try both `X_ZTE-COM_` (hyphen) and `X_ZTE_COM_` (underscore)
- **Verify model support**: Not all parameters exist on every model and firmware version
- **Refresh the object tree**: Use `refreshObject` to discover the current data model on the device
- **Bridge model limitations**: The F601 and similar bridge ONTs have a very limited parameter tree with no WiFi, VoIP, or routing parameters

### WiFi Password Not Setting

- Use `KeyPassphrase` directly on `WLANConfiguration`, **not** `PreSharedKey.1.KeyPassphrase`
- Set `BeaconType` and encryption modes **before** setting the passphrase in the provision
- Minimum password length is typically 8 characters; shorter values cause fault code 9007
- Verify the WLAN instance number matches the intended radio band (1 for 2.4GHz, 5 for 5GHz)

### VLAN Configuration Issues

- `X_ZTE-COM_VLANID` changes typically require a reboot to take effect
- Verify the `WANConnectionDevice` instance number is correct for the target WAN interface
- The VLAN ID must match the VLAN configuration on the OLT side
- Some ISP firmware locks VLAN settings and returns fault code 9001 on write attempts

### Firmware Upgrade Failures

1. Verify the firmware file has been uploaded to the GenieACS file server (port 7567)
2. Match the `oui` and `productClass` headers with the target device identifiers
3. Confirm the file server is accessible from the ONT network
4. ZTE firmware filenames are typically model-specific (e.g., `F670L_V9.0.10P2N2.bin`)
5. Wait for `7 TRANSFER COMPLETE` inform event before issuing a reboot

### Optical Power Reading Issues

- If optical parameters return empty values, the vendor prefix may be incorrect for this firmware
- Some bridge models do not expose GPON statistics via TR-069
- Ensure the `X_ZTE-COM_GponInterfaceConfig` object has been refreshed recently
- Values returned as empty strings indicate the SFP module does not support diagnostics

### Common TR-069 Fault Codes

| Fault Code | Meaning | ZTE-Specific Resolution |
|------------|---------|------------------------|
| 9001 | Request denied | Parameter may be ISP-locked on this firmware |
| 9002 | Internal error | Reboot the ONT; persistent errors may need factory reset |
| 9003 | Invalid arguments | Check parameter types match expected schema |
| 9005 | Invalid parameter name | Check vendor prefix variant (hyphen vs underscore) |
| 9006 | Invalid parameter type | ZTE expects specific types; verify xsd type in SPV |
| 9007 | Invalid parameter value | Value out of range or invalid format (e.g., short password) |
| 9008 | Set non-writable param | Parameter is read-only on this firmware version |

---

## NBI API Quick Reference

All examples use the GenieACS NBI REST API on the default port 7557. Replace `<id>` with the full device identifier (e.g., `ZTEG-F670L-ZTEGXXXXXXXX`).

```bash
# Find all ZTE devices
curl -s 'http://localhost:7557/devices/?query={"DeviceID.Manufacturer._value":{"$regex":"ZTE"}}'

# Reboot device
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"reboot"}'

# Factory reset
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"factoryReset"}'

# Refresh full data model
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"refreshObject","objectName":""}'

# Set WiFi SSID via NBI
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"setParameterValues","parameterValues":[["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID","NewSSID","xsd:string"]]}'

# Upload firmware file
curl -X PUT 'http://localhost:7557/files/F670L_V9.0.10P2N2.bin' \
  --data-binary @F670L_V9.0.10P2N2.bin \
  --header "fileType: 1 Firmware Upgrade Image" \
  --header "oui: ZTEG" \
  --header "productClass: F670L"

# Tag a device
curl -X POST 'http://localhost:7557/devices/<id>/tags/zte_f670l'

# Delete a fault
curl -X DELETE 'http://localhost:7557/faults/<id>:default'
```

---

## Best Practices

### Auto-Tagging on Bootstrap

Use a bootstrap provision to automatically tag ZTE devices by manufacturer and model for easier preset targeting:

```javascript
// Provision: zte-auto-tag
const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let productClass = declare("DeviceID.ProductClass", {value: now});

if (manufacturer.value[0].indexOf("ZTE") >= 0) {
  declare("Tags.zte", null, {value: true});
  let model = productClass.value[0];
  if (model) {
    declare("Tags." + model.replace(/[^a-zA-Z0-9]/g, "_"), null, {value: true});
  }

  // Detect vendor prefix variant for downstream provisions
  let gpon = declare("InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.*", {path: now});
  if (gpon.size) {
    declare("Tags.zte_hyphen_prefix", null, {value: true});
  }
}
```

### Preset Organization

Organize presets with clear preconditions and event-based triggers for manageable ZTE ONT fleets:

- **Manufacturer filter**: Use precondition `DeviceID.Manufacturer LIKE "%ZTE%"` for all ZTE presets
- **Model-specific presets**: Add `DeviceID.ProductClass = "F670L"` for model-targeted configurations
- **Separate by function**: Create distinct presets for WiFi, WAN, optical monitoring, and VoIP
- **Bootstrap event** (`0 BOOTSTRAP`): Use for initial configuration (auto-tagging, default WiFi)
- **Periodic event** (`2 PERIODIC`): Use for monitoring provisions (optical power, uptime checks)
- **Value change event** (`4 VALUE CHANGE`): Use for drift detection and configuration enforcement

### Performance Tips

- **Declare only what you need**: Avoid refreshing the entire device tree. Target specific parameter paths
- **Cached vs fresh reads**: Use `{value: 1}` for cached parameter reads and `{value: Date.now()}` when a fresh value from the device is required
- **Periodic inform interval**: Set to 300-600 seconds. Shorter intervals increase load; longer intervals delay fault detection
- **Batch parameter changes**: Group related `declare()` calls in a single provision to minimize session round-trips
- **ZTE TR-069 performance**: ZTE ONTs generally handle TR-069 sessions efficiently. Most models complete a full session (inform through commit) within 5-15 seconds

### Optical Power Monitoring Strategy

For ISPs managing large ZTE GPON deployments, implement a tiered monitoring approach:

| Tag | RX Power Range | Action |
|-----|----------------|--------|
| `optical_ok` | Above -25 dBm | Normal operation, no action |
| `optical_warning` | -25 to -28 dBm | Schedule field inspection |
| `optical_critical` | Below -28 dBm | Immediate attention required |

Trigger the `zte-optical-monitor` provision on the `2 PERIODIC` event with a precondition matching ZTE GPON models. Exclude bridge models and EPON variants that do not expose GPON optical statistics.
