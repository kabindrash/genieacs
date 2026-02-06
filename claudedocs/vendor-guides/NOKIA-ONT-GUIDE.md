# GenieACS Nokia ONT Management Guide

## Overview

This guide covers the management of Nokia and legacy Alcatel-Lucent (ALU) Optical Network Terminals (ONTs) using GenieACS. Nokia ONTs are unique among vendor devices because they may implement either the TR-098 data model (`InternetGatewayDevice` root) or the TR-181 data model (`Device` root), depending on the hardware model and firmware version. This dual data model support makes Nokia the most complex vendor to provision in a mixed fleet.

**Common OUI**: `ALCL` (persists on all Nokia ONTs, including Nokia-branded firmware, due to the Alcatel-Lucent acquisition)

**Data Model**: TR-098 (`InternetGatewayDevice`) on older models OR TR-181 (`Device`) on newer models -- never both simultaneously

**Vendor Extension Prefixes**: `X_ALU_COM_` (Alcatel-Lucent legacy, most common across all models) and `X_NOKIA_COM_` (newer firmware only, not universally available)

Nokia acquired Alcatel-Lucent in January 2016. The ALU Fixed Networks division became Nokia Fixed Networks. Legacy ALU I-series ONTs remain widely deployed alongside the current Nokia G-series. GenieACS supports both data models through its unified `declare()` API, and provision scripts can detect and handle either model at runtime.

**Related Documentation**:
- [PROVISIONING-SPEC.md](../specs/PROVISIONING-SPEC.md) - Provision script API (`declare()`, `commit()`, `ext()`)
- [NBI-API-SPEC.md](../specs/NBI-API-SPEC.md) - REST API for device management
- [SESSION-SPEC.md](../specs/SESSION-SPEC.md) - Session lifecycle and state management
- [03-PROVISIONING-SYSTEM.md](../workflow/03-PROVISIONING-SYSTEM.md) - Provisioning workflow overview

## Supported Models

The following Nokia and Alcatel-Lucent ONT models have been tested with GenieACS. Models not listed here may also work provided they support TR-069/CWMP. The critical difference from other vendors is that the data model varies by model.

### Nokia G-Series (Current)

| Model | Type | WiFi | PON | Ports | Data Model | Notes |
|-------|------|------|-----|-------|------------|-------|
| G-240W-A | Router | 2.4GHz | GPON | 4 GE, 2 FXS | TR-098 | Most common Nokia ONT |
| G-240W-B | Router | 2.4GHz | GPON | 4 GE, 2 FXS | TR-098 | Hardware variant of G-240W-A |
| G-240W-C | Router | 2.4/5GHz | GPON | 4 GE, 2 FXS | TR-098 | Dual-band |
| G-240W-F | Router | 2.4/5GHz AC | GPON | 4 GE, 2 FXS | TR-098 | 802.11ac WiFi |
| G-240G-A | Bridge | None | GPON | 4 GE | TR-098 | SFU bridge mode only |
| G-240G-E | Bridge | None | GPON | 4 GE | TR-098 | Enhanced bridge variant |
| G-2425G-A | Router | 2.4/5GHz AC | GPON | 4 GE, 1 2.5G, 2 FXS | TR-181 | Premium model with 2.5G port |
| G-2426G-A | Router | WiFi 6 | XGS-PON | 4 GE, 1 2.5G | TR-181 | Next-generation XGS-PON |
| G-010G-A | Bridge | None | GPON | 1 GE | TR-098 | Basic single-port SFU |
| XS-250WX-A | Router | WiFi 6 | XGS-PON | 4 GE, 1 10G | TR-181 | XGS-PON with WiFi 6 |
| XS-2426X-A | Router | WiFi 6E | XGS-PON | 4 GE, 1 10G | TR-181 | WiFi 6E premium tier |

### Alcatel-Lucent Legacy (I-Series)

| ALU Model | Nokia Equivalent | Status | Data Model |
|-----------|-----------------|--------|------------|
| I-240W-A | G-240W-A | Replaced | TR-098 |
| I-240W-Q | G-240W-Q | Replaced | TR-098 |
| I-240G-A | G-240G-A | Replaced | TR-098 |
| I-010G | G-010G-A | Replaced | TR-098 |
| I-220 | (discontinued) | End of life | TR-098 |

### Data Model Summary

**TR-098 models** (root: `InternetGatewayDevice`): G-240W-A, G-240W-B, G-240W-C, G-240W-F, G-240G-A, G-240G-E, G-010G-A, all I-series legacy models.

**TR-181 models** (root: `Device`): G-2425G-A, G-2426G-A, XS-250WX-A, XS-2426X-A.

**IMPORTANT**: Some models can switch data model through a firmware update. Never hardcode data model assumptions for a specific model. Always detect the active data model at runtime.

## Data Model Detection

