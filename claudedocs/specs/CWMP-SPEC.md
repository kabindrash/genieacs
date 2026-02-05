# GenieACS CWMP Service Specification

## Overview

The CWMP (CPE WAN Management Protocol) service implements TR-069 protocol handling for communication with Customer Premises Equipment (CPE) devices.

**Primary Files**:
- `bin/genieacs-cwmp.ts` - Service entry point
- `lib/cwmp.ts` - Main protocol handler
- `lib/session.ts` - Session state management
- `lib/soap.ts` - SOAP message parsing/generation
- `lib/sandbox.ts` - Script execution sandbox

## Service Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `CWMP_PORT` | int | 7547 | TCP listening port |
| `CWMP_INTERFACE` | string | "::" | Network interface binding |
| `CWMP_WORKER_PROCESSES` | int | 0 | Worker count (0=CPU cores) |
| `CWMP_SSL_CERT` | string | "" | SSL certificate path |
| `CWMP_SSL_KEY` | string | "" | SSL private key path |
| `cwmp.auth` | expression | null | Authentication expression |
| `cwmp.sessionTimeout` | int | varies | Session timeout (seconds) |
| `cwmp.maxCommitIterations` | int | varies | Max script re-executions |

## Session Lifecycle

### Session States

```
Inform Received
    │
    ├── Authenticate (if cwmp.auth configured)
    │
    ├── Acquire Lock (cwmp_session_{deviceId})
    │
    ├── Load Tasks, Faults, Presets
    │
    ├── Process Tasks ◄─────────────────┐
    │                                    │
    ├── Apply Presets                    │
    │                                    │
    ├── Run Provisions                   │
    │                                    │
    ├── Run Declarations                 │
    │   ├── Read Phase (GPN, GPV, GPA)   │
    │   └── Write Phase (SPV, Add/Del)   │
    │                                    │
    ├── More Work? ──────────Yes─────────┘
    │       │
    │       No
    │
    ├── Save Device Data
    │
    ├── Clear Completed Tasks
    │
    ├── Save Faults
    │
    └── Release Lock → End Session
```

### Timing Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| Max session duration | 300s | Prevent stuck sessions |
| Lock refresh interval | 10s | Keep session alive |
| Request timeout | 10s | Individual RPC timeout |
| Script timeout | 50ms | Prevent runaway scripts |
| Max RPC count | 255 | Limit session operations |
| Max cycles | 255 | Prevent infinite loops |

## Authentication

### Digest Authentication

**Location**: `lib/cwmp.ts:75-162`

Authentication is controlled by the `cwmp.auth` configuration expression:
- If `null` (default): No authentication required
- If set: Evaluates expression with username/password

**Digest Challenge Flow**:
1. CWMP responds with `401 Unauthorized` and `WWW-Authenticate` header
2. CPE resends request with `Authorization` header
3. Server validates Digest response
4. Session proceeds on success

### Configuration Example

```javascript
// In MongoDB config collection
{
  "_id": "cwmp.auth",
  "value": "\"FUNC('AUTH', Username, Password)\""
}
```

## SOAP Message Processing

### Supported RPC Methods

**ACS-Initiated (to CPE)**:
| Method | Description |
|--------|-------------|
| GetParameterNames | Discover parameters |
| GetParameterValues | Read values |
| GetParameterAttributes | Read notification settings |
| SetParameterValues | Write values |
| SetParameterAttributes | Configure notifications |
| AddObject | Create instance |
| DeleteObject | Remove instance |
| Reboot | Restart device |
| FactoryReset | Factory reset |
| Download | Push file |

**CPE-Initiated (from CPE)**:
| Method | Description |
|--------|-------------|
| Inform | Session initiation |
| TransferComplete | Download finished |
| GetRPCMethods | Capability query |
| RequestDownload | Device-initiated download |

### Inform Events

| Event | Trigger |
|-------|---------|
| 0 BOOTSTRAP | First boot |
| 1 BOOT | Device startup |
| 2 PERIODIC | Periodic inform |
| 3 SCHEDULED | Scheduled inform |
| 4 VALUE CHANGE | Parameter changed |
| 5 KICKED | ACS-initiated |
| 6 CONNECTION REQUEST | HTTP trigger |
| 7 TRANSFER COMPLETE | Download finished |
| 8 DIAGNOSTICS COMPLETE | Diagnostics done |
| M Reboot | Reboot completed |
| M ScheduleInform | Scheduled event |
| M Download | Download event |
| M Upload | Upload event |

## Provisioning Engine

### Sandbox Execution

**Location**: `lib/sandbox.ts`

Scripts run in isolated V8 context:
- No access to Node.js APIs
- Custom `Date` implementation
- Seeded random for reproducibility
- 50ms execution timeout

### Script API

**declare(path, timestamps, values)**
```javascript
// Read parameter
let val = declare("Device.DeviceInfo.SoftwareVersion", {value: 1});

// Set parameter
declare("Device.ManagementServer.PeriodicInformInterval",
  {value: 1},
  {value: 300}
);

// Wildcards
declare("Device.WiFi.SSID.*", {value: Date.now()});

// Aliases
declare("Device.WiFi.SSID.[SSID:MyNetwork].Enable",
  {value: 1},
  {value: true}
);
```

