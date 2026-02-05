# GenieACS Session Management Specification

## Overview

The `lib/session.ts` module (3,033 lines) is the largest and most critical file in GenieACS, implementing the complete session management system for CWMP device communication. It handles session lifecycle, RPC orchestration, provision execution, and device synchronization.

**Primary File**: `lib/session.ts`

## Session Lifecycle

### State Machine

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

### State Values

| State | Value | Description |
|-------|-------|-------------|
| INIT | 0 | Session initialized |
| INFORM | 1 | Processing Inform |
| PROVISION | 2 | Running provisions |
| GET | 3 | Generating GET RPCs |
| SET | 4 | Generating SET RPCs |
| COMMIT | 5 | Committing changes |
| END | 6 | Session complete |
| FAULT | 7 | Session fault |

## Core Functions

### Session Initialization

```typescript
export async function init(
  deviceId: string,
  cwmpVersion: string,
  timeout: number
): Promise<SessionContext>
```

Creates a new session context:
1. Generate unique session ID
2. Initialize device data structures
3. Load cached device state from database
4. Set timeout and CWMP version
5. Return ready session context

### Inform Processing

```typescript
export async function inform(
  sessionContext: SessionContext,
  rpcReq: InformRequest
): Promise<AcsResponse>
```

Processes device Inform message:
1. Extract device identification
2. Process events (BOOTSTRAP, BOOT, etc.)
3. Update parameter values from Inform
4. Load presets matching device/events
5. Queue applicable provisions
6. Return InformResponse

**Event Handling**:
| Event | Action |
|-------|--------|
| `0 BOOTSTRAP` | Clear all device data |
| `1 BOOT` | Refresh session data |
| `2 PERIODIC` | Normal periodic inform |
| `4 VALUE CHANGE` | Parameter changed |
| `6 CONNECTION REQUEST` | User-initiated |
| `7 TRANSFER COMPLETE` | Download finished |

### RPC Request Generation

```typescript
export async function rpcRequest(
  sessionContext: SessionContext,
  declarations: Declaration[]
): Promise<{ rpcReq: AcsRequest | null; fault: Fault | null }>
```

Generates next RPC based on current state:

**Priority Order**:
1. Virtual parameter computations
2. GetParameterNames (discovery)
3. GetParameterValues (retrieval)
4. SetParameterValues (configuration)
5. AddObject / DeleteObject (instances)
6. Download (firmware/config)
7. Reboot / FactoryReset

**Decision Flow**:
```
1. Run provision scripts
2. Collect declarations
3. Determine sync requirements
4. Generate optimal RPC
5. Track pending response
```

### RPC Response Processing

```typescript
export async function rpcResponse(
  sessionContext: SessionContext,
  id: string,
  response: CpeResponse
): Promise<void>
```

Processes device RPC response:
1. Match response to pending request
2. Update device data with results
3. Track successful/failed operations
4. Trigger next iteration if needed

**Response Types**:
| Response | Processing |
|----------|------------|
| `GetParameterNamesResponse` | Update path discovery |
| `GetParameterValuesResponse` | Update parameter values |
| `SetParameterValuesResponse` | Confirm value changes |
| `AddObjectResponse` | Record new instance |
| `DeleteObjectResponse` | Remove instance |
| `DownloadResponse` | Track download state |
| `FaultResponse` | Handle error |

### RPC Fault Handling

```typescript
export async function rpcFault(
  sessionContext: SessionContext,
  id: string,
  fault: FaultStruct
): Promise<void>
```

Handles CWMP fault responses:
1. Parse fault code and message
2. Determine fault severity
3. Update affected provisions
4. Retry or mark as failed

**Fault Codes**:
| Code | Meaning | Action |
|------|---------|--------|
| 9001 | Request denied | Retry with backoff |
| 9002 | Internal error | Log and continue |
| 9003 | Invalid arguments | Fix and retry |
| 9004 | Resources exceeded | Wait and retry |
| 9005 | Invalid param name | Skip parameter |

## Declaration Processing

### Declaration Structure

```typescript
interface Declaration {
  path: Path;
  pathGet?: number;    // Discover paths at timestamp
  pathSet?: number;    // Create/delete paths at timestamp
  attrGet?: AttributeTimestamps;  // Retrieve attributes
  attrSet?: Partial<Attributes>;  // Set attributes
  defer?: boolean;     // Defer to later iteration
}
```

### Processing Algorithm

```typescript
function processDeclarations(
  sessionContext: SessionContext,
  declarations: Declaration[]
): void
```

**Steps**:
1. Group declarations by path
2. Resolve wildcards and aliases
3. Determine required attributes
4. Build sync state for RPCs
5. Mark deferred declarations

### Instance Processing

```typescript
function processInstances(
  sessionContext: SessionContext,
  declarations: Declaration[]
): void
```

Handles multi-instance objects:
- AddObject for instance creation
- DeleteObject for instance removal
- Relative counting (+N/-N instances)

## Provision Execution

### Adding Provisions

```typescript
export async function addProvisions(
  sessionContext: SessionContext,
  provisions: Provision[]
): Promise<void>
```

Queues provisions for execution:
1. Add to provision queue
2. Associate with channels
3. Set execution weights

### Provision Script Execution

Provisions execute in sandbox:
```typescript
// lib/sandbox.ts integration
const script = compileScript(provisionCode);
const result = await executeScript(script, {
  declare: declareFn,
  clear: clearFn,
  ext: extFn,
  log: logFn
});
```

