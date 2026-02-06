# GenieACS Huawei ONT Management Guide

## Overview

This guide covers the management of Huawei Optical Network Terminals (ONTs) using GenieACS. Huawei ONTs implement the TR-098 data model with `InternetGatewayDevice` as the root object. Huawei extends the standard TR-069 parameter tree with vendor-specific parameters under the `X_HW_` prefix.

**Common OUI**: `00E0FC` (used for device identification and firmware matching)

**Data Model**: TR-098 (`InternetGatewayDevice` root path)

**Vendor Extension Prefix**: `X_HW_` (Huawei-specific parameters)

GenieACS fully supports Huawei ONTs through standard CWMP/TR-069 protocol handling. The CWMP service (`lib/cwmp.ts`) processes Huawei Inform messages, executes provision scripts against the device parameter tree, and commits changes through standard TR-069 RPCs. All features described in [PROVISIONING-SPEC.md](../specs/PROVISIONING-SPEC.md) and [CWMP-SPEC.md](../specs/CWMP-SPEC.md) apply to Huawei devices.

**Related Documentation**:
- [PROVISIONING-SPEC.md](../specs/PROVISIONING-SPEC.md) - Provision script API (`declare()`, `commit()`, `ext()`)
- [NBI-API-SPEC.md](../specs/NBI-API-SPEC.md) - REST API for device management
- [SESSION-SPEC.md](../specs/SESSION-SPEC.md) - Session lifecycle and state management
- [03-PROVISIONING-SYSTEM.md](../workflow/03-PROVISIONING-SYSTEM.md) - Provisioning workflow overview

## Supported Models

The following Huawei ONT models have been tested with GenieACS. Models not listed here may also work provided they support TR-069/CWMP.

### Router Models (with NAT/WiFi)

| Model | WiFi | GPON/EPON | Ports | Notes |
|-------|------|-----------|-------|-------|
| HG8245H | 2.4GHz | GPON | 4 GE, 2 FXS, 1 USB | Most widely deployed Huawei ONT |
| HG8245Q2 | 2.4/5GHz | GPON | 4 GE, 2 FXS, 1 USB | Dual-band successor to HG8245H |
| HG8145V5 | 2.4/5GHz | GPON | 1 GE, 1 FE, 1 FXS | Budget dual-band |
| HG8546M | 2.4GHz | GPON | 1 GE, 3 FE, 1 FXS | Mid-range single-band |
| HG8247H | 2.4GHz | GPON | 4 GE, 2 FXS, CATV | With CATV port |
| EG8145V5 | 2.4/5GHz | GPON | 1 GE, 3 FE, 1 FXS | EchoLife variant |
| EG8245H5 | 2.4/5GHz | GPON | 4 GE, 2 FXS | EchoLife premium |
| EG8245W5 | 2.4/5GHz AC | GPON | 4 GE, 2 FXS | AC WiFi variant |
| HS8145V5 | 2.4/5GHz | GPON | 1 GE, 3 FE, 1 FXS | SmartAX series |
| HS8546V5 | 2.4/5GHz | GPON | 4 GE, 2 FXS, 1 USB | SmartAX premium |

### Bridge Models (no NAT/WiFi)

| Model | WiFi | GPON/EPON | Ports | Notes |
|-------|------|-----------|-------|-------|
| HG8010H | None | GPON | 1 GE | Bridge mode only |
| HG8310M | None | GPON | 1 GE | Compact bridge |

### Model Naming Convention

Huawei ONT model numbers follow a predictable pattern:

- **HG** prefix: HuaWei Gateway (standard residential series)
- **EG** prefix: EchoLife Gateway (carrier-grade series)
- **HS** prefix: SmartAX Home series
- **First two digits after prefix**: Hardware generation (81xx, 82xx, 85xx)
- **Last characters**: Variant indicator (H = standard, V5 = version 5, M = mini, W = wireless AC)

## TR-069 Parameter Paths

This section documents the key TR-069 parameter paths available on Huawei ONTs. All paths use the `InternetGatewayDevice` root object (TR-098 data model). Instance placeholders `{i}` and `{j}` indicate object instances that may vary by device configuration.

