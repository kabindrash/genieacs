# GenieACS Core Components Specification

## Overview

This document covers fundamental components that underpin GenieACS operations: device data management, HTTP server infrastructure, local caching, system initialization, and GPN optimization heuristics.

**Primary Files**:
- `lib/device.ts` - Device data manipulation
- `lib/server.ts` - HTTP/HTTPS server wrapper
- `lib/local-cache.ts` - Distributed local cache
- `lib/init.ts` - System bootstrap and seeding
- `lib/gpn-heuristic.ts` - GetParameterNames optimization
- `lib/query.ts` - Database query building

## Device Data Management (`device.ts`)

### Purpose

Manages device parameter state during CWMP sessions, handling:
- Parameter value sanitization
- Alias path resolution
- Change tracking
- Attribute management

### Change Tracking Flags

```typescript
const CHANGE_FLAGS = {
  object: 2,      // Object type changed
  writable: 4,    // Writable flag changed
  value: 8,       // Value changed
  notification: 16, // Notification level changed
  accessList: 32,  // Access list changed
};
```

### Core Functions

#### Parameter Value Sanitization

```typescript
export function sanitizeParameterValue(
  parameterValue: [string | number | boolean, string]
): [string | number | boolean, string]
```

Converts parameter values to canonical types based on XSD type:

| XSD Type | Conversion |
|----------|------------|
| `xsd:boolean` | Parse "true"/"false"/"1"/"0" |
| `xsd:int`, `xsd:unsignedInt` | Parse as integer |
| `xsd:dateTime` | Parse as timestamp (ms) |
| Other | Convert to string |

#### Alias Resolution

```typescript
export function getAliasDeclarations(
  path: Path,
  timestamp: number,
  attrGet?: object
): Declaration[]
```

Expands alias paths (e.g., `Device.WiFi.SSID.[SSID:MyNetwork]`) into concrete declarations for resolution.

**Algorithm**:
1. Strip alias to get wildcard path
2. For each alias segment, recursively get declarations
3. Combine with value timestamp requirements

#### Path Unpacking

```typescript
export function unpack(
  deviceData: DeviceData,
  path: Path,
  revision?: number
): Path[]
```

Resolves wildcard/alias paths to concrete matching paths:

1. **Simple paths**: Direct lookup in PathSet
2. **Alias paths**:
   - Strip aliases to wildcards
   - Find all matching paths
   - Filter by alias value matches
3. **Sort results**: Numeric sorting for instance numbers

#### Data Clear

```typescript
export function clear(
  deviceData: DeviceData,
  path: Path,
  timestamp: number,
  attributes: AttributeTimestamps,
  changeFlags?: number
): void
```

Marks device data as outdated:
- Clears timestamps for matching paths
- Removes attributes if timestamp is newer
- Triggers change trackers for affected channels

#### Data Set

```typescript
export function set(
  deviceData: DeviceData,
  path: Path,
  timestamp: number,
  attributes: Attributes,
  toClear?: Clear[]
): Clear[]
```

Updates device data with new values:
- Adds path to PathSet if new
- Compares timestamps to determine freshness
- Tracks changes for notification
- Recursively ensures parent paths exist as objects

#### Change Tracking

```typescript
export function track(
  deviceData: DeviceData,
  path: Path,
  marker: string,
  attributes?: string[]
): void

export function clearTrackers(
  deviceData: DeviceData,
  tracker: string | string[]
): void
```

Registers interest in path changes and clears completed trackers.

## HTTP Server (`server.ts`)

### Purpose

Provides HTTP/HTTPS server wrapper with:
- SSL/TLS support
- Socket endpoint tracking
- Graceful shutdown
- Client error handling

### Server Options

```typescript
interface ServerOptions {
  port?: number;
  host?: string;
  ssl?: { key: string; cert: string };
  timeout?: number;
  keepAliveTimeout?: number;
  requestTimeout?: number;
  onConnection?: (socket: Socket) => void;
  onClientError?: (err: Error, socket: Socket) => void;
}
```

### Socket Endpoint Tracking

```typescript
interface SocketEndpoint {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  remoteFamily: "IPv4" | "IPv6";
}

const socketEndpoints: WeakMap<Socket, SocketEndpoint> = new WeakMap();
```

Socket endpoints are captured on connection since they're unavailable after close.

### SSL Certificate Loading

```typescript
function getValidPrivKeys(value: string): Buffer[]
function getValidCerts(value: string): Buffer[]
```

