# GenieACS WiFi Provisioning System Specification

## Overview

The WiFi Provisioning System provides dynamic, policy-driven WiFi configuration for CPE devices supporting TR-069/CWMP protocol. The system replaces vendor-specific WiFi scripts with a universal, data-model-agnostic architecture that discovers device capabilities at runtime.

**Primary Files**:
- `provisions/universal/dynamic-wifi-config.js` - Universal WiFi configuration provision
- `provisions/virtual-parameters/wifi_ssid_5g.js` - 5GHz SSID virtual parameter
- `provisions/virtual-parameters/wifi_password_5g.js` - 5GHz password virtual parameter
- `provisions/virtual-parameters/wifi_ssid_6g.js` - 6GHz SSID virtual parameter
- `provisions/virtual-parameters/wifi_password_6g.js` - 6GHz password virtual parameter
- `provisions/presets/wifi-default.json` - Default WiFi policy preset

## Architecture Principles

### Policy-Driven Configuration

**Core Principle**: All WiFi settings originate from preset JSON arguments, never hardcoded in provision source code.

**Benefits**:
- Per-plan WiFi differentiation via separate presets with tag preconditions
- Runtime policy changes without provision script modifications
- Centralized WiFi policy management through preset configuration

### Dynamic Discovery

**Runtime Detection**:
- **Data Model**: TR-181 vs TR-098 auto-detection
- **Band Discovery**: 2.4GHz, 5GHz, 6GHz identification without hardcoded instances
- **Password Paths**: Vendor-specific path resolution (ZTE vs Huawei/Nokia TR-098 differences)

**Anti-Pattern Eliminated**: No more vendor-specific WiFi scripts requiring manual instance mapping.

### Universal Vendor Support

**Single Provision**: `dynamic-wifi-config.js` replaces 4 vendor-specific scripts:
- Huawei WiFi provision (removed)
- ZTE WiFi provision (removed)
- Nokia WiFi provision (removed)
- Universal WiFi provision (superseded)

**Vendor Differences Abstracted**:
- TR-181 vs TR-098 data model variations
- Password path differences (ZTE direct KeyPassphrase vs standard PreSharedKey.1.KeyPassphrase)
- Band discovery methods (OperatingFrequencyBand vs Channel heuristics)

## Policy JSON Schema

### Structure

