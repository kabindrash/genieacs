# GenieACS Utilities & Support Components Specification

## Overview

This document covers utility modules, helper functions, and support components that provide foundational capabilities across GenieACS services.

**Primary Files**:
- `lib/instance-set.ts` - Object instance management
- `lib/scheduling.ts` - Cron and interval scheduling
- `lib/forwarded.ts` - Proxy header handling
- `lib/common/debounce.ts` - Function debouncing
- `lib/common/memoize.ts` - Function memoization
- `lib/common/yaml.ts` - YAML serialization
- `lib/common/errors.ts` - Custom error types
- `lib/db/util.ts` - Database utilities
- `lib/cwmp/local-cache.ts` - CWMP service cache
- `lib/ui/local-cache.ts` - UI service cache
- `lib/debug.ts` - Debug logging utilities

## Instance Set (`instance-set.ts`)

### Purpose

Manages collections of TR-069 object instances with set operations for superset/subset matching. Used for tracking multi-instance objects like `Device.WiFi.SSID.*`.

### Interface

```typescript
interface Instance {
  [name: string]: string;  // Key-value pairs identifying instance
}

export default class InstanceSet {
  constructor()
  add(instance: Instance): void
  delete(instance: Instance): void
  superset(instance: Instance): Instance[]
  subset(instance: Instance): Instance[]
  forEach(callback: (instance: Instance) => void): void
  values(): IterableIterator<Instance>
  clear(): void
  get size(): number
  [Symbol.iterator](): IterableIterator<Instance>
}
```

### Operations

**superset(instance)**: Find all instances that contain the given key-value pairs.
```typescript
// Find all WiFi configs with SSID "MyNetwork"
const matches = instanceSet.superset({ SSID: "MyNetwork" });
// Returns instances like:
// { SSID: "MyNetwork", Enable: "true", Channel: "6" }
// { SSID: "MyNetwork", Enable: "false" }
```

**subset(instance)**: Find all instances whose keys are a subset of the given instance.
```typescript
// Find instances that match only these criteria
const matches = instanceSet.subset({ SSID: "MyNetwork", Enable: "true" });
```

### Sorting

Results are sorted by:
1. Number of keys (descending for superset, ascending for subset)
2. Key names alphabetically
3. Values alphabetically

### Use Cases

- Tracking object instances during CWMP session
- Alias path resolution (`Device.WiFi.SSID.[SSID:MyNetwork]`)
- Instance filtering in provisions

## Scheduling (`scheduling.ts`)

### Purpose

Provides scheduling utilities for periodic operations with device-specific variance to prevent thundering herd.

### Functions

#### variance(deviceId, vrnc)

```typescript
export function variance(deviceId: string, vrnc: number): number
```

Generates deterministic offset per device using MD5 hash:
```typescript
// Same device always gets same offset
const offset = variance("device-001", 3600000); // 0-3600000
```

**Algorithm**: `MD5(deviceId) % variance`

Used to spread device connections across time window.

#### interval(timestamp, intrvl, offset)

```typescript
export function interval(
  timestamp: number,
  intrvl: number,
  offset = 0
): number
```

Aligns timestamp to interval boundary:
```typescript
// Align to hourly boundary with device offset
const aligned = interval(Date.now(), 3600000, deviceOffset);
```

**Formula**: `floor((timestamp + offset) / interval) * interval - offset`

#### parseCron(cronExp)

```typescript
export function parseCron(cronExp: string): Schedule
```

Parses cron expression using `@breejs/later`:
```typescript
const schedule = parseCron("0 0 * * *");  // Daily at midnight
```

**Supports**: Standard 5-field or 6-field (with seconds) cron syntax.

#### cron(timestamp, schedule, offset)

```typescript
export function cron(
  timestamp: number,
  schedule: Schedule,
  offset = 0
): [number, number]
```

Returns `[prev, next]` occurrence times:
```typescript
const [lastRun, nextRun] = cron(Date.now(), schedule, deviceOffset);
```

### Thundering Herd Prevention

```typescript
// Each device gets unique offset
const offset = variance(deviceId, informInterval);

// Align inform time with offset
const informTime = interval(Date.now(), 86400000, offset);

// All devices spread across 24-hour window
```

## Proxy Headers (`forwarded.ts`)

### Purpose

Parses `Forwarded` HTTP header for reverse proxy deployments, extracting client IP and protocol information.

### Configuration

```typescript
// Trust proxies in these CIDR ranges
FORWARDED_HEADER = "192.168.1.0/24,10.0.0.0/8"
```

### Interface

```typescript
interface RequestOrigin {
  localAddress: string;   // Server address
  localPort: number;      // Server port
  remoteAddress: string;  // Client IP
  remotePort: number;     // Client port
  host: string;           // Host header
  encrypted: boolean;     // HTTPS connection
}

export function getRequestOrigin(request: IncomingMessage): RequestOrigin
```

