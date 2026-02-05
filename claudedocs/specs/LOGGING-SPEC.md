# GenieACS Logging Specification

## Overview

The `lib/logger.ts` module (328 lines) provides the logging infrastructure for GenieACS, supporting multiple output streams, JSON and simple text formats, systemd journal integration, log rotation, and structured logging with request context.

**Primary File**: `lib/logger.ts`

## Log Streams

### Stream Types

| Stream | Purpose | Configuration |
|--------|---------|---------------|
| **Application Log** | General service logs | `LOG_FILE`, `LOG_FORMAT` |
| **Access Log** | HTTP request logs | `ACCESS_LOG_FILE`, `ACCESS_LOG_FORMAT` |

### Stream Initialization

```typescript
export function init(
  service: string,
  version: string
): void
```

Initializes logging for a service:
1. Detects if running under systemd (`JOURNAL_STREAM` env var)
2. Opens log file if configured
3. Sets up inode tracking for rotation detection
4. Starts rotation check interval (60 seconds)

## Log Formats

### Simple Format

Human-readable format for development and manual inspection:

```
2024-01-15T10:30:45.123Z [INFO] cwmp-001 Inform received deviceId="ABC123" event="0 BOOTSTRAP"
```

**Structure**:
```
{timestamp} [{severity}] {hostname}-{pid} {message} {key}={value}...
```

### JSON Format

Structured format for log aggregation systems:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "severity": "INFO",
  "hostname": "cwmp-001",
  "pid": 12345,
  "message": "Inform received",
  "deviceId": "ABC123",
  "event": "0 BOOTSTRAP"
}
```

### Systemd Journal Format

When running under systemd, logs are sent directly to the journal with structured fields:

```
PRIORITY=6
MESSAGE=Inform received
DEVICE_ID=ABC123
EVENT=0 BOOTSTRAP
```

## Log Levels

| Level | Priority | Description |
|-------|----------|-------------|
| `INFO` | 6 | Normal operation events |
| `WARN` | 4 | Warning conditions |
| `ERROR` | 3 | Error conditions |

### Level Selection

```typescript
export function info(details: LogDetails): void
export function warn(details: LogDetails): void
export function error(details: LogDetails): void
```

## Log Details Interface

```typescript
interface LogDetails {
  message: string;
  sessionContext?: SessionContext;
  deviceId?: string;
  remoteAddress?: string;
  fault?: Fault;
  rpc?: string;
  [key: string]: unknown;
}
```

## Context Extraction

### Session Context Extraction

```typescript
function extractSessionContext(
  sessionContext: SessionContext
): Record<string, unknown>
```

Extracts logging fields from session context:
- `deviceId` - Device identifier
- `remoteAddress` - Client IP address
- `sessionTimestamp` - Session start time

### Request Context Extraction

```typescript
function extractRequestContext(
  ctx: Context
): Record<string, unknown>
```

Extracts from Koa context:
- `remoteAddress` - Client IP (considering X-Forwarded-For)
- `method` - HTTP method
- `url` - Request URL
- `status` - Response status code
- `responseTime` - Request duration (ms)

## Log Flattening

Complex objects are flattened for output:

```typescript
function flatten(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string>
```

**Example**:
```typescript
// Input
{ fault: { code: "9001", message: "Failed" }, device: { id: "ABC" } }

// Output (flattened)
{ "fault.code": "9001", "fault.message": "Failed", "device.id": "ABC" }
```

## Log Rotation

### Rotation Detection

File-based logging supports log rotation through inode tracking:

```typescript
// Every 60 seconds:
1. Stat log file
2. Compare inode to cached inode
3. If different (rotated):
   a. Close old file handle
   b. Open new file
   c. Update inode cache
```

### Integration with logrotate

```bash
# /etc/logrotate.d/genieacs
/var/log/genieacs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

**Note**: `copytruncate` is recommended over `create` for seamless rotation.

## Access Logging

### Access Log Format

```typescript
export function accessLog(ctx: Context): void
```

Logs HTTP request completion:
```
2024-01-15T10:30:45.123Z 192.168.1.100 GET /devices/ABC123 200 45ms
```

### Access Log Fields

| Field | Description |
|-------|-------------|
| `remoteAddress` | Client IP address |
| `method` | HTTP method |
| `url` | Request URL |
| `status` | Response status code |
| `responseTime` | Processing time (ms) |
| `userAgent` | User-Agent header |

## CWMP-Specific Logging

### RPC Logging

```typescript
export function rpcLog(
  sessionContext: SessionContext,
  rpc: string,
  request: boolean
): void
```

Logs RPC requests and responses:
```
2024-01-15T10:30:45.123Z [INFO] Inform request deviceId="ABC123"
2024-01-15T10:30:45.234Z [INFO] GetParameterValues response deviceId="ABC123"
```

### Fault Logging

```typescript
export function faultLog(
  sessionContext: SessionContext,
  fault: Fault
): void
```

Logs session faults with full context:
```json
{
  "message": "Session fault",
  "deviceId": "ABC123",
  "fault.code": "9001",
  "fault.message": "Request denied",
  "fault.detail": "SetParameterValues failed"
}
```

## Configuration Reference

| Option | Default | Description |
|--------|---------|-------------|
| `LOG_FILE` | - | Application log file path |
| `LOG_FORMAT` | `simple` | `simple` or `json` |
| `ACCESS_LOG_FILE` | - | Access log file path |
| `ACCESS_LOG_FORMAT` | `simple` | `simple` or `json` |

## Integration Examples

### Service Initialization

```typescript
// bin/genieacs-cwmp.ts
import * as logger from "../lib/logger.ts";
import packageJson from "../package.json";

logger.init("cwmp", packageJson.version);

logger.info({
  message: "CWMP service started",
  port: config.get("CWMP_PORT")
});
```

### Session Logging

```typescript
// lib/cwmp.ts
logger.info({
  message: "Inform received",
  sessionContext,
  event: rpcReq.event.join(", ")
});
```

### Error Logging

```typescript
try {
  await processSession(ctx);
} catch (err) {
  logger.error({
    message: "Session error",
    sessionContext,
    error: err.message,
    stack: err.stack
  });
}
```

## Performance Considerations

### Async Writing

Log writes are synchronous to ensure ordering but buffered by the OS. For high-throughput scenarios:
- Use JSON format for structured parsing
- Direct to systemd journal for fastest writes
- Consider separate access log file

### Memory Usage

- Log buffers are flushed on each write
- No in-memory log accumulation
- Rotation detection uses minimal memory (single inode per file)

### Log Filtering

Production recommendations:
- Log INFO level for normal operation
- Enable WARN/ERROR for alerting
- Use external tools (grep, jq) for log analysis

## Systemd Integration

### Journal Detection

```typescript
const isJournal = !!process.env.JOURNAL_STREAM;
```

### Service File Example

```ini
[Unit]
Description=GenieACS CWMP
After=network.target mongodb.service

[Service]
Type=simple
ExecStart=/usr/bin/genieacs-cwmp
Environment=GENIEACS_CWMP_PORT=7547
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Journal Queries

```bash
# View CWMP logs
journalctl -u genieacs-cwmp

# View errors only
journalctl -u genieacs-cwmp -p err

# Follow logs
journalctl -u genieacs-cwmp -f

# JSON output
journalctl -u genieacs-cwmp -o json
```