**clear(path, timestamp, attributes)**
```javascript
// Force refresh
clear("Device.DeviceInfo.", Date.now());
```

**commit()**
```javascript
// Process pending declarations before continuing
commit();
```

**ext(name, function, ...args)**
```javascript
// Call external extension
let config = ext("config-service", "getConfig", deviceId);
```

**log(message, metadata)**
```javascript
log("Device configured", {firmware: "2.0"});
```

### Execution Flow

1. Script starts execution
2. `declare()` calls register declarations
3. When data needed from device:
   - Mark declarations as deferred
   - Throw `COMMIT` symbol
4. Session processes declarations
5. Script re-executes from beginning
6. Cached data available on retry
7. Repeat until script completes

### Default Provisions

| Provision | Arguments | Description |
|-----------|-----------|-------------|
| refresh | path, [interval], [attrs] | Refresh parameters |
| value | path, value | Set parameter |
| tag | name, value | Add/remove tag |
| reboot | | Reboot device |
| reset | | Factory reset |
| download | fileType, fileName, [target] | Download file |
| instances | path, count | Manage instances |

## Preset System

### Preset Structure

```javascript
{
  "_id": "my-preset",
  "weight": 0,           // Lower = higher priority
  "channel": "default",  // Fault isolation channel
  "events": {
    "Inform": true,      // Trigger on Inform
    "1_BOOT": false
  },
  "precondition": "ProductClass = \"Router\"",
  "provision": "my-provision",
  "provisionArgs": "\"arg1\", 123"
}
```

### Matching Algorithm

1. Filter by events (must match session events)
2. Filter by schedule (cron expressions)
3. Extract parameters from precondition
4. Fetch parameters from device
5. Evaluate precondition expression
6. Execute matching presets by weight order

### Cycle Detection

Maximum 4 preset evaluation cycles per session. Exceeding triggers `preset_loop` fault.

## Virtual Parameters

### Definition

```javascript
// Virtual parameter script
let manufacturer = declare("Device.DeviceInfo.Manufacturer", {value: 1});
let model = declare("Device.DeviceInfo.ModelName", {value: 1});

return {
  writable: false,
  value: [manufacturer.value[0] + " " + model.value[0], "xsd:string"]
};
```

### Return Format

```javascript
{
  writable: boolean,     // Required if queried
  value: [value, type]   // Required if queried
}
```

## Extension System

### Architecture

- Extensions run in child processes
- Communication via IPC
- Configurable timeout (`EXT_TIMEOUT`)
- Script directory: `GENIEACS_EXT_DIR`

### Extension Format

```javascript
// extensions/my-extension.js
exports.myFunction = function(args, callback) {
  let [arg1, arg2] = args;

  // Async operation
  someAsyncWork().then(result => {
    callback(null, result);
  }).catch(err => {
    callback(err);
  });
};
```

## Connection Request

### Methods

| Method | Trigger Condition |
|--------|-------------------|
| HTTP | Default |
| UDP | STUN enabled, UDP address available |
| XMPP | XMPP configured, Jabber ID available |

### HTTP Connection Request

**Location**: `lib/connection-request.ts:75-170`

1. Read ConnectionRequestURL from device
2. Read credentials from device/config
3. Send HTTP request with Digest auth
4. Wait for device session

### UDP Connection Request

**Location**: `lib/connection-request.ts:172-223`

Uses STUN-style UDP packet with HMAC-SHA1 signature.

## Fault Handling

### Fault Structure

```javascript
{
  "_id": "device-001:default",
  "device": "device-001",
  "channel": "default",
  "code": "cwmp.9002",
  "message": "Internal Error",
  "timestamp": Date,
  "retries": 3,
  "provisions": "[...]"
}
```

### Retry Strategy

- Exponential backoff: `RETRY_DELAY * 2^retries`
- Default retry delay: 300 seconds
- Configurable via `RETRY_DELAY`

### Fault Codes

| Code Pattern | Source |
|--------------|--------|
| `script.*` | Sandbox execution |
| `ext.*` | Extension errors |
| `cwmp.*` | Protocol errors |
| `preset_loop` | Infinite preset loop |
| `too_many_rpcs` | RPC count exceeded |
| `too_many_cycles` | Cycle count exceeded |

## Data Structures

### SessionContext

```typescript
interface SessionContext {
  sessionId: string;
  deviceId: string;
  deviceData: DeviceData;
  cwmpVersion: string;
  timestamp: number;
  provisions: any[];
  channels: {[channel: string]: number};
  virtualParameters: any[];
  revisions: number[];
  syncState: SyncState;
  state: number;
  authState: number;
  httpRequest: IncomingMessage;
  httpResponse: ServerResponse;
}
```

### DeviceData

```typescript
interface DeviceData {
  paths: PathSet;
  timestamps: VersionedMap<Path, number>;
  attributes: VersionedMap<Path, Attributes>;
  trackers: Map<Path, {[name: string]: number}>;
  changes: Set<string>;
}
```

## Performance Optimization

### Batching

- GetParameterValues batched by `gpvBatchSize` (default: 32)
- GetParameterNames uses `gpnNextLevel` threshold

### Caching

- Local cache for presets, provisions, files, config
- 5-second refresh interval
- Hash-based change detection

### Parallel Operations

- Tasks loaded in parallel with faults and presets
- RPC requests pipelined where possible