Nokia ONTs can use either TR-098 or TR-181, and this can change with a firmware update. Every provision script that references the device parameter tree MUST detect which data model is active. Hardcoding either `InternetGatewayDevice` or `Device` without detection will cause failures on devices running the other model.

The following provision script performs runtime data model detection and applies tags for use in preset preconditions.

```javascript
// Provision: nokia-detect-model
// Detect whether Nokia ONT uses TR-098 or TR-181 data model.
// Apply as a bootstrap provision (0 BOOTSTRAP) for all Nokia devices.

const now = Date.now();

// Try TR-181 first (Device root)
let tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});
let tr098 = declare("InternetGatewayDevice.DeviceInfo.Manufacturer", {value: now});

let root = "";
if (tr181.size) {
  root = "Device";
  declare("Tags.tr181", null, {value: true});
  declare("Tags.tr098", null, {value: false});
} else if (tr098.size) {
  root = "InternetGatewayDevice";
  declare("Tags.tr098", null, {value: true});
  declare("Tags.tr181", null, {value: false});
}

log("Nokia data model root: " + root);
```

**How it works**: The `declare()` function returns an object with a `size` property indicating how many parameters matched. If `Device.DeviceInfo.Manufacturer` returns a result, the device uses TR-181. If `InternetGatewayDevice.DeviceInfo.Manufacturer` returns a result, it uses TR-098. The provision applies tags (`tr098` or `tr181`) that can be used as preset preconditions to route the device to data model-specific provisions.

**Recommendation**: Run this provision on every `0 BOOTSTRAP` event. Use the resulting tags to create separate presets for TR-098 and TR-181 devices, or use the detection pattern inline within each provision script.

## TR-069 Parameter Paths

This section documents the key TR-069 parameter paths available on Nokia ONTs. Because Nokia devices may use either data model, both TR-098 and TR-181 paths are provided side by side where they differ. Instance placeholders `{i}` and `{j}` indicate object instances that may vary by device configuration.

**Note**: `*` stands for `InternetGatewayDevice` (TR-098) or `Device` (TR-181) throughout this section for readability.

### Device Information

| Feature | TR-098 Path | TR-181 Path | Type | Writable |
|---------|-------------|-------------|------|----------|
| Manufacturer | `InternetGatewayDevice.DeviceInfo.Manufacturer` | `Device.DeviceInfo.Manufacturer` | string | No |
| OUI | `InternetGatewayDevice.DeviceInfo.ManufacturerOUI` | `Device.DeviceInfo.ManufacturerOUI` | string | No |
| Model | `InternetGatewayDevice.DeviceInfo.ModelName` | `Device.DeviceInfo.ModelName` | string | No |
| Serial | `InternetGatewayDevice.DeviceInfo.SerialNumber` | `Device.DeviceInfo.SerialNumber` | string | No |
| Hardware Ver | `InternetGatewayDevice.DeviceInfo.HardwareVersion` | `Device.DeviceInfo.HardwareVersion` | string | No |
| Software Ver | `InternetGatewayDevice.DeviceInfo.SoftwareVersion` | `Device.DeviceInfo.SoftwareVersion` | string | No |
| Uptime | `InternetGatewayDevice.DeviceInfo.UpTime` | `Device.DeviceInfo.UpTime` | uint | No |

### WiFi Configuration

| Feature | TR-098 Path | TR-181 Path | Type | Writable |
|---------|-------------|-------------|------|----------|
| SSID | `*.LANDevice.1.WLANConfiguration.{i}.SSID` | `*.WiFi.SSID.{i}.SSID` | string | Yes |
| Radio Enable | `*.LANDevice.1.WLANConfiguration.{i}.Enable` | `*.WiFi.Radio.{i}.Enable` | boolean | Yes |
| Channel | `*.LANDevice.1.WLANConfiguration.{i}.Channel` | `*.WiFi.Radio.{i}.Channel` | uint | Yes |
| Security Mode | `*.LANDevice.1.WLANConfiguration.{i}.BeaconType` | `*.WiFi.AccessPoint.{i}.Security.ModeEnabled` | string | Yes |
| Passphrase | `*.LANDevice.1.WLANConfiguration.{i}.PreSharedKey.1.KeyPassphrase` | `*.WiFi.AccessPoint.{i}.Security.KeyPassphrase` | string | Yes |
| SSID Broadcast | `*.LANDevice.1.WLANConfiguration.{i}.SSIDAdvertisementEnabled` | `*.WiFi.AccessPoint.{i}.SSIDAdvertisementEnabled` | boolean | Yes |

**TR-098 security values**: `BeaconType` accepts `"None"`, `"WPA"`, `"11i"` (WPA2), or `"WPAand11i"` (mixed mode).

**TR-181 security values**: `ModeEnabled` accepts `"None"`, `"WPA-Personal"`, `"WPA2-Personal"`, `"WPA-WPA2-Personal"`, `"WPA2-Enterprise"`, among others.

### WAN Configuration

