# GenieACS Type Definitions Specification

## Overview

The `lib/types.ts` module (518 lines) provides comprehensive TypeScript type definitions used throughout GenieACS. This specification documents all 50+ exported types, their relationships, and usage patterns.

**Primary File**: `lib/types.ts`

## Core Data Types

### Expression Type

```typescript
type Expression = string | number | boolean | null | Expression[];
```

Recursive type representing the expression language AST:
- **Primitives**: `string`, `number`, `boolean`, `null`
- **Operations**: Arrays with operator at index 0

**Examples**:
```typescript
const equality: Expression = ["=", "Device.Info.Name", "Router"];
const compound: Expression = ["AND", ["=", "A", 1], [">", "B", 0]];
const param: Expression = ["PARAM", "Device.DeviceInfo.SerialNumber"];
```

### Path Type

```typescript
interface Path extends Array<string> {
  readonly length: number;
  readonly alias: number;
  readonly wildcard: number;
}
```

Represents TR-069 parameter paths with metadata:
- `alias` - Bitmask indicating alias segments
- `wildcard` - Bitmask indicating wildcard segments

## Attribute Types

### AttributeValue

```typescript
type AttributeValue = string | number | boolean | null;
```

### AttributeTimestamps

```typescript
interface AttributeTimestamps {
  object?: number;
  writable?: number;
  value?: number;
  notification?: number;
  accessList?: number;
  [key: string]: number | undefined;
}
```

Tracks when each attribute was last updated.

### Attributes

```typescript
interface Attributes {
  object?: [number, 0 | 1];           // [timestamp, isObject]
  writable?: [number, 0 | 1];         // [timestamp, isWritable]
  value?: [number, AttributeValue, string]; // [timestamp, value, type]
  notification?: [number, number];    // [timestamp, notificationLevel]
  accessList?: [number, string[]];    // [timestamp, subscribers]
}
```

Complete attribute state with timestamps and values.

## Device Data Types

### DeviceData

```typescript
interface DeviceData {
  paths: PathSet;
  timestamps: VersionedMap<Path>;
  attributes: VersionedMap<Path>;
  trackers: Map<Path, Set<string>>;
  changes: Set<string>;
}
```

**Components**:
| Field | Purpose |
|-------|---------|
| `paths` | All known paths for device |
| `timestamps` | When each path was last seen |
| `attributes` | Parameter values and metadata |
| `trackers` | Change notification subscribers |
| `changes` | Pending change notifications |

### Clear

```typescript
interface Clear {
  path: Path;
  timestamp: number;
  attributes: AttributeTimestamps;
  changeFlags: number;
}
```

Represents a data clear operation for outdated data removal.

## Session Types

### SessionContext

```typescript
interface SessionContext {
  sessionId: string;
  timestamp: number;
  deviceId: string;
  deviceData: DeviceData;
  cwmpVersion: string;
  timeout: number;

  provisions: Provision[];
  channels: Record<string, number>;
  revisions: number[];
  rpcCount: number;
  iteration: number;
  cycle: number;

  extensionsCache: Record<string, unknown>;
  declarations: Declaration[][];

  virtualParameters: VirtualParameterDeclaration[][];

  syncState?: SyncState;
  lastActivity?: number;
  rpcRequest?: AcsRequest;
  operationsTouched?: Record<string, number>;

  tasks: Task[];
  operations: Operation[];
  faults: Record<string, SessionFault>;
  retries: Record<string, number>;
  cacheUntil?: number;
}
```

**Session Lifecycle Fields**:
| Field | Description |
|-------|-------------|
| `sessionId` | Unique session identifier |
| `timestamp` | Session start time |
| `deviceId` | Device being managed |
| `cwmpVersion` | Negotiated CWMP version |
| `timeout` | Session timeout (ms) |

**Provision Execution Fields**:
| Field | Description |
|-------|-------------|
| `provisions` | Active provision scripts |
| `channels` | Channel weights for execution order |
| `revisions` | Data revision history |
| `rpcCount` | RPC messages sent this session |
| `iteration` | Current provision iteration |
| `cycle` | Provision execution cycle |

**State Tracking Fields**:
| Field | Description |
|-------|-------------|
| `syncState` | Device synchronization state |
| `tasks` | Queued tasks for device |
| `operations` | Active operations |
| `faults` | Session faults by channel |