### Device Information

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `InternetGatewayDevice.DeviceInfo.Manufacturer` | string | No | Returns "Huawei" or "Huawei Technologies Co., Ltd." |
| `InternetGatewayDevice.DeviceInfo.ManufacturerOUI` | string | No | Typically "00E0FC" |
| `InternetGatewayDevice.DeviceInfo.ModelName` | string | No | Model identifier (e.g., "HG8245H") |
| `InternetGatewayDevice.DeviceInfo.SerialNumber` | string | No | Device serial number |
| `InternetGatewayDevice.DeviceInfo.HardwareVersion` | string | No | Hardware revision string |
| `InternetGatewayDevice.DeviceInfo.SoftwareVersion` | string | No | Current firmware version |
| `InternetGatewayDevice.DeviceInfo.UpTime` | uint | No | Seconds since last boot |
| `InternetGatewayDevice.DeviceInfo.ProvisioningCode` | string | Yes | ISP provisioning code |
| `InternetGatewayDevice.DeviceInfo.X_HW_WebUserPassword` | string | Yes | Web admin password (vendor extension) |

### WiFi Configuration

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `*.LANDevice.1.WLANConfiguration.{i}.Enable` | boolean | Yes | Enable or disable the radio |
| `*.LANDevice.1.WLANConfiguration.{i}.SSID` | string | Yes | Network name |
| `*.LANDevice.1.WLANConfiguration.{i}.Channel` | uint | Yes | WiFi channel number |
| `*.LANDevice.1.WLANConfiguration.{i}.BeaconType` | string | Yes | Security mode: "None", "WPA", "11i", "WPAand11i" |
| `*.LANDevice.1.WLANConfiguration.{i}.WPAEncryptionModes` | string | Yes | "TKIPEncryption", "AESEncryption", "TKIPandAESEncryption" |
| `*.LANDevice.1.WLANConfiguration.{i}.WPAAuthenticationMode` | string | Yes | "PSKAuthentication" for pre-shared key |
| `*.LANDevice.1.WLANConfiguration.{i}.PreSharedKey.1.KeyPassphrase` | string | Yes | WiFi password (WPA/WPA2 passphrase) |
| `*.LANDevice.1.WLANConfiguration.{i}.SSIDAdvertisementEnabled` | boolean | Yes | Broadcast SSID visibility |
| `*.LANDevice.1.WLANConfiguration.{i}.X_HW_WifiPowerPercent` | uint | Yes | Transmit power percentage (vendor extension) |
| `*.LANDevice.1.WLANConfiguration.{i}.Standard` | string | Yes | WiFi standard: "b", "g", "n", "ac" |

**Note**: `*` stands for `InternetGatewayDevice` throughout this section for readability.

**IMPORTANT -- WLAN Instance Numbering**: On dual-band Huawei ONTs, WLAN instance numbers are NOT necessarily sequential. The 2.4GHz radio may be instance 1, while the 5GHz radio may be instance 5 (not instance 2). This mapping varies across firmware versions. Always discover instances using wildcards before configuring specific radios. See section 5.1 for details.

### WAN Configuration

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `*.WANDevice.1.WANConnectionDevice.{i}.WANIPConnection.{j}.Enable` | boolean | Yes | Enable IP connection |
| `*.WANDevice.1.WANConnectionDevice.{i}.WANIPConnection.{j}.ExternalIPAddress` | string | No | Assigned IP address |
| `*.WANDevice.1.WANConnectionDevice.{i}.WANIPConnection.{j}.ConnectionType` | string | Yes | "IP_Routed" or "IP_Bridged" |
| `*.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.Username` | string | Yes | PPPoE username |
| `*.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.Password` | string | Yes | PPPoE password |
| `*.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.ExternalIPAddress` | string | No | PPP-assigned IP address |
| `*.WANDevice.1.WANConnectionDevice.{i}.WANPPPConnection.{j}.ConnectionStatus` | string | No | "Connected" or "Disconnected" |
| `*.WANDevice.1.WANConnectionDevice.{i}.X_HW_VLANMuxID` | int | Yes | VLAN ID (vendor extension) |

**IMPORTANT**: Huawei ONTs may have multiple `WANConnectionDevice` instances. The mapping between instances and physical WAN connections varies by model and firmware. Each VLAN typically maps to its own `WANConnectionDevice`. Do not assume that `WANConnectionDevice.1` is the internet service without verifying the connection type and VLAN assignment.

