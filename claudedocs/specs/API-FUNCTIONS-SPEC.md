# GenieACS API Functions Specification

## Overview

The `lib/api-functions.ts` module (499 lines) provides core API business logic functions used by both the NBI (North Bound Interface) and internal services. It handles connection requests, task management, resource CRUD operations, and local authentication.

**Primary File**: `lib/api-functions.ts`

## Connection Request System

### Connection Request Routing

```typescript
export async function connectionRequest(
  deviceId: string,
  device: Record<string, { value?: [any, string] }>
): Promise<void>
```

**Decision Tree**:
```
1. Extract connection parameters from device record
2. Determine connection method:
   ├─ XMPP JID present? → xmppConnectionRequest()
   ├─ UDP address present? → udpConnectionRequest()
   └─ HTTP URL present? → httpConnectionRequest()
3. Apply authentication expression from config
4. Handle timeout and errors
```

**Configuration Dependencies**:
| Config Key | Purpose |
|------------|---------|
| `CONNECTION_REQUEST_TIMEOUT` | Request timeout in ms |
| `CONNECTION_REQUEST_ALLOW_BASIC_AUTH` | Allow HTTP Basic auth |
| `DEBUG` | Enable debug logging |

### Session Polling

```typescript
export async function awaitSessionStart(
  deviceId: string,
  lastInform: number,
  timeout: number
): Promise<number>
```

Polls database for session initiation:
- Checks `faults` collection for new device entries
- Uses exponential backoff (50ms initial, 1.5x multiplier)
- Returns timestamp of session start or 0 on timeout

```typescript
export async function awaitSessionEnd(
  deviceId: string,
  timeout: number
): Promise<boolean>
```

Polls for session termination:
- Checks `cache` collection for session lock release
- Same exponential backoff pattern
- Returns true if session ended, false on timeout

## Task Management

### Task Sanitization

```typescript
function sanitizeTask(task: Record<string, unknown>): Task
```

Validates and normalizes task objects before database insertion:

**Validation Rules**:
| Field | Validation |
|-------|------------|
| `name` | Required, must be valid task type |
| `device` | Required, valid device ID |
| `parameterNames` | Array for getParameterValues |
| `parameterValues` | Object for setParameterValues |
| `fileName` | Required for download tasks |
| `fileType` | Optional, defaults from file metadata |

**Supported Task Types**:
- `getParameterValues`
- `setParameterValues`
- `addObject`
- `deleteObject`
- `reboot`
- `factoryReset`
- `download`
- `refreshObject`
- `getParameterNames`

### Task Insertion

```typescript
export async function insertTasks(
  tasks: Task[],
  timestamp?: number,
  options?: { connection_request?: boolean; timeout?: number }
): Promise<Task[]>
```

**Process Flow**:
1. Group tasks by device ID
2. For each device:
   - Sanitize all tasks
   - Generate ObjectIDs with timestamp
   - Bulk insert into `tasks` collection
3. If `connection_request` option:
   - Fetch device connection params
   - Trigger connection request
   - If `timeout` specified, await session completion

**Return Value**: Array of inserted tasks with `_id` fields populated

## Resource Operations

### Delete Operations

```typescript
export async function deleteDevice(deviceId: string): Promise<void>
```

**Atomic Delete Process**:
1. Acquire device lock (prevents concurrent session)
2. Delete from `devices` collection
3. Delete from `faults` collection
4. Delete from `tasks` collection
5. Delete from `operations` collection
6. Release lock (in finally block)

**Error Handling**: Throws `ResourceLockedError` if device in active session

```typescript
export async function deleteFault(
  deviceId: string,
  channel: string
): Promise<boolean>
```

Deletes fault and associated retrying task:
1. Find and delete fault by `_id: ${deviceId}:${channel}`
2. If fault was retrying, delete corresponding task
3. Return true if fault existed, false otherwise

### Resource Dispatcher

```typescript
export async function deleteResource(
  resource: string,
  id: string
): Promise<boolean>
```

Routes delete requests by resource type:
| Resource | Collection | Cache Invalidation |
|----------|------------|-------------------|
| `devices` | devices | - |
| `presets` | presets | ✓ |
| `provisions` | provisions | ✓ |
| `virtualParameters` | virtualParameters | ✓ |
| `files` | fs.files (GridFS) | ✓ |
| `permissions` | permissions | ✓ |
| `users` | users | ✓ |
| `config` | config | ✓ |

```typescript
export async function putResource(
  resource: string,
  id: string,
  data: Record<string, unknown>
): Promise<void>
```

Routes create/update requests with similar resource mapping.

**Cache Invalidation**: Calls `cache.del("cwmp-local-cache-hash")` for configuration resources.

## Authentication

### Local Authentication

```typescript
export async function authLocal(
  snapshot: Snapshot,
  username: string,
  password: string
): Promise<Record<string, unknown> | null>
```

**Authentication Flow**:
1. Get user from local cache snapshot
2. If user not found, return null
3. Verify password using `auth.verify(password, user.password, user.salt)`
4. Return user object (minus password/salt) on success, null on failure

**User Object Structure**:
```typescript
{
  _id: string;         // Username
  roles: string;       // Comma-separated roles
  password: string;    // PBKDF2 hash (not returned)
  salt: string;        // Salt (not returned)
}
```

## Integration Patterns

### With NBI Service

```typescript
// In lib/nbi.ts
router.post("/devices/:id/tasks", async (ctx) => {
  const tasks = await insertTasks(
    [{ device: ctx.params.id, ...ctx.request.body }],
    Date.now(),
    {
      connection_request: ctx.query.connection_request !== "false",
      timeout: parseInt(ctx.query.timeout) || 0
    }
  );
  ctx.body = tasks[0];
});
```

### With UI Service

```typescript
// In lib/ui/api.ts
async function deleteDevice(deviceId: string): Promise<void> {
  return apiFunctions.deleteDevice(deviceId);
}
```

## Error Handling

### Lock Contention

```typescript
import { ResourceLockedError } from "./common/errors.ts";

try {
  await deleteDevice(deviceId);
} catch (err) {
  if (err instanceof ResourceLockedError) {
    // Device is in active session
    res.status(409).send("Device busy");
  }
  throw err;
}
```

### Task Validation Errors

Invalid task objects throw errors with descriptive messages:
- `"Invalid task name"` - Unknown task type
- `"Missing required field"` - Required field not provided
- `"Invalid parameter format"` - Malformed parameter data

## Performance Considerations

### Bulk Operations

- Tasks grouped by device before insertion
- Single bulk write per device reduces round-trips
- Lock acquisition serializes device operations

### Polling Efficiency

- Exponential backoff prevents database flooding
- 50ms base interval with 1.5x multiplier
- Maximum practical timeout ~5 minutes

### Cache Invalidation

- Only configuration resources trigger cache invalidation
- `cwmp-local-cache-hash` key deletion forces all workers to refresh
- GridFS files don't require cache invalidation (served directly)

## Configuration Reference

| Option | Default | Description |
|--------|---------|-------------|
| `CONNECTION_REQUEST_TIMEOUT` | 2000 | HTTP/XMPP request timeout (ms) |
| `CONNECTION_REQUEST_ALLOW_BASIC_AUTH` | false | Allow insecure Basic auth |
| `DEBUG` | false | Enable connection request debug logging |
