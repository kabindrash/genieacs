# GenieACS Shared Infrastructure Specification

## Overview

The GenieACS shared infrastructure provides foundational components including type definitions, path handling for device parameters, an expression language for queries, configuration management, logging, clustering, and utility functions.

**Primary Files**:
- `lib/types.ts` - Core type definitions
- `lib/common/path.ts` - TR-069 path notation
- `lib/common/expression/` - Query expression language
- `lib/config.ts` - Configuration system
- `lib/logger.ts` - Logging infrastructure
- `lib/cluster.ts` - Worker process management

## Type System

### Expression Types

```typescript
// Base expression - recursive structure for queries
export type Expression = string | number | boolean | null | any[];
```

Expressions use prefix notation with operator at index 0:
- `["AND", expr1, expr2]`
- `["=", "Parameter.Name", "value"]`
- `["LIKE", "DeviceID.SerialNumber", "ABC%"]`

### Device Attributes

```typescript
interface Attributes {
  object?: [number, 1 | 0];       // [timestamp, isObject]
  writable?: [number, 1 | 0];     // [timestamp, isWritable]
  value?: [number, [value, type]]; // [timestamp, [value, xsd:type]]
  notification?: [number, number]; // [timestamp, level]
  accessList?: [number, string[]]; // [timestamp, subscribers]
}
```

### DeviceData Structure

```typescript
interface DeviceData {
  paths: PathSet;                              // All known parameter paths
  timestamps: VersionedMap<Path, number>;      // Discovery timestamps
  attributes: VersionedMap<Path, Attributes>;  // Parameter attributes
  trackers: Map<Path, { [name: string]: number }>; // Change tracking
  changes: Set<string>;                        // Modified channels
}
```

### Session Context

Central state object for CWMP sessions:

| Property | Type | Description |
|----------|------|-------------|
| `sessionId` | string | Unique session identifier |
| `deviceId` | string | Device identifier |
| `deviceData` | DeviceData | Cached device state |
| `cwmpVersion` | string | Protocol version |
| `provisions` | any[] | Active provision scripts |
| `channels` | object | Active processing channels |
| `syncState` | SyncState | Pending sync operations |
| `state` | number | Session state machine |
| `authState` | number | Authentication state |

### Fault Types

```typescript
interface Fault {
  code: string;
  message: string;
  detail?: FaultStruct;
  timestamp?: number;
}

interface SessionFault extends Fault {
  provisions: string;   // Pending provisions
  retryNow?: boolean;   // Immediate retry
  retries?: number;     // Retry count
  expiry?: number;      // Expiration timestamp
}
```

## Path Notation System

### Path Class

```typescript
class Path {
  public readonly segments: Segments;  // Path components
  public readonly wildcard: number;    // Bitmask of wildcard positions
  public readonly alias: number;       // Bitmask of alias positions
}
```

### Path Syntax

| Pattern | Description | Example |
|---------|-------------|---------|
| Simple | Dot-separated segments | `Device.DeviceInfo.Manufacturer` |
| Wildcard | `*` matches any segment | `Device.WiFi.Radio.*.Enable` |
| Alias | `[path:value]` matches by value | `Device.WiFi.SSID.[SSID:MyNetwork].Enable` |

### Caching Strategy

Two-level LRU cache with 120-second rotation:
```typescript
let cache1 = new Map<string, Path>();
let cache2 = new Map<string, Path>();

// Every 120 seconds
cache2 = cache1;
cache1 = new Map();
```

### Path Operations

| Method | Description |
|--------|-------------|
| `parse(str)` | Create Path from string (cached) |
| `slice(start, end)` | Extract sub-path |
| `concat(path2)` | Join two paths |
| `stripAlias()` | Replace aliases with wildcards |
| `toString()` | String representation |

## PathSet Data Structure

Multi-indexed collection for efficient path queries:

```typescript
class PathSet {
  private lengthIndex: Set<Path>[];           // By segment count
  private fragmentIndex: Map<string, Set<Path>>[]; // By segment value
  private stringIndex: Map<string, Path>;     // Direct lookup
}
```

### Query Method

```typescript
find(path: Path, superset: boolean, subset: boolean, depth: number): Path[]
```

| Parameters | Result |
|------------|--------|
| `superset=false, subset=false` | Exact match |
| `superset=true` | Paths that `path` could match |
| `subset=true` | Paths that match `path` pattern |

## Expression Language

### Operator Precedence

| Level | Operators | Associativity |
|-------|-----------|---------------|
| 10 | OR | Left |
| 11 | AND | Left |
| 12 | NOT | Unary |
| 20 | =, <>, >, >=, <, <=, LIKE | Binary |
| 30 | \|\| (concat) | Left |
| 31 | +, - | Left |
| 32 | *, /, % | Left |

### Built-in Functions

| Function | Arguments | Description |
|----------|-----------|-------------|
| `NOW()` | none | Current timestamp |
| `UPPER(str)` | 1 | Uppercase conversion |
| `LOWER(str)` | 1 | Lowercase conversion |
| `ROUND(num, precision?)` | 1-2 | Round to decimal places |
| `COALESCE(val1, ...)` | 1+ | First non-null value |

### Three-Value Logic

- `AND`: Returns `false` if any is `false`, `null` if any is `null`
- `OR`: Returns `true` if any is `true`, `null` if any is `null`
- `NOT`: Negates or returns `null`

### Expression Evaluation