### LAN Configuration

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `*.LANDevice.1.LANHostConfigManagement.DHCPServerEnable` | boolean | Yes | DHCP server toggle |
| `*.LANDevice.1.LANHostConfigManagement.MinAddress` | string | Yes | DHCP pool start address |
| `*.LANDevice.1.LANHostConfigManagement.MaxAddress` | string | Yes | DHCP pool end address |
| `*.LANDevice.1.LANHostConfigManagement.SubnetMask` | string | Yes | LAN subnet mask |
| `*.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress` | string | Yes | LAN gateway IP address |
| `*.LANDevice.1.LANHostConfigManagement.DHCPLeaseTime` | int | Yes | DHCP lease time in seconds |

### Huawei Vendor Extensions (X_HW_)

Huawei extends the standard TR-069 data model with proprietary parameters under the `X_HW_` prefix. These parameters provide access to Huawei-specific features not covered by the TR-098 standard.

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `*.X_HW_CLIUserInfo.{i}.Username` | string | Yes | CLI/Telnet username |
| `*.X_HW_CLIUserInfo.{i}.Password` | string | Yes | CLI/Telnet password |
| `*.X_HW_CLIUserInfo.{i}.Level` | string | Yes | Access level (admin, user) |
| `*.LANDevice.1.WLANConfiguration.{i}.X_HW_WifiPowerPercent` | uint | Yes | Transmit power percentage |
| `*.LANDevice.1.WLANConfiguration.{i}.X_HW_SSIDHide` | boolean | Yes | Hide SSID from broadcast |
| `*.WANDevice.1.WANConnectionDevice.{i}.X_HW_VLANMuxID` | int | Yes | VLAN ID assignment |
| `*.WANDevice.1.WANConnectionDevice.{i}.X_HW_VLAN_CoS` | int | Yes | VLAN Class of Service priority (0-7) |

### VoIP Configuration

| Path | Type | Writable | Description |
|------|------|----------|-------------|
| `*.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServer` | string | Yes | SIP proxy server address |
| `*.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServerPort` | uint | Yes | SIP proxy port |
| `*.Services.VoiceService.1.VoiceProfile.1.SIP.RegistrarServer` | string | Yes | SIP registrar address |
| `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.AuthUserName` | string | Yes | SIP authentication username |
| `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.AuthPassword` | string | Yes | SIP authentication password |
| `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.SIP.URI` | string | Yes | SIP URI (phone number) |
| `*.Services.VoiceService.1.VoiceProfile.1.Line.{i}.Enable` | string | Yes | "Enabled" or "Disabled" |

## Provision Scripts

This section provides ready-to-use provision scripts for common Huawei ONT management tasks. All scripts use the `declare()` API documented in [PROVISIONING-SPEC.md](../specs/PROVISIONING-SPEC.md).

### WiFi Configuration

```javascript
// Provision: huawei-wifi-config
// Configure WiFi SSID and password on Huawei ONTs.
// IMPORTANT: Instance numbers may not be sequential on dual-band models.
// Always discover instances first using wildcards.

const now = Date.now();

// Discover all WLAN instances on the device
let wlanInstances = declare(
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.*",
  {path: now}
);

// Collect discovered instances into an array
let instances = [];
for (let inst of wlanInstances) {
  instances.push(inst);
}

// Configure 2.4GHz radio (typically the first discovered instance)
if (instances.length >= 1) {
  let path24 = instances[0].path;
  declare(path24 + ".Enable", {value: now}, {value: true});
  declare(path24 + ".SSID", {value: now}, {value: "MyNetwork"});
  declare(path24 + ".BeaconType", {value: now}, {value: "11i"});
  declare(path24 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
  declare(path24 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
  declare(path24 + ".PreSharedKey.1.KeyPassphrase", {value: now}, {value: "SecurePassword123"});
}

// Configure 5GHz radio if available (second discovered instance)
if (instances.length >= 2) {
  let path5 = instances[1].path;
  declare(path5 + ".Enable", {value: now}, {value: true});
  declare(path5 + ".SSID", {value: now}, {value: "MyNetwork-5G"});
  declare(path5 + ".BeaconType", {value: now}, {value: "11i"});
  declare(path5 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
  declare(path5 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
  declare(path5 + ".PreSharedKey.1.KeyPassphrase", {value: now}, {value: "SecurePassword123"});
}
```

### WAN PPPoE Configuration