| Feature | TR-098 Path | TR-181 Path | Type | Writable |
|---------|-------------|-------------|------|----------|
| PPPoE Username | `*.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.Username` | `*.PPP.Interface.{i}.Username` | string | Yes |
| PPPoE Password | `*.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.Password` | `*.PPP.Interface.{i}.Password` | string | Yes |
| WAN IP Address | `*.WANDevice.1.WANConnectionDevice.{i}.WANIPConnection.{j}.ExternalIPAddress` | `*.IP.Interface.{i}.IPv4Address.{j}.IPAddress` | string | No |
| Connection Status | `*.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.ConnectionStatus` | `*.PPP.Interface.{i}.Status` | string | No |

### Nokia/ALU Vendor Extensions

The `X_ALU_COM` vendor extension parameters are available on all Nokia and Alcatel-Lucent ONTs, regardless of whether they use TR-098 or TR-181. The `X_ALU_COM` prefix is the primary vendor extension namespace; `X_NOKIA_COM` parameters are only present on newer firmware.

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `*.X_ALU_COM.OntOpticalParam.RxPower` | string | No | Optical receive power in dBm |
| `*.X_ALU_COM.OntOpticalParam.TxPower` | string | No | Optical transmit power in dBm |
| `*.X_ALU_COM.OntOpticalParam.Temperature` | string | No | ONT SFP module temperature |
| `*.X_ALU_COM.OntGeneral.SLID` | string | Yes | Subscriber Line ID |
| `*.X_ALU_OMCI_VlanId` | uint | varies | OMCI VLAN ID |
| `*.WANConnectionDevice.*.X_ALU_OMCI_VlanTag` | varies | varies | WAN connection VLAN tag |
| `*.X_ALU_COM_WIFI.BandSteering.*` | varies | Yes | Band steering configuration |

**IMPORTANT**: The `X_ALU_COM` prefix appears under the active root object. On TR-098 devices, use `InternetGatewayDevice.X_ALU_COM.*`. On TR-181 devices, use `Device.X_ALU_COM.*`. Do NOT assume `X_NOKIA_COM` is available; always try `X_ALU_COM` first.

### VoIP Configuration

VoIP parameter paths are largely the same between TR-098 and TR-181 on Nokia ONTs. The `VoiceService` subtree structure is consistent across both data models.

| Feature | TR-098 Path | TR-181 Path | Type | Writable |
|---------|-------------|-------------|------|----------|
| SIP Server | `*.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServer` | `*.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServer` | string | Yes |
| SIP Port | `*.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServerPort` | `*.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServerPort` | uint | Yes |
| SIP Username | `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.AuthUserName` | `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.AuthUserName` | string | Yes |
| SIP Password | `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.AuthPassword` | `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.AuthPassword` | string | Yes |
| SIP URI | `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.URI` | `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.URI` | string | Yes |
| Line Enable | `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.Enable` | `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.Enable` | string | Yes |

## Provision Scripts

This section provides ready-to-use provision scripts for common Nokia ONT management tasks. All scripts use the `declare()` API documented in [PROVISIONING-SPEC.md](../specs/PROVISIONING-SPEC.md). Every script includes runtime data model detection because Nokia devices may use either TR-098 or TR-181.

### Data Model-Aware WiFi Configuration

```javascript
// Provision: nokia-wifi-config
// Configure WiFi on Nokia ONTs with automatic data model detection.
// Handles both TR-098 (G-240W series) and TR-181 (G-2425G, XS series).

const now = Date.now();
const ssid24 = "MyNetwork";
const ssid5 = "MyNetwork-5G";
const passphrase = "SecurePassword123";

// Detect data model
let tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});
let tr098 = declare("InternetGatewayDevice.DeviceInfo.Manufacturer", {value: now});

if (tr181.size) {
  // TR-181 path (G-2425G-A, G-2426G-A, XS-series)
  declare("Device.WiFi.Radio.1.Enable", {value: now}, {value: true});
  declare("Device.WiFi.SSID.1.SSID", {value: now}, {value: ssid24});
  declare("Device.WiFi.AccessPoint.1.Security.ModeEnabled", {value: now}, {value: "WPA2-Personal"});
  declare("Device.WiFi.AccessPoint.1.Security.KeyPassphrase", {value: now}, {value: passphrase});

  // 5GHz radio
  declare("Device.WiFi.Radio.2.Enable", {value: now}, {value: true});
  declare("Device.WiFi.SSID.2.SSID", {value: now}, {value: ssid5});
  declare("Device.WiFi.AccessPoint.2.Security.ModeEnabled", {value: now}, {value: "WPA2-Personal"});
  declare("Device.WiFi.AccessPoint.2.Security.KeyPassphrase", {value: now}, {value: passphrase});
} else if (tr098.size) {
  // TR-098 path (G-240W series, G-240G series, all I-series)
  let wlan24 = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1";
  declare(wlan24 + ".Enable", {value: now}, {value: true});
  declare(wlan24 + ".SSID", {value: now}, {value: ssid24});
  declare(wlan24 + ".BeaconType", {value: now}, {value: "11i"});
  declare(wlan24 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
  declare(wlan24 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
  declare(wlan24 + ".PreSharedKey.1.KeyPassphrase", {value: now}, {value: passphrase});

  // 5GHz radio (if available -- not present on single-band models)
  let wlan5 = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5";
  let w5 = declare(wlan5 + ".*", {path: now});
  if (w5.size) {
    declare(wlan5 + ".Enable", {value: now}, {value: true});
    declare(wlan5 + ".SSID", {value: now}, {value: ssid5});
    declare(wlan5 + ".BeaconType", {value: now}, {value: "11i"});
    declare(wlan5 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
    declare(wlan5 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
    declare(wlan5 + ".PreSharedKey.1.KeyPassphrase", {value: now}, {value: passphrase});
  }
}
```