### Forwarded Header Parsing

Supports RFC 7239 format:
```
Forwarded: for=192.168.1.100; proto=https; host=example.com; by=10.0.0.1
```

**Parsed Fields**:
| Field | Description |
|-------|-------------|
| `for` | Client IP address |
| `proto` | Protocol (http/https) |
| `host` | Original host header |
| `by` | Proxy address |

### Trust Validation

Only processes header if request comes from trusted proxy:
```typescript
const ip = parse(socketEndpoints.remoteAddress);
const trusted = cidrs.some((cidr) =>
  ip.kind() === cidr[0].kind() && ip.match(cidr)
);
```

### IPv6 Support

Handles IPv6 addresses in brackets:
```
Forwarded: for="[2001:db8::1]:8080"
```

### Caching

Results cached per request using WeakMap to avoid repeated parsing.

## Debounce (`common/debounce.ts`)

### Purpose

Batches rapid function calls within timeout window.

### Function

```typescript
export default function debounce<T>(
  func: (args: T[]) => void,
  timeout: number
): (arg: T) => void
```

### Behavior

- Collects all arguments during timeout window
- Calls function once with array of all arguments
- Resets timer on each new call

### Example

```typescript
const batchedLog = debounce((messages: string[]) => {
  console.log(`${messages.length} messages:`, messages);
}, 100);

batchedLog("a");  // Timer starts
batchedLog("b");  // Timer resets
batchedLog("c");  // Timer resets
// After 100ms: logs "3 messages: ['a', 'b', 'c']"
```

### Use Cases

- Batching database writes
- Aggregating log messages
- Reducing API call frequency

## Memoize (`common/memoize.ts`)

### Purpose

Caches function results with two-generation LRU eviction.

### Function

```typescript
export default function memoize<T extends (...args: any[]) => any>(func: T): T
```

### Caching Strategy

**Two-Generation Cache**:
```
cache1 (current) ←── cache2 (previous)
        │                   │
        └───── 120s ────────┘
                (rotate)
```

Every 120 seconds:
1. `cache2 = cache1`
2. `cache1 = new Map()`

### Key Generation

```typescript
function getKey(obj): string {
  // Primitives: "type:value"
  // Objects/Functions: "type:randomId" (via WeakMap)
}
```

### Promise Handling

Rejected promises are evicted from cache:
```typescript
r.catch(() => {
  cache1.delete(key);
  cache2.delete(key);
});
```

### Example

```typescript
const cachedFetch = memoize(async (url: string) => {
  const response = await fetch(url);
  return response.json();
});

// First call: actual fetch
await cachedFetch("/api/data");

// Second call within 120s: cached result
await cachedFetch("/api/data");
```

## YAML Serialization (`common/yaml.ts`)

### Purpose

Serializes JavaScript objects to YAML format with proper string handling.

### Function

```typescript
export function stringify(obj: unknown): string
```

### Configuration

| Constant | Value | Description |
|----------|-------|-------------|
| `LINE_WIDTH` | 80 | Maximum line width |
| `INDENTATION` | "  " | Two-space indentation |

### String Handling

**Reserved Words** (quoted):
- `true`, `True`, `TRUE`
- `false`, `False`, `FALSE`
- `null`, `Null`, `NULL`

**Multi-line Strings**:
- `|` for literal blocks (preserves newlines)
- `>` for folded blocks (wraps lines)

**Chomping Indicators**:
- `-` strip trailing newlines
- `+` keep trailing newlines
- (none) single trailing newline

### Example Output

```yaml
name: GenieACS
description: |
  A TR-069 Auto Configuration Server
  for device management.
config:
  - port: 7547
    ssl: true
  - port: 7557
    ssl: false
```

## Custom Errors (`common/errors.ts`)

### Purpose

Defines custom error types for specific error conditions.

### Error Types

```typescript
export class ResourceLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceLockedError";
  }
}
```

### Usage

```typescript
import { ResourceLockedError } from "./common/errors.ts";

if (isLocked) {
  throw new ResourceLockedError("Device session already active");
}
```

### Error Handling

```typescript
try {
  await acquireLock(deviceId);
} catch (err) {
  if (err instanceof ResourceLockedError) {
    // Handle lock contention
    return res.status(409).send("Device busy");
  }
  throw err;
}
```

## Database Utilities (`db/util.ts`)

### Purpose

Helper functions for MongoDB query building and projection optimization.

### Functions

#### optimizeProjection(obj)

```typescript
export function optimizeProjection(obj: { [path: string]: 1 }): {
  [path: string]: 1;
}
```

Removes overlapping projections:
```typescript
const proj = optimizeProjection({
  "Device.": 1,
  "Device.DeviceInfo.": 1,  // Removed (redundant)
  "Device.WiFi.": 1,        // Removed (redundant)
});
// Result: { "Device.": 1 }
```

#### convertOldPrecondition(q)

