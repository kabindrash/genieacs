# GenieACS Provisioning Engine Specification

## Overview

The Provisioning Engine executes device configuration scripts, manages device state, handles preset matching, and orchestrates TR-069 RPC operations.

**Primary Files**:
- `lib/sandbox.ts` - Script execution sandbox
- `lib/session.ts` - Session state management
- `lib/default-provisions.ts` - Built-in provision functions
- `lib/extensions.ts` - External script execution
- `lib/scheduling.ts` - Cron and interval scheduling

## Sandbox Execution Environment

### Security Features

**VM Context Isolation** (`lib/sandbox.ts:18`):
```typescript
const context = vm.createContext(undefined, { microtaskMode: "afterEvaluate" });
```

**Execution Timeout**: 50ms per script execution

**Deterministic Random**: `Math.random()` replaced with seeded PRNG based on device ID

### Execution States

| Status | Value | Meaning |
|--------|-------|---------|
| `0` | Complete | Script finished normally |
| `1` | COMMIT | Script accessed deferred data |
| `2` | EXT | Extension call pending |

### Deferred Execution Pattern

When a script accesses data requiring device fetch:
1. Declarations marked as deferred
2. `COMMIT` symbol thrown to pause execution
3. Session processes declarations (TR-069 RPCs)
4. Script re-executed with updated data

## Provision Script API

### declare(path, timestamps, values)

```typescript
function declare(
  path: string,
  timestamps: { [attr: string]: number },
  values: { [attr: string]: any },
): ParameterWrapper
```

**Purpose**: Declare parameter requirements and optionally set values.

**Examples**:
```javascript
// Read parameter value
let param = declare("Device.ManagementServer.URL", {value: Date.now()});
log(param.value);

// Set parameter value
declare("Device.ManagementServer.PeriodicInformInterval", {value: 1}, {value: 300});

// Work with wildcards
declare("Device.WiFi.SSID.*", {value: Date.now()});

// Use aliases for object instances
declare("Device.WiFi.SSID.[SSID:MyNetwork].Enable", {value: 1}, {value: true});
```

**ParameterWrapper Properties**:
- `.path` - Resolved parameter path
- `.value` - Current parameter value
- `.writable` - Writable flag
- `.size` - Number of matching instances
- `[Symbol.iterator]` - Iterate over matches

### clear(path, timestamp, attributes)

```typescript
function clear(path: string, timestamp: number, attributes?): void
```

Mark device data as outdated, forcing refresh on next access.

### ext(...args)

```typescript
function ext(...args: unknown[]): any
```

Call external extension scripts. Results are cached per session.

### log(msg, meta)

```typescript
function log(msg: string, meta: Record<string, unknown>): void
```

### Date (SandboxDate)

Custom Date with scheduling support:

```javascript
// Current session timestamp
let now = Date.now();

// Timestamp aligned to interval with variance
let scheduled = Date.now(3600000, 3600000);

// Timestamp for cron expression
let cronTime = Date.now("0 0 * * *", 3600000);
```

## Default Provisions

### refresh(path, [interval], [refreshChildren], [...attrs])

Refresh parameter values from device.

```json
["refresh", "Device.DeviceInfo."]
["refresh", "Device.WiFi.", 3600]
```

### value(path, [attr], value)

Set a parameter value.

```json
["value", "Device.ManagementServer.PeriodicInformInterval", 3600]
["value", "Device.WiFi.SSID.1.Enable", true]
```

### tag(tagName, value)

Add or remove device tags.

```json
["tag", "configured", true]
["tag", "needs-update", false]
```

### reboot()

Reboot the device.

### reset()

Factory reset the device.

### download(fileType, fileName, [targetFileName])

Download file to device.

```json
["download", "1 Firmware Upgrade Image", "firmware-v2.0.bin"]
["download", "3 Vendor Configuration File", "config.cfg", "backup.cfg"]
```

### instances(path, count)

Manage object instances.

```json
["instances", "Device.WiFi.SSID.*", 4]
["instances", "Device.NAT.PortMapping.*", "+1"]
```

## Virtual Parameters

Computed parameters under `VirtualParameters.*` path.

### Return Value Requirements

```javascript
return {
  writable: true/false,  // Required if queried
  value: [value, type]   // Required if queried
};
```

### Example

```javascript
// Virtual parameter: SummarizedFirmware
let manufacturer = declare("Device.DeviceInfo.Manufacturer", {value: 1});
let version = declare("Device.DeviceInfo.SoftwareVersion", {value: 1});

return {
  writable: false,
  value: [manufacturer.value + "_" + version.value, "xsd:string"]
};
```

## Expression Language

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equality | `ProductClass = "Router"` |
| `<>` | Inequality | `Status <> "Disabled"` |
| `>`, `>=`, `<`, `<=` | Comparison | `Uptime > 3600` |
| `LIKE` | Pattern match | `SerialNumber LIKE "ABC%"` |
| `IS NULL` | Null check | `LastContact IS NULL` |
| `AND`, `OR`, `NOT` | Logical | `Type = "WiFi" AND Enabled = true` |