### SyncState

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
  virtualParameterDeclarations: VirtualParameterDeclaration[][];
  instancesToDelete: Map<Path, Set<Path>>;
  instancesToCreate: Map<Path, InstanceSet>;
  downloadsToDelete: Set<Path>;
  downloadsToCreate: Map<Path, Download>;
  downloadsValues: Map<Path, AttributeTimestamps>;
  downloadsDownload: Map<Path, Download>;
  reboot: number;
  factoryReset: number;
}
```

Tracks pending operations for device synchronization.

## Task Types

### Task

```typescript
interface Task {
  _id: ObjectId;
  name: string;
  device: string;
  timestamp: Date;
  status?: string;
  fault?: Fault;

  // Task-specific fields
  parameterNames?: string[];
  parameterValues?: Record<string, AttributeValue>;
  objectName?: string;
  fileName?: string;
  fileType?: string;
  targetFileName?: string;
}
```

**Task Types**:
| Name | Required Fields |
|------|----------------|
| `getParameterValues` | `parameterNames` |
| `setParameterValues` | `parameterValues` |
| `addObject` | `objectName` |
| `deleteObject` | `objectName` |
| `download` | `fileName` |
| `reboot` | - |
| `factoryReset` | - |
| `refreshObject` | `objectName` |
| `getParameterNames` | `parameterNames` |

### Operation

```typescript
interface Operation {
  _id: ObjectId;
  name: string;
  timestamp: Date;
  provisions: string[];
  channels: Record<string, number>;
  retries: Record<string, number>;
  args: unknown;
}
```

## Fault Types

### Fault

```typescript
interface Fault {
  code: string;
  message: string;
  detail?: string;
  timestamp?: number;
}
```

### SessionFault

```typescript
interface SessionFault extends Fault {
  provisions: string[];
  retries: number;
  channel: string;
}
```

### FaultStruct

```typescript
interface FaultStruct {
  faultCode: string;
  faultString: string;
  setParameterValuesFault?: {
    parameterName: string;
    faultCode: string;
    faultString: string;
  }[];
}
```

Used for CWMP fault parsing from SOAP responses.

## RPC Types

### ACS Requests (Server → Device)

```typescript
type AcsRequest =
  | GetParameterNamesRequest
  | GetParameterValuesRequest
  | SetParameterValuesRequest
  | AddObjectRequest
  | DeleteObjectRequest
  | RebootRequest
  | FactoryResetRequest
  | DownloadRequest
  | GetRPCMethodsRequest;

interface GetParameterNamesRequest {
  name: "GetParameterNames";
  parameterPath: string;
  nextLevel: boolean;
}

interface GetParameterValuesRequest {
  name: "GetParameterValues";
  parameterNames: string[];
}

interface SetParameterValuesRequest {
  name: "SetParameterValues";
  parameterList: [string, AttributeValue, string][];
  parameterKey?: string;
}

interface AddObjectRequest {
  name: "AddObject";
  objectName: string;
  parameterKey?: string;
}

interface DeleteObjectRequest {
  name: "DeleteObject";
  objectName: string;
  parameterKey?: string;
}

interface RebootRequest {
  name: "Reboot";
  commandKey?: string;
}

interface FactoryResetRequest {
  name: "FactoryReset";
}

interface DownloadRequest {
  name: "Download";
  fileType: string;
  url: string;
  username?: string;
  password?: string;
  fileSize?: number;
  targetFileName?: string;
  delaySeconds?: number;
  successUrl?: string;
  failureUrl?: string;
  commandKey?: string;
}
```

### CPE Requests (Device → Server)

```typescript
type CpeRequest =
  | InformRequest
  | TransferCompleteRequest
  | GetRPCMethodsRequest
  | RequestDownloadRequest;

interface InformRequest {
  name: "Inform";
  deviceId: {
    Manufacturer: string;
    OUI: string;
    ProductClass?: string;
    SerialNumber: string;
  };
  event: string[];
  retryCount: number;
  parameterList: [string, AttributeValue, string][];
  currentTime?: Date;
  maxEnvelopes?: number;
}

interface TransferCompleteRequest {
  name: "TransferComplete";
  commandKey: string;
  faultStruct?: FaultStruct;
  startTime?: Date;
  completeTime?: Date;
}

interface RequestDownloadRequest {
  name: "RequestDownload";
  fileType: string;
  fileTypeArg?: [string, string][];
}
```

### ACS Responses

```typescript
type AcsResponse =
  | GetParameterNamesResponse
  | GetParameterValuesResponse
  | SetParameterValuesResponse
  | AddObjectResponse
  | DeleteObjectResponse
  | RebootResponse
  | DownloadResponse
  | FaultResponse;

interface GetParameterNamesResponse {
  name: "GetParameterNamesResponse";
  parameterList: [string, boolean][];
}