**Formats Supported**:
- File path: `/path/to/key.pem`
- Inline PEM: `-----BEGIN PRIVATE KEY-----...`
- Multiple (colon-separated): `/path/key1.pem:/path/key2.pem`

### Server Lifecycle

```typescript
export function start(
  options: ServerOptions,
  listener: Promisify<http.RequestListener>
): void

export function stop(terminateConnections = true): Promise<void>

export function getSocketEndpoints(socket: Socket): SocketEndpoint
```

**Graceful Shutdown**:
1. Stop accepting new connections
2. Wait up to 20 seconds for active requests
3. Remove request listener
4. Set 1-second socket timeout
5. Force close after 30 seconds total

## Local Cache (`local-cache.ts`)

### Purpose

Provides distributed local caching with:
- Version-based invalidation
- Lock-based refresh coordination
- Snapshot isolation for concurrent requests

### Architecture

```typescript
export class LocalCache<T> {
  private nextRefresh: number;
  private currentRevision: string;
  private snapshots: Map<string, T>;

  constructor(
    private cacheKey: string,
    private callback: () => Promise<[string, T]>
  );

  async getRevision(): Promise<string>;
  hasRevision(revision: string): boolean;
  get(revision: string): T;
  async refresh(): Promise<void>;
}
```

### Configuration

| Constant | Value | Description |
|----------|-------|-------------|
| `REFRESH` | 5000ms | Refresh check interval |
| `EVICT_TIMEOUT` | 120000ms | Snapshot eviction delay |

### Refresh Algorithm

```
1. Check if refresh needed (time-based)
2. Query distributed cache for current hash
3. If hash matches local → skip refresh
4. Acquire distributed lock
5. Execute callback to generate new data
6. Store new snapshot locally
7. Update distributed cache with new hash
8. Release lock
9. Schedule old snapshot eviction
```

### Snapshot Isolation

Multiple snapshots are retained for concurrent requests:
- Current revision actively served
- Previous revisions kept for 2 minutes
- Concurrent refreshes coordinated via lock

### Usage Pattern

```typescript
const cache = new LocalCache<Config>(
  "config-cache-key",
  async () => {
    const data = await loadFromDatabase();
    const hash = computeHash(data);
    return [hash, data];
  }
);

// Get current revision (refreshes if needed)
const revision = await cache.getRevision();

// Get data for specific revision
const data = cache.get(revision);
```

## System Initialization (`init.ts`)

### Purpose

Handles first-time setup and default configuration seeding.

### Bootstrap Status

```typescript
interface Status {
  users: boolean;     // No users configured
  presets: boolean;   // No presets configured
  filters: boolean;   // No UI filters
  device: boolean;    // No device page config
  index: boolean;     // No index page config
  overview: boolean;  // No overview config
}

export async function getStatus(): Promise<Status>
```

### Seed Function

```typescript
export async function seed(options: Record<string, boolean>): Promise<void>
```

**Seedable Resources**:

| Option | Seeds |
|--------|-------|
| `users` | Admin user + permissions |
| `filters` | Serial, ProductClass, Tag filters |
| `device` | Device page layout |
| `index` | Device list columns |
| `overview` | Dashboard charts |
| `presets` | bootstrap, default, inform presets |

### Default Provisions

**Bootstrap Provision**:
```javascript
const now = Date.now();
clear("Device", now);
clear("InternetGatewayDevice", now);
```

**Default Provision**:
```javascript
const hourly = Date.now(3600000);
declare("InternetGatewayDevice.DeviceInfo.HardwareVersion", {path: hourly, value: hourly});
declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {path: hourly, value: hourly});
// ... more hourly refreshes
```

**Inform Provision**:
```javascript
const username = declare("DeviceID.ID", {value: 1}).value[0];
const password = Math.trunc(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
const informInterval = 300;
// Configure connection request credentials and periodic inform
```

### Default Permissions

```typescript
const permissions = [
  { role: "admin", resource: "devices", access: 3, validate: "true" },
  { role: "admin", resource: "faults", access: 3, validate: "true" },
  { role: "admin", resource: "files", access: 3, validate: "true" },
  { role: "admin", resource: "presets", access: 3, validate: "true" },
  { role: "admin", resource: "provisions", access: 3, validate: "true" },
  { role: "admin", resource: "config", access: 3, validate: "true" },
  { role: "admin", resource: "permissions", access: 3, validate: "true" },
  { role: "admin", resource: "users", access: 3, validate: "true" },
  { role: "admin", resource: "virtualParameters", access: 3, validate: "true" },
];
```