### WAN PPPoE Configuration

```javascript
// Provision: nokia-wan-pppoe
// Configure PPPoE WAN connection on Nokia ONTs.
// Handles both TR-098 and TR-181 data models.

const now = Date.now();
const pppUser = "user@isp.com";
const pppPass = "password";

let tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});

if (tr181.size) {
  // TR-181 path
  declare("Device.PPP.Interface.1.Enable", {value: now}, {value: true});
  declare("Device.PPP.Interface.1.Username", {value: now}, {value: pppUser});
  declare("Device.PPP.Interface.1.Password", {value: now}, {value: pppPass});
} else {
  // TR-098 path
  let connPath = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1";
  declare(connPath + ".WANPPPConnection.1.Enable", {value: now}, {value: true});
  declare(connPath + ".WANPPPConnection.1.Username", {value: now}, {value: pppUser});
  declare(connPath + ".WANPPPConnection.1.Password", {value: now}, {value: pppPass});
  declare(connPath + ".WANPPPConnection.1.ConnectionType", {value: now}, {value: "IP_Routed"});
}
```

### Optical Power Monitoring

```javascript
// Provision: nokia-optical-monitor
// Monitor GPON optical power levels on Nokia ONTs.
// Works with both TR-098 and TR-181 devices (X_ALU_COM is vendor-agnostic).

const now = Date.now();

// Try TR-098 path first
let rxPower = declare("InternetGatewayDevice.X_ALU_COM.OntOpticalParam.RxPower", {value: now});

if (!rxPower.size) {
  // Try TR-181 path
  rxPower = declare("Device.X_ALU_COM.OntOpticalParam.RxPower", {value: now});
}

if (rxPower.size && rxPower.value[0]) {
  let rx = parseFloat(rxPower.value[0]);
  log("Nokia GPON RX Power: " + rx + " dBm");

  if (rx < -28) {
    declare("Tags.optical_critical", null, {value: true});
    declare("Tags.optical_warning", null, {value: false});
    log("CRITICAL: Low optical RX power: " + rx + " dBm");
  } else if (rx < -25) {
    declare("Tags.optical_warning", null, {value: true});
    declare("Tags.optical_critical", null, {value: false});
  } else {
    declare("Tags.optical_warning", null, {value: false});
    declare("Tags.optical_critical", null, {value: false});
  }
}
```

**Optical power thresholds**: RX power below -28 dBm indicates a critical condition (fiber break, excessive splitter loss, or dirty connector). RX power between -25 dBm and -28 dBm is a warning level that should be investigated. Normal operational range is typically -8 dBm to -25 dBm.

### Auto-Tagging with Data Model Detection

```javascript
// Provision: nokia-auto-tag
// Auto-tag Nokia/ALU devices on first connect.
// Attach to a preset with event: 0 BOOTSTRAP

const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let productClass = declare("DeviceID.ProductClass", {value: now});

if (manufacturer.value[0].indexOf("ALCL") >= 0 || manufacturer.value[0].indexOf("Nokia") >= 0) {
  // Apply vendor tag
  declare("Tags.nokia", null, {value: true});

  // Apply model-specific tag (replace hyphens with underscores for safe tag names)
  let model = productClass.value[0];
  if (model) {
    declare("Tags." + model.replace(/-/g, "_"), null, {value: true});
  }

  // Detect and tag data model
  let dev = declare("Device.DeviceInfo.Manufacturer", {value: now});
  if (dev.size) {
    declare("Tags.tr181", null, {value: true});
  } else {
    declare("Tags.tr098", null, {value: true});
  }
}
```

**How it works**: The `DeviceID.Manufacturer` field contains the OUI or manufacturer name. Nokia ONTs report `ALCL` (from the Alcatel-Lucent OUI) or occasionally `Nokia`. This provision checks for both values and tags the device accordingly. The data model detection adds `tr098` or `tr181` tags for preset routing.

### VoIP Configuration