```javascript
// Provision: huawei-wan-pppoe
// Configure PPPoE WAN connection on Huawei ONTs.
// Adjust WANConnectionDevice instance and VLAN to match your network design.

const now = Date.now();
const pppUser = "user@isp.com";
const pppPass = "password";
const vlanId = 100;

// Discover existing WAN connection devices
let wanConn = declare(
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.*",
  {path: now}
);

// Configure PPPoE on the first WANConnectionDevice
let connPath = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1";
declare(connPath + ".WANPPPConnection.1.Enable", {value: now}, {value: true});
declare(connPath + ".WANPPPConnection.1.Username", {value: now}, {value: pppUser});
declare(connPath + ".WANPPPConnection.1.Password", {value: now}, {value: pppPass});
declare(connPath + ".WANPPPConnection.1.ConnectionType", {value: now}, {value: "IP_Routed"});

// Set VLAN using Huawei vendor extension
declare(connPath + ".X_HW_VLANMuxID", {value: now}, {value: vlanId});
declare(connPath + ".X_HW_VLAN_CoS", {value: now}, {value: 0});
```

### WAN DHCP Configuration

```javascript
// Provision: huawei-wan-dhcp
// Configure DHCP-based WAN connection on Huawei ONTs.

const now = Date.now();
const connPath = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1";

declare(connPath + ".WANIPConnection.1.Enable", {value: now}, {value: true});
declare(connPath + ".WANIPConnection.1.ConnectionType", {value: now}, {value: "IP_Routed"});
declare(connPath + ".WANIPConnection.1.AddressingType", {value: now}, {value: "DHCP"});
```

### Firmware Upgrade

```javascript
// Provision: huawei-firmware-upgrade
// Pre/post firmware upgrade checks for Huawei ONTs.
// The actual firmware download is triggered via the NBI task API (see section 7).
// Upload the firmware file to GenieACS file server first.

const now = Date.now();

// Read current firmware version for logging
let currentFW = declare(
  "InternetGatewayDevice.DeviceInfo.SoftwareVersion",
  {value: now}
);
log("Current firmware: " + currentFW.value[0]);

// Read device model for matching
let model = declare("DeviceID.ProductClass", {value: now});
log("Device model: " + model.value[0]);

// Read hardware version for firmware compatibility check
let hwVersion = declare(
  "InternetGatewayDevice.DeviceInfo.HardwareVersion",
  {value: now}
);
log("Hardware version: " + hwVersion.value[0]);
```

### VoIP Configuration

```javascript
// Provision: huawei-voip
// Configure SIP VoIP service on Huawei ONTs.
// Supports FXS port configuration for analog phone connections.

const now = Date.now();
const sipServer = "sip.isp.com";
const sipPort = 5060;
const sipUser = "1001";
const sipPass = "sippassword";

const voipBase = "InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1";

// SIP server settings
declare(voipBase + ".SIP.ProxyServer", {value: now}, {value: sipServer});
declare(voipBase + ".SIP.ProxyServerPort", {value: now}, {value: sipPort});
declare(voipBase + ".SIP.RegistrarServer", {value: now}, {value: sipServer});
declare(voipBase + ".SIP.RegistrarServerPort", {value: now}, {value: sipPort});

// Line 1 configuration (FXS port 1)
declare(voipBase + ".Line.1.Enable", {value: now}, {value: "Enabled"});
declare(voipBase + ".Line.1.SIP.AuthUserName", {value: now}, {value: sipUser});
declare(voipBase + ".Line.1.SIP.AuthPassword", {value: now}, {value: sipPass});
declare(voipBase + ".Line.1.SIP.URI", {value: now}, {value: sipUser});
```

### Port Forwarding

```javascript
// Provision: huawei-port-forward
// Add a port forwarding rule on Huawei ONTs.
// Works with WANIPConnection (DHCP WAN). For PPPoE, use WANPPPConnection path instead.

const now = Date.now();
const natBase = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1" +
  ".WANIPConnection.1.PortMapping";

// Discover existing port mapping rules
let rules = declare(natBase + ".*", {path: now});
let nextIdx = rules.size + 1;

// Add a new port forwarding rule
let rulePath = natBase + "." + nextIdx;
declare(rulePath + ".PortMappingEnabled", {value: now}, {value: true});
declare(rulePath + ".PortMappingProtocol", {value: now}, {value: "TCP"});
declare(rulePath + ".ExternalPort", {value: now}, {value: 8080});
declare(rulePath + ".InternalPort", {value: now}, {value: 80});
declare(rulePath + ".InternalClient", {value: now}, {value: "192.168.1.100"});
declare(rulePath + ".PortMappingDescription", {value: now}, {value: "Web Server"});
```