## GPN Heuristic (`gpn-heuristic.ts`)

### Purpose

Estimates GetParameterNames (GPN) RPC count to optimize CWMP data retrieval.

### Algorithm

```typescript
export function estimateGpnCount(
  gpnPatterns: [Path, number][],
  depth = 0
): number
```

**Parameters**:
- `gpnPatterns`: Array of [path, flags] tuples
- `flags`: Bitmask where set bits indicate segments needing refresh
- `depth`: Current recursion depth

### Configuration

| Constant | Value | Description |
|----------|-------|-------------|
| `WILDCARD_MULTIPLIER` | 2 | Estimated instances per wildcard |
| `UNDISCOVERED_DEPTH` | 7 | Max depth for undiscovered paths |

### Estimation Logic

```
1. Separate patterns into:
   - Concrete children (known paths)
   - Wildcard children (need discovery)

2. For undiscovered paths (flags & 1):
   - Add 1 GPN for this level
   - Stop at UNDISCOVERED_DEPTH

3. For wildcards:
   - Multiply child estimate by WILDCARD_MULTIPLIER
   - Subtract concrete path estimates

4. Sum all child estimates
```

### Use Case

Decides whether to use `nextLevel=false` in GPN:
- **Few GPNs expected**: Use `nextLevel=true` (efficient)
- **Many GPNs expected**: Use `nextLevel=false` (batch)

## Query Building (`query.ts`)

### Purpose

Converts expressions to MongoDB queries with projection support.

### Key Functions

```typescript
// Convert filter expression to MongoDB query
export function convertFilter(filter: Expression): object;

// Build projection for required fields
export function buildProjection(fields: string[]): object;

// Combine multiple queries
export function combineQueries(queries: object[]): object;
```

### Filter Conversion

| Expression | MongoDB Query |
|------------|---------------|
| `["=", "field", value]` | `{ field: value }` |
| `["<>", "field", value]` | `{ field: { $ne: value } }` |
| `[">", "field", value]` | `{ field: { $gt: value } }` |
| `["LIKE", "field", pattern]` | `{ field: { $regex: pattern } }` |
| `["AND", expr1, expr2]` | `{ $and: [query1, query2] }` |
| `["OR", expr1, expr2]` | `{ $or: [query1, query2] }` |
| `["IS NULL", "field"]` | `{ field: null }` |

## Integration Patterns

### Session Data Flow

```
1. CWMP Request arrives
   └─ server.ts: Accept connection, track socket

2. Load cached configuration
   └─ local-cache.ts: Get revision, retrieve snapshot

3. Process device parameters
   └─ device.ts: sanitize, set, track changes

4. Build database queries
   └─ query.ts: Convert expressions

5. Optimize GPN operations
   └─ gpn-heuristic.ts: Estimate optimal batch size
```

### Cache Coordination

```
                 ┌─────────────┐
                 │   MongoDB   │
                 │ cache table │
                 └──────┬──────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Worker 1│    │ Worker 2│    │ Worker N│
    │ LocalCache│   │ LocalCache│   │ LocalCache│
    └─────────┘    └─────────┘    └─────────┘

- MongoDB stores authoritative hash
- Workers compare local hash to DB
- Lock prevents concurrent refresh
- Snapshots provide isolation
```

## Performance Considerations

### Device Data

- **PathSet indexing**: O(1) lookup for exact paths
- **Change tracking**: Bitmap-based for efficiency
- **Snapshot isolation**: Avoids locking during reads

### Local Cache

- **5-second refresh interval**: Balances freshness vs load
- **120-second eviction**: Handles long requests
- **Lock contention**: Minimized with hash comparison

### GPN Optimization

- **Heuristic accuracy**: Estimates within 2x typical
- **Depth limiting**: Prevents excessive recursion
- **Wildcard handling**: Accounts for instance expansion

## Error Handling

### Device Data

- Invalid timestamps: Silently ignored (no update)
- Missing paths: Created on first access
- Type mismatches: Sanitized to string

### Server

- SSL errors: Logged, connection closed
- Client errors: 400 response, logged
- Shutdown timeout: Force close after 30s

### Local Cache

- Lock acquisition failure: Proceeds without lock
- Callback errors: Propagated to caller
- Hash mismatch: Triggers full refresh
