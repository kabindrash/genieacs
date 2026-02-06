# GenieACS Cross-Vendor ONT Comparison and Abstraction

## Overview

This document provides side-by-side comparisons of Huawei, ZTE, and Nokia ONTs managed by GenieACS. It covers parameter path mapping, vendor abstraction strategies using virtual parameters, universal provision patterns, and preset architecture for multi-vendor deployments.

For vendor-specific details, see the individual guides:
- [HUAWEI-ONT-GUIDE.md](HUAWEI-ONT-GUIDE.md)
- [ZTE-ONT-GUIDE.md](ZTE-ONT-GUIDE.md)
- [NOKIA-ONT-GUIDE.md](NOKIA-ONT-GUIDE.md)

---

## Vendor Summary

| Property | Huawei | ZTE | Nokia |
|----------|--------|-----|-------|
| **Data Model** | TR-098 | TR-098 | TR-098 or TR-181 |
| **Root Path** | `InternetGatewayDevice` | `InternetGatewayDevice` | `InternetGatewayDevice` or `Device` |
| **Extension Prefix** | `X_HW_` | `X_ZTE-COM_` | `X_ALU_COM_`, `X_NOKIA_COM_` |
| **Common OUI** | `00E0FC` | varies | `ALCL` |
| **Manufacturer String** | `Huawei` or `Huawei Technologies Co., Ltd.` | `ZTE` | `ALCL` or `Nokia` |
| **WLAN 2.4GHz Instance** | Non-sequential (discover first) | 1 | 1 |
| **WLAN 5GHz Instance** | Non-sequential (discover first) | 5 | 5 or 2 (TR-181) |
| **WiFi Password Path** | `PreSharedKey.1.KeyPassphrase` | `KeyPassphrase` (direct) | `PreSharedKey.1.KeyPassphrase` (TR-098) or `Security.KeyPassphrase` (TR-181) |
| **VLAN Extension** | `X_HW_VLANMuxID` | `X_ZTE-COM_VLANID` | `X_ALU_OMCI_VlanId` |
| **Optical Monitoring** | Not standard | `X_ZTE-COM_GponInterfaceConfig` | `X_ALU_COM.OntOpticalParam` |

---

## Parameter Path Mapping

### Device Information

| Operation | Huawei | ZTE | Nokia (TR-098) | Nokia (TR-181) |
|-----------|--------|-----|----------------|----------------|
| Manufacturer | `IGD.DeviceInfo.Manufacturer` | `IGD.DeviceInfo.Manufacturer` | `IGD.DeviceInfo.Manufacturer` | `Device.DeviceInfo.Manufacturer` |
| Serial Number | `IGD.DeviceInfo.SerialNumber` | `IGD.DeviceInfo.SerialNumber` | `IGD.DeviceInfo.SerialNumber` | `Device.DeviceInfo.SerialNumber` |
| Model Name | `IGD.DeviceInfo.ModelName` | `IGD.DeviceInfo.ModelName` | `IGD.DeviceInfo.ModelName` | `Device.DeviceInfo.ModelName` |
| Firmware Version | `IGD.DeviceInfo.SoftwareVersion` | `IGD.DeviceInfo.SoftwareVersion` | `IGD.DeviceInfo.SoftwareVersion` | `Device.DeviceInfo.SoftwareVersion` |
| Hardware Version | `IGD.DeviceInfo.HardwareVersion` | `IGD.DeviceInfo.HardwareVersion` | `IGD.DeviceInfo.HardwareVersion` | `Device.DeviceInfo.HardwareVersion` |
| Uptime | `IGD.DeviceInfo.UpTime` | `IGD.DeviceInfo.UpTime` | `IGD.DeviceInfo.UpTime` | `Device.DeviceInfo.UpTime` |

**Note**: `IGD` = `InternetGatewayDevice` (abbreviated for table readability).

### WiFi Configuration

