# GenieACS Provisioning System Deep Dive

## Overview

The provisioning system is the brain of GenieACS - it determines what actions to take on devices during sessions. It consists of three main components: **Presets** (triggers), **Provisions** (scripts), and **Virtual Parameters** (computed values).

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PROVISIONING SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────────┐      │
│  │   PRESETS    │─────▶│  PROVISIONS  │─────▶│ VIRTUAL PARAMS   │      │
│  │  (Triggers)  │      │  (Scripts)   │      │   (Computed)     │      │
│  └──────────────┘      └──────────────┘      └──────────────────┘      │
│         │                     │                      │                  │
│         ▼                     ▼                      ▼                  │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────────┐      │
│  │ • Events     │      │ • declare()  │      │ • Calculations   │      │
│  │ • Schedule   │      │ • ext()      │      │ • Transformations│      │
│  │ • Precondition│     │ • log()      │      │ • Aggregations   │      │
│  │ • Weight     │      │ • clear()    │      │ • Formatting     │      │
│  └──────────────┘      └──────────────┘      └──────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Presets (Trigger Rules)

Presets define WHEN provisions should execute based on device events, schedules, and conditions.

### Preset Structure

```typescript
interface Preset {
  _id: string;           // Preset name
  channel: string;       // Execution channel
  weight: number;        // Priority (higher = earlier)
  precondition: string;  // Filter expression
  events: {              // Trigger events
    "0 BOOTSTRAP"?: boolean;
    "1 BOOT"?: boolean;
    "2 PERIODIC"?: boolean;
    "3 SCHEDULED"?: boolean;
    "4 VALUE CHANGE"?: boolean;
    "6 CONNECTION REQUEST"?: boolean;
  };
  schedule?: {           // Cron-like schedule
    md?: number[];       // Days of month (1-31)
    h?: number[];        // Hours (0-23)
    m?: number[];        // Minutes (0-59)
  };
  provisions: string[];  // Provision scripts to run
}
```

### Matching Algorithm

```
Device Session Starts
        │
        ▼
┌───────────────────┐
│  For Each Preset  │
└─────────┬─────────┘
          │
    ┌─────▼─────┐     No
    │ Events    ├────────────────┐
    │ Match?    │                │
    └─────┬─────┘                │
          │ Yes                  │
    ┌─────▼─────┐     No         │
    │ Schedule  ├────────────────┤
    │ Match?    │                │
    └─────┬─────┘                │
          │ Yes                  │
    ┌─────▼─────┐     No         │
    │Precondition├───────────────┤
    │ Match?    │                │
    └─────┬─────┘                │
          │ Yes                  │
    ┌─────▼─────┐                │
    │   ADD TO  │                │
    │  MATCHED  │                │
    └─────┬─────┘                │
          │                      │
          ◄──────────────────────┘
          │
          ▼
┌───────────────────┐
│ Sort by Weight    │
│ Group by Channel  │
└───────────────────┘
```

### Channel System

Channels provide ordering and fault isolation:

```
Channel: "bootstrap"          Channel: "default"
Weight: 100                   Weight: 50
┌─────────────────┐          ┌─────────────────┐
│ clear_device    │          │ refresh_params  │
│ factory_reset   │          │ apply_config    │
└────────┬────────┘          └────────┬────────┘
         │                            │
         │ Must complete              │ Runs after
         │ before "default"           │ "bootstrap"
         │                            │
         ▼                            ▼
```

**Channel Rules**:
- Higher weight = executed first
- Fault in one channel doesn't block others
- Same channel provisions run sequentially
- Different channel provisions can interleave

## Provisions (Scripts)

Provisions are JavaScript scripts that declare what the device should do.

### Sandbox Environment

```
┌─────────────────────────────────────────────────────────────────┐
│                        SANDBOX VM                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Available APIs:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ declare(path, attrGet, attrSet)  // Core declaration API    ││
│  │ clear(path, timestamp)           // Clear cached data       ││
│  │ commit()                         // Force commit cycle      ││
│  │ ext(script, ...args)             // Call extension          ││
│  │ log(message)                     // Session logging         ││
│  │ Date, Math, JSON, Array...       // Safe JS built-ins       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Blocked:                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ require, import                  // No module loading       ││
│  │ process, global                  // No Node.js access       ││
│  │ setTimeout, setInterval          // No timers               ││
│  │ fetch, XMLHttpRequest            // No network access       ││
│  │ fs, child_process                // No system access        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Limits:                                                         │
│  • Execution timeout: 50ms per iteration                        │
│  • Max iterations: 32 per session                               │
│  • Memory: Limited by V8 isolate                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The declare() Function

This is the heart of the provisioning system:

```javascript
declare(path, attributesToGet, attributesToSet)
```

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | string | Parameter path with optional wildcards |
| `attributesToGet` | object | What to read from device |
| `attributesToSet` | object | What to write to device |

**Attribute Types**:

```javascript
// Reading attributes
{
  value: 1,           // Get current value (timestamp freshness)
  writable: 1,        // Check if writable
  object: 1,          // Check if object/container
  path: 1             // Get full path
}