```javascript
// Provision: nokia-voip
// Configure SIP VoIP service on Nokia ONTs.
// VoIP paths are the same for both TR-098 and TR-181.

const now = Date.now();
const sipServer = "sip.isp.com";
const sipPort = 5060;
const sipUser = "1001";
const sipPass = "sippassword";

// Detect data model to determine root path
let tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});
let root = tr181.size ? "Device" : "InternetGatewayDevice";

let voipBase = root + ".Services.VoiceService.1.VoiceProfile.1";

// SIP server settings
declare(voipBase + ".SIP.ProxyServer", {value: now}, {value: sipServer});
declare(voipBase + ".SIP.ProxyServerPort", {value: now}, {value: sipPort});
declare(voipBase + ".SIP.RegistrarServer", {value: now}, {value: sipServer});

// Line 1 configuration (FXS port 1)
declare(voipBase + ".Line.1.Enable", {value: now}, {value: "Enabled"});
declare(voipBase + ".Line.1.SIP.AuthUserName", {value: now}, {value: sipUser});
declare(voipBase + ".Line.1.SIP.AuthPassword", {value: now}, {value: sipPass});
declare(voipBase + ".Line.1.SIP.URI", {value: now}, {value: sipUser});
```

### ALU Legacy Migration Bootstrap

```javascript
// Provision: nokia-alu-migration
// Bootstrap provision for migrating legacy ALU ONTs to GenieACS.
// Use this when onboarding ALU I-series devices that were previously managed
// by a different ACS or were unmanaged.

const now = Date.now();

// Clear stale cached data from previous ACS sessions
clear("InternetGatewayDevice", now);
clear("Device", now);

let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let model = declare("DeviceID.ProductClass", {value: now});
let serial = declare("DeviceID.SerialNumber", {value: now});

log("Migration: " + manufacturer.value[0] + " " + model.value[0] + " SN:" + serial.value[0]);

// Tag for tracking migration status
declare("Tags.migrated", null, {value: true});
declare("Tags.needs_config", null, {value: true});

// Set periodic inform to ensure ongoing management connectivity
declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", {value: now}, {value: true});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", {value: now}, {value: 300});
```

**Note**: The `clear()` function removes all cached parameter data for the device in GenieACS. This forces a full re-discovery on the next session, which is necessary when migrating from another ACS that may have stored different parameter paths or values.

### Staged Firmware Upgrade Check

```javascript
// Provision: nokia-firmware-check
// Read and log current firmware version for staged rollout tracking.
// Tag devices by firmware version prefix for group-based upgrades.

const now = Date.now();
let currentFW = declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: now});

if (!currentFW.size) {
  currentFW = declare("Device.DeviceInfo.SoftwareVersion", {value: now});
}

let model = declare("DeviceID.ProductClass", {value: now});

log("Nokia " + model.value[0] + " firmware: " + currentFW.value[0]);

// Tag based on firmware version prefix for staged rollout
// Nokia firmware follows 3FE{xxxxx}{xxx}{yy} format
if (currentFW.value[0] && currentFW.value[0].indexOf("3FE") === 0) {
  declare("Tags.nokia_firmware_" + currentFW.value[0].substring(0, 10), null, {value: true});
}
```

## Vendor-Specific Quirks and Workarounds

This section documents known Nokia-specific behaviors that differ from standard TR-069 expectations. Understanding these quirks is critical for reliable device management.

### Dual Data Model Support

Nokia ONTs use EITHER TR-098 (`InternetGatewayDevice`) or TR-181 (`Device`), never both simultaneously. This is the defining characteristic of Nokia ONTs in a GenieACS deployment.

**TR-098 models**: G-240W-A, G-240W-B, G-240W-C, G-240W-F, G-240G-A, G-240G-E, G-010G-A, and all legacy I-series models.

**TR-181 models**: G-2425G-A, G-2426G-A, XS-250WX-A, XS-2426X-A.

**Firmware-driven changes**: Some models can switch data model through a firmware update. A G-240W-F running older firmware uses TR-098, but a future firmware version could migrate it to TR-181. Always detect the data model at runtime.

**Impact on provisions**: Every provision script that references the device parameter tree must handle both data models, or must be paired with model-specific presets that use tag-based preconditions (`Tags.tr098 = true` or `Tags.tr181 = true`).

### ALU-to-Nokia Prefix Migration

All Nokia ONTs, including those manufactured after the 2016 acquisition, continue to use the `X_ALU_COM` prefix for vendor-specific parameters. This is a backward compatibility decision, not a bug.

- The OUI remains `ALCL` on all Nokia ONTs, including Nokia-branded hardware and firmware.
- The `X_ALU_COM` prefix is the primary and often only vendor extension namespace.
- Some newer firmware versions add `X_NOKIA_COM` parameters alongside `X_ALU_COM`, but `X_NOKIA_COM` is not guaranteed to be present.
- **Recommendation**: Always use `X_ALU_COM` as the primary vendor extension path. Only fall back to `X_NOKIA_COM` if `X_ALU_COM` is not available for a specific parameter.

