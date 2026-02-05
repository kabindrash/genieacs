# GenieACS Product Requirements Document (PRD)

**Version**: 1.2.13
**Analysis Date**: 2026-02-05
**Document Type**: Technical PRD - Codebase Analysis

---

## Executive Summary

GenieACS is an open-source TR-069 Auto Configuration Server (ACS) designed for managing Customer Premises Equipment (CPE) devices at scale. It provides a complete solution for remote device management, including parameter configuration, firmware upgrades, diagnostics, and monitoring.

### System Overview

GenieACS consists of four interconnected services:

| Service | Port | Purpose |
|---------|------|---------|
| **genieacs-cwmp** | 7547 | TR-069 CWMP protocol handler - communicates with CPE devices |
| **genieacs-nbi** | 7557 | Northbound Interface REST API - external system integration |
| **genieacs-fs** | 7567 | File Server - serves firmware and configuration files |
| **genieacs-ui** | 3000 | Web-based management interface |

### Technology Stack

- **Runtime**: Node.js (TypeScript)
- **Database**: MongoDB with GridFS
- **Protocol**: TR-069 (CWMP) over HTTP/HTTPS
- **Frontend**: Mithril.js SPA
- **Authentication**: JWT (UI), HTTP Digest (CWMP)

---

## 1. Core Capabilities

### 1.1 Device Management

**Supported Operations**:
- **GetParameterValues**: Read device parameters
- **SetParameterValues**: Write device parameters
- **GetParameterNames**: Discover parameter structure
- **GetParameterAttributes**: Query notification settings
- **SetParameterAttributes**: Configure notifications
- **AddObject**: Create object instances
- **DeleteObject**: Remove object instances
- **Reboot**: Restart devices
- **FactoryReset**: Reset to factory defaults
- **Download**: Push firmware/config files

**Device Data Model**:
- Supports TR-106 data model (InternetGatewayDevice, Device)
- Nested parameter storage in MongoDB
- Versioned parameter tracking via `VersionedMap`
- Wildcard and alias path notation

### 1.2 Provisioning System

**Script Execution**:
- JavaScript-based provision scripts
- Sandboxed VM execution (50ms timeout)
- Declarative configuration via `declare()` API
- Extension mechanism for external integrations

**Preset System**:
- Event-based triggers (Inform, Boot, Bootstrap, etc.)
- Expression-based preconditions
- Weighted priority ordering
- Channel-based fault isolation

**Virtual Parameters**:
- Computed parameters via scripts
- Abstraction layer over physical parameters
- Custom aggregation and transformation

### 1.3 Query and Expression Language

**SQL-like Syntax**:
```sql
ProductClass = "Router" AND Uptime > 3600
DeviceID.SerialNumber LIKE "ABC%"
Tags.production = true
```

**Supported Operators**:
- Comparison: `=`, `<>`, `>`, `>=`, `<`, `<=`
- Pattern: `LIKE`, `NOT LIKE`
- Logical: `AND`, `OR`, `NOT`
- Null: `IS NULL`, `IS NOT NULL`
- Functions: `NOW()`, `UPPER()`, `LOWER()`, `ROUND()`, `COALESCE()`

### 1.4 Task Management

**Task Types**:
- `getParameterValues` - Read parameters
- `setParameterValues` - Write parameters
- `refreshObject` - Refresh parameter tree
- `addObject` - Create instance
- `deleteObject` - Remove instance
- `download` - File transfer
- `reboot` - Device restart
- `factoryReset` - Factory reset
- `provisions` - Custom provisioning

**Task Lifecycle**:
1. Task created via NBI or UI
2. Connection request sent to device
3. Device connects, task executed
4. Result stored, faults recorded on failure
5. Exponential backoff retry on errors

---

## 2. Architecture Analysis

### 2.1 Service Architecture

```
                    ┌─────────────────┐
                    │   External      │
                    │   Systems       │
                    └────────┬────────┘
                             │ REST API
                    ┌────────▼────────┐
                    │  genieacs-nbi   │
                    │    (7557)       │
                    └────────┬────────┘
                             │
┌─────────────────┐          │          ┌─────────────────┐
│  genieacs-ui    │          │          │  genieacs-fs    │
│    (3000)       │          │          │    (7567)       │
└────────┬────────┘          │          └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │    MongoDB      │
                    │   (GridFS)      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  genieacs-cwmp  │
                    │    (7547)       │
                    └────────┬────────┘
                             │ TR-069
                    ┌────────▼────────┐
                    │   CPE Devices   │
                    └─────────────────┘
```

### 2.2 Data Flow

**Inform Session Flow**:
1. CPE sends Inform RPC to CWMP service
2. CWMP authenticates device (optional Digest auth)
3. Session lock acquired for device
4. Tasks loaded from database
5. Presets evaluated and matched
6. Provisions executed in sandbox
7. Declarations processed (read/write phases)
8. Device data saved to MongoDB
9. Session completed, lock released