```typescript
function evaluate(
  exp: Expression,
  obj?: Record<string, unknown>,
  now?: number,
  cb?: (e: Expression) => Expression,
): Expression
```

Supports partial evaluation - returns simplified expression when operands aren't fully resolved.

## Configuration System

### Configuration Sources (Priority)

1. Command Line: `--option-name value`
2. Environment: `GENIEACS_OPTION_NAME`
3. Config File: `config/config.json`
4. Defaults

### Service Configuration

| Service | Port | SSL Cert | SSL Key |
|---------|------|----------|---------|
| CWMP | 7547 | `CWMP_SSL_CERT` | `CWMP_SSL_KEY` |
| NBI | 7557 | `NBI_SSL_CERT` | `NBI_SSL_KEY` |
| FS | 7567 | `FS_SSL_CERT` | `FS_SSL_KEY` |
| UI | 3000 | `UI_SSL_CERT` | `UI_SSL_KEY` |

### Timing Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `DOWNLOAD_TIMEOUT` | 3600s | Download timeout |
| `EXT_TIMEOUT` | 3000ms | Extension timeout |
| `MAX_CACHE_TTL` | 86400s | Cache expiration |
| `RETRY_DELAY` | 300s | Fault retry delay |
| `SESSION_TIMEOUT` | 30s | Session timeout |

### Device-Specific Configuration

Lookup order with progressive specificity:
1. `OPTION-MANUFACTURER-OUI-PRODUCTCLASS-SERIAL`
2. `OPTION-MANUFACTURER-OUI-PRODUCTCLASS`
3. `OPTION-MANUFACTURER-OUI`
4. `OPTION-MANUFACTURER`
5. `OPTION`

## Logging Infrastructure

### Log Streams

| Stream | Default | Purpose |
|--------|---------|---------|
| Application | stderr | Process events |
| Access | stdout | Request logs |

### Log Formats

**Simple Format**:
```
2024-01-15T10:30:45.123Z [INFO] 192.168.1.1 Device-001: Message; key="value"
```

**JSON Format**:
```json
{"timestamp":"...","severity":"info","hostname":"server1","pid":1234,"message":"..."}
```

**Systemd Format**: Prepends severity prefix (`<6>` info, `<4>` warn, `<3>` error)

### Log Rotation

- Checks file inode every 60 seconds
- Reopens if file moved (logrotate compatible)
- Synchronized across workers

## Cluster Mode

### Worker Management

```typescript
function start(workerCount: number, servicePort: number, serviceAddress: string): void
```

Default workers: `Math.max(2, cpus().length)`

### Crash Recovery

1. Log worker death with exit code/signal
2. Track crashes in 3-minute sliding window
3. Exit if >5 crashes in each of 3 consecutive minutes
4. Throttle respawns: minimum 2 seconds between restarts

## Proxy Handling

### Request Origin

```typescript
interface RequestOrigin {
  localAddress: string;   // Server bind address
  localPort: number;      // Server port
  remoteAddress: string;  // Client IP
  remotePort: number;     // Client port
  host: string;           // Host header
  encrypted: boolean;     // TLS connection
}
```

### Forwarded Header

```
Forwarded: for=client; proto=https; host=example.com; by=proxy
```

Only processed from trusted proxies (configured via `FORWARDED_HEADER` CIDR list).

## Utility Components

### VersionedMap

Multi-version key-value store for session state:

```typescript
class VersionedMap<K, V> {
  get(key: K, rev?: number): V
  set(key: K, value: V, rev?: number): this
  delete(key: K, rev?: number): boolean
  getDiff(key: K): [V, V]  // [first, last]
  collapse(revision: number): void
}
```

### Memoize

Two-level LRU caching for function results:
- WeakMap-based key generation
- 120-second cache rotation
- Promise rejection evicts cache entry

### Debounce

Batches calls within timeout window:

```typescript
function debounce<T>(func: (args: T[]) => void, timeout: number): (arg: T) => void
```

## Authorization System

### Authorizer Class

```typescript
class Authorizer {
  hasAccess(resourceType: string, access: number): boolean
  getFilter(resourceType: string, access: number): Expression
  getValidator(resourceType: string, resource: unknown): ValidatorFn
}
```

### Permission Structure

```typescript
interface Permissions {
  [role: string]: {
    [access: number]: {
      [resource: string]: {
        access: number;         // 1=read, 2=write, 3=read+write
        filter: Expression;     // Row-level security
        validate?: Expression;  // Mutation validation
      };
    };
  };
}
```

## Bootstrap / Initialization

### Status Check

```typescript
interface Status {
  users: boolean;     // No users configured
  presets: boolean;   // No presets configured
  filters: boolean;   // No UI filters
  device: boolean;    // No device page config
  index: boolean;     // No index page config
  overview: boolean;  // No overview config
}
```

### Default Provisions

| Provision | Purpose |
|-----------|---------|
| bootstrap | Clear device tree on first boot |
| default | Hourly refresh of basic parameters |
| inform | Configure connection request credentials |

## Performance Considerations

### Path Parsing
- Cache hit rate critical for performance
- Canonical string representation enables sharing
- Avoid creating paths in hot loops

### Expression Evaluation
- Pre-parse and cache expressions
- Use `minimize()` for complex filters
- Avoid deep CASE nesting

### Cluster Mode
- Worker count should match CPU cores
- 2-second respawn throttle prevents thrashing
- Crash monitoring protects against cascades