## Vendor-Specific Quirks and Workarounds

This section documents known Huawei-specific behaviors that differ from standard TR-069 expectations. Understanding these quirks is critical for reliable device management.

### Non-Sequential WLAN Instance Numbering

On dual-band Huawei ONTs, WLAN instance numbers are often non-sequential. The 2.4GHz radio may use instance 1 while the 5GHz radio uses instance 5 (not instance 2). This mapping varies across firmware versions and ISP customizations.

**Impact**: Hardcoding instance numbers (e.g., `WLANConfiguration.1` for 2.4GHz and `WLANConfiguration.2` for 5GHz) will fail on many Huawei devices.

**Workaround**: Always discover instances using wildcards before applying configuration:

```javascript
let wlans = declare(
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.*",
  {path: Date.now()}
);
for (let w of wlans) {
  log("Found WLAN instance: " + w.path);
}
```

### ISP-Locked Firmware

Many Huawei ONTs ship with ISP-customized firmware that restricts TR-069 parameter access.

**Symptoms**:
- Parameters that should be writable return fault code 9008 (set non-writable parameter)
- Some standard TR-098 parameters are missing from the data model
- Additional vendor-specific parameters appear under the `X_HW_` namespace
- `DeviceInfo.SoftwareVersion` includes ISP-specific codes

**Identification**: Firmware version strings typically include ISP codes. For example, `V3R017C10S100` where `C10` indicates ISP customization tier. Generic firmware uses `C00` or omits the C-code entirely.

**Impact**: Provision scripts that set ISP-locked parameters will generate persistent faults in GenieACS. Filter provisions by firmware version or use try/catch patterns where possible.

### Firmware Version String Inconsistency

The value reported by `DeviceInfo.SoftwareVersion` may not match the firmware filename or the version shown in the ONT web GUI.

- Some models report the full version string (e.g., `V5R020C00S050`)
- Others report shortened versions or ISP-branded strings
- The `DeviceInfo.AdditionalSoftwareVersion` parameter, where available, may provide more detail

**Recommendation**: When building firmware upgrade logic, match on partial version strings rather than exact equality.

### Boolean Encoding

Most Huawei ONTs accept standard TR-069 boolean values (`true`/`false` or `1`/`0`). However, some older firmware versions require `1`/`0` exclusively.

**Symptom**: Fault code 9006 (invalid parameter type) when setting boolean parameters with `true`/`false`.

**Workaround**: If encountering fault 9006 on boolean parameters, switch to integer encoding (`1` for true, `0` for false).

### Multiple WANConnectionDevice Instances

Huawei ONTs with multiple WAN services (internet, IPTV, VoIP, management) create separate `WANConnectionDevice` instances for each service. Each VLAN typically maps to its own instance.

**Impact**: Assuming `WANConnectionDevice.1` is the internet connection is unreliable. Verify the correct instance by checking:
- `X_HW_VLANMuxID` for the expected VLAN ID
- `WANPPPConnection` or `WANIPConnection` existence and connection type
- `ConnectionStatus` to identify the active internet connection

### Connection Request Issues

Some Huawei ONTs behind NAT fail to respond to HTTP connection requests from GenieACS.

**Workarounds**:
- Set `PeriodicInformInterval` to 300-600 seconds as a fallback mechanism
- Enable STUN if supported: set `ManagementServer.STUNEnable` to `true`
- Verify that the ONT management VLAN has proper routing to the ACS
- NAT traversal support varies by model and firmware version

### Parameter Refresh Depth

GenieACS uses `UNDISCOVERED_DEPTH = 7` in the GPN (GetParameterNames) heuristic (`lib/gpn-heuristic.ts`). Some Huawei parameter trees, particularly vendor extensions, exceed this default depth.

**Impact**: Deep parameters may not be discovered during automatic refresh operations.

**Workaround**: Refresh specific subtrees rather than the entire root when targeting deep parameters:

```javascript
// Instead of refreshing the entire tree
declare("InternetGatewayDevice.*", {path: Date.now()});

// Refresh a specific subtree
declare(
  "InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1.*",
  {path: Date.now()}
);
```