### GPN Depth Limitations

Nokia ONTs with deep parameter trees may exceed the GenieACS `UNDISCOVERED_DEPTH = 7` limit defined in `lib/gpn-heuristic.ts`. Some Nokia firmware also does not properly respond to `NextLevel=false` in GetParameterNames requests.

**Impact**: Automatic parameter discovery may miss deep parameters. Full tree refresh operations may time out or return incomplete data.

**Workaround**: Refresh specific subtrees instead of the entire root object:

```javascript
// Instead of refreshing the entire tree (slow and may miss deep parameters)
// declare("InternetGatewayDevice.*", {path: Date.now()});

// Refresh targeted subtrees
declare("InternetGatewayDevice.WANDevice", {path: Date.now(), value: Date.now()});
declare("InternetGatewayDevice.LANDevice", {path: Date.now(), value: Date.now()});
declare("InternetGatewayDevice.Services", {path: Date.now(), value: Date.now()});
```

### Session Timeout Issues

Nokia ONTs sometimes hold CWMP sessions open longer than expected or drop sessions prematurely before all pending RPCs have been processed.

**Impact**: Large configuration changes may not complete within a single session. Parameters set late in a provision may not be committed to the device.

**Workaround**: Use `commit()` strategically to save critical parameters before the session drops:

```javascript
// Set critical parameters first, commit, then continue with less critical ones
declare("...WANPPPConnection.1.Username", {value: now}, {value: pppUser});
declare("...WANPPPConnection.1.Password", {value: now}, {value: pppPass});
commit();

// Less critical parameters can follow after the commit
declare("...WLANConfiguration.1.SSID", {value: now}, {value: ssid});
```

**Configuration**: Adjust `cwmp.sessionTimeout` in GenieACS configuration if session timeouts occur frequently with Nokia devices.

### Connection Request Reliability

HTTP connection requests from GenieACS to Nokia ONTs may not work reliably on all models and firmware versions.

- The `4 VALUE CHANGE` inform event is inconsistent across Nokia firmware; not all parameter changes trigger it.
- NAT traversal via STUN varies by firmware version and is not universally supported.
- **Recommendation**: Configure periodic inform (300-600 seconds) as the primary management mechanism rather than relying on connection requests.

### SOAP/XML Encoding Quirks

Some Nokia firmware versions send non-standard SOAP/XML that may require special handling:

- Malformed SOAP headers with non-standard XML namespaces
- Extra whitespace in parameter values
- Empty `<cwmp:ID>` elements in responses
- GenieACS handles most of these through `lib/xml-parser.ts` and `lib/soap.ts`, but unusual firmware versions may produce unexpected parsing behavior.

### Firmware File Naming

Nokia firmware files follow a specific naming convention: `3FE{xxxxx}{xxx}{yy}` (for example, `3FE49717AOCK83`).

- When uploading firmware, the `oui` header must be set to `ALCL` (not "Nokia") to match the device OUI.
- The `productClass` header must match the device `DeviceID.ProductClass` value exactly.
- ALU firmware can generally be applied to equivalent Nokia models (e.g., ALU I-240W-A firmware on Nokia G-240W-A), but Nokia firmware CANNOT be applied to older ALU hardware.

### Default Credentials

Many legacy Alcatel-Lucent ONTs shipped with default administrative credentials: username `AdminGPON` and password `ALC#FGU`. The Subscriber Line ID (SLID) can be set remotely via TR-069:

```
InternetGatewayDevice.X_ALU_COM.OntGeneral.SLID
```

## Troubleshooting

### ONT Not Appearing in GenieACS

When a Nokia ONT does not show up in the GenieACS device list, verify the following in order:

1. **ACS URL Configuration**: Confirm the ACS URL is correctly set on the ONT. This can be configured through the ONT web GUI, via OMCI provisioning from the OLT, or through DHCP Option 43.
2. **Network Connectivity**: The ONT must be able to reach the GenieACS CWMP service on port 7547 (default). Test with `curl http://acs-server:7547` from a device on the same network.
3. **Firewall Rules**: Verify that no firewall is blocking traffic between the ONT and the ACS on port 7547.
4. **DHCP Option 43**: If using auto-provisioning via DHCP, verify that Option 43 is correctly configured with the ACS URL.
5. **GenieACS Logs**: Check the CWMP service logs for incoming connections: `journalctl -u genieacs-cwmp -f`
6. **Reboot After ACS URL Change**: Nokia ONTs typically require a full reboot after the ACS URL is changed before the first Inform is sent.

### Data Model Mismatch Errors

This is the most common Nokia-specific issue in GenieACS deployments.

**Symptom**: "Parameter does not exist" errors on paths that should be valid for the device model.

