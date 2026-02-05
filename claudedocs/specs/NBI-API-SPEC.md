# GenieACS NBI (Northbound Interface) API Specification

## Overview

The NBI provides a RESTful HTTP API for programmatic access to device management operations. It serves as the integration point for external OSS/BSS systems.

**Primary Files**:
- `bin/genieacs-nbi.ts` - Service entry point
- `lib/nbi.ts` - API handlers
- `lib/api-functions.ts` - Business logic
- `lib/query.ts` - Query language

## Service Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `NBI_PORT` | int | 7557 | TCP listening port |
| `NBI_INTERFACE` | string | "::" | Network interface |
| `NBI_WORKER_PROCESSES` | int | 0 | Worker count (0=CPU cores) |
| `NBI_SSL_CERT` | string | "" | SSL certificate path |
| `NBI_SSL_KEY` | string | "" | SSL private key path |

## Authentication

**WARNING**: The NBI service has NO built-in authentication. Deploy behind a reverse proxy with authentication or restrict network access.

## API Endpoints

### Resource Query

**Endpoint**: `GET /{collection}`

Query any collection with filtering, sorting, and pagination.

**Supported Collections**:
- `devices` - Device records
- `tasks` - Pending tasks
- `faults` - Device faults
- `presets` - Configuration presets
- `provisions` - Provision scripts
- `virtual_parameters` - Virtual parameters
- `files` - File metadata
- `permissions` - Access permissions
- `users` - User accounts
- `config` - System configuration
- `objects` - Object definitions

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | JSON | MongoDB-style query filter |
| `projection` | String | Comma-separated fields to return |
| `sort` | JSON | Sort specification |
| `skip` | Integer | Records to skip |
| `limit` | Integer | Maximum records |

**Response Headers**:
- `total` - Total count of matching documents
- `GenieACS-Version` - Server version

**Example**:
```bash
GET /devices?query={"_deviceId._OUI":"000000"}&projection=_id,_lastInform&skip=0&limit=10&sort={"_lastInform":-1}
```

### Resource Count

**Endpoint**: `HEAD /{collection}`

Get count without returning documents.

**Response Headers**:
- `total` - Document count

### Device Management

#### Delete Device

**Endpoint**: `DELETE /devices/{deviceId}`

Deletes device and all associated data (tasks, faults, operations).

**Response Codes**:
- `200` - Device deleted
- `503` - Device is in session

### Device Tags

#### Add Tag

**Endpoint**: `POST /devices/{deviceId}/tags/{tag}`

**Response**: `200` on success

#### Remove Tag

**Endpoint**: `DELETE /devices/{deviceId}/tags/{tag}`

**Response**: `200` on success

### Task Management

#### Create Task

**Endpoint**: `POST /devices/{deviceId}/tasks`

**Query Parameters**:
| Parameter | Description |
|-----------|-------------|
| `connection_request` | Trigger connection request |
| `timeout` | Custom timeout (ms) |

**Request Body**:
```json
{
  "name": "taskName",
  "timestamp": "2024-01-01T00:00:00Z",
  "expiry": 3600,
  ...task-specific-fields
}
```

**Task Types**:

##### getParameterValues
```json
{
  "name": "getParameterValues",
  "parameterNames": [
    "Device.DeviceInfo.SoftwareVersion"
  ]
}
```

##### setParameterValues
```json
{
  "name": "setParameterValues",
  "parameterValues": [
    ["Device.ManagementServer.PeriodicInformInterval", 300, "xsd:unsignedInt"]
  ]
}
```

##### refreshObject
```json
{
  "name": "refreshObject",
  "objectName": "Device.LANDevice.1."
}
```

##### addObject
```json
{
  "name": "addObject",
  "objectName": "Device.WANDevice.1.WANConnectionDevice.1.WANIPConnection.",
  "parameterValues": [
    ["ConnectionType", "IP_Routed", "xsd:string"]
  ]
}
```