```json
{
  "password": "SharedPassword",
  "bands": {
    "2.4": {"ssid": "Net", "security": "wpa2", "enabled": true, "password": "Override"},
    "5":   {"ssid": "Net-5G", "security": "wpa2"},
    "6":   {"ssid": "Net-6E", "security": "wpa3"}
  }
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `password` | string | Yes | Shared password for all bands (overridable per-band) |
| `bands` | object | Yes | Band-specific configuration object |
| `bands.{2.4\|5\|6}` | object | No | Configuration for specific frequency band |
| `bands.{band}.ssid` | string | Yes | Network SSID for this band |
| `bands.{band}.security` | string | No | Security mode: `wpa2`, `wpa3`, `wpa2-wpa3` (default: `wpa2`) |
| `bands.{band}.enabled` | boolean | No | Enable/disable radio (default: `true`) |
| `bands.{band}.password` | string | No | Band-specific password override (default: shared `password`) |

### Security Modes

| Mode | TR-181 Implementation | TR-098 Implementation |
|------|----------------------|----------------------|
| `wpa2` | `ModeEnabled: "WPA2-Personal"` | `WPAAuthenticationMode: "PSKAuthentication"` |
| `wpa3` | `ModeEnabled: "WPA3-SAE"`<br>`MFPConfig: "Required"` | `WPAAuthenticationMode: "SAEAuthentication"` |
| `wpa2-wpa3` | `ModeEnabled: "WPA2-PSK-WPA3-SAE"`<br>`MFPConfig: "Optional"` | *Not supported in TR-098* |

**WiFi Alliance Mandate**: 6 GHz band always forced to WPA3-SAE regardless of policy security setting.

### Example Policies

**Single Shared Password**:
```json
{
  "password": "SecurePassword123",
  "bands": {
    "2.4": {"ssid": "MyNetwork", "security": "wpa2"},
    "5":   {"ssid": "MyNetwork-5G", "security": "wpa2"}
  }
}
```

**Per-Band Passwords**:
```json
{
  "password": "DefaultPass",
  "bands": {
    "2.4": {"ssid": "HomeNet", "security": "wpa2", "password": "2.4GHzPass"},
    "5":   {"ssid": "HomeNet-5G", "security": "wpa3", "password": "5GHzPass"},
    "6":   {"ssid": "HomeNet-6E", "security": "wpa3", "password": "6GHzPass"}
  }
}
```

**Disable 2.4GHz Band**:
```json
{
  "password": "SecurePass",
  "bands": {
    "2.4": {"ssid": "Legacy", "security": "wpa2", "enabled": false},
    "5":   {"ssid": "Modern-5G", "security": "wpa3"}
  }
}
```

## Dynamic Band Discovery

### TR-181 Discovery

**Method**: Read `Device.WiFi.Radio.*.OperatingFrequencyBand` parameter.

**Implementation** (`dynamic-wifi-config.js:140-155`):
```javascript
var radios = declare("Device.WiFi.Radio.*", {path: now});
for (var r of radios) {
  var freqBand = declare(r.path + ".OperatingFrequencyBand", {value: now});
  var bandStr = freqBand.value[0]; // e.g. "2.4GHz", "5GHz", "6GHz"

  var band = null;
  if (bandStr.indexOf("2.4") >= 0) band = "2.4";
  else if (bandStr.indexOf("6") >= 0) band = "6";
  else if (bandStr.indexOf("5") >= 0) band = "5";

  if (band && policy.bands[band]) {
    configureBand(band, policy.bands[band], r.path, true);
  }
}
```

**Band Values**: Typically `"2.4GHz"`, `"5GHz"`, `"6GHz"` (vendor variations handled by substring matching).

### TR-098 Discovery

**Method**: Heuristic analysis of `Channel` and `PossibleChannels` parameters.

**Channel Classification Algorithm** (`dynamic-wifi-config.js:41-65`):
```javascript
function classifyBandTR098(channelVal, possibleStr) {
  // Step 1: Parse PossibleChannels string (e.g. "1-11", "36,40,44,48")
  var maxCh = 0;
  var parts = possibleStr.replace(/;/g, ",").split(",");
  for (var p = 0; p < parts.length; p++) {
    var segment = parts[p].trim();
    var rangeParts = segment.split("-");
    var val = parseInt(rangeParts[rangeParts.length - 1], 10) || 0;
    if (val > maxCh) maxCh = val;
  }

  // Step 2: Classify by maximum channel
  if (maxCh > 177) return "6";    // 6 GHz: channels 1-233
  if (maxCh > 14) return "5";     // 5 GHz: channels 36-177
  if (maxCh > 0) return "2.4";    // 2.4 GHz: channels 1-14

  // Step 3: Fallback to current channel value
  var ch = parseInt(channelVal, 10) || 0;
  if (ch > 177) return "6";
  if (ch >= 36) return "5";
  if (ch > 0 && ch <= 14) return "2.4";

  return null;
}
```

**Channel Ranges**:
| Band | Channel Range | Example PossibleChannels |
|------|--------------|-------------------------|
| 2.4 GHz | 1-14 | `"1-13"`, `"1,6,11"` |
| 5 GHz | 36-177 | `"36,40,44,48"`, `"100-140"` |
| 6 GHz | 1-233 (>177) | `"1,5,9,13,17,21,25,29,33,37"` |

**Implementation** (`dynamic-wifi-config.js:158-172`):
```javascript
var wlans = declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.*", {path: now});
for (var w of wlans) {
  var channel = declare(w.path + ".Channel", {value: now});
  var possible = declare(w.path + ".PossibleChannels", {value: now});

  var chVal = channel.value ? channel.value[0] : 0;
  var possStr = possible.value ? possible.value[0] : "";
  var band = classifyBandTR098(chVal, possStr);

  if (band && policy.bands[band]) {
    configureBand(band, policy.bands[band], w.path, false);
  }
}
```

## Password Path Resolution

### TR-181 Password Path

**Standard Path**: `Device.WiFi.AccessPoint.{i}.Security.KeyPassphrase`

**Implementation** (`dynamic-wifi-config.js:92-94`):
```javascript
function setPasswordTR181(apPath, password) {
  declare(apPath + ".Security.KeyPassphrase", {value: now}, {value: password});
}
```

**Example**: `Device.WiFi.AccessPoint.1.Security.KeyPassphrase`

### TR-098 Password Paths

**Vendor Variations**:

| Vendor | Path Pattern | Example |
|--------|-------------|---------|
| Huawei, Nokia | `WLANConfiguration.{i}.PreSharedKey.1.KeyPassphrase` | `IGD.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase` |
| ZTE | `WLANConfiguration.{i}.KeyPassphrase` | `IGD.LANDevice.1.WLANConfiguration.1.KeyPassphrase` |

**Auto-Detection Implementation** (`dynamic-wifi-config.js:96-108`):
```javascript
function setPasswordTR098(wlanPath, password) {
  // Try ZTE-style first (KeyPassphrase directly on WLANConfiguration)
  var kp = declare(wlanPath + ".KeyPassphrase", {value: now});
  if (kp.size) {
    declare(wlanPath + ".KeyPassphrase", {value: now}, {value: password});
    return;
  }

  // Standard path (Huawei, Nokia TR-098)
  var psk = declare(wlanPath + ".PreSharedKey.1.KeyPassphrase", {value: now});
  if (psk.size) {
    declare(wlanPath + ".PreSharedKey.1.KeyPassphrase", {value: now}, {value: password});
  }
}
```

**Detection Logic**: Attempt ZTE path first, fallback to standard path if ZTE path returns zero size.

## Security Configuration

### TR-181 Security Implementation

**Parameters**:
- `Device.WiFi.AccessPoint.{i}.Security.ModeEnabled`
- `Device.WiFi.AccessPoint.{i}.Security.MFPConfig` (Management Frame Protection)

**Implementation** (`dynamic-wifi-config.js:68-79`):
```javascript
function applySecurityTR181(apPath, securityMode) {
  if (securityMode === "wpa3") {
    declare(apPath + ".Security.ModeEnabled", {value: now}, {value: "WPA3-SAE"});
    declare(apPath + ".Security.MFPConfig", {value: now}, {value: "Required"});
  } else if (securityMode === "wpa2-wpa3") {
    declare(apPath + ".Security.ModeEnabled", {value: now}, {value: "WPA2-PSK-WPA3-SAE"});
    declare(apPath + ".Security.MFPConfig", {value: now}, {value: "Optional"});
  } else {
    // Default: wpa2
    declare(apPath + ".Security.ModeEnabled", {value: now}, {value: "WPA2-Personal"});
  }
}
```

**MFPConfig Values**:
- WPA3-SAE: `"Required"` (WPA3 mandates management frame protection)
- WPA2-PSK-WPA3-SAE: `"Optional"` (compatibility mode)
- WPA2-Personal: Not set (legacy devices)

### TR-098 Security Implementation

**Parameters**:
- `WLANConfiguration.{i}.BeaconType` - Set to `"11i"` (WPA2/WPA3)
- `WLANConfiguration.{i}.WPAEncryptionModes` - Set to `"AESEncryption"`
- `WLANConfiguration.{i}.WPAAuthenticationMode` - `"PSKAuthentication"` or `"SAEAuthentication"`

**Implementation** (`dynamic-wifi-config.js:81-89`):
```javascript
function applySecurityTR098(wlanPath, securityMode) {
  declare(wlanPath + ".BeaconType", {value: now}, {value: "11i"});
  declare(wlanPath + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});

  if (securityMode === "wpa3") {
    declare(wlanPath + ".WPAAuthenticationMode", {value: now}, {value: "SAEAuthentication"});
  } else {
    declare(wlanPath + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
  }
}
```

**BeaconType Values**:
- `"11i"`: WPA2/WPA3 (IEEE 802.11i security)
- `"WPA"`: Legacy WPA (not used)
- `"Basic"`: Open network (not used)

**Limitation**: TR-098 does not support WPA2-WPA3 mixed mode (`wpa2-wpa3` policy treated as `wpa2`).

### 6 GHz Security Enforcement

**WiFi Alliance Mandate**: 6 GHz band (WiFi 6E) requires WPA3-SAE minimum security.

**Implementation** (`dynamic-wifi-config.js:112-114`):
```javascript
function configureBand(band, bandConfig, path, isTR181Path) {
  // Enforce WPA3 on 6 GHz (WiFi Alliance mandate)
  var security = bandConfig.security || "wpa2";
  if (band === "6") security = "wpa3";
  // ...
}
```

**Behavior**: Policy-specified security mode overridden to `wpa3` for 6 GHz band regardless of preset configuration.

## Virtual Parameters

### Purpose

Provide vendor-agnostic read/write access to WiFi settings via GenieACS virtual parameters.

### Implementation Pattern

**Common Structure**:
1. Band classification helper function (TR-098)
2. TR-181 discovery loop (search for specific band in `OperatingFrequencyBand`)
3. TR-098 discovery loop (classify band via channel heuristic)
4. Read or write based on `args[1].value` presence
5. Return `{writable: true, value: [data, "xsd:string"]}`

### wifi_ssid_5g / wifi_password_5g

**Files**:
- `provisions/virtual-parameters/wifi_ssid_5g.js`
- `provisions/virtual-parameters/wifi_password_5g.js`

**Discovery Logic** (excerpt from `wifi_ssid_5g.js:32-54`):
```javascript
// TR-181: Find radio where OperatingFrequencyBand contains "5" but not "2"
let radios = declare("Device.WiFi.Radio.*", {path: now});
for (let r of radios) {
  let fb = declare(r.path + ".OperatingFrequencyBand", {value: now});
  if (fb.value && fb.value[0] && fb.value[0].indexOf("5") >= 0 && fb.value[0].indexOf("2") < 0) {
    found181 = r.path.split(".")[3];  // Extract instance number
    break;
  }
}