| Operation | Huawei | ZTE | Nokia (TR-098) | Nokia (TR-181) |
|-----------|--------|-----|----------------|----------------|
| Enable Radio | `IGD.LANDevice.1.WLANConfiguration.{i}.Enable` | `IGD.LANDevice.1.WLANConfiguration.{i}.Enable` | `IGD.LANDevice.1.WLANConfiguration.{i}.Enable` | `Device.WiFi.Radio.{i}.Enable` |
| SSID | `IGD.LANDevice.1.WLANConfiguration.{i}.SSID` | `IGD.LANDevice.1.WLANConfiguration.{i}.SSID` | `IGD.LANDevice.1.WLANConfiguration.{i}.SSID` | `Device.WiFi.SSID.{i}.SSID` |
| Channel | `IGD.LANDevice.1.WLANConfiguration.{i}.Channel` | `IGD.LANDevice.1.WLANConfiguration.{i}.Channel` | `IGD.LANDevice.1.WLANConfiguration.{i}.Channel` | `Device.WiFi.Radio.{i}.Channel` |
| Security Mode | `*.BeaconType` | `*.BeaconType` | `*.BeaconType` | `Device.WiFi.AccessPoint.{i}.Security.ModeEnabled` |
| Encryption | `*.WPAEncryptionModes` | `*.WPAEncryptionModes` | `*.WPAEncryptionModes` | (part of ModeEnabled) |
| Password | `*.PreSharedKey.1.KeyPassphrase` | `*.KeyPassphrase` | `*.PreSharedKey.1.KeyPassphrase` | `Device.WiFi.AccessPoint.{i}.Security.KeyPassphrase` |
| Broadcast SSID | `*.SSIDAdvertisementEnabled` | `*.SSIDAdvertisementEnabled` | `*.SSIDAdvertisementEnabled` | `Device.WiFi.AccessPoint.{i}.SSIDAdvertisementEnabled` |

**Key difference**: ZTE uses `KeyPassphrase` directly on `WLANConfiguration`, while Huawei and Nokia (TR-098) use `PreSharedKey.1.KeyPassphrase`.

### WAN Configuration

| Operation | Huawei | ZTE | Nokia (TR-098) | Nokia (TR-181) |
|-----------|--------|-----|----------------|----------------|
| PPPoE Username | `IGD.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.Username` | Same as Huawei | Same as Huawei | `Device.PPP.Interface.{i}.Username` |
| PPPoE Password | `IGD.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.Password` | Same as Huawei | Same as Huawei | `Device.PPP.Interface.{i}.Password` |
| WAN IP | `IGD.WANDevice.1.WANConnectionDevice.{i}.WANIPConnection.{j}.ExternalIPAddress` | Same as Huawei | Same as Huawei | `Device.IP.Interface.{i}.IPv4Address.{j}.IPAddress` |
| Connection Status | `*.WANPPPConnection.{j}.ConnectionStatus` | Same as Huawei | Same as Huawei | `Device.PPP.Interface.{i}.Status` |
| VLAN ID | `*.X_HW_VLANMuxID` | `*.X_ZTE-COM_VLANID` | `*.X_ALU_OMCI_VlanId` | `*.X_ALU_OMCI_VlanId` |

### Optical Monitoring

| Operation | Huawei | ZTE | Nokia |
|-----------|--------|-----|-------|
| RX Power | Not standard | `IGD.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.RxPower` | `*.X_ALU_COM.OntOpticalParam.RxPower` |
| TX Power | Not standard | `IGD.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.TxPower` | `*.X_ALU_COM.OntOpticalParam.TxPower` |
| Temperature | Not standard | `IGD.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.Temperature` | `*.X_ALU_COM.OntOpticalParam.Temperature` |
| Voltage | Not standard | `IGD.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.Voltage` | N/A |

### VoIP Configuration

VoIP paths are largely consistent across all three vendors using the standard TR-098 VoiceService path:

```
{root}.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServer
{root}.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServerPort
{root}.Services.VoiceService.1.VoiceProfile.1.SIP.RegistrarServer
{root}.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.AuthUserName
{root}.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.AuthPassword
{root}.Services.VoiceService.1.VoiceProfile.1.Line.{i}.Enable
```

Where `{root}` is `InternetGatewayDevice` or `Device` depending on the data model.

---

## Virtual Parameter Abstraction

Virtual parameters in GenieACS provide a vendor-agnostic interface by mapping logical parameter names to vendor-specific paths. They are defined in the GenieACS UI under "Virtual Parameters" and execute JavaScript to read/write the correct underlying path.

For full virtual parameter API documentation, see `claudedocs/specs/PROVISIONING-SPEC.md`.

### WiFi SSID (2.4GHz)

