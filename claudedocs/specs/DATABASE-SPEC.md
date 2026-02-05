# GenieACS Database Layer Specification

## Overview

GenieACS uses MongoDB as its primary data store, with GridFS for binary file storage. The database layer provides caching, query synthesis, and distributed locking.

**Primary Files**:
- `lib/db/db.ts` - Database connection and collections
- `lib/db/types.ts` - Collection schemas
- `lib/db/synth.ts` - Query synthesis
- `lib/cwmp/db.ts` - CWMP-specific operations
- `lib/ui/db.ts` - UI-specific operations
- `lib/versioned-map.ts` - Parameter versioning

## Connection Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `MONGODB_CONNECTION_URL` | required | MongoDB connection string |

## Collections

### devices

Stores device data and parameters.

```typescript
interface Device {
  _id: string;                    // Device ID (composite key)
  _lastInform: Date;              // Last inform timestamp
  _registered: Date;              // Registration timestamp
  _tags?: string[];               // Device tags
  _timestamp?: Date;              // Global parameter timestamp
  _deviceId?: {
    _Manufacturer: string;
    _OUI: string;
    _ProductClass?: string;
    _SerialNumber: string;
  };
  // Dynamic parameters as nested objects:
  // ParameterPath: {
  //   _value: string|number|boolean,
  //   _type: string,           // xsd:string, xsd:int, etc.
  //   _timestamp: Date,
  //   _writable: boolean,
  //   _object: boolean,        // If object node
  //   _notification: number,
  //   _accessList: string[]
  // }
}
```

### tasks

Pending device tasks.

```typescript
interface Task {
  _id: ObjectId;
  timestamp?: Date;
  expiry?: Date;
  name: string;           // Task type
  device: string;         // Target device ID
  // Type-specific fields:
  parameterNames?: string[];      // getParameterValues
  parameterValues?: [string, any, string?][]; // setParameterValues
  objectName?: string;            // add/deleteObject, refreshObject
  fileType?: string;              // download
  fileName?: string;              // download
  targetFileName?: string;        // download
  provisions?: [string, ...any[]][]; // provisions
}
```

### faults

Device and task faults.

```typescript
interface Fault {
  _id: string;            // Format: "deviceId:channel"
  device: string;
  channel: string;
  timestamp: Date;
  provisions: string;     // JSON-serialized
  retries: number;
  code: string;
  message: string;
  detail?: object;
  expiry?: Date;
}
```

### presets

Configuration presets.

```typescript
interface Preset {
  _id: string;            // Preset name
  weight: number;         // Priority (lower = first)
  channel: string;
  events: Record<string, boolean>;
  precondition?: string;  // Expression
  provision?: string;     // Provision name
  provisionArgs?: string; // Provision arguments
}
```

### provisions

Provision scripts.

```typescript
interface Provision {
  _id: string;            // Provision name
  script: string;         // JavaScript code
}
```

### virtualParameters

Virtual parameter scripts.

```typescript
interface VirtualParameter {
  _id: string;            // Parameter name
  script: string;         // JavaScript code
}
```

### files (GridFS metadata)

File metadata stored in `fs.files`.

```typescript
interface File {
  _id: string;            // Filename
  length: number;         // File size
  filename: string;       // Original filename
  uploadDate: Date;
  metadata?: {
    fileType?: string;    // TR-069 file type
    oui?: string;         // Manufacturer filter
    productClass?: string;
    version?: string;
  };
}
```

### operations

Pending asynchronous operations.

```typescript
interface Operation {
  _id: string;            // Format: "deviceId:commandKey"
  name: string;
  timestamp: Date;
  channels: string;       // JSON
  retries: string;        // JSON
  provisions: string;     // JSON
  args: string;           // JSON
}
```

### permissions

RBAC permissions.

```typescript
interface Permission {
  _id: string;
  role: string;
  resource: string;
  access: 1 | 2 | 3;      // 1=count, 2=read, 3=write
  filter?: string;        // Row-level filter expression
  validate?: string;      // Mutation validation expression
}
```

### users

User accounts.

```typescript
interface User {
  _id: string;            // Username
  password: string;       // Hashed password
  roles: string;          // Comma-separated roles
  salt: string;           // Password salt
}
```

### config

System configuration.

```typescript
interface Config {
  _id: string;            // Config key
  value: string;          // Expression string
}
```

### cache

Distributed cache.

```typescript
interface Cache {
  _id: string;            // Cache key
  value: string;
  timestamp: Date;
  expire: Date;           // TTL
}
```

### locks

Distributed locks.

```typescript
interface Lock {
  _id: string;            // Lock name
  value: string;          // Lock token
  timestamp: Date;
  expire: Date;           // TTL
}
```

## Indexes

### Current Indexes

```javascript
// tasks - efficient retrieval by device
db.tasks.createIndex({ device: 1, timestamp: 1 })

// cache - TTL automatic expiration
db.cache.createIndex({ expire: 1 }, { expireAfterSeconds: 0 })

// locks - TTL automatic expiration
db.locks.createIndex({ expire: 1 }, { expireAfterSeconds: 0 })
```

### Recommended Additional Indexes

```javascript
// devices - online status queries
db.devices.createIndex({ "_lastInform": 1 })

// devices - tag filtering
db.devices.createIndex({ "_tags": 1 })

// devices - OUI filtering
db.devices.createIndex({ "_deviceId._OUI": 1 })

// devices - product class filtering
db.devices.createIndex({ "_deviceId._ProductClass": 1 })
```