```typescript
export function convertOldPrecondition(q: Record<string, unknown>): Expression
```

Converts MongoDB-style queries to expression language:

| MongoDB | Expression |
|---------|------------|
| `{ field: value }` | `["=", ["PARAM", "field"], value]` |
| `{ field: { $ne: v } }` | `["OR", ["<>", ...], ["IS NULL", ...]]` |
| `{ $and: [...] }` | `["AND", ...]` |
| `{ $or: [...] }` | `["OR", ...]` |
| `{ _tags: "tag" }` | `["IS NOT NULL", ["PARAM", "Tags.tag"]]` |

### Tag Query Handling

```typescript
// Old format
{ _tags: "configured" }
// Converts to
["IS NOT NULL", ["PARAM", "Tags.configured"]]

// Negation
{ _tags: { $ne: "pending" } }
// Converts to
["IS NULL", ["PARAM", "Tags.pending"]]
```

## Service Local Caches

### CWMP Local Cache (`cwmp/local-cache.ts`)

Extends base `LocalCache` for CWMP service:

```typescript
import { LocalCache } from "../local-cache.ts";

// Cached data structure
interface CwmpConfig {
  presets: Preset[];
  provisions: Map<string, string>;
  virtualParameters: Map<string, string>;
  config: Map<string, Expression>;
}

// Usage
const cwmpCache = new LocalCache<CwmpConfig>(
  "cwmp-local-cache-hash",
  loadCwmpConfig
);
```

### UI Local Cache (`ui/local-cache.ts`)

Extends base `LocalCache` for UI service:

```typescript
interface UiConfig {
  users: Map<string, User>;
  permissions: Permission[];
  config: Map<string, unknown>;
}

// Exported functions
export async function getRevision(): Promise<string>
export function getUsers(revision: string): Record<string, User>
export function getPermissions(revision: string): Permission[]
export function getUiConfig(revision: string): UiConfig
```

### Cache Coordination

Both caches use the same invalidation mechanism:
1. Hash stored in MongoDB `cache` collection
2. Workers compare local hash to DB
3. Lock prevents concurrent refresh
4. `del("cwmp-local-cache-hash")` forces refresh

## Debug Logging (`debug.ts`)

### Purpose

Provides detailed logging for troubleshooting connection issues.

### Functions

```typescript
// HTTP logging
export function outgoingHttpRequest(
  req: ClientRequest,
  deviceId: string,
  method: string,
  url: string,
  body: string
): void

export function incomingHttpResponse(
  res: IncomingMessage,
  deviceId: string,
  body: string
): void

export function outgoingHttpRequestError(
  req: ClientRequest,
  deviceId: string,
  method: string,
  url: string,
  err: Error
): void

// UDP logging
export function outgoingUdpMessage(
  host: string,
  deviceId: string,
  port: number,
  msg: string
): void

// XMPP logging
export function outgoingXmppStanza(deviceId: string, stanza: string): void
export function incomingXmppStanza(deviceId: string, stanza: string): void
```

### Activation

Debug logging is controlled by `_debug` parameter in connection request functions:
```typescript
await httpConnectionRequest(url, authExp, allowBasic, timeout, true, deviceId);
//                                                            ^^^^
//                                                          debug=true
```

### Log Format

```javascript
{
  message: "Outgoing HTTP request",
  deviceId: "device-001",
  method: "GET",
  url: "http://192.168.1.100:7547/",
  body: "..."
}
```

## Integration Patterns

### Scheduling + Variance

```typescript
// In provision script
const deviceId = declare("DeviceID.ID", {value: 1}).value[0];
const offset = variance(deviceId, informInterval * 1000);
const informTime = interval(Date.now(), 86400000, offset);

declare("Device.ManagementServer.PeriodicInformTime",
  {value: 1},
  {value: informTime}
);
```

### Memoize + Database

```typescript
const getDeviceConfig = memoize(async (deviceId: string) => {
  return await db.collection("devices").findOne({ _id: deviceId });
});

// Cached for 120 seconds
const config = await getDeviceConfig("device-001");
```

### Debounce + Logging

```typescript
const batchLog = debounce((entries: LogEntry[]) => {
  logger.info({ count: entries.length }, "Batch processed");
  entries.forEach(e => writeToFile(e));
}, 1000);

// Collect entries for 1 second before writing
batchLog(entry);
```

## Performance Considerations

### Instance Set

- O(n) for superset/subset queries
- Sorting adds O(n log n) overhead
- Best for small instance counts (<100)

### Memoize

- 120-second cache rotation prevents memory leaks
- WeakMap for object keys enables garbage collection
- Promise rejection eviction prevents stale errors

### Forwarded Header

- WeakMap cache per request
- CIDR matching on every request
- Consider performance impact with many trusted ranges

### YAML Stringify

- Line folding for long strings
- Recursive for nested objects
- Use JSON.stringify for performance-critical paths