## Troubleshooting

### ONT Not Appearing in GenieACS

When a Huawei ONT does not show up in the GenieACS device list, verify the following in order:

1. **ACS URL Configuration**: Confirm the ACS URL is set on the ONT. This can be configured through the ONT web GUI, via OMCI from the OLT, or through DHCP Option 43.
2. **Network Connectivity**: The ONT must be able to reach the GenieACS CWMP service on port 7547 (default). Test with `curl http://acs-server:7547` from a device on the same network.
3. **Firewall Rules**: Verify that no firewall is blocking traffic between the ONT and the ACS on port 7547.
4. **DHCP Option 43**: If using auto-provisioning via DHCP, verify that Option 43 is correctly configured with the ACS URL.
5. **GenieACS Logs**: Check the CWMP service logs for incoming connections: `journalctl -u genieacs-cwmp -f`
6. **Reboot After ACS URL Change**: Huawei ONTs may require a full reboot after the ACS URL is changed before the first Inform is sent.

### "Parameter does not exist" Errors

This error indicates that a provision script or NBI task is referencing a parameter path that the device does not expose.

1. Verify the parameter path exists on the specific model and firmware version.
2. Use the `refreshObject` task via NBI to re-discover the current data model.
3. Check WLAN instance numbering -- the expected instance may not exist (see section 5.1).
4. Confirm the parameter is not hidden or removed by ISP-customized firmware.

### WiFi Changes Not Taking Effect

When WiFi configuration changes applied via provision scripts do not appear on the device:

1. **Set BeaconType first**: Set `BeaconType` BEFORE setting encryption modes and passphrase. Some firmware versions ignore encryption settings if the beacon type has not been set.
2. **Set all security parameters together**: Configure all WiFi security parameters within the same provision execution to avoid partial state.
3. **Radio disable/enable cycle**: Some models require the radio to be disabled and re-enabled after security changes take effect.
4. **Verify instance number**: Confirm that the WLAN instance being configured matches the intended radio band.

### WAN Configuration Failures

1. **Correct WANConnectionDevice instance**: Verify that the WANConnectionDevice instance corresponds to the target VLAN or service type.
2. **OMCI prerequisite**: Some ONTs require WAN connections to be provisioned via OMCI from the OLT before TR-069 can modify them.
3. **PPPoE special characters**: URL-encode special characters in PPPoE credentials when setting via NBI API.
4. **Reboot after VLAN changes**: Changes to `X_HW_VLANMuxID` may require an ONT reboot before taking effect.

### Firmware Upgrade Failures

1. **Verify file upload**: Confirm the firmware file is present on the GenieACS file server: `curl -s 'http://localhost:7557/files/'`
2. **File server accessibility**: The ONT must be able to reach the file server on port 7567. Verify routing and firewall rules.
3. **Metadata matching**: The `oui` and `productClass` headers on the uploaded file must match the device `DeviceID.OUI` and `DeviceID.ProductClass` values.
4. **Hardware compatibility**: Verify that the firmware version is compatible with the ONT hardware version.
5. **Wait for TRANSFER COMPLETE**: After initiating a download task, wait for the `7 TRANSFER COMPLETE` inform event before attempting a reboot.
6. **Flash storage**: Check that the ONT has sufficient flash storage for the firmware image.

### Session Timeout During Large Operations

When configuring many parameters at once, the CWMP session may time out before all operations complete.

**Workarounds**:
- Split large configuration changes across multiple provisions with different preset channels.
- Use `commit()` between groups of related parameter sets to flush intermediate changes.
- Increase `cwmp.sessionTimeout` in GenieACS configuration if timeouts occur frequently.

### Fault Code 9001 (Request Denied)

This fault indicates the device refused a SetParameterValues or similar request.

1. The parameter may be read-only on ISP-locked firmware.
2. Clear existing faults before retrying: `curl -X DELETE 'http://localhost:7557/faults/{device_id}:default'`
3. Verify that required parent objects exist before setting child parameters.

### Common TR-069 Fault Codes