```javascript
// Virtual Parameter: wifi_ssid_2g
// Provides vendor-agnostic read/write access to the 2.4GHz WiFi SSID
const now = Date.now();
let m = "";

// Try TR-181 path (Nokia newer models)
let d = declare("Device.WiFi.SSID.1.SSID", {value: now});

// Try TR-098 path (Huawei, ZTE, Nokia older models)
let igd = declare(
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
  {value: now}
);

if (args[1].value) {
  // Write operation
  m = args[1].value[0];
  if (d.size) {
    declare("Device.WiFi.SSID.1.SSID", null, {value: m});
  } else if (igd.size) {
    declare(
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
      null, {value: m}
    );
  }
} else {
  // Read operation
  if (d.size) m = d.value[0];
  else if (igd.size) m = igd.value[0];
}

return {writable: true, value: [m, "xsd:string"]};
```

### WiFi Password (2.4GHz)

```javascript
// Virtual Parameter: wifi_password_2g
// Handles the critical path difference between ZTE and other vendors
const now = Date.now();
let m = "";

// TR-181 (Nokia newer)
let d = declare("Device.WiFi.AccessPoint.1.Security.KeyPassphrase", {value: now});

// TR-098 standard (Huawei, Nokia older)
let igd = declare(
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
  {value: now}
);

// ZTE-specific (KeyPassphrase directly on WLANConfiguration)
let zte = declare(
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
  {value: now}
);

if (args[1].value) {
  m = args[1].value[0];
  if (d.size) {
    declare("Device.WiFi.AccessPoint.1.Security.KeyPassphrase", null, {value: m});
  } else if (zte.size) {
    declare(
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
      null, {value: m}
    );
  } else if (igd.size) {
    declare(
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
      null, {value: m}
    );
  }
} else {
  if (d.size) m = d.value[0];
  else if (zte.size) m = zte.value[0];
  else if (igd.size) m = igd.value[0];
}

return {writable: true, value: [m, "xsd:string"]};
```

### WAN Status

```javascript
// Virtual Parameter: wan_status
// Read-only: returns WAN connection status across vendors
const now = Date.now();
let m = "";

// TR-181 PPP status
let d = declare("Device.PPP.Interface.1.Status", {value: now});

// TR-098 PPP status
let igd = declare(
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ConnectionStatus",
  {value: now}
);

// TR-098 IP connection status (DHCP WAN)
let igdIp = declare(
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ConnectionStatus",
  {value: now}
);

if (d.size) m = d.value[0];
else if (igd.size) m = igd.value[0];
else if (igdIp.size) m = igdIp.value[0];

return {writable: false, value: [m, "xsd:string"]};
```

### WAN IP Address

```javascript
// Virtual Parameter: wan_ip
// Read-only: returns the WAN IP address regardless of vendor
const now = Date.now();
let m = "";

// TR-181
let d = declare("Device.IP.Interface.1.IPv4Address.1.IPAddress", {value: now});

// TR-098 PPP
let igdPpp = declare(
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress",
  {value: now}
);

// TR-098 IP
let igdIp = declare(
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress",
  {value: now}
);

if (d.size && d.value[0]) m = d.value[0];
else if (igdPpp.size && igdPpp.value[0]) m = igdPpp.value[0];
else if (igdIp.size && igdIp.value[0]) m = igdIp.value[0];

return {writable: false, value: [m, "xsd:string"]};
```

### Optical RX Power

```javascript
// Virtual Parameter: optical_rx_power
// Read-only: returns GPON optical RX power across ZTE and Nokia
const now = Date.now();
let m = "";

// ZTE
let zte = declare(
  "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.RxPower",
  {value: now}
);

// Nokia (TR-098)
let nokia098 = declare(
  "InternetGatewayDevice.X_ALU_COM.OntOpticalParam.RxPower",
  {value: now}
);

// Nokia (TR-181)
let nokia181 = declare(
  "Device.X_ALU_COM.OntOpticalParam.RxPower",
  {value: now}
);

if (zte.size && zte.value[0]) m = zte.value[0];
else if (nokia098.size && nokia098.value[0]) m = nokia098.value[0];
else if (nokia181.size && nokia181.value[0]) m = nokia181.value[0];

return {writable: false, value: [m, "xsd:string"]};
```

---