// Writing attributes
{
  value: "NewValue",  // Set parameter value
  writable: true,     // Mark as writable (metadata only)
  object: true        // Create object instance
}
```

### Declaration Examples

```javascript
// 1. Read a single parameter
const version = declare("Device.DeviceInfo.SoftwareVersion", {value: 1});
// Returns: { value: [["2.0.1", "xsd:string"]], ... }

// 2. Read all parameters under a path
const wifi = declare("Device.WiFi.SSID.*", {value: 1});
// Returns all SSID instances with their values

// 3. Set a parameter value
declare("Device.WiFi.SSID.1.SSID", null, {value: "MyNetwork"});

// 4. Create a new object instance
declare("Device.WiFi.SSID.*", {path: 1}, {object: true});

// 5. Delete an object instance
declare("Device.WiFi.SSID.2", null, {object: false});

// 6. Conditional logic
const uptime = declare("Device.DeviceInfo.UpTime", {value: 1});
if (uptime.value[0] < 300) {
  // Device just rebooted
  declare("Tags.recently_rebooted", null, {value: true});
}

// 7. Using aliases (dynamic paths)
declare("Device.WiFi.SSID.[SSID:MyNetwork].Enable", null, {value: true});
```

### Provision Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROVISION EXECUTION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Iteration 1:                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Script: declare("Device.Info.Version", {value: 1})          ││
│  │ Cache State: MISS (value not cached)                        ││
│  │ Action: Script SUSPENDS, queue GetParameterValues RPC       ││
│  └─────────────────────────────────────────────────────────────┘│
│                         │                                        │
│                         ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ RPC: GetParameterValues("Device.Info.Version")              ││
│  │ Device Response: "2.0.1"                                    ││
│  │ Cache State: HIT (value = "2.0.1")                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                         │                                        │
│                         ▼                                        │
│  Iteration 2:                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Script: declare("Device.Info.Version", {value: 1})          ││
│  │ Cache State: HIT (value = "2.0.1")                          ││
│  │ Result: Returns {value: [["2.0.1", "xsd:string"]]}          ││
│  │ Script continues execution...                                ││
│  │ Action: Script COMPLETES                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Common Provision Patterns

```javascript
// Pattern 1: Refresh all device parameters
const now = Date.now();
declare("Device.DeviceInfo.*", {value: now});
declare("Device.ManagementServer.*", {value: now});
declare("Device.WiFi.*", {value: now});

// Pattern 2: Configure WiFi
declare("Device.WiFi.SSID.1.SSID", null, {value: "CompanyWiFi"});
declare("Device.WiFi.SSID.1.Enable", null, {value: true});
declare("Device.WiFi.AccessPoint.1.Security.ModeEnabled", null,
        {value: "WPA2-Personal"});

// Pattern 3: Firmware upgrade check
const currentFW = declare("Device.DeviceInfo.SoftwareVersion", {value: 1});
const targetFW = "3.0.0";

if (currentFW.value[0][0] !== targetFW) {
  declare("Downloads.[FileType:1 Firmware Upgrade Image]",
          {path: 1},
          {path: now});
}

// Pattern 4: Tag-based provisioning
const hasTag = declare("Tags.configured", {value: 1});
if (!hasTag.value[0]) {
  // Run initial configuration
  declare("Device.WiFi.SSID.1.SSID", null, {value: "DefaultSSID"});
  declare("Tags.configured", null, {value: true});
}

// Pattern 5: Using extensions
const config = ext("config-lookup", "deviceConfig", deviceId);
declare("Device.WiFi.SSID.1.SSID", null, {value: config.ssid});
```

## Virtual Parameters

Virtual parameters are computed values that don't exist on the device but appear in the device data model.

### Virtual Parameter Structure

```javascript
// Virtual parameter script returns:
{
  writable: boolean,           // Can this be written?
  value: [value, type]         // Current computed value
}
```

### Execution Context

```
┌─────────────────────────────────────────────────────────────────┐
│                   VIRTUAL PARAMETER EXECUTION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  When provision declares: VirtualParameters.Summary              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 1. Load script from "virtualParameters" collection          ││
│  │ 2. Execute in sandbox with access to:                       ││
│  │    - declare() for reading device parameters                ││
│  │    - args object with GET/SET request info                  ││
│  │ 3. Return computed value                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Virtual Parameter Examples

