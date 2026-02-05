# GenieACS Session Lifecycle

## Overview

A CWMP session is a stateful conversation between a device (CPE) and GenieACS. This document details the complete lifecycle from device connection to session completion.

## Session State Machine

```
┌─────────────┐
│   INIT      │ ← Session created
└──────┬──────┘
       │ Inform received
       ▼
┌─────────────┐
│  PROCESS    │ ← Process declarations
└──────┬──────┘
       │ Generate RPC
       ▼
┌─────────────┐     ┌─────────────┐
│   PENDING   │────▶│  RESPONSE   │
│    RPC      │◀────│  RECEIVED   │
└──────┬──────┘     └─────────────┘
       │ No more RPCs needed
       ▼
┌─────────────┐
│   COMMIT    │ ← Save device state
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    END      │ ← Session complete
└─────────────┘
```

## Step 1: Device Initiates Connection (Inform)

The device sends an Inform message to start communication.

```
┌──────────┐                                    ┌──────────────┐
│  Device  │                                    │  CWMP:7547   │
│  (CPE)   │                                    │  (GenieACS)  │
└────┬─────┘                                    └──────┬───────┘
     │                                                 │
     │  ──── SOAP: Inform Request ──────────────────►  │
     │       (DeviceID, Events, Parameters)            │
     │                                                 │
```

### Inform Message Contents

```xml
<Inform>
  <DeviceId>
    <Manufacturer>Acme</Manufacturer>
    <OUI>001122</OUI>
    <ProductClass>Router</ProductClass>
    <SerialNumber>ABC123</SerialNumber>
  </DeviceId>
  <Event>
    <EventStruct>
      <EventCode>0 BOOTSTRAP</EventCode>
    </EventStruct>
  </Event>
  <ParameterList>
    <ParameterValueStruct>
      <Name>Device.DeviceInfo.SoftwareVersion</Name>
      <Value>2.0.1</Value>
    </ParameterValueStruct>
    <!-- More parameters... -->
  </ParameterList>
</Inform>
```

### GenieACS Processing

```typescript
// 1. Parse SOAP Inform message (lib/soap.ts)
const rpcReq = soap.request(body);

// 2. Generate device ID
const deviceId = `${rpcReq.deviceId.OUI}-${rpcReq.deviceId.ProductClass}-${rpcReq.deviceId.SerialNumber}`;

// 3. Acquire session lock (prevents concurrent sessions)
const lockToken = await lock.acquireLock(`session:${deviceId}`, ttl, 0);
if (!lockToken) {
  return res.status(503).send("Device already in session");
}

// 4. Initialize session context (lib/session.ts)
const sessionContext = await session.init(deviceId, cwmpVersion, timeout);

// 5. Process Inform
await session.inform(sessionContext, rpcReq);
```

## Step 2: Preset Matching

After Inform processing, GenieACS matches presets to determine what to do.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Preset Matching Engine                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Device: OUI=001122, ProductClass=Router, Serial=ABC123        │
│   Events: ["0 BOOTSTRAP", "1 BOOT"]                             │
│                                                                  │
│   ┌─────────────────┐     ┌─────────────────┐                   │
│   │ Preset: bootstrap│     │ Preset: default │                   │
│   │ Events: BOOTSTRAP│ ✓   │ Precondition:   │ ✓                │
│   │ Provisions:      │     │   Tags.init=null│                   │
│   │   - clear        │     │ Provisions:     │                   │
│   └─────────────────┘     │   - refresh     │                   │
│                            │   - configure   │                   │
│                            └─────────────────┘                   │
│                                                                  │
│   Matched Provisions: [clear, refresh, configure]               │
└─────────────────────────────────────────────────────────────────┘
```

### Matching Criteria

1. **Events**: Does preset.events include any Inform event?
2. **Schedule**: Is current time within schedule window?
3. **Precondition**: Does device match filter expression?

## Step 3: Provision Execution

Matched provisions execute in the sandbox environment.

```
┌─────────────────────────────────────────────────────────────────┐
│                      SANDBOX EXECUTION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Provision Script:                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ const version = declare("Device.DeviceInfo.*", {value: 1}); ││
│  │ if (version.value[0][0] === "OldFirmware") {                ││
│  │   declare("Tags.needs_upgrade", null, {value: true});       ││
│  │ }                                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Collected Declarations:                                         │
│  - GET Device.DeviceInfo.* (value)                              │
│  - SET Tags.needs_upgrade = true (conditional)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Step 4: RPC Generation

Based on declarations, GenieACS generates CWMP RPCs.