## Universal Provision Patterns

These provisions use virtual parameters or runtime vendor detection to work across all three vendors.

### Universal WiFi Configuration

```javascript
// Provision: universal-wifi-config
// Works across Huawei, ZTE, and Nokia using virtual parameters
// Requires: wifi_ssid_2g, wifi_password_2g virtual parameters

const now = Date.now();

// Use virtual parameters for vendor-agnostic access
declare("VirtualParameters.wifi_ssid_2g", {value: now}, {value: "MyNetwork"});
declare("VirtualParameters.wifi_password_2g", {value: now}, {value: "SecurePassword123"});
```

### Universal Auto-Tag Provision

```javascript
// Provision: universal-auto-tag
// Auto-tag any vendor ONT on bootstrap event
const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let productClass = declare("DeviceID.ProductClass", {value: now});
let mfg = manufacturer.value[0];

// Vendor detection and tagging
if (mfg.indexOf("Huawei") >= 0) {
  declare("Tags.huawei", null, {value: true});
  declare("Tags.vendor_huawei", null, {value: true});
} else if (mfg.indexOf("ZTE") >= 0) {
  declare("Tags.zte", null, {value: true});
  declare("Tags.vendor_zte", null, {value: true});
} else if (mfg.indexOf("ALCL") >= 0 || mfg.indexOf("Nokia") >= 0) {
  declare("Tags.nokia", null, {value: true});
  declare("Tags.vendor_nokia", null, {value: true});

  // Nokia-specific: detect data model
  let tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});
  if (tr181.size) {
    declare("Tags.tr181", null, {value: true});
  } else {
    declare("Tags.tr098", null, {value: true});
  }
}

// Model-specific tag (all vendors)
let model = productClass.value[0];
if (model) {
  declare("Tags." + model.replace(/[^a-zA-Z0-9]/g, "_"), null, {value: true});
}
```

### Universal Optical Power Monitor

```javascript
// Provision: universal-optical-monitor
// Monitor GPON optical power across ZTE and Nokia
// Huawei does not expose standard optical monitoring via TR-069
const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let mfg = manufacturer.value[0];
let rxPower = null;

if (mfg.indexOf("ZTE") >= 0) {
  rxPower = declare(
    "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.RxPower",
    {value: now}
  );
} else if (mfg.indexOf("ALCL") >= 0 || mfg.indexOf("Nokia") >= 0) {
  // Try TR-098 first
  rxPower = declare(
    "InternetGatewayDevice.X_ALU_COM.OntOpticalParam.RxPower",
    {value: now}
  );
  if (!rxPower.size) {
    // Fallback to TR-181
    rxPower = declare(
      "Device.X_ALU_COM.OntOpticalParam.RxPower",
      {value: now}
    );
  }
}

if (rxPower && rxPower.size && rxPower.value[0]) {
  let rx = parseFloat(rxPower.value[0]);
  log("Optical RX Power: " + rx + " dBm (" + mfg + ")");

  if (rx < -28) {
    declare("Tags.optical_critical", null, {value: true});
    declare("Tags.optical_warning", null, {value: false});
  } else if (rx < -25) {
    declare("Tags.optical_warning", null, {value: true});
    declare("Tags.optical_critical", null, {value: false});
  } else {
    declare("Tags.optical_warning", null, {value: false});
    declare("Tags.optical_critical", null, {value: false});
  }
}
```

### Universal Firmware Version Logger

```javascript
// Provision: universal-firmware-log
// Log firmware information for inventory tracking across all vendors
const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let productClass = declare("DeviceID.ProductClass", {value: now});
let serial = declare("DeviceID.SerialNumber", {value: now});

// Try both data model roots for firmware version
let fw098 = declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: now});
let fw181 = declare("Device.DeviceInfo.SoftwareVersion", {value: now});

let fw = "";
if (fw181.size && fw181.value[0]) fw = fw181.value[0];
else if (fw098.size && fw098.value[0]) fw = fw098.value[0];

log("Inventory: " + manufacturer.value[0] + " " + productClass.value[0] +
    " SN:" + serial.value[0] + " FW:" + fw);
```

---

## Preset Architecture for Multi-Vendor Deployments

### Layered Preset Strategy