**NBI Request Flow**:
1. Client sends REST request to NBI
2. Request validated and parsed
3. Database query/operation executed
4. Response returned (JSON)
5. Cache invalidation triggered if needed

### 2.3 Database Schema

**Collections**:

| Collection | Purpose |
|------------|---------|
| `devices` | Device data and parameters |
| `tasks` | Pending device tasks |
| `faults` | Device/task faults |
| `presets` | Configuration presets |
| `provisions` | Provision scripts |
| `virtualParameters` | Virtual parameter scripts |
| `files` | File metadata (actual files in GridFS) |
| `operations` | Pending operations |
| `permissions` | RBAC permissions |
| `users` | User accounts |
| `config` | System configuration |
| `cache` | Distributed cache |
| `locks` | Distributed locks |

**Device Document Structure**:
```javascript
{
  _id: "device-001",
  _lastInform: Date,
  _registered: Date,
  _tags: ["tag1", "tag2"],
  _deviceId: {
    _Manufacturer: "Vendor",
    _OUI: "000000",
    _ProductClass: "Router",
    _SerialNumber: "ABC123"
  },
  InternetGatewayDevice: {
    _object: true,
    _timestamp: Date,
    DeviceInfo: {
      SoftwareVersion: {
        _value: "1.0.0",
        _type: "xsd:string",
        _timestamp: Date,
        _writable: false
      }
    }
  }
}
```

---

## 3. Security Analysis

### 3.1 Critical Vulnerabilities

| Severity | Issue | Location |
|----------|-------|----------|
| **CRITICAL** | NBI has NO authentication | `lib/nbi.ts` |
| **CRITICAL** | File Server has NO authentication | `lib/fs.ts` |
| **HIGH** | CWMP auth disabled by default | `lib/cwmp.ts:83` |
| **HIGH** | JWT tokens never expire | `lib/ui.ts:119` |
| **HIGH** | Empty JWT secret allowed | `lib/ui.ts:24` |
| **MEDIUM** | No rate limiting on login | `lib/api-functions.ts` |
| **MEDIUM** | Missing security headers | All services |
| **MEDIUM** | No session timeout | `lib/ui.ts` |

### 3.2 Authentication Mechanisms

**UI Authentication**:
- JWT-based with cookie storage
- PBKDF2-SHA512 password hashing (10,000 iterations)
- No token expiration implemented
- Missing `httpOnly` cookie flag

**CWMP Authentication**:
- HTTP Digest auth (configurable)
- MD5-based challenge/response
- Disabled by default

**NBI/FS Authentication**:
- **None** - relies on network isolation

### 3.3 Security Recommendations

**Immediate Actions**:
1. Implement NBI authentication (JWT or API keys)
2. Implement FS authentication
3. Enable CWMP auth by default
4. Add JWT expiration
5. Require non-empty JWT secret

**High Priority**:
6. Add security headers (CSP, X-Frame-Options, etc.)
7. Implement rate limiting
8. Add account lockout
9. Upgrade PBKDF2 iterations to 100,000+

---

## 4. Component Specifications

### 4.1 CWMP Service (`lib/cwmp.ts`)

**Purpose**: TR-069 protocol handler

**Key Features**:
- SOAP message parsing and generation
- Digest authentication support
- Session management with distributed locking
- Inform handling (device registration)
- RPC request/response processing
- Connection request initiation

**Configuration**:
| Option | Default | Description |
|--------|---------|-------------|
| `CWMP_PORT` | 7547 | Service port |
| `cwmp.auth` | null | Auth expression |
| `cwmp.sessionTimeout` | varies | Session timeout |
| `cwmp.maxCommitIterations` | varies | Max script iterations |

### 4.2 NBI Service (`lib/nbi.ts`)

**Purpose**: REST API for external integration

**Endpoints**:
| Method | Path | Description |
|--------|------|-------------|
| GET | `/{collection}` | Query resources |
| HEAD | `/{collection}` | Count resources |
| PUT | `/presets/{id}` | Create/update preset |
| PUT | `/provisions/{id}` | Create/update provision |
| PUT | `/files/{id}` | Upload file |
| POST | `/devices/{id}/tasks` | Create task |
| DELETE | `/devices/{id}` | Delete device |
| GET | `/ping/{host}` | Ping utility |

### 4.3 File Server (`lib/fs.ts`)

**Purpose**: Serve files for TR-069 Download RPC

**Features**:
- GridFS storage backend
- ETag and conditional request support
- Range request support
- In-memory caching (120s TTL)

### 4.4 UI Service (`lib/ui.ts`)

**Purpose**: Web management interface

**Architecture**:
- Mithril.js SPA framework
- Custom reactive store with WeakMap tracking
- Component context system
- JWT authentication with cookies

**Pages**:
- Overview (dashboard with charts)
- Devices (paginated list with filtering)
- Device detail (configurable components)
- Faults (fault management)
- Admin (presets, provisions, files, users, config)

---

## 5. Performance Characteristics

### 5.1 Scalability