```
┌──────────────────────────────────────────────────────────────────┐
│                    RPC Generation Engine                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Sync State Analysis:                                            │
│                                                                   │
│  ┌─────────────────┐                                             │
│  │ What's needed?  │                                             │
│  │  - gpn: []      │ → GetParameterNames (none needed)           │
│  │  - gpv: [paths] │ → GetParameterValues (values needed)        │
│  │  - spv: {}      │ → SetParameterValues (none yet)             │
│  └─────────────────┘                                             │
│                                                                   │
│  Generated RPC:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ GetParameterValues                                          │ │
│  │   ["Device.DeviceInfo.SoftwareVersion",                     │ │
│  │    "Device.DeviceInfo.HardwareVersion",                     │ │
│  │    "Device.DeviceInfo.UpTime"]                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### RPC Priority Order

1. Virtual parameter computations
2. GetParameterNames (path discovery)
3. GetParameterValues (read values)
4. SetParameterValues (write values)
5. AddObject / DeleteObject (instances)
6. Download (firmware/config)
7. Reboot / FactoryReset

## Step 5: RPC Request/Response Loop

```
┌──────────┐                                    ┌──────────────┐
│  Device  │                                    │   GenieACS   │
└────┬─────┘                                    └──────┬───────┘
     │                                                 │
     │  ◄──── GetParameterValues Request ────────────  │
     │        [Device.DeviceInfo.*]                    │
     │                                                 │
     │  ──── GetParameterValuesResponse ───────────►  │
     │       [{name: "...SoftwareVersion",             │
     │         value: "2.0.1", type: "string"}]       │
     │                                                 │
     │  ◄──── SetParameterValues Request ────────────  │
     │        [{name: "...SSID", value: "MyNet"}]     │
     │                                                 │
     │  ──── SetParameterValuesResponse ───────────►  │
     │       {status: 0}                              │
     │                                                 │
     │  ... (loop until no more RPCs) ...             │
     │                                                 │
     │  ◄──── Empty Response (Session End) ──────────  │
     │                                                 │
```

### Iteration Cycle

The system is iterative - provisions run multiple times until stable:

```
Iteration 1:
  Script: declare("Device.Info.Version", {value: now})
  Result: Value not cached, need to fetch
  Action: Generate GetParameterValues RPC

(Device responds)

Iteration 2:
  Script: declare("Device.Info.Version", {value: now})
  Result: Value now cached: "2.0.0"
  Script continues: if (version === "2.0.0") { /* done */ }
  Action: No more declarations needed

Session complete!
```

**Max Iterations**: 32 (configurable via `MAX_COMMIT_ITERATIONS`)

## Step 6: Session Commit

When all RPCs complete, device data is saved to MongoDB.

```typescript
// lib/cwmp/db.ts
await saveDevice(deviceId, sessionContext.deviceData);

// Stores complete device state:
{
  _id: "001122-Router-ABC123",
  "Device.DeviceInfo.SoftwareVersion": {
    _value: ["2.0.1", "xsd:string"],
    _timestamp: 1704067200000
  },
  _lastInform: new Date(),
  _tags: ["configured"]
}
```

## Step 7: Session End

```typescript
// Release session lock
await lock.releaseLock(`session:${deviceId}`, lockToken);

// Send empty SOAP response to device
// Device closes connection
```

## Event Types

| Event Code | Name | Trigger |
|------------|------|---------|
| `0 BOOTSTRAP` | Bootstrap | Factory reset or first contact |
| `1 BOOT` | Boot | Device reboot |
| `2 PERIODIC` | Periodic | Scheduled inform interval |
| `3 SCHEDULED` | Scheduled | ACS-scheduled inform |
| `4 VALUE CHANGE` | Value Change | Parameter changed |
| `5 KICKED` | Kicked | User kicked session |
| `6 CONNECTION REQUEST` | Connection Request | ACS-initiated wakeup |
| `7 TRANSFER COMPLETE` | Transfer Complete | Download finished |
| `8 DIAGNOSTICS COMPLETE` | Diagnostics Complete | Diagnostic test done |

## Error Handling

### Session Faults

```typescript
interface SessionFault {
  code: string;           // "provision", "script", "cwmp"
  message: string;        // Human-readable error
  detail?: string;        // Stack trace
  provisions: string[];   // Failed provisions
  retries: number;        // Retry count
  channel: string;        // Affected channel
}
```

### CWMP Fault Codes

| Code | Meaning | Action |
|------|---------|--------|
| 9001 | Request denied | Retry with backoff |
| 9002 | Internal error | Log and continue |
| 9003 | Invalid arguments | Fix and retry |
| 9004 | Resources exceeded | Wait and retry |
| 9005 | Invalid parameter | Skip parameter |

## Connection Request (Push)

When the ACS needs to wake a device:

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   NBI    │     │   CWMP   │     │  Device  │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     │ POST task      │                │
     ├───────────────►│                │
     │                │                │
     │                │  HTTP GET      │
     │                │  (wake up)     │
     │                ├───────────────►│
     │                │                │
     │                │◄───────────────┤
     │                │  Inform        │
     │                │  (new session) │
```

### Connection Request Methods

| Method | When Used | Details |
|--------|-----------|---------|
| HTTP | Device has public URL | Direct GET request |
| UDP | Device behind NAT | STUN-discovered address |
| XMPP | Push notification | Rare, requires XMPP setup |