| Fault Code | Meaning | Huawei-Specific Resolution |
|-----------|---------|---------------------------|
| 9001 | Request denied | Check ISP firmware lock; parameter may be read-only |
| 9002 | Internal error | Reboot the ONT; may indicate a flash write failure |
| 9003 | Invalid arguments | Verify parameter types match TR-069 specification |
| 9005 | Invalid parameter name | Path does not exist; re-discover with refreshObject task |
| 9006 | Invalid parameter type | Try alternate boolean format: use 1/0 instead of true/false |
| 9007 | Invalid parameter value | Value is outside the allowed range for this parameter |
| 9008 | Set non-writable param | Parameter is read-only on this firmware version |

## NBI API Quick Reference

The following `curl` examples demonstrate common Huawei device management operations through the GenieACS NBI API (port 7557). Replace `<id>` with the full device ID (format: `00E0FC-ModelName-SerialNumber`).

For complete NBI API documentation, see [NBI-API-SPEC.md](../specs/NBI-API-SPEC.md).

```bash
# Find all Huawei devices
curl -s 'http://localhost:7557/devices/?query={"DeviceID.Manufacturer._value":{"$regex":"Huawei"}}'

# Reboot a device
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"reboot"}'

# Factory reset a device
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"factoryReset"}'

# Refresh the full data model
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"refreshObject","objectName":""}'

# Refresh WiFi subtree only
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"refreshObject","objectName":"InternetGatewayDevice.LANDevice.1.WLANConfiguration."}'

# Set WiFi SSID via NBI
curl -X POST 'http://localhost:7557/devices/<id>/tasks?connection_request' \
  --data '{"name":"setParameterValues","parameterValues":[["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID","NewSSID","xsd:string"]]}'

# Upload firmware file to the file server
curl -X PUT 'http://localhost:7557/files/HG8245H_V3R017C10S100.bin' \
  --data-binary @HG8245H_V3R017C10S100.bin \
  --header "fileType: 1 Firmware Upgrade Image" \
  --header "oui: 00E0FC" \
  --header "productClass: HG8245H"

# Tag a device
curl -X POST 'http://localhost:7557/devices/<id>/tags/huawei_hg8245h'

# Delete a fault
curl -X DELETE 'http://localhost:7557/faults/<id>:default'
```

## Best Practices

### Auto-Tagging on Bootstrap

Use a bootstrap provision to automatically tag Huawei devices when they first connect to GenieACS. This enables model-specific preset targeting.

```javascript
// Provision: huawei-auto-tag
// Auto-tag Huawei devices on first connect (bootstrap event).
// Attach to a preset with precondition: none (or broad match)
// and event: 0 BOOTSTRAP

const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let productClass = declare("DeviceID.ProductClass", {value: now});

if (manufacturer.value[0].indexOf("Huawei") >= 0) {
  // Apply vendor tag
  declare("Tags.huawei", null, {value: true});

  // Apply model-specific tag (sanitize for safe tag names)
  let model = productClass.value[0];
  if (model) {
    declare("Tags." + model.replace(/[^a-zA-Z0-9]/g, "_"), null, {value: true});
  }
}
```

### Preset Organization

Organize GenieACS presets for Huawei devices following these guidelines:

- **Vendor-level precondition**: Use `DeviceID.Manufacturer LIKE "%Huawei%"` to target all Huawei devices.
- **Model-specific presets**: Add `DeviceID.ProductClass = "HG8245H"` for model-targeted configurations.
- **Separate concerns**: Create distinct presets for WiFi, WAN, VoIP, and monitoring tasks. Assign each to a different channel to prevent interference.
- **Bootstrap event**: Use the `0 BOOTSTRAP` event for initial device configuration (auto-tagging, default passwords, ACS settings).
- **Periodic event**: Use the `2 PERIODIC` event for ongoing monitoring, compliance checks, and maintenance tasks.

### Performance Tips

- **Declare only what you need**: Avoid refreshing the entire device tree. Target specific subtrees to reduce session duration and device load.
- **Cached vs. fresh reads**: Use `{value: 1}` for cached parameter reads (acceptable staleness). Use `{value: Date.now()}` only when a fresh read from the device is required.
- **Periodic inform interval**: Set to 300-600 seconds for a manageable balance between responsiveness and ACS load. Lower values increase database writes and CWMP session frequency.
- **Batch related changes**: Group related parameter changes in a single provision script. Each provision executes within one CWMP session, reducing round trips.
- **Use preset channels**: Assign presets to channels (`default`, `bootstrap`, `monitoring`) to isolate critical operations from non-critical ones. A fault in one channel does not block provisions in another.