// TR-098: Find WLANConfiguration where band classification returns "5"
let wlans = declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.*", {path: now});
for (let w of wlans) {
  let ch = declare(w.path + ".Channel", {value: now});
  let poss = declare(w.path + ".PossibleChannels", {value: now});
  if (classifyBand(ch.value[0], poss.value[0]) === "5") {
    found098 = w.path;
    break;
  }
}
```

**Read/Write Logic**:
- **Read**: If `args[1].value` is null/undefined, return current parameter value
- **Write**: If `args[1].value` exists, set new value via `declare()` and return new value

**Password Path Resolution**: `wifi_password_5g.js` uses same auto-detection as main provision (ZTE vs standard).

### wifi_ssid_6g / wifi_password_6g

**Files**:
- `provisions/virtual-parameters/wifi_ssid_6g.js`
- `provisions/virtual-parameters/wifi_password_6g.js`

**Discovery Differences**:
- **TR-181**: Match `OperatingFrequencyBand` containing `"6"`
- **TR-098**: `classifyBand()` returns `"6"` for channels > 177

**No 6 GHz Support Behavior**: Returns empty string `""` if no 6 GHz radio found (backward compatibility).

### Legacy Parameters (wifi_ssid_2g / wifi_password_2g)

**Files**:
- `provisions/virtual-parameters/wifi_ssid_2g.js` (existing)
- `provisions/virtual-parameters/wifi_password_2g.js` (existing)

**Implementation**: Hardcoded instance 1 assumption (universally 2.4 GHz across all vendors).

**Rationale**: 2.4 GHz band consistently mapped to instance 1 in both TR-181 and TR-098 data models.

**Not Refactored**: Retained for backward compatibility and simplicity (no discovery overhead needed).

## Preset Configuration

### Structure

**File**: `provisions/presets/wifi-default.json`

```json
{
  "weight": 10,
  "channel": "wifi",
  "events": {"2 PERIODIC": true},
  "precondition": "",
  "configurations": [{
    "type": "provision",
    "name": "dynamic-wifi-config",
    "args": ["JSON_POLICY_STRING"]
  }]
}
```

### Field Definitions

| Field | Value | Description |
|-------|-------|-------------|
| `weight` | `10` | Preset priority (lower = higher priority) |
| `channel` | `"wifi"` | Logical grouping for presets |
| `events` | `{"2 PERIODIC": true}` | Triggered on periodic inform events |
| `precondition` | `""` | Empty = applies to all devices |
| `configurations[0].type` | `"provision"` | Configuration type |
| `configurations[0].name` | `"dynamic-wifi-config"` | Provision script name |
| `configurations[0].args[0]` | JSON string | Policy JSON as string |

**Critical Note**: NBI API stores provisions in `configurations` array, NOT `provisions` key.

### Event Matching

**Event Code**: `"2 PERIODIC"` (periodic inform event from TR-069 spec)

**Simulator Compatibility**: `genieacs-sim` only sends `"2 PERIODIC"`, never `"0 BOOTSTRAP"`.

**Preset Events Are AND**: `{"0 BOOTSTRAP": true, "2 PERIODIC": true}` requires BOTH events in Inform EventCodes array. See `lib/cwmp.ts:454-462` for event matching implementation.

**Best Practice**: Use `{"2 PERIODIC": true}` for universal device compatibility.

### Per-Plan Differentiation

**Strategy**: Create multiple presets with tag-based preconditions.

**Example**:

**Preset: wifi-premium.json**
```json
{
  "weight": 5,
  "channel": "wifi",
  "events": {"2 PERIODIC": true},
  "precondition": "Tags.plan_premium",
  "configurations": [{
    "type": "provision",
    "name": "dynamic-wifi-config",
    "args": ["{\"password\":\"PremiumPass\",\"bands\":{\"2.4\":{\"ssid\":\"Premium\"},\"5\":{\"ssid\":\"Premium-5G\"},\"6\":{\"ssid\":\"Premium-6E\",\"security\":\"wpa3\"}}}"]
  }]
}
```

**Preset: wifi-basic.json**
```json
{
  "weight": 10,
  "channel": "wifi",
  "events": {"2 PERIODIC": true},
  "precondition": "Tags.plan_basic",
  "configurations": [{
    "type": "provision",
    "name": "dynamic-wifi-config",
    "args": ["{\"password\":\"BasicPass\",\"bands\":{\"2.4\":{\"ssid\":\"Basic\"},\"5\":{\"ssid\":\"Basic-5G\"}}}"]
  }]
}
```

**Preset: wifi-fallback.json** (no 6 GHz for basic plans)
```json
{
  "weight": 15,
  "channel": "wifi",
  "events": {"2 PERIODIC": true},
  "precondition": "",
  "configurations": [{
    "type": "provision",
    "name": "dynamic-wifi-config",
    "args": ["{\"password\":\"DefaultPass\",\"bands\":{\"2.4\":{\"ssid\":\"Default\"},\"5\":{\"ssid\":\"Default-5G\"}}}"]
  }]
}
```

**Weight Order**: Premium (5) → Basic (10) → Fallback (15). Lower weight = higher priority.

## Auto-Tagging System

### Purpose

Automatically assign vendor, data model, and device model tags to CPE devices for preset precondition targeting.

### File

`provisions/universal/universal-auto-tag.js`

### Vendor Alias Map

**Extensibility Pattern**: Add new vendor with single line in alias map.

**Implementation** (`universal-auto-tag.js:8-17`):
```javascript
var VENDOR_ALIASES = {
  "huawei": "huawei",
  "zte": "zte",
  "nokia": "nokia",
  "alcl": "nokia",    // Alcatel-Lucent → Nokia
  "alu": "nokia",     // ALU → Nokia
  "fiberhome": "fiberhome",
  "tp-link": "tplink",
  "dasan": "dasan"
};
```

**Matching Logic**: Case-insensitive substring match against `DeviceID.Manufacturer`.

**Tags Applied**: Both canonical vendor name and `vendor_` prefixed tag.

**Example**: Manufacturer `"ALCATEL"` → Tags: `nokia`, `vendor_nokia`

### Data Model Detection

**Implementation** (`universal-auto-tag.js:40-46`):
```javascript
var tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});
if (tr181.size > 0) {
  declare("Tags.tr181", null, {value: true});
} else {
  declare("Tags.tr098", null, {value: true});
}
```

**Detection Method**: Probe for TR-181 root `Device.` namespace. Size > 0 = TR-181, else TR-098.

**Applied to ALL Vendors**: Not just Nokia (improvement over legacy vendor-specific scripts).

### Model-Specific Tag

**Implementation** (`universal-auto-tag.js:48-52`):
```javascript
var model = productClass.value[0];
if (model) {
  declare("Tags." + model.replace(/[^a-zA-Z0-9]/g, "_"), null, {value: true});
}
```

**Source**: `DeviceID.ProductClass` parameter value.

**Sanitization**: Non-alphanumeric characters replaced with underscores.

**Example**: ProductClass `"HG8245H"` → Tag: `HG8245H`

### Tag Application API

**Method**: `declare("Tags.{name}", null, {value: true})`

**Implementation Detail**: Saved via `$addToSet._tags` in `lib/cwmp/db.ts:354-374` (MongoDB array operation).

**Critical**: Second parameter must be `null`, third parameter object with `value: true`.

## Sandbox Performance

### Execution Constraints

**Timeout**: 50ms per iteration (enforced by `lib/sandbox.ts`)

**Max Iterations**: 32 iterations before forced termination

**Timestamp Source**: `Date.now()` returns `sessionContext.timestamp`, not real clock time (deterministic execution)

### Performance Profile

**Dynamic WiFi Provision**:
- **Average Iterations**: 4-6 iterations
- **Breakdown**:
  - Iteration 1: Data model detection, band discovery declarations
  - Iteration 2-3: Band classification, parameter path probes
  - Iteration 4-5: SSID, security, password declarations
  - Iteration 6: Final commit (if needed)
- **Well Within Limits**: Peak ~6 iterations << 32 max

**Virtual Parameters (5GHz/6GHz)**:
- **Average Iterations**: 3-4 iterations
- **Breakdown**:
  - Iteration 1: Band discovery declarations
  - Iteration 2: Classification logic
  - Iteration 3: Read/write parameter declaration
  - Iteration 4: Return value (if needed)

**Auto-Tagging**:
- **Average Iterations**: 2 iterations
- **Breakdown**:
  - Iteration 1: Manufacturer, ProductClass, TR-181 probe
  - Iteration 2: Tag declarations

### Optimization Techniques

**Batch Declarations**: Group related `declare()` calls to minimize iteration count.

**Early Exit**: Check for missing policy/args before expensive operations.

**Shared Helpers**: Band classification function reused across virtual parameters (code reuse, not execution optimization).

## Simulator Support

### Existing TR-098 Simulators

**Updated Files**:
- `simulators/huawei-hg8245h.csv`
- `simulators/zte-zxhn-f660.csv`
- `simulators/nokia-g240wa.csv`

**Addition**: `WLANConfiguration.9` instance with 6 GHz configuration:
- `Channel: 37` (6 GHz range)
- `PossibleChannels: "1,5,9,13,17,21,25,29,33,37"` (6 GHz channels)
- `SSID: "Simulator-6E"`
- `Enable: true`

**Total Instances**: 9 WLANConfiguration instances (1-9) per simulator.

### New TR-181 Simulator

**File**: `simulators/nokia-xs2426g.csv`

**Model**: Nokia XS-2426G-A (WiFi 6E tri-band ONT)

**Data Model**: TR-181 Device.2 compliant

**WiFi Configuration**:
- `Device.WiFi.Radio.1`: 2.4 GHz (`OperatingFrequencyBand: "2.4GHz"`)
- `Device.WiFi.Radio.2`: 5 GHz (`OperatingFrequencyBand: "5GHz"`)
- `Device.WiFi.Radio.3`: 6 GHz (`OperatingFrequencyBand: "6GHz"`)

**Instances**: Matching `SSID.{1-3}` and `AccessPoint.{1-3}` instances.

**Purpose**: Test TR-181 6 GHz discovery and WPA3 enforcement.

### Simulator Infrastructure

**Base Image**: `genieacs-sim` from `github.com/zaidka/genieacs-sim`

**Docker Compose**: `docker-compose.simulator.yml`

**Network**: Uses shared `genieacs_default` network (external reference to main compose network)

**Device Count**: 11 total simulated devices:
- 3x Huawei HG8245H (TR-098)
- 3x ZTE ZXHN F660 (TR-098)
- 3x Nokia G-240W-A (TR-098)
- 2x Nokia XS-2426G-A (TR-181, new)

**No Cross-Compose depends_on**: Cannot use `depends_on` across compose files. Use external named networks for DNS resolution instead.

## Migration from Legacy System

### Replaced Components

**Removed Provisions**:
1. `provisions/huawei/configure-wifi.js` (vendor-specific)
2. `provisions/zte/configure-wifi.js` (vendor-specific)
3. `provisions/nokia/configure-wifi.js` (vendor-specific)
4. `provisions/universal/configure-wifi.js` (non-dynamic predecessor)

**Removed Presets**:
1. `provisions/presets/huawei-wifi.json`
2. `provisions/presets/zte-wifi.json`
3. `provisions/presets/nokia-wifi.json`
4. `provisions/presets/universal-wifi.json`

**Total Removal**: 8 files eliminated (4 provisions + 4 presets)

### New Components

**Added Provisions**:
1. `provisions/universal/dynamic-wifi-config.js` (single universal replacement)
2. `provisions/virtual-parameters/wifi_ssid_5g.js`
3. `provisions/virtual-parameters/wifi_password_5g.js`
4. `provisions/virtual-parameters/wifi_ssid_6g.js`
5. `provisions/virtual-parameters/wifi_password_6g.js`
6. `provisions/universal/universal-auto-tag.js` (extensible vendor tagging)

**Added Presets**:
1. `provisions/presets/wifi-default.json` (universal policy-driven preset)

**Total Addition**: 7 files (6 provisions + 1 preset)

### Net Reduction

**Before**: 8 vendor-specific files
**After**: 7 universal files
**Net**: -1 file, but:
- Eliminated vendor coupling
- Added 6 GHz support
- Added 4 new virtual parameters
- Enabled policy-driven differentiation
- Improved auto-tagging extensibility

## Lessons Learned

### Preset Event Matching

**Discovery**: Preset events are AND-combined, not OR-combined.

**Implementation**: `lib/cwmp.ts:454-462` checks ALL specified events present in Inform EventCodes.

**Example**:
```json
{"0 BOOTSTRAP": true, "2 PERIODIC": true}
```
Requires BOTH `"0 BOOTSTRAP"` AND `"2 PERIODIC"` in device Inform event list.

**Best Practice**: Use single event `{"2 PERIODIC": true}` for maximum compatibility.

### Simulator Bootstrap Limitation

**Discovery**: `genieacs-sim` never sends `"0 BOOTSTRAP"` event.

**Behavior**: Only sends `"2 PERIODIC"` on periodic inform intervals.

**Impact**: Presets requiring bootstrap event will never match simulator devices.

**Workaround**: Use `{"2 PERIODIC": true}` for simulator-compatible testing.

### NBI Preset Field Name

**Discovery**: Provisions stored in `configurations` array in NBI API, NOT `provisions` key.

**Incorrect**:
```json
{"provisions": [{"type": "provision", "name": "script"}]}
```

**Correct**:
```json
{"configurations": [{"type": "provision", "name": "script"}]}
```

**Source**: NBI API spec and observed behavior.

### Sandbox Date.now()

**Discovery**: `Date.now()` returns `sessionContext.timestamp` (session start time), not real-time clock.

**Implication**: All `declare()` timestamp parameters use same session timestamp value.

**Benefit**: Deterministic execution, reproducible provision results.

### Tag Declaration Syntax

**Discovery**: Tags applied via `declare("Tags.{name}", null, {value: true})`.

**Critical Details**:
- Second parameter MUST be `null` (not `{value: now}`)
- Third parameter object with `value: true` (boolean, not timestamp)
- Saved via `$addToSet._tags` MongoDB operation (`lib/cwmp/db.ts:354-374`)

**Example**:
```javascript
declare("Tags.vendor_nokia", null, {value: true});  // Correct
declare("Tags.vendor_nokia", {value: now}, {value: true});  // Wrong
```

### Password Path Auto-Detection

**Discovery**: ZTE uses `WLANConfiguration.{i}.KeyPassphrase`, NOT `PreSharedKey.1.KeyPassphrase`.

**Solution**: Probe for ZTE path first (size check), fallback to standard path.

**Lesson**: Always probe before assuming parameter paths, even within same data model (TR-098).

### SSID Validation Guard

**Discovery**: If a band config object has no `ssid` field (e.g., `"5": {}`), the provision would
call `declare(path + ".SSID", {value: now}, {value: undefined})`, creating an invalid set operation.

**Solution**: `configureBand()` returns early if `!bandConfig.ssid`, skipping bands with incomplete config.

**Lesson**: Always validate policy inputs before passing to `declare()` set operations.

### TR-098 WPA2-WPA3 Mixed Mode

**Discovery**: TR-098 `WPAAuthenticationMode` only supports `PSKAuthentication` and `SAEAuthentication`.
There is no standard value for WPA2-WPA3 mixed mode in TR-098.

**Behavior**: When policy specifies `"wpa2-wpa3"`, TR-098 devices gracefully degrade to WPA2 (PSK).
TR-181 devices correctly receive `WPA2-PSK-WPA3-SAE` mixed mode via `Security.ModeEnabled`.

**Lesson**: Document asymmetric feature support between TR-098 and TR-181 data models.

### Channel-Only Band Classification Ambiguity

**Discovery**: 6GHz channels 1-177 numerically overlap with 2.4GHz (1-13) and 5GHz (36-165) channels.
Without `PossibleChannels`, channel 37 could be either 5GHz or 6GHz.

**Solution**: PossibleChannels-based detection is authoritative (max > 177 → 6GHz). Channel-only
fallback defaults to 2.4/5GHz for ambiguous channels, as 6GHz-only devices are rare.

**Impact**: Only affects devices that don't report `PossibleChannels` — extremely rare in practice.

### Preset Weight and Precondition Overlap

**Discovery**: Multiple presets with the same `channel` can match the same device. The provision runs
once per matching preset with different args. The last execution's values win.

**Solution**: Per-plan presets (e.g., premium) use higher weight (20) than the default (10) to ensure
their configuration overwrites the default when both match.

**Lesson**: Always consider preset overlap when creating per-plan WiFi tiers.

## Future Enhancements

### Policy Enhancements

**Channel Selection**:
- Add `channel` field to band configuration
- Support auto-channel selection vs fixed channel
- DFS (Dynamic Frequency Selection) awareness for 5 GHz

**Bandwidth Configuration**:
- Add `bandwidth` field: `20`, `40`, `80`, `160` MHz
- Default based on band (2.4: 20/40, 5: 80/160, 6: 160)

**Advanced Security**:
- WPA3-Enterprise support
- 802.1X authentication configuration
- RADIUS server integration

**VLAN Tagging**:
- Per-SSID VLAN assignment
- Multi-SSID support (guest networks)

### Virtual Parameters

**Additional VPs**:
- `wifi_channel_2g`, `wifi_channel_5g`, `wifi_channel_6g`
- `wifi_bandwidth_2g`, `wifi_bandwidth_5g`, `wifi_bandwidth_6g`
- `wifi_clients_2g`, `wifi_clients_5g`, `wifi_clients_6g` (read-only)
- `wifi_tx_power_2g`, `wifi_tx_power_5g`, `wifi_tx_power_6g`

**Aggregate VPs**:
- `wifi_total_clients` (sum across all bands)
- `wifi_enabled_bands` (JSON array: `["2.4", "5", "6"]`)

### Multi-SSID Support

**Policy Schema Extension**:
```json
{
  "password": "DefaultPass",
  "bands": {
    "2.4": {
      "ssids": [
        {"name": "Primary", "security": "wpa2", "password": "Pass1"},
        {"name": "Guest", "security": "wpa2", "password": "Pass2", "guest": true}
      ]
    }
  }
}
```

**Implementation**:
- Iterate over multiple SSID instances per radio
- Map guest networks to separate VLANs
- Bandwidth/client limits per SSID

### Vendor Extensions

**Vendor-Specific Features**:
- Huawei WiFi Optimizer toggles
- Nokia SmartConnect (band steering)
- ZTE Beamforming configuration

**Implementation Pattern**:
- Separate optional provision: `vendor-specific-wifi-{vendor}.js`
- Precondition: `Tags.vendor_{vendor}`
- Called AFTER universal provision

**Preserves Universality**: Core provision remains vendor-agnostic.

## Testing Recommendations

### Unit Testing

**Band Classification**:
- Test all channel ranges (1-14, 36-177, 178-233)
- Test PossibleChannels parsing (ranges, comma-separated, semicolon-delimited)
- Test edge cases (empty strings, invalid formats)

**Password Path Resolution**:
- Mock ZTE data model (direct KeyPassphrase)
- Mock Huawei/Nokia data model (PreSharedKey.1.KeyPassphrase)
- Test fallback behavior

**Security Mode Application**:
- Verify WPA2, WPA3, WPA2-WPA3 parameter settings
- Verify 6 GHz WPA3 enforcement
- Test TR-181 vs TR-098 differences

### Integration Testing

**Multi-Vendor Validation**:
- Deploy `wifi-default.json` preset to all 11 simulator devices
- Verify band discovery across TR-098 (Huawei, ZTE, Nokia) and TR-181 (Nokia XS-2426G)
- Validate SSID, password, security settings via NBI API parameter reads

**Virtual Parameter Testing**:
- Read `wifi_ssid_5g`, `wifi_password_5g` from all devices
- Read `wifi_ssid_6g`, `wifi_password_6g` (expect "" for non-6E devices)
- Write new values, verify persistence via session replay

**Policy Variation Testing**:
- Test single-band policies (2.4 only)
- Test dual-band policies (2.4 + 5)
- Test tri-band policies (2.4 + 5 + 6)
- Test per-band password overrides
- Test disabled bands (`enabled: false`)

### Performance Testing

**Iteration Count Monitoring**:
- Log iteration count for each provision execution
- Verify all provisions complete within 6 iterations
- Test worst-case: 9 WLAN instances (TR-098 simulators)

**Timeout Testing**:
- Artificially slow sandbox (stub `declare()` with delays)
- Verify graceful handling of 50ms timeout
- Ensure no partial configurations applied

### Regression Testing

**Legacy Device Compatibility**:
- Test devices with only 2.4 GHz (policy with 5/6 should not fail)
- Test devices with only 2.4 + 5 GHz (6 GHz policy should not fail)
- Test TR-098 devices without SAEAuthentication support (WPA3 fallback)

**Event Matching**:
- Verify preset matches on `"2 PERIODIC"` inform
- Verify preset does NOT match on `"1 BOOT"` inform (if precondition specified)

## Appendix: Data Model Reference

### TR-181 WiFi Parameters

**Radio Parameters**:
```
Device.WiFi.Radio.{i}.Enable
Device.WiFi.Radio.{i}.OperatingFrequencyBand
Device.WiFi.Radio.{i}.Channel
Device.WiFi.Radio.{i}.OperatingChannelBandwidth
Device.WiFi.Radio.{i}.TransmitPower
```

**SSID Parameters**:
```
Device.WiFi.SSID.{i}.Enable
Device.WiFi.SSID.{i}.SSID
Device.WiFi.SSID.{i}.LowerLayers
```

**AccessPoint Parameters**:
```
Device.WiFi.AccessPoint.{i}.Enable
Device.WiFi.AccessPoint.{i}.SSIDReference
Device.WiFi.AccessPoint.{i}.Security.ModeEnabled
Device.WiFi.AccessPoint.{i}.Security.KeyPassphrase
Device.WiFi.AccessPoint.{i}.Security.MFPConfig
```

### TR-098 WiFi Parameters

**WLANConfiguration Parameters**:
```
InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.Enable
InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.SSID
InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.Channel
InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.PossibleChannels
InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.BeaconType
InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.WPAEncryptionModes
InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.WPAAuthenticationMode
InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.KeyPassphrase  // ZTE
InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.PreSharedKey.{i}.KeyPassphrase  // Huawei/Nokia
```

### WiFi Channel Allocations

**2.4 GHz (IEEE 802.11b/g/n/ax)**:
- Channels: 1-14
- Bandwidth: 20 MHz, 40 MHz
- Regions: Channel 14 Japan-only

**5 GHz (IEEE 802.11a/n/ac/ax)**:
- Channels: 36-177 (varies by region)
- UNII-1: 36, 40, 44, 48
- UNII-2A: 52, 56, 60, 64
- UNII-2C: 100-144 (DFS required)
- UNII-3: 149-165
- Bandwidth: 20, 40, 80, 160 MHz

**6 GHz (IEEE 802.11ax/be - WiFi 6E/7)**:
- Channels: 1-233 (6 GHz numbering)
- U-NII-5: 1-93
- U-NII-6: 97-113
- U-NII-7: 117-185
- U-NII-8: 189-233
- Bandwidth: 20, 40, 80, 160, 320 MHz
- WPA3 mandatory

## Appendix: Implementation Files

### Provision Scripts

**dynamic-wifi-config.js** (179 lines):
- Policy parsing and validation
- Data model detection (TR-181 vs TR-098)
- Band discovery (OperatingFrequencyBand vs Channel heuristic)
- Security configuration (WPA2/WPA3)
- Password path resolution (ZTE vs standard)
- Band configuration application

**wifi_ssid_5g.js** (76 lines):
- Band classification helper
- TR-181 5GHz radio discovery
- TR-098 5GHz WLAN discovery
- Read/write SSID parameter

**wifi_password_5g.js** (89 lines):
- Band classification helper
- TR-181 5GHz radio discovery
- TR-098 5GHz WLAN discovery
- Password path auto-detection
- Read/write password parameter

**wifi_ssid_6g.js** (76 lines):
- Band classification helper (6 GHz: channels > 177)
- TR-181 6GHz radio discovery
- TR-098 6GHz WLAN discovery
- Read/write SSID parameter
- Returns "" if no 6 GHz support

**wifi_password_6g.js** (89 lines):
- Band classification helper
- TR-181 6GHz radio discovery
- TR-098 6GHz WLAN discovery
- Password path auto-detection
- Read/write password parameter
- Returns "" if no 6 GHz support

**universal-auto-tag.js** (53 lines):
- Vendor alias map (extensible)
- Manufacturer substring matching
- Data model detection (ALL vendors)
- ProductClass model-specific tag
- Tag application via declare()

### Preset Files

**wifi-default.json** (12 lines):
- Weight: 10
- Event: `"2 PERIODIC"`
- Precondition: empty (all devices)
- Configuration: `dynamic-wifi-config` provision
- Args: JSON policy string (tri-band example)

### Simulator Files

**huawei-hg8245h.csv** (~500 lines):
- TR-098 data model
- 9 WLANConfiguration instances (added instance 9 for 6 GHz)
- ProductClass: HG8245H

**zte-zxhn-f660.csv** (~500 lines):
- TR-098 data model
- 9 WLANConfiguration instances
- ZTE-specific KeyPassphrase path
- ProductClass: ZXHN F660

**nokia-g240wa.csv** (~500 lines):
- TR-098 data model
- 9 WLANConfiguration instances
- Standard PreSharedKey.1.KeyPassphrase path
- ProductClass: G-240W-A

**nokia-xs2426g.csv** (~800 lines, new):
- TR-181 Device.2 data model
- 3 Radio instances (2.4, 5, 6 GHz)
- 3 SSID instances
- 3 AccessPoint instances
- ProductClass: XS-2426G-A
- Manufacturer: Nokia

## Appendix: Key Code References

**Session Event Matching** (`lib/cwmp.ts:454-462`):
```typescript
// Preset events are AND-combined
for (const eventCode of Object.keys(preset.events)) {
  if (!inform.eventCodes.includes(eventCode)) {
    return false;  // All specified events must be present
  }
}
```

**Tag Storage** (`lib/cwmp/db.ts:354-374`):
```typescript
// Tags saved via MongoDB $addToSet operation
if (path.startsWith("Tags.")) {
  const tag = path.slice(5);
  update.$addToSet = update.$addToSet || {};
  update.$addToSet._tags = tag;
}
```

**Sandbox Timeout** (`lib/sandbox.ts:18`):
```typescript
const context = vm.createContext(undefined, { microtaskMode: "afterEvaluate" });
// Execution timeout: 50ms per iteration
```

**Deferred Execution** (`lib/sandbox.ts`):
```typescript
// When data access requires device fetch, throw COMMIT symbol
// Session processes declarations, then re-executes script
if (needsFetch) throw symbols.COMMIT;
```