**Cause**: Using TR-098 paths (e.g., `InternetGatewayDevice.LANDevice...`) on a TR-181 device, or TR-181 paths (e.g., `Device.WiFi...`) on a TR-098 device.

**Solution**: Always detect the data model at runtime (see Section 3). Use tags (`tr098`, `tr181`) to route devices to the correct presets. Review all provision scripts to ensure they handle both data models or are assigned only to the correct device group.

### "Parameter does not exist" Errors

Beyond data model mismatches, this error can occur for several other reasons:

1. **Wrong data model root**: Using `Device.` on a TR-098 ONT or `InternetGatewayDevice.` on a TR-181 ONT.
2. **Wrong WLAN instance numbers**: Instance numbers are not always sequential. Discover instances with wildcards before referencing specific ones.
3. **Parameter not writable**: Some parameters are read-only on certain firmware versions or are managed exclusively via OMCI.
4. **Object instance missing**: The object instance may need to be created first using an `AddObject` RPC before child parameters can be set.
5. **Discovery incomplete**: Use a `refreshObject` task to re-discover the device parameter tree.

### WiFi Changes Not Taking Effect

When WiFi configuration changes applied via provision scripts do not appear on the device:

1. **Set security parameters in correct order**: On TR-098 devices, set `BeaconType` first, then `WPAEncryptionModes`, then `WPAAuthenticationMode`, then `KeyPassphrase`. Some firmware ignores parameters set out of order.
2. **Set ALL security parameters together**: Configure all WiFi security parameters within the same provision execution to avoid partial state.
3. **Radio disable/enable cycle**: Some models require the radio to be disabled and re-enabled after security changes take effect.
4. **Verify instance number**: Confirm that the WLAN instance being configured matches the intended radio band.

### Firmware Upgrade Failures

1. **Verify file upload**: Confirm the firmware file is present on the GenieACS file server: `curl -s 'http://localhost:7557/files/'`
2. **File server accessibility**: The ONT must be able to reach the file server on port 7567. Verify routing and firewall rules.
3. **Firmware compatibility**: Verify that the firmware version is compatible with the ONT hardware version. ALU firmware can be applied to equivalent Nokia models, but not the reverse.
4. **Wait for TRANSFER COMPLETE**: After initiating a download task, wait for the `7 TRANSFER COMPLETE` inform event before attempting a reboot.
5. **Flash storage**: Check that the ONT has sufficient flash storage for the firmware image.
6. **OUI matching**: The `oui` header on the uploaded file must be `ALCL` (not "Nokia"), matching the device OUI.

### Optical Power Issues

- If `X_ALU_COM` parameters return empty values, try refreshing the specific subtree: `InternetGatewayDevice.X_ALU_COM.OntOpticalParam.*` or `Device.X_ALU_COM.OntOpticalParam.*`.
- GPON optical parameters may not be available on bridge-only models.
- RX power below -28 dBm indicates a critical condition. Between -25 dBm and -28 dBm is a warning level.

### Common TR-069 Fault Codes

| Fault Code | Meaning | Nokia-Specific Resolution |
|-----------|---------|--------------------------|
| 9001 | Request denied | Parameter may be read-only or managed exclusively via OMCI |
| 9002 | Internal error | Reboot the ONT; may indicate flash corruption |
| 9003 | Invalid arguments | Verify parameter types match specification |
| 9005 | Invalid parameter name | Wrong data model; verify TR-098 vs TR-181 (most common Nokia issue) |
| 9006 | Invalid parameter type | Type mismatch between provision value and device expectation |
| 9007 | Invalid parameter value | Value is outside the allowed range for this parameter |
| 9008 | Set non-writable param | Parameter is OMCI-managed or firmware read-only |
| 9800-9899 | Vendor-specific | Nokia-specific vendor faults; consult firmware release notes |

**Clearing persistent faults**:

```bash
curl -X DELETE 'http://localhost:7557/faults/<device_id>:default'
```

## NBI API Quick Reference

The following `curl` examples demonstrate common Nokia device management operations through the GenieACS NBI API (port 7557). Replace `<id>` with the full device ID (format: `ALCL-ModelName-SerialNumber`).

For complete NBI API documentation, see [NBI-API-SPEC.md](../specs/NBI-API-SPEC.md).

```bash
# Find all Nokia devices (matches both ALCL and Nokia manufacturer values)
curl -s 'http://localhost:7557/devices/?query={"DeviceID.Manufacturer._value":{"$regex":"ALCL|Nokia"}}'

# Reboot a device
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"reboot"}'

# Factory reset a device
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"factoryReset"}'

# Refresh the full data model
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"refreshObject","objectName":""}'

# Set WiFi SSID via NBI (TR-098 example)
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"setParameterValues","parameterValues":[["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID","NewSSID","xsd:string"]]}'

# Upload Nokia firmware to file server
curl -X PUT 'http://localhost:7557/files/3FE49717AOCK83.bin' \
  --data-binary @3FE49717AOCK83.bin \
  --header "fileType: 1 Firmware Upgrade Image" \
  --header "oui: ALCL" \
  --header "productClass: G-240W-A"

# Tag a device
curl -X POST 'http://localhost:7557/devices/<id>/tags/nokia_g240wa'

# Delete a fault
curl -X DELETE 'http://localhost:7557/faults/<id>:default'
```