### Functions

```sql
UPPER(parameter)
LOWER(parameter)
ROUND(value, precision)
COALESCE(val1, val2, ...)
NOW()
```

### CASE Statement

```sql
CASE
  WHEN condition1 THEN result1
  WHEN condition2 THEN result2
  ELSE default_result
END
```

### AST Representation

```typescript
["=", ["PARAM", "DeviceID.OUI"], "001122"]
["AND", ["=", "Type", "Router"], [">", "Uptime", 0]]
["FUNC", "UPPER", ["PARAM", "DeviceID.SerialNumber"]]
```

## Preset System

### Preset Structure

```typescript
interface Preset {
  name: string;
  channel: string;
  schedule?: { md5: string; duration: number; schedule: any };
  events?: { [event: string]: boolean };
  precondition?: Expression;
  provisions: [string, ...Expression[]][];
}
```

### Matching Algorithm

1. **Filter by events**: Match preset events to device events
2. **Filter by schedule**: Check cron schedule
3. **Extract parameters**: Fetch required parameters from device
4. **Evaluate preconditions**: Run expression against device data

### Channel System

- Each preset belongs to a channel (default: "default")
- Tasks use `task_{taskId}` channels
- Faults tracked per channel independently

### Cycle Detection

Max preset cycles: 4. Prevents infinite configuration loops.

## Extension Mechanism

Extensions run in separate child processes.

### Extension Script Format

```javascript
// extensions/my-extension.js
exports.myFunction = function(args, callback) {
  let [param1, param2] = args;
  callback(null, { success: true, data: "result" });
};
```

### Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `EXT_TIMEOUT` | 3000ms | Extension timeout |
| `GENIEACS_EXT_DIR` | - | Extensions directory |

## Task Queue Processing

### Task Types

| Task Name | Converted To |
|-----------|--------------|
| `getParameterValues` | `["refresh", paramName]` |
| `setParameterValues` | `["value", path, value]` |
| `refreshObject` | `["refresh", objectName]` |
| `reboot` | `["reboot"]` |
| `factoryReset` | `["reset"]` |
| `download` | `["download", type, name, target]` |
| `addObject` | `["instances", path, "+1"]` |
| `deleteObject` | `["instances", path, 0]` |
| `provisions` | Direct execution |

## Fault Handling

### Retry Logic

Exponential backoff: `RETRY_DELAY * 2^retries`

### Fault Codes

| Code | Source | Meaning |
|------|--------|---------|
| `script.*` | sandbox.ts | Script execution error |
| `ext.*` | extensions.ts | Extension error |
| `cwmp.*` | session.ts | TR-069 protocol error |
| `preset_loop` | cwmp.ts | Infinite preset loop |
| `too_many_rpcs` | session.ts | RPC count > 255 |
| `too_many_cycles` | session.ts | Cycles > 255 |
| `timeout` | extensions.ts | Extension timeout |

## Execution Limits

| Limit | Value |
|-------|-------|
| Max RPC Count | 255 |
| Max Cycles | 255 |
| Script Timeout | 50ms |
| Max Revision Depth | 8 |
| Max Preset Cycles | 4 |

## Session Lifecycle

```
CPE Inform
    │
    ▼
Authenticate → Acquire Lock
    │
    ├──────────────────┬──────────────────┐
    │                  │                  │
Load Tasks      Load Faults        Load Presets
    │                  │                  │
    └──────────────────┴──────────────────┘
                       │
                       ▼
              Process Tasks ◄────────┐
                       │             │
                       ▼             │
              Apply Presets          │
                       │             │
                       ▼             │
              Run Provisions         │
                       │             │
                       ▼             │
              Run Declarations       │
                       │             │
          ┌────────────┴────────────┐│
          │                         ││
     Read Phase              Write Phase
    (GPN, GPV, GPA)        (SPV, Add/Del, Download)
          │                         │
          └────────────┬────────────┘
                       │
                 More Work? ──Yes────┘
                       │
                       No
                       │
                       ▼
              Save Device/Tasks/Faults
                       │
                       ▼
              Release Lock → End Session
```

## Path Syntax

### Simple Paths
```
Device.DeviceInfo.Manufacturer
Device.WiFi.SSID.1.SSID
```

### Wildcard Paths
```
Device.WiFi.SSID.*
Device.*.Enabled
```

### Alias Paths
```
Device.WiFi.SSID.[SSID:"MyNetwork"].BSSID
Device.NAT.PortMapping.[Protocol:"TCP",ExternalPort:"80"].Enable
```

## Scheduling

### Variance Function

Deterministic per-device offset to prevent thundering herd:
```typescript
variance(deviceId, vrnc) = md5(deviceId) % vrnc
```

### Interval Alignment

```typescript
interval(timestamp, intrvl, offset) = floor((timestamp + offset) / intrvl) * intrvl - offset
```

### Cron Support

Uses `@breejs/later` for cron expression parsing.