```javascript
// Example 1: Combined status summary
// Name: Summary
const status = declare("Device.DeviceInfo.Status", {value: 1});
const uptime = declare("Device.DeviceInfo.UpTime", {value: 1});
const online = status.value[0][0] === "Up";
const days = Math.floor(uptime.value[0][0] / 86400);

return {
  writable: false,
  value: [`${online ? "Online" : "Offline"} - ${days} days`, "xsd:string"]
};

// Example 2: Calculated bandwidth
// Name: TotalBandwidth
const down = declare("Device.IP.Interface.1.Stats.BytesReceived", {value: 1});
const up = declare("Device.IP.Interface.1.Stats.BytesSent", {value: 1});
const total = (down.value[0][0] || 0) + (up.value[0][0] || 0);

return {
  writable: false,
  value: [total, "xsd:unsignedLong"]
};

// Example 3: Writable virtual parameter
// Name: WiFiConfig
if (args[1]) {
  // SET operation
  const config = JSON.parse(args[1]);
  declare("Device.WiFi.SSID.1.SSID", null, {value: config.ssid});
  declare("Device.WiFi.SSID.1.Enable", null, {value: config.enabled});
  return {writable: true, value: [args[1], "xsd:string"]};
} else {
  // GET operation
  const ssid = declare("Device.WiFi.SSID.1.SSID", {value: 1});
  const enabled = declare("Device.WiFi.SSID.1.Enable", {value: 1});
  const config = JSON.stringify({
    ssid: ssid.value[0][0],
    enabled: enabled.value[0][0]
  });
  return {writable: true, value: [config, "xsd:string"]};
}
```

## Extension System

Extensions allow calling external scripts for complex operations.

### Extension Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Provision      │     │  Extension       │     │  External        │
│   Script         │────▶│  Worker          │────▶│  Script          │
│                  │     │  (lib/extension) │     │  (config/ext)    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
       │                        │                        │
       │ ext("script",args)     │ spawn process          │ Execute
       │                        │ or HTTP call           │ business
       │                        │                        │ logic
       │◀───────────────────────│◀───────────────────────│
       │ Return result          │ Collect output         │ Return
```

### Extension Example

```javascript
// In provision script:
const result = ext("lookup-customer", serialNumber);
declare("Device.ManagementServer.Username", null, {value: result.username});

// External script (config/ext/lookup-customer.js):
const [serialNumber] = args;
const customer = await database.findBySerial(serialNumber);
return { username: customer.username, plan: customer.plan };
```

## Fault Handling

### Fault Types

```typescript
interface Fault {
  code: string;           // "cwmp" | "script" | "ext"
  message: string;        // Human-readable error
  detail?: string;        // Stack trace or details
  retries: number;        // Retry count
  timestamp: number;      // When fault occurred
}
```

### Fault Recovery Flow

```
Provision Execution
        │
        ▼
   ┌────────────┐
   │   Error    │
   │  Occurs    │
   └─────┬──────┘
         │
   ┌─────▼──────┐
   │ Create     │
   │ Fault      │
   │ Record     │
   └─────┬──────┘
         │
   ┌─────▼──────────────────────────────────────┐
   │ Retry Logic:                               │
   │ • Wait: min(2^retries * 60s, 24h)         │
   │ • Max retries: configurable (default: 3)  │
   │ • Backoff: exponential                    │
   └─────┬──────────────────────────────────────┘
         │
   ┌─────▼──────┐
   │ Next       │
   │ Session    │
   │ Retry      │
   └────────────┘
```

### Fault Storage

```javascript
// Fault document in MongoDB
{
  _id: "001122-Router-ABC123:default",  // deviceId:channel
  channel: "default",
  code: "script",
  message: "TypeError: Cannot read property 'value' of undefined",
  detail: "at provision 'configure':15:20",
  retries: 2,
  timestamp: 1704067200000,
  provisions: ["configure", "set-params"]
}
```

## Best Practices

### Provision Design

1. **Keep provisions small and focused**
   ```javascript
   // Good: Single responsibility
   // provision: set-wifi
   declare("Device.WiFi.SSID.1.SSID", null, {value: config.ssid});

   // Bad: Too many responsibilities
   // provision: configure-everything
   // ... 200 lines of mixed concerns
   ```

2. **Use meaningful tags**
   ```javascript
   // Tag devices for tracking state
   declare("Tags.wifi_configured", null, {value: true});
   declare("Tags.firmware_3.0", null, {value: true});
   ```

3. **Handle missing parameters gracefully**
   ```javascript
   const param = declare("Device.Optional.Param", {value: 1});
   if (param.value && param.value[0]) {
     // Parameter exists, use it
   }
   ```

### Performance Tips

1. **Batch declarations**
   ```javascript
   // Good: Single declaration with wildcard
   declare("Device.WiFi.*", {value: 1});

   // Bad: Multiple individual declarations
   declare("Device.WiFi.SSID.1.SSID", {value: 1});
   declare("Device.WiFi.SSID.1.Enable", {value: 1});
   // ... many more
   ```

2. **Use appropriate freshness**
   ```javascript
   // Only refresh if older than 1 hour
   const oneHourAgo = Date.now() - 3600000;
   declare("Device.DeviceInfo.*", {value: oneHourAgo});
   ```

3. **Minimize extension calls**
   ```javascript
   // Cache extension results in tags when possible
   const cached = declare("Tags.customer_config", {value: 1});
   if (!cached.value[0]) {
     const config = ext("lookup-customer", serial);
     declare("Tags.customer_config", null, {value: JSON.stringify(config)});
   }
   ```