##### deleteObject
```json
{
  "name": "deleteObject",
  "objectName": "Device.WANDevice.1.WANConnectionDevice.1.WANIPConnection.2."
}
```

##### download
```json
{
  "name": "download",
  "fileType": "1 Firmware Upgrade Image",
  "fileName": "firmware.bin",
  "targetFileName": "firmware.img"
}
```

##### provisions
```json
{
  "name": "provisions",
  "provisions": [
    ["myProvision", "arg1", 123]
  ]
}
```

##### reboot
```json
{
  "name": "reboot"
}
```

##### factoryReset
```json
{
  "name": "factoryReset"
}
```

**Response Codes**:
- `200` - Task completed successfully
- `202` - Task queued
- `400` - Invalid task format
- `404` - Device not found
- `503` - Device is in session
- `504` - Connection request failed

#### Delete Task

**Endpoint**: `DELETE /tasks/{taskId}`

**Response Codes**:
- `200` - Task deleted
- `404` - Task not found
- `503` - Device is in session

#### Retry Task

**Endpoint**: `POST /tasks/{taskId}/retry`

Clears fault for failed task, allowing retry.

**Response**: `200` on success

### Fault Management

#### Delete Fault

**Endpoint**: `DELETE /faults/{faultId}`

Fault ID format: `{deviceId}:{channel}`

**Response**: `200` on success

### Preset Management

#### Create/Update Preset

**Endpoint**: `PUT /presets/{presetName}`

**Request Body**:
```json
{
  "weight": 0,
  "channel": "default",
  "events": { "Inform": true, "1_BOOT": false },
  "precondition": "DeviceID.ProductClass = \"Router\"",
  "provision": "myProvision",
  "provisionArgs": "\"arg1\", 123"
}
```

#### Delete Preset

**Endpoint**: `DELETE /presets/{presetName}`

### Provision Management

#### Create/Update Provision

**Endpoint**: `PUT /provisions/{provisionName}`

**Content-Type**: `text/plain` (JavaScript code)

**Request Body**:
```javascript
const version = declare("Device.DeviceInfo.SoftwareVersion", {value: 1});
if (version.value[0] !== "2.0") {
  declare("Tags.needs-upgrade", {value: Date.now()}, {value: true});
}
```

**Response Codes**:
- `200` - Provision saved
- `400` - Script syntax error

#### Delete Provision

**Endpoint**: `DELETE /provisions/{provisionName}`

### Virtual Parameter Management

#### Create/Update Virtual Parameter

**Endpoint**: `PUT /virtual_parameters/{parameterName}`

**Content-Type**: `text/plain` (JavaScript code)

**Request Body**:
```javascript
let manufacturer = declare("Device.DeviceInfo.Manufacturer", {value: 1});
let model = declare("Device.DeviceInfo.ModelName", {value: 1});
return {
  writable: false,
  value: [manufacturer.value[0] + " " + model.value[0], "xsd:string"]
};
```

#### Delete Virtual Parameter

**Endpoint**: `DELETE /virtual_parameters/{parameterName}`

### Object Management

#### Create/Update Object

**Endpoint**: `PUT /objects/{objectName}`

**Request Body**:
```json
{
  "manufacturer": "Vendor",
  "productClass": "Router"
}
```

#### Delete Object

**Endpoint**: `DELETE /objects/{objectName}`

### File Management

#### Upload File

**Endpoint**: `PUT /files/{filename}`

**Headers**:
| Header | Description |
|--------|-------------|
| `FileType` | TR-069 file type |
| `OUI` | Manufacturer OUI filter |
| `ProductClass` | Product class filter |
| `Version` | Version string |

**Request Body**: Raw binary content

**Response**: `201 Created`

**Example**:
```bash
curl -X PUT \
  -H "FileType: 1 Firmware Upgrade Image" \
  -H "OUI: 000000" \
  -H "Version: 2.0.0" \
  --data-binary @firmware.bin \
  http://localhost:7557/files/firmware-v2.bin
```

