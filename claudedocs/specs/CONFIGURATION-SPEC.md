# GenieACS Configuration Specification

## Overview

The `lib/config.ts` module (279 lines) provides the configuration system for GenieACS, supporting hierarchical device-specific configuration, multiple configuration sources, type casting, and backward compatibility with earlier versions.

**Primary File**: `lib/config.ts`

## Configuration Loading Priority

Configuration values are resolved in order (highest priority first):

```
1. Command-line arguments (--option=value)
2. Environment variables (GENIEACS_OPTION)
3. Configuration file (genieacs.env or custom)
4. Default values
```

### Environment Variable Convention

All environment variables use the `GENIEACS_` prefix:
```bash
GENIEACS_CWMP_PORT=7547
GENIEACS_MONGODB_CONNECTION_URL=mongodb://localhost/genieacs
GENIEACS_UI_JWT_SECRET=mysecret
```

### Configuration File Format

The configuration file uses `.env` format:
```bash
# genieacs.env
CWMP_PORT=7547
MONGODB_CONNECTION_URL=mongodb://localhost/genieacs
UI_JWT_SECRET=mysecret
```

## Hierarchical Device-Specific Configuration

### Resolution Order

Device-specific configuration resolves in order:
```
1. Device-specific: config[deviceId].*
2. ProductClass-specific: config[OUI-ProductClass].*
3. OUI-specific: config[OUI].*
4. Global: config.*
```

### Example

```javascript
// Global default
config.CWMP_RETRY_INTERVAL = 300000

// OUI-specific override
config["001122"].CWMP_RETRY_INTERVAL = 60000

// ProductClass-specific override
config["001122-Router"].CWMP_RETRY_INTERVAL = 120000

// Device-specific override
config["001122-Router-ABC123"].CWMP_RETRY_INTERVAL = 30000
```

### Lookup Function

```typescript
export function get(
  optionName: string,
  deviceId?: string
): string | number | boolean | null
```

**Resolution Process**:
1. If `deviceId` provided:
   - Parse into OUI, ProductClass, SerialNumber
   - Check device-specific config
   - Check ProductClass-specific config
   - Check OUI-specific config
2. Check global config
3. Return default value

## Type Casting

### Supported Types

| Type | Config Suffix | Examples |
|------|--------------|----------|
| `string` | (default) | `"value"` |
| `int` | `_PORT`, `_TIMEOUT` | `7547`, `3000` |
| `bool` | `_SSL`, `_ENABLED` | `true`, `false` |
| `path` | `_DIR`, `_FILE` | `/path/to/file` |

### Type Casting Rules

```typescript
function castValue(value: string, optionName: string): string | number | boolean
```

**Integer Options** (suffix patterns):
- `*_PORT` - Port numbers
- `*_TIMEOUT` - Timeouts in ms
- `*_INTERVAL` - Intervals in ms
- `*_LIMIT` - Numeric limits
- `*_WORKERS` - Worker counts

**Boolean Options** (suffix patterns):
- `*_SSL` - SSL enable flags
- `*_ENABLED` - Feature toggles
- `*_AUTH` - Authentication flags

**Path Options**:
- Resolved relative to working directory
- Normalized for platform

## Configuration Options Reference

### Service Ports

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `CWMP_PORT` | 7547 | int | CWMP service port |
| `CWMP_SSL_PORT` | - | int | CWMP SSL port |
| `NBI_PORT` | 7557 | int | NBI REST API port |
| `FS_PORT` | 7567 | int | File server port |
| `UI_PORT` | 3000 | int | Web UI port |

### MongoDB Configuration

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `MONGODB_CONNECTION_URL` | `mongodb://127.0.0.1/genieacs` | string | MongoDB connection string |

### SSL/TLS Configuration

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `CWMP_SSL` | false | bool | Enable CWMP SSL |
| `CWMP_SSL_KEY` | - | path | SSL private key file |
| `CWMP_SSL_CERT` | - | path | SSL certificate file |
| `NBI_SSL` | false | bool | Enable NBI SSL |
| `FS_SSL` | false | bool | Enable File Server SSL |
| `UI_SSL` | false | bool | Enable UI SSL |

### Session Management

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `CWMP_SESSION_TIMEOUT` | 30000 | int | Session timeout (ms) |
| `MAX_COMMIT_ITERATIONS` | 32 | int | Max provision cycles |
| `EXT_TIMEOUT` | 3000 | int | Extension timeout (ms) |

### Connection Requests

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `CONNECTION_REQUEST_TIMEOUT` | 2000 | int | HTTP request timeout |
| `CONNECTION_REQUEST_ALLOW_BASIC_AUTH` | false | bool | Allow Basic auth |
| `UDP_CONNECTION_REQUEST_PORT` | - | int | UDP CR source port |