### Channel System

Provisions grouped by channels with weights:
```
Channel "bootstrap" (weight: 100)
  └── provision: "clear-device"

Channel "default" (weight: 200)
  └── provision: "refresh-params"

Channel "inform" (weight: 300)
  └── provision: "inform-config"
```

Higher weights execute later.

## Virtual Parameters

### Computation Flow

```typescript
function generateGetVirtualParameterProvisions(
  sessionContext: SessionContext
): VirtualParameterDeclaration[]
```

1. Identify virtual parameters needed
2. Load virtual parameter scripts
3. Execute to compute values
4. Return as synthetic parameters

### Virtual Parameter Script

```javascript
// Example virtual parameter
const serialNumber = declare("Device.DeviceInfo.SerialNumber", {value: Date.now()});
const oui = declare("Device.DeviceInfo.ManufacturerOUI", {value: Date.now()});
return {
  writable: false,
  value: [oui.value[0] + "-" + serialNumber.value[0], "xsd:string"]
};
```

## Device Synchronization

### SyncState Structure

```typescript
interface SyncState {
  refreshAttributes: {
    exist: Set<Path>;
    object: Set<Path>;
    writable: Set<Path>;
    value: Set<Path>;
    notification: Set<Path>;
    accessList: Set<Path>;
  };
  spv: Map<Path, AttributeValue>;
  gpn: Set<Path>;
  gpnPatterns: Map<Path, number>;
  tags: Map<string, boolean>;
  instancesToDelete: Map<Path, Set<Path>>;
  instancesToCreate: Map<Path, InstanceSet>;
  downloadsToCreate: Map<Path, Download>;
  reboot: number;
  factoryReset: number;
}
```

### Synchronization Priority

1. **Discovery** (GPN): Find available paths
2. **Retrieval** (GPV): Get current values
3. **Modification** (SPV): Set new values
4. **Structure** (AddObject/DeleteObject): Modify instances
5. **Operations** (Download/Reboot): Execute commands

## Session Serialization

### Serialize

```typescript
export function serialize(
  sessionContext: SessionContext
): string
```

Converts session to JSON for database storage:
- Encodes device data with revisions
- Preserves provision state
- Includes fault information

### Deserialize

```typescript
export function deserialize(
  data: string
): SessionContext
```

Restores session from stored data:
- Rebuilds device data structures
- Restores provision queue
- Recovers sync state

## Transfer Complete Handling

```typescript
export async function transferComplete(
  sessionContext: SessionContext,
  rpcReq: TransferCompleteRequest
): Promise<AcsResponse>
```

Processes download completion:
1. Match to pending download operation
2. Check fault status
3. Update operation state
4. Return acknowledgment

## Timeout Operations

```typescript
export async function timeoutOperations(
  sessionContext: SessionContext
): Promise<void>
```

Handles timed-out operations:
1. Find expired operations
2. Mark as failed
3. Generate fault entries
4. Clean up state

## Configuration Integration

### Config Callback

```typescript
export function configContextCallback(
  sessionContext: SessionContext,
  exp: Expression
): Expression
```

Evaluates configuration expressions with device context:
- Resolves device-specific config
- Supports dynamic configuration
- Caches results per session

## Error Handling

### Session Faults

```typescript
interface SessionFault {
  code: string;
  message: string;
  detail?: string;
  provisions: string[];
  retries: number;
  channel: string;
}
```

### Retry Logic

```
Fault occurs
    │
    ├─ Retryable? ──No──▶ Mark failed, continue
    │
    └─ Yes
        │
        ├─ Retries < max? ──No──▶ Mark failed, continue
        │
        └─ Yes ──▶ Increment retry, backoff, retry
```

### Fault Propagation

Session faults stored per channel:
```typescript
sessionContext.faults["channel-name"] = {
  code: "provision",
  message: "Script error",
  provisions: ["failing-script"],
  retries: 0,
  channel: "channel-name"
};
```

## Performance Optimization

### RPC Batching

Multiple parameters combined into single RPC:
```typescript
// Instead of 3 separate GetParameterValues
["Device.Info.Name", "Device.Info.Model", "Device.Info.Version"]
// Combined into 1 RPC
```

### Iteration Limits

- `MAX_COMMIT_ITERATIONS`: 32 (default)
- Prevents infinite provision loops
- Breaks cycles in provision dependencies

### Revision Tracking

Device data uses revision numbers for:
- Efficient change detection
- Minimal database writes
- Conflict resolution

## Integration Points

### With CWMP Service

```typescript
// lib/cwmp.ts
const sessionContext = await session.init(deviceId, cwmpVersion, timeout);
await session.inform(sessionContext, informRequest);
// ... RPC loop ...
await session.rpcResponse(sessionContext, id, response);
```

### With Database

```typescript
// lib/cwmp/db.ts
await saveDevice(sessionContext.deviceId, sessionContext.deviceData);
```

### With Extensions

```typescript
// Extension calls from provisions
const result = await session.extensionCall(sessionContext, "ext-name", "func", args);
```

## Debugging

### Session Logging

```typescript
logger.info({
  message: "Session state",
  sessionContext,
  state: sessionContext.syncState,
  provisions: sessionContext.provisions.length
});
```

### State Inspection

Key fields to check:
- `sessionContext.rpcCount` - RPCs sent
- `sessionContext.iteration` - Current iteration
- `sessionContext.faults` - Active faults
- `sessionContext.syncState` - Pending operations