#### Delete File

**Endpoint**: `DELETE /files/{filename}`

**Response Codes**:
- `200` - File deleted
- `404` - File not found

### Utilities

#### Ping

**Endpoint**: `GET /ping/{host}`

**Response**: Ping output (text/plain)

**Response Codes**:
- `200` - Ping successful
- `404` - Host unreachable
- `500` - Platform not supported

## Query Language

### Operators

| Operator | Example |
|----------|---------|
| `$eq` | `{"field": {"$eq": "value"}}` |
| `$ne` | `{"field": {"$ne": "value"}}` |
| `$gt` | `{"field": {"$gt": 100}}` |
| `$gte` | `{"field": {"$gte": 100}}` |
| `$lt` | `{"field": {"$lt": 100}}` |
| `$lte` | `{"field": {"$lte": 100}}` |
| `$in` | `{"field": {"$in": ["a", "b"]}}` |
| `$nin` | `{"field": {"$nin": ["a", "b"]}}` |
| `$and` | `{"$and": [{...}, {...}]}` |
| `$or` | `{"$or": [{...}, {...}]}` |
| `$regex` | `{"field": {"$regex": "^ABC"}}` |
| `$exists` | `{"field": {"$exists": true}}` |

### Automatic Type Coercion

String values are automatically tested as:
- String (exact match)
- Number (if parseable)
- Date (if length >= 8)
- Regex (if `/pattern/`)

### Wildcard Patterns

Use `*` as wildcard:
```json
{"DeviceID.SerialNumber": "ABC*"}
```

### Device Query Expansion

For device queries, parameter paths without underscore prefix are automatically appended with `._value`:
```json
// Input
{"Device.DeviceInfo.SoftwareVersion": "1.0"}

// Expanded
{"Device.DeviceInfo.SoftwareVersion._value": "1.0"}
```

## Error Handling

### Error Response Format

Errors returned as plain text with HTTP status code.

**Examples**:
```
400 Bad Request
SyntaxError: Unexpected token...

404 Not Found
No such device

405 Method Not Allowed
405 Method Not Allowed

503 Service Unavailable
Device is in session

504 Gateway Timeout
Connection request error: ...
```

### Session Locking

NBI operations acquire session locks to prevent concurrent modifications:
- Lock name: `cwmp_session_{deviceId}`
- Default TTL: 5 seconds
- On conflict: Returns `503 Service Unavailable`

## Complete Examples

### Query Online Devices

```bash
curl "http://localhost:7557/devices?query=\
{\"_lastInform\":{\"$gt\":\"$(date -d '1 hour ago' -Iseconds)\"}}\
&projection=_id,_lastInform,_deviceId._Manufacturer\
&sort={\"_lastInform\":-1}\
&limit=100"
```

### Firmware Upgrade Workflow

```bash
# 1. Upload firmware
curl -X PUT \
  -H "FileType: 1 Firmware Upgrade Image" \
  -H "Version: 2.0.0" \
  --data-binary @firmware.bin \
  "http://localhost:7557/files/firmware-v2.bin"

# 2. Create download task
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"download","fileType":"1 Firmware Upgrade Image","fileName":"firmware-v2.bin"}' \
  "http://localhost:7557/devices/device-001/tasks?connection_request"
```

### Create Provision and Preset

```bash
# Create provision
curl -X PUT \
  -H "Content-Type: text/plain" \
  -d 'declare("Device.ManagementServer.PeriodicInformInterval", {value: 1}, {value: 300});' \
  "http://localhost:7557/provisions/set-inform"

# Create preset
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{
    "weight": 0,
    "channel": "default",
    "events": {"Inform": true},
    "precondition": "true",
    "provision": "set-inform",
    "provisionArgs": ""
  }' \
  "http://localhost:7557/presets/default-inform"
```