```
                    ┌──────────────────────────────┐
                    │     Universal Presets         │
                    │  (all devices, no vendor      │
                    │   precondition)               │
                    ├──────────────────────────────┤
                    │  - universal-auto-tag         │
                    │  - universal-firmware-log     │
                    │  - periodic-inform-config     │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
   ┌──────────▼──────┐ ┌──────▼───────┐ ┌──────▼──────────┐
   │  Huawei Presets  │ │ ZTE Presets  │ │  Nokia Presets   │
   │  Manufacturer    │ │ Manufacturer │ │  Manufacturer    │
   │  LIKE "%Huawei%" │ │ LIKE "%ZTE%" │ │  LIKE "%ALCL%"   │
   ├──────────────────┤ ├──────────────┤ ├──────────────────┤
   │ huawei-wifi      │ │ zte-wifi     │ │ nokia-wifi-098   │
   │ huawei-wan       │ │ zte-wan      │ │ nokia-wifi-181   │
   │ huawei-voip      │ │ zte-voip     │ │ nokia-wan-098    │
   │                  │ │ zte-optical  │ │ nokia-wan-181    │
   │                  │ │              │ │ nokia-optical    │
   └──────────────────┘ └──────────────┘ └──────────────────┘
              │                │                │
   ┌──────────▼──────┐ ┌──────▼───────┐ ┌──────▼──────────┐
   │ Model Presets    │ │ Model Presets│ │ Model Presets    │
   │ ProductClass =   │ │ ProductClass │ │ Tags.tr098 or   │
   │ "HG8245H"       │ │ = "F670L"    │ │ Tags.tr181      │
   └──────────────────┘ └──────────────┘ └──────────────────┘
```

### Preset Configuration Examples

**Universal Bootstrap** (no precondition, event: `0 BOOTSTRAP`):
```
Precondition: (empty - matches all devices)
Provision: universal-auto-tag
Channel: bootstrap
Event: 0 BOOTSTRAP
```

**Huawei WiFi** (vendor-specific):
```
Precondition: DeviceID.Manufacturer LIKE "%Huawei%"
Provision: huawei-wifi-config
Channel: wifi
Event: 0 BOOTSTRAP
```

**ZTE Optical Monitor** (vendor-specific, periodic):
```
Precondition: DeviceID.Manufacturer LIKE "%ZTE%"
Provision: zte-optical-monitor
Channel: monitoring
Event: 2 PERIODIC
```

**Nokia WiFi TR-098** (data model-specific):
```
Precondition: Tags.nokia = true AND Tags.tr098 = true
Provision: nokia-wifi-098
Channel: wifi
Event: 0 BOOTSTRAP
```

**Nokia WiFi TR-181** (data model-specific):
```
Precondition: Tags.nokia = true AND Tags.tr181 = true
Provision: nokia-wifi-181
Channel: wifi
Event: 0 BOOTSTRAP
```

### Channel Isolation Strategy

| Channel | Purpose | Event Trigger | Fault Impact |
|---------|---------|---------------|--------------|
| `bootstrap` | Initial device configuration | `0 BOOTSTRAP` | Only blocks re-bootstrap |
| `wifi` | WiFi configuration | `0 BOOTSTRAP`, `2 PERIODIC` | Only blocks WiFi operations |
| `wan` | WAN/internet configuration | `0 BOOTSTRAP` | Only blocks WAN operations |
| `voip` | VoIP configuration | `0 BOOTSTRAP` | Only blocks VoIP operations |
| `monitoring` | Optical power, uptime checks | `2 PERIODIC` | Only blocks monitoring |
| `firmware` | Firmware management | Manual trigger | Only blocks firmware ops |

Preset channels prevent a fault in one operation (e.g., WiFi configuration failure) from blocking unrelated operations (e.g., WAN configuration or monitoring).

---

## Common Pitfalls