## Best Practices

### Staged Firmware Rollout

1. Tag a small set of test devices with `firmware_test`.
2. Upload the new firmware to the GenieACS file server with correct `oui` (`ALCL`) and `productClass` headers.
3. Create a preset targeting only `firmware_test` devices that triggers the download task.
4. Monitor for `7 TRANSFER COMPLETE` inform events on test devices.
5. After validation, remove the tag restriction to allow fleet-wide deployment.
6. Keep the previous firmware version uploaded as a rollback option.

### Optical Power Monitoring

- Poll optical power via the `nokia-optical-monitor` provision on periodic inform events.
- Tag devices with `optical_critical` (RX < -28 dBm) or `optical_warning` (RX < -25 dBm).
- Monitor the `X_ALU_COM.OntOpticalParam.Temperature` parameter for SFP overheating.
- Use tagged device lists to prioritize field maintenance and fiber plant inspection.

### Preset Organization

- **Vendor-level precondition**: Use `DeviceID.Manufacturer LIKE "%ALCL%"` to target all Nokia and ALU devices. This catches both legacy ALU and current Nokia firmware.
- **Data model routing**: Create separate presets for TR-098 and TR-181 devices using tag filters (`Tags.tr098 = true` or `Tags.tr181 = true`).
- **Separate concerns**: Create distinct presets for WiFi, WAN, VoIP, and monitoring tasks. Assign each to a different preset channel to prevent interference.
- **Bootstrap event**: Use the `0 BOOTSTRAP` event for initial device configuration (auto-tagging, data model detection, default settings).
- **Periodic event**: Use the `2 PERIODIC` event for ongoing monitoring, optical power checks, and compliance verification.

### Performance Tips

- **Declare only what you need**: Avoid refreshing the entire device tree. Target specific subtrees to reduce session duration and device load.
- **Cached vs. fresh reads**: Use `{value: 1}` for cached parameter reads when staleness is acceptable. Use `{value: Date.now()}` only when a fresh read from the device is required.
- **Periodic inform interval**: Set to 300-600 seconds for a balance between responsiveness and ACS load.
- **Batch related changes**: Group related parameter changes in a single provision script to reduce CWMP round trips.
- **Use preset channels**: Assign presets to channels (`default`, `bootstrap`, `monitoring`) to isolate critical operations from non-critical ones. A fault in one channel does not block provisions in another.
- **Use commit() strategically**: Call `commit()` after setting critical parameters (WAN credentials, management settings) before continuing with optional parameters (WiFi, cosmetic settings). This ensures critical changes persist even if the session drops.

## Alcatel-Lucent Legacy Notes

### Historical Context

Nokia completed its acquisition of Alcatel-Lucent in January 2016. The ALU Fixed Networks division was reorganized as the Nokia Fixed Networks business unit. The ONT product line transitioned from ALU I-series naming to Nokia G-series naming, but the underlying hardware platforms and firmware architecture remained closely related.

### ALU-Specific Behaviors

- **OUI**: All Nokia ONTs, including those manufactured after the acquisition, report the OUI as `ALCL`. This is a deliberate backward compatibility decision, not a firmware bug.
- **Vendor prefix**: The `X_ALU_COM` prefix is maintained across all Nokia ONT firmware for backward compatibility. It is the primary vendor extension namespace.
- **Default credentials**: Many ALU ONTs shipped with default administrative credentials: username `AdminGPON` and password `ALC#FGU`. These should be changed during initial provisioning.
- **Firmware compatibility**: ALU firmware images can generally be applied to equivalent Nokia models (e.g., I-240W-A firmware on G-240W-A). However, Nokia firmware CANNOT be applied to older ALU hardware revision boards.
- **SLID provisioning**: The Subscriber Line ID (SLID) is set via `InternetGatewayDevice.X_ALU_COM.OntGeneral.SLID`. This is commonly required for GPON OLT authentication.

### Migration Checklist

When migrating ALU I-series devices to GenieACS from another management system:

1. Clear stale device data using the `nokia-alu-migration` provision (see Section 5.6).
2. Run the `nokia-auto-tag` provision to apply vendor and data model tags.
3. Set periodic inform to 300 seconds to ensure reliable management connectivity.
4. Verify the ACS URL is correctly set on the device.
5. Update default credentials if the device was using `AdminGPON`/`ALC#FGU`.
6. Run a `refreshObject` task to discover the full parameter tree.
7. Apply production configuration presets after migration tagging is confirmed.
