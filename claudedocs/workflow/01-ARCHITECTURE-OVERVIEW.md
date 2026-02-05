# GenieACS Architecture Overview

## System Architecture

```
                                    ┌─────────────────────────────────────────┐
                                    │              MongoDB                     │
                                    │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
                                    │  │ devices │ │  tasks  │ │ presets │   │
                                    │  └─────────┘ └─────────┘ └─────────┘   │
                                    │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
                                    │  │ faults  │ │  files  │ │  cache  │   │
                                    │  └─────────┘ └─────────┘ └─────────┘   │
                                    └───────────────────┬─────────────────────┘
                                                        │
                    ┌───────────────────────────────────┼───────────────────────────────────┐
                    │                                   │                                   │
            ┌───────▼───────┐                   ┌───────▼───────┐                   ┌───────▼───────┐
            │  CWMP :7547   │                   │   NBI :7557   │                   │   UI :3000    │
            │ (TR-069 ACS)  │                   │  (REST API)   │                   │ (Web Admin)   │
            └───────┬───────┘                   └───────┬───────┘                   └───────┬───────┘
                    │                                   │                                   │
                    │ SOAP/HTTP                         │ REST                              │ HTTP
                    │                                   │                                   │
            ┌───────▼───────┐                   ┌───────▼───────┐                   ┌───────▼───────┐
            │    CPE/Router │                   │ External Apps │                   │   Browser     │
            │    Devices    │                   │  (Automation) │                   │   (Admin)     │
            └───────────────┘                   └───────────────┘                   └───────────────┘
```

## Services

### CWMP Service (Port 7547)

The core TR-069 Auto Configuration Server that communicates with devices.

**Responsibilities**:
- Accept device Inform messages
- Manage CWMP sessions
- Execute SOAP RPC calls
- Process provisions and presets
- Sync device parameters

**Key Files**:
- `bin/genieacs-cwmp.ts` - Entry point
- `lib/cwmp.ts` - Request handler
- `lib/session.ts` - Session management
- `lib/soap.ts` - SOAP message processing

### NBI Service (Port 7557)

North Bound Interface - REST API for external integration.

**Responsibilities**:
- Query device data
- Create/manage tasks
- Trigger connection requests
- CRUD for presets, provisions, files
- External system integration

**Key Files**:
- `bin/genieacs-nbi.ts` - Entry point
- `lib/nbi.ts` - Route handlers
- `lib/api-functions.ts` - Business logic

### File Server (Port 7567)

Serves files to devices for firmware upgrades and configuration.

**Responsibilities**:
- Serve firmware images
- Serve configuration files
- Handle range requests
- ETag-based caching

**Key Files**:
- `bin/genieacs-fs.ts` - Entry point
- `lib/fs.ts` - File serving logic

### UI Service (Port 3000)

Web-based administration interface.

**Responsibilities**:
- Device management UI
- Preset/provision editors
- User authentication
- Real-time updates

**Key Files**:
- `bin/genieacs-ui.ts` - Entry point
- `lib/ui.ts` - Backend API
- `ui/` - Frontend components

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `devices` | Device parameter data and state |
| `tasks` | Queued operations for devices |
| `faults` | Error records and retry state |
| `presets` | Provisioning trigger rules |
| `provisions` | JavaScript provision scripts |
| `virtualParameters` | Computed parameter scripts |
| `files` | File metadata (GridFS) |
| `users` | Admin user accounts |
| `permissions` | RBAC permission sets |
| `config` | Runtime configuration |
| `cache` | Distributed cache entries |
| `locks` | Distributed lock tokens |

## Communication Protocols

### CWMP/TR-069 (Device ↔ ACS)

- **Transport**: HTTP/HTTPS
- **Encoding**: SOAP 1.1 XML
- **Authentication**: HTTP Digest
- **Session**: Stateful, locked per device

### REST API (External ↔ NBI)

- **Transport**: HTTP/HTTPS
- **Encoding**: JSON
- **Authentication**: JWT (optional)
- **Session**: Stateless

### Connection Request (ACS → Device)

Three methods to wake devices:
1. **HTTP**: Direct GET to device URL
2. **UDP**: NAT traversal with STUN
3. **XMPP**: Push notification protocol

## Data Model

### Device Identification

```
DeviceID = {OUI}-{ProductClass}-{SerialNumber}

Example: 001122-Router-ABC123
```

### Parameter Paths

TR-069 uses hierarchical parameter paths:
```
Device.DeviceInfo.SoftwareVersion
Device.WiFi.SSID.1.SSID
Device.WiFi.SSID.[SSID:MyNetwork].Enable  (alias)
Device.WiFi.SSID.*.SSID                    (wildcard)
```

### Parameter Storage

```javascript
// MongoDB document structure
{
  _id: "001122-Router-ABC123",
  "Device.DeviceInfo.SoftwareVersion": {
    _value: ["2.0.1", "xsd:string"],
    _timestamp: 1704067200000,
    _type: "xsd:string",
    _writable: false
  },
  _lastInform: ISODate("2024-01-01T12:00:00Z"),
  _registered: ISODate("2024-01-01T10:00:00Z"),
  _tags: ["configured", "production"]
}
```

## Clustering

Each service supports horizontal scaling:

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │ Worker 1│         │ Worker 2│         │ Worker N│
    │  CWMP   │         │  CWMP   │         │  CWMP   │
    └────┬────┘         └────┬────┘         └────┬────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │    MongoDB      │
                    │  (shared state) │
                    └─────────────────┘
```

**Coordination**:
- Distributed locking prevents concurrent device sessions
- Local cache with hash-based invalidation
- MongoDB as single source of truth