**Horizontal Scaling**:
- Worker process clustering per service
- Stateless design (state in MongoDB)
- Distributed locking for session coordination

**Caching Strategy**:
- Two-tier cache (DB + in-memory)
- 5-second refresh interval for config
- 120-second memoization for files
- WeakMap-based query tracking in UI

### 5.2 Resource Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| Script timeout | 50ms | Prevent runaway scripts |
| Max RPC count | 255 | Session limit |
| Max cycles | 255 | Prevent infinite loops |
| Max preset cycles | 4 | Prevent preset loops |
| Max revision depth | 8 | Virtual parameter nesting |

### 5.3 Database Indexes

**Current Indexes**:
- `tasks`: `{device: 1, timestamp: 1}`
- `cache`: `{expire: 1}` (TTL)
- `locks`: `{expire: 1}` (TTL)

**Recommended Additional**:
- `devices._lastInform`
- `devices._tags`
- `devices._deviceId._OUI`

---

## 6. Deployment Considerations

### 6.1 Configuration

**Environment Variables**:
```bash
# MongoDB connection
GENIEACS_MONGODB_CONNECTION_URL=mongodb://localhost/genieacs

# Service ports
GENIEACS_CWMP_PORT=7547
GENIEACS_NBI_PORT=7557
GENIEACS_FS_PORT=7567
GENIEACS_UI_PORT=3000

# SSL (recommended)
GENIEACS_CWMP_SSL_CERT=/path/to/cert.pem
GENIEACS_CWMP_SSL_KEY=/path/to/key.pem

# Authentication
GENIEACS_UI_JWT_SECRET=<strong-random-secret>
```

### 6.2 Network Security

**Recommended Architecture**:
```
Internet
    │
    ├── [Firewall] ──► CWMP (7547) - CPE devices only
    │
    └── [VPN/Private] ──► NBI (7557) - OSS/BSS only
                    ├──► FS (7567)  - CPE devices
                    └──► UI (3000)  - Operators
```

### 6.3 High Availability

**Recommendations**:
1. MongoDB replica set for database HA
2. Multiple CWMP workers behind load balancer
3. Distributed lock timeout prevents deadlocks
4. Graceful shutdown with 5-second drain

---

## 7. API Reference Summary

### 7.1 NBI Query Language

**Basic Query**:
```bash
GET /devices?query={"_deviceId._OUI":"000000"}
```

**With Projection and Pagination**:
```bash
GET /devices?query={}&projection=_id,_lastInform&skip=0&limit=10&sort={"_lastInform":-1}
```

### 7.2 Task Creation

**Create task with connection request**:
```bash
POST /devices/device-001/tasks?connection_request
Content-Type: application/json

{
  "name": "setParameterValues",
  "parameterValues": [
    ["Device.ManagementServer.PeriodicInformInterval", 300, "xsd:unsignedInt"]
  ]
}
```

### 7.3 Provision Script API

```javascript
// Declare parameter requirement
let version = declare("Device.DeviceInfo.SoftwareVersion", {value: 1});

// Set parameter value
declare("Device.ManagementServer.PeriodicInformInterval",
  {value: 1},
  {value: 300}
);

// Add tag
declare("Tags.configured", {value: Date.now()}, {value: true});

// Call extension
let result = ext("my-extension", "myFunction", arg1, arg2);

// Log message
log("Device configured", {version: version.value[0]});
```

---

## 8. Future Considerations

### 8.1 Security Enhancements

- [ ] Implement NBI/FS authentication
- [ ] Add JWT token expiration
- [ ] Implement rate limiting
- [ ] Add security headers
- [ ] Upgrade password hashing
- [ ] Add audit logging

### 8.2 Feature Improvements

- [ ] WebSocket support for real-time updates
- [ ] Batch operations API
- [ ] Device grouping and bulk actions
- [ ] Improved monitoring/metrics
- [ ] Plugin architecture

### 8.3 Performance Optimizations

- [ ] Redis caching layer
- [ ] Database sharding support
- [ ] Connection pooling improvements
- [ ] Query optimization

---

## Appendix A: File Reference

| Component | Primary Files |
|-----------|---------------|
| CWMP | `lib/cwmp.ts`, `lib/session.ts`, `lib/soap.ts` |
| NBI | `lib/nbi.ts`, `lib/api-functions.ts` |
| FS | `lib/fs.ts` |
| UI | `lib/ui.ts`, `lib/ui/api.ts`, `ui/*.ts` |
| Database | `lib/db/db.ts`, `lib/db/synth.ts`, `lib/cwmp/db.ts` |
| Auth | `lib/auth.ts`, `lib/common/authorizer.ts` |
| Provisioning | `lib/sandbox.ts`, `lib/default-provisions.ts` |
| Types | `lib/types.ts`, `lib/db/types.ts` |
| Config | `lib/config.ts`, `lib/local-cache.ts` |

---

*Document generated from comprehensive codebase analysis of GenieACS v1.2.13*