| Pitfall | Vendor(s) | Impact | Prevention |
|---------|-----------|--------|------------|
| Wrong data model root | Nokia | All parameter operations fail | Always detect TR-098 vs TR-181 at runtime |
| Wrong WiFi password path | ZTE vs others | Password not set, silent failure | Use `KeyPassphrase` for ZTE, `PreSharedKey.1.KeyPassphrase` for others |
| Hardcoded WLAN instances | Huawei | Wrong radio configured or error | Discover instances with wildcards first |
| Vendor prefix mismatch | ZTE | Parameter not found errors | Try both `X_ZTE-COM_` and `X_ZTE_COM_` |
| Assuming OUI identifies Nokia | Nokia | Devices not matched | Use `ALCL`, not `Nokia`, for OUI matching |
| ISP-locked parameters | All | Fault 9001/9008 on write | Check firmware type, handle faults gracefully |
| Full tree refresh | Nokia | Session timeout, incomplete data | Refresh specific subtrees only |
| VLAN changes without reboot | ZTE, Huawei | Changes not applied | Schedule reboot task after VLAN changes |
| Boolean format mismatch | Huawei (older) | Fault 9006 on boolean set | Use `1`/`0` if `true`/`false` fails |
| Missing commit() on Nokia | Nokia | Critical params lost on session drop | Use `commit()` after critical parameter groups |

---

## Decision Matrix: Virtual Parameters vs Vendor-Specific Provisions

| Scenario | Approach | Rationale |
|----------|----------|-----------|
| WiFi SSID/password across vendors | Virtual parameters | Simple read/write, consistent interface |
| WAN PPPoE configuration | Vendor-specific provisions | Complex path differences, VLAN extensions differ |
| Optical monitoring | Vendor-specific provisions | Completely different vendor extension paths |
| VoIP configuration | Universal provision with root detection | Paths are same structure, only root differs |
| Firmware management | Vendor-specific (NBI tasks) | File naming, OUI headers are vendor-specific |
| Device tagging | Universal provision | Simple detection logic, consistent tag schema |
| VLAN configuration | Vendor-specific provisions | Vendor extension paths completely differ |

---

## Recommended Virtual Parameter Set

For a multi-vendor deployment, create these virtual parameters as a minimum abstraction layer:

| Virtual Parameter | Type | Writable | Purpose |
|-------------------|------|----------|---------|
| `wifi_ssid_2g` | string | Yes | 2.4GHz WiFi SSID |
| `wifi_ssid_5g` | string | Yes | 5GHz WiFi SSID |
| `wifi_password_2g` | string | Yes | 2.4GHz WiFi password |
| `wifi_password_5g` | string | Yes | 5GHz WiFi password |
| `wan_ip` | string | No | WAN IP address |
| `wan_status` | string | No | WAN connection status |
| `optical_rx_power` | string | No | GPON optical RX power |
| `optical_tx_power` | string | No | GPON optical TX power |
| `data_model` | string | No | "TR-098" or "TR-181" |

These virtual parameters allow the GenieACS UI to display a consistent device summary regardless of vendor, and allow universal provisions to configure basic WiFi without knowing the underlying vendor.

---

## Monitoring Dashboard Queries

Common NBI queries for multi-vendor fleet monitoring:

```bash
# All devices with critical optical power
curl -s 'http://localhost:7557/devices/?query={"Tags.optical_critical":true}'

# All Nokia TR-181 devices
curl -s 'http://localhost:7557/devices/?query={"Tags.nokia":true,"Tags.tr181":true}'

# All devices by vendor
curl -s 'http://localhost:7557/devices/?query={"Tags.vendor_huawei":true}'
curl -s 'http://localhost:7557/devices/?query={"Tags.vendor_zte":true}'
curl -s 'http://localhost:7557/devices/?query={"Tags.vendor_nokia":true}'

# Devices with active faults
curl -s 'http://localhost:7557/faults/'

# Device count by manufacturer
curl -s 'http://localhost:7557/devices/?query={"DeviceID.Manufacturer._value":"Huawei"}&projection=DeviceID' | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"
```

---

## Related Documentation

- [README.md](README.md) - Vendor guides index and quick reference
- [HUAWEI-ONT-GUIDE.md](HUAWEI-ONT-GUIDE.md) - Huawei-specific parameter paths and provisions
- [ZTE-ONT-GUIDE.md](ZTE-ONT-GUIDE.md) - ZTE-specific parameter paths and provisions
- [NOKIA-ONT-GUIDE.md](NOKIA-ONT-GUIDE.md) - Nokia/ALU-specific parameter paths and provisions
- [PROVISIONING-SPEC.md](../specs/PROVISIONING-SPEC.md) - `declare()`, `commit()`, virtual parameter API
- [NBI-API-SPEC.md](../specs/NBI-API-SPEC.md) - REST API for device and task management