### Authentication

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `CWMP_ACCESS` | - | string | CWMP auth method |
| `UI_JWT_SECRET` | - | string | JWT signing secret |

### Logging

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `LOG_FILE` | - | path | Log file path |
| `LOG_FORMAT` | `simple` | string | `simple` or `json` |
| `ACCESS_LOG_FILE` | - | path | Access log path |

### Clustering

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `CWMP_WORKERS` | CPU cores | int | CWMP worker count |
| `NBI_WORKERS` | 1 | int | NBI worker count |
| `FS_WORKERS` | 1 | int | FS worker count |
| `UI_WORKERS` | 1 | int | UI worker count |

### Cache Configuration

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `MAX_CACHE_TTL` | 86400 | int | Cache TTL (seconds) |

### XMPP Configuration

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `XMPP_JID` | - | string | ACS XMPP JID |
| `XMPP_PASSWORD` | - | string | ACS XMPP password |

### Proxy Configuration

| Option | Default | Type | Description |
|--------|---------|------|-------------|
| `FORWARDED_HEADER` | - | string | Trusted proxy CIDRs |

## SSL Certificate Shortcuts

For convenience, SSL options support shortcuts:

```typescript
// Shorthand (same key/cert for all services)
GENIEACS_SSL_KEY=/path/to/key.pem
GENIEACS_SSL_CERT=/path/to/cert.pem

// Service-specific (overrides shorthand)
GENIEACS_CWMP_SSL_KEY=/path/to/cwmp-key.pem
```

## Backward Compatibility

### v1.0 Configuration Migration

| Old Option | New Option |
|------------|------------|
| `CWMP_INTERFACE` | `CWMP_PORT` |
| `NBI_INTERFACE` | `NBI_PORT` |
| `FS_INTERFACE` | `FS_PORT` |
| `UI_INTERFACE` | `UI_PORT` |

### v1.1 Configuration Migration

| Old Option | New Option |
|------------|------------|
| `MONGODB_URL` | `MONGODB_CONNECTION_URL` |
| `CWMP_TIMEOUT` | `CWMP_SESSION_TIMEOUT` |

## Dynamic Configuration

### Runtime Configuration Access

```typescript
import * as config from "./config.ts";

// Get global config
const port = config.get("CWMP_PORT"); // 7547

// Get device-specific config
const timeout = config.get("CWMP_SESSION_TIMEOUT", "001122-Router-ABC123");
```

### Database Configuration

Runtime configuration stored in MongoDB `config` collection:
```javascript
{
  _id: "key.name",
  value: "expression or value"
}
```

### Expression-Based Configuration

Configuration values can be expressions evaluated per-device:
```javascript
// In config collection
{
  _id: "device.CWMP_RETRY_INTERVAL",
  value: "Tags.slow_device IS NOT NULL ? 60000 : 300000"
}
```

## Configuration Validation

### Required Options

| Service | Required Options |
|---------|-----------------|
| CWMP | `MONGODB_CONNECTION_URL` |
| NBI | `MONGODB_CONNECTION_URL` |
| FS | `MONGODB_CONNECTION_URL`, `FS_HOSTNAME` or `FS_URL_PREFIX` |
| UI | `MONGODB_CONNECTION_URL`, `UI_JWT_SECRET` |

### Validation Errors

```typescript
// Missing required option
Error: "Configuration option UI_JWT_SECRET is required"

// Invalid type
Error: "Configuration option CWMP_PORT must be an integer"

// Invalid path
Error: "Configuration option SSL_KEY: File not found"
```

## Integration Example

```typescript
// bin/genieacs-cwmp.ts
import * as config from "../lib/config.ts";

const port = config.get("CWMP_PORT") as number;
const ssl = config.get("CWMP_SSL") as boolean;

const serverOptions = {
  port,
  ssl: ssl ? {
    key: config.get("CWMP_SSL_KEY") as string,
    cert: config.get("CWMP_SSL_CERT") as string
  } : undefined
};

server.start(serverOptions, listener);
```

## Environment Example

```bash
# Production environment file
export GENIEACS_MONGODB_CONNECTION_URL="mongodb://db.example.com:27017/genieacs?replicaSet=rs0"
export GENIEACS_CWMP_PORT=7547
export GENIEACS_CWMP_SSL=true
export GENIEACS_CWMP_SSL_KEY=/etc/ssl/cwmp.key
export GENIEACS_CWMP_SSL_CERT=/etc/ssl/cwmp.crt
export GENIEACS_CWMP_WORKERS=4
export GENIEACS_UI_JWT_SECRET="$(openssl rand -hex 32)"
export GENIEACS_LOG_FILE=/var/log/genieacs/genieacs.log
export GENIEACS_ACCESS_LOG_FILE=/var/log/genieacs/access.log
```