## Query Synthesis

### Expression Language

SQL-like syntax converted to MongoDB queries:

```sql
ProductClass = "Router" AND Uptime > 3600
DeviceID.SerialNumber LIKE "ABC%"
Tags.production = true
```

### Supported Operators

| Expression | MongoDB |
|------------|---------|
| `=` | `$eq` |
| `<>` | `$ne` |
| `>`, `>=`, `<`, `<=` | `$gt`, `$gte`, `$lt`, `$lte` |
| `LIKE` | `$regex` |
| `IS NULL` | `$exists: false` |
| `IS NOT NULL` | `$exists: true` |
| `AND` | `$and` |
| `OR` | `$or` |

### Path Mapping

Logical paths mapped to MongoDB field paths:

| Logical Path | MongoDB Path |
|--------------|--------------|
| `DeviceID.ID` | `_id` |
| `DeviceID.*` | `_deviceId._*` |
| `Events.Inform` | `_lastInform` |
| `Events.Registered` | `_registered` |
| `Tags.*` | `_tags` |
| `Param.Name` | `Param.Name._value` |

### Type System

| Parameter Type | BSON Types |
|----------------|------------|
| `_id` | string |
| `_lastInform`, `_registered` | date |
| `_tags` | array |
| `_deviceId.*` | string |
| Parameter values | string, number, bool, date |

## VersionedMap

Multi-version key-value store for parameter tracking during sessions.

### Purpose

- Track parameter changes across session revisions
- Enable rollback to previous states
- Compute diffs for persistence

### API

```typescript
class VersionedMap<K, V> {
  get(key: K, rev?: number): V;
  set(key: K, value: V, rev?: number): this;
  delete(key: K, rev?: number): boolean;
  getRevisions(key: K): Revisions<V>;
  setRevisions(key: K, revisions: Revisions<V>): void;
  getDiff(key: K): [V, V];  // [first, last]
  *diff(): IterableIterator<[K, V, V]>;
  collapse(revision: number): void;
}
```

### Revision Format

```typescript
interface Revisions<V> {
  [rev: number]: V;    // Value at revision
  delete?: number;     // Bitmask of deleted revisions
}
```

## Caching

### Two-Tier Cache Architecture

1. **Database Cache** (`cache` collection)
   - Coordinates invalidation across processes
   - TTL-based expiration

2. **Local Cache** (in-memory)
   - Fast access
   - 5-second refresh interval
   - Hash-based change detection

### CWMP Local Cache

Caches:
- Presets (with compiled scripts)
- Provisions (with compiled scripts)
- Virtual Parameters (with compiled scripts)
- Files metadata
- Config values

### UI Local Cache

Caches:
- Permissions (parsed into role hierarchy)
- Users (with password hashes)
- Config values
- UI configuration

### Cache Invalidation

Triggered by resource modifications:
- `cwmp-local-cache-hash`: presets, provisions, virtualParameters, files, config
- `ui-local-cache-hash`: permissions, users, config

## Distributed Locking

### Implementation

Uses MongoDB atomic operations:

```typescript
async function acquireLock(
  lockName: string,
  ttl: number,
  timeout = 0,
  token = Math.random().toString(36).slice(2)
): Promise<string>
```

### Lock Acquisition

1. `findOneAndUpdate` with `upsert: true`
2. On conflict (error 11000): Retry with backoff
3. Validate clock skew (30s tolerance)
4. Return token on success

### Lock Release

```typescript
async function releaseLock(lockName: string, token: string): Promise<void>
```

Deletes lock only if token matches.

### Usage

- Session management: `cwmp_session_{deviceId}`
- Cache coordination: Prevents concurrent rebuilds

## Device Operations

### Fetch Device

```typescript
async function fetchDevice(
  id: string,
  timestamp: number
): Promise<[Path, number, Attributes?][]>
```

Converts nested MongoDB document to flat path/attribute tuples.

### Save Device

```typescript
async function saveDevice(
  deviceId: string,
  deviceData: DeviceData,
  isNew: boolean,
  sessionTimestamp: number
): Promise<void>
```

Computes diffs and generates MongoDB update operations:
- `$set` for updates
- `$unset` for deletions
- `$addToSet` for tag additions
- `$pull` for tag removals

## Projection Optimization

Removes overlapping field projections:

```javascript
// Input
{"a": 1, "a.b": 1}

// Optimized
{"a": 1}
```

## Data Validation

### Parameter Value Sanitization

Converts values based on XSD type:
- `xsd:boolean`: Strings "true"/"false" to boolean
- `xsd:int`: Parse as integer
- `xsd:dateTime`: Parse as timestamp
- Default: Convert to string

### Old Precondition Conversion

Converts legacy MongoDB-style queries to expression format.

## GridFS Operations

### File Upload

```typescript
async function putFile(
  filename: string,
  metadata: Record<string, string>,
  contentStream: Readable
): Promise<void>
```

Uses `openUploadStreamWithId` with filename as ID.

### File Download

```typescript
function downloadFile(filename: string): Readable
```

Uses `openDownloadStreamByName`.

### File Delete

```typescript
async function deleteFile(filename: string): Promise<void>
```

Uses `filesBucket.delete()`.