interface GetParameterValuesResponse {
  name: "GetParameterValuesResponse";
  parameterList: [string, AttributeValue, string][];
}

interface SetParameterValuesResponse {
  name: "SetParameterValuesResponse";
  status: number;
}

interface AddObjectResponse {
  name: "AddObjectResponse";
  instanceNumber: number;
  status: number;
}
```

## Declaration Types

### Declaration

```typescript
interface Declaration {
  path: Path;
  pathGet?: number;
  pathSet?: number;
  attrGet?: AttributeTimestamps;
  attrSet?: Partial<Attributes>;
  defer?: boolean;
}
```

Specifies what to retrieve or set on a device path:
| Field | Purpose |
|-------|---------|
| `path` | Target path (may include wildcards/aliases) |
| `pathGet` | Timestamp for path discovery |
| `pathSet` | Timestamp for path creation/deletion |
| `attrGet` | Attributes to retrieve |
| `attrSet` | Attributes to set |
| `defer` | Defer execution to later iteration |

### VirtualParameterDeclaration

```typescript
type VirtualParameterDeclaration = [
  Path,                    // Path
  AttributeTimestamps,     // attrGet
  Partial<Attributes>      // attrSet
];
```

## Provision Types

### Provision

```typescript
type Provision = [string, ...unknown[]];
```

A provision is an array with script name at index 0 and arguments following.

**Examples**:
```typescript
const refresh: Provision = ["refresh", "Device.DeviceInfo.", "value"];
const setValue: Provision = ["value", "Device.Info.Name", "Router"];
const download: Provision = ["download", "1 Firmware Upgrade Image", "firmware.img"];
```

### Preset

```typescript
interface Preset {
  _id: string;
  channel: string;
  weight: number;
  precondition?: Expression;
  events?: Record<string, boolean>;
  schedule?: {
    md?: number[];
    h?: number[];
    m?: number[];
    s?: number[];
  };
  provisions: Provision[];
}
```

## Query Types

### QueryOptions

```typescript
interface QueryOptions {
  projection?: Record<string, 1>;
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}
```

## Utility Types

### DeviceIdStruct

```typescript
interface DeviceIdStruct {
  Manufacturer: string;
  OUI: string;
  ProductClass?: string;
  SerialNumber: string;
}
```

### Download

```typescript
interface Download {
  fileType: string;
  fileName: string;
  url?: string;
  username?: string;
  password?: string;
  targetFileName?: string;
}
```

### PermissionSet

```typescript
interface PermissionSet {
  role: string;
  resource: string;
  access: number;
  filter?: Expression;
  validate?: Expression;
}
```

## Type Relationships

```
SessionContext
    ├── DeviceData
    │   ├── PathSet (paths)
    │   ├── VersionedMap<Path> (timestamps)
    │   ├── VersionedMap<Path> (attributes)
    │   └── Map<Path, Set<string>> (trackers)
    │
    ├── SyncState
    │   ├── Set<Path> (refreshAttributes.*)
    │   ├── Map<Path, AttributeValue> (spv)
    │   └── Map<Path, Download> (downloadsToCreate)
    │
    ├── Declaration[][]
    │   └── Declaration
    │       ├── Path
    │       ├── AttributeTimestamps
    │       └── Attributes
    │
    ├── Task[]
    │   └── Task
    │       └── Fault
    │
    └── SessionFault[]
        └── Fault
```

## Usage Examples

### Creating a Session Context

```typescript
const sessionContext: SessionContext = {
  sessionId: generateId(),
  timestamp: Date.now(),
  deviceId: "001122-Router-ABC123",
  deviceData: initDeviceData(),
  cwmpVersion: "1.4",
  timeout: 30000,
  provisions: [],
  channels: {},
  revisions: [0],
  rpcCount: 0,
  iteration: 0,
  cycle: 0,
  extensionsCache: {},
  declarations: [],
  virtualParameters: [],
  tasks: [],
  operations: [],
  faults: {},
  retries: {}
};
```

### Working with Declarations

```typescript
const declaration: Declaration = {
  path: Path.parse("Device.DeviceInfo.SoftwareVersion"),
  attrGet: { value: Date.now() },
  attrSet: { value: [Date.now(), "2.0.0", "xsd:string"] }
};
```

### Handling RPC Requests

```typescript
function handleInform(req: InformRequest): void {
  const deviceId = generateDeviceId(req.deviceId);
  const events = req.event;
  const params = req.parameterList;

  for (const [name, value, type] of params) {
    // Process parameters
  }
}
```
