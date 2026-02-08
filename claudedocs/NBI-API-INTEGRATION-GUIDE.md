# GenieACS NBI API — OSS/BSS Integration Guide

Complete reference for integrating GenieACS with OSS/BSS systems via the Northbound Interface (NBI) REST API. Covers all endpoints, query syntax, provisioning presets, task execution, and end-to-end subscriber provisioning workflows.

**Base URL**: `http://<genieacs-host>:7557`

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Query Endpoints (Read Data)](#2-query-endpoints-read-data)
3. [Device Query Syntax](#3-device-query-syntax)
4. [Device Response Format](#4-device-response-format)
5. [Preset Management (Provisioning Policies)](#5-preset-management-provisioning-policies)
6. [Provision Management (Scripts)](#6-provision-management-scripts)
7. [Virtual Parameter Management](#7-virtual-parameter-management)
8. [Object Management (Templates)](#8-object-management-templates)
9. [Task API (On-Demand Device Operations)](#9-task-api-on-demand-device-operations)
10. [Device Tag Management](#10-device-tag-management)
11. [File Management (Firmware)](#11-file-management-firmware)
12. [Fault Management](#12-fault-management)
13. [Utility Endpoints](#13-utility-endpoints)
14. [Preset Policy Reference (What Values to Send)](#14-preset-policy-reference-what-values-to-send)
15. [Auto-Tag System](#15-auto-tag-system)
16. [OSS/BSS Integration Workflows](#16-ossbss-integration-workflows)
17. [Error Handling & Status Codes](#17-error-handling--status-codes)
18. [Gotchas & Lessons Learned](#18-gotchas--lessons-learned)

---

## 1. API Overview

The NBI is a stateless REST API exposed by the GenieACS NBI service (default port 7557). It provides CRUD operations on all GenieACS collections and the ability to send on-demand tasks to CPE devices.

### Response Headers

Every response includes:
- `GenieACS-Version`: Server version string
- `total`: Total matching documents (on query endpoints)

### Content Types

| Endpoint | PUT Content-Type | Response Content-Type |
|----------|-----------------|----------------------|
| Presets | `application/json` | `application/json` |
| Objects | `application/json` | `application/json` |
| Provisions | `text/plain` (raw JS) | N/A |
| Virtual Parameters | `text/plain` (raw JS) | N/A |
| Files | `application/octet-stream` | N/A |
| Tasks | `application/json` | `application/json` |
| Query endpoints | N/A (GET only) | `application/json` |

---

## 2. Query Endpoints (Read Data)

### List Any Collection

```
GET /:collection_name/
```

Supported collections: `devices`, `presets`, `objects`, `provisions`, `virtual_parameters`, `tasks`, `faults`, `files`, `users`, `permissions`, `config`

**Note**: Internal collections (`operations`, `cache`, `locks`) also exist and are queryable through this endpoint, but they are for internal GenieACS use and not intended for OSS/BSS integration.

**Note**: URL uses underscores (e.g., `virtual_parameters`), not camelCase.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | JSON string | MongoDB-style filter (URL-encoded) |
| `projection` | Comma-separated | Fields to include (e.g., `DeviceID,Tags`) |
| `sort` | JSON string | Sort order (e.g., `{"_lastInform":-1}`) |
| `skip` | Integer | Pagination offset |
| `limit` | Integer | Max results to return |

#### Examples

**List all devices**:
```bash
curl -s 'http://localhost:7557/devices/'
```

**List devices with filter**:
```bash
# Find by manufacturer (URL-encoded JSON query)
curl -s 'http://localhost:7557/devices/?query=%7B%22DeviceID.Manufacturer%22%3A%22Huawei%22%7D'

# Equivalent readable query: {"DeviceID.Manufacturer":"Huawei"}
```

**List with projection (specific fields only)**:
```bash
curl -s 'http://localhost:7557/devices/?projection=DeviceID,Tags,_lastInform'
```

**Paginated results**:
```bash
curl -s 'http://localhost:7557/devices/?limit=10&skip=0&sort=%7B%22_lastInform%22%3A-1%7D'
```

**Count devices (HEAD request)**:
```bash
curl -s -I 'http://localhost:7557/devices/'
# Response header: total: 42
```

**List all presets**:
```bash
curl -s 'http://localhost:7557/presets/'
```

**List all provisions**:
```bash
curl -s 'http://localhost:7557/provisions/'
```

**List all faults**:
```bash
curl -s 'http://localhost:7557/faults/'
```

**List all tasks**:
```bash
curl -s 'http://localhost:7557/tasks/'
```

**Query tasks by device** (note: `_id` is auto-converted to ObjectId):
```bash
curl -s 'http://localhost:7557/tasks/?query=%7B%22device%22%3A%2200E0FC-HG8245H-001000%22%7D'
```

#### Collection-Specific Query Behavior

| Collection | Query Behavior |
|------------|---------------|
| `devices` | Parameter paths auto-expanded with `._value`. String values normalized to number/date/regex. |
| `tasks` | `_id` converted to MongoDB ObjectId, `timestamp` to Date, `retries` to Number |
| `faults` | `timestamp` converted to Date, `retries` to Number |
| All others | Queries passed to MongoDB as-is |

---

## 3. Device Query Syntax

Device queries use JSON with MongoDB-style operators. The NBI automatically expands device parameter paths by appending `._value` for MongoDB storage format.

### Basic Queries

```json
// Exact match
{"DeviceID.Manufacturer": "Huawei"}

// Match by device ID
{"_id": "00E0FC-HG8245H-001000"}

// Match by tag
{"_tags": "vendor_huawei"}

// Wildcard (uses regex under the hood)
{"DeviceID.ProductClass": "HG8245*"}
```

### MongoDB Operators

```json
// Greater than
{"_lastInform": {"$gt": "2024-01-01"}}

// In set
{"DeviceID.Manufacturer": {"$in": ["Huawei", "ZTE"]}}

// Not equal
{"DeviceID.Manufacturer": {"$ne": "Nokia"}}

// Less than
{"InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.RxPower": {"$lt": -25}}

// Logical OR
{"$or": [
  {"DeviceID.Manufacturer": "Huawei"},
  {"DeviceID.Manufacturer": "ZTE"}
]}

// Logical AND
{"$and": [
  {"_tags": "vendor_nokia"},
  {"_tags": "optical_warning"}
]}

// Check field exists
{"InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.RxPower": {"$exists": true}}

// Check field type
{"_lastInform": {"$type": "date"}}
```

### Value Auto-Normalization

String values are automatically tested as:
1. **Exact string match**
2. **Number** (if parseable as float)
3. **Date** (if string length >= 8 characters, parseable, and year > 1983)
4. **Regex** (if contains `*` wildcards, or matches `/pattern/flags` format). **Note**: Wildcard `*` patterns only replace the first inner `*` occurrence — e.g., `"A*B*C"` converts to regex `^A.*B*C$` (second `*` is literal).

This means `{"_lastInform": "2024-01-01"}` will match both the string and the Date representation.

### Device Parameter Path Note

When querying device parameters, the NBI auto-appends `._value` to paths where the **last path segment** doesn't start with `_`. So:
- Query: `{"DeviceID.Manufacturer": "Huawei"}`
- Becomes: `{"DeviceID.Manufacturer._value": "Huawei"}` (last segment `Manufacturer` doesn't start with `_`)

Internal fields (like `_id`, `_tags`, `_lastInform`) are **not** expanded because their last segment starts with `_`.

### Sorting Device Fields

Same rule applies to sort: device parameter paths get `._value` appended.

```bash
# Sort by last inform time (internal field, no expansion)
sort={"_lastInform":-1}

# Sort by serial number (device param, gets ._value appended)
sort={"DeviceID.SerialNumber":1}
```

---

## 4. Device Response Format

Understanding the device document structure is essential for parsing NBI query results.

### Example Device Document (from `GET /devices/`)

```json
{
  "_id": "00E0FC-HG8245H-001000",
  "_registered": "2024-01-15T08:00:00.000Z",
  "_lastInform": "2024-02-08T10:30:00.000Z",
  "_lastBoot": "2024-02-07T06:00:00.000Z",
  "_lastBootstrap": "2024-01-15T08:00:00.000Z",
  "_tags": ["vendor_huawei", "huawei", "tr098", "HG8245H", "plan_residential"],
  "_deviceId": {
    "_Manufacturer": "Huawei",
    "_OUI": "00E0FC",
    "_ProductClass": "HG8245H",
    "_SerialNumber": "001000"
  },
  "InternetGatewayDevice": {
    "DeviceInfo": {
      "SoftwareVersion": {
        "_value": "V300R019C10SPC128",
        "_type": "xsd:string",
        "_timestamp": 1707385800000
      },
      "Manufacturer": {
        "_value": "Huawei",
        "_type": "xsd:string",
        "_timestamp": 1707385800000
      }
    },
    "WANDevice": {
      "1": {
        "WANConnectionDevice": {
          "1": {
            "WANPPPConnection": {
              "1": {
                "Username": {
                  "_value": "sub001@isp.com",
                  "_type": "xsd:string",
                  "_writable": true,
                  "_timestamp": 1707385800000
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Key Structural Points

- **Internal fields** start with `_`: `_id`, `_tags`, `_lastInform`, `_registered`, `_lastBoot`, `_lastBootstrap`, `_deviceId`
- **Parameter values** stored as `{ "_value": <val>, "_type": "<xsd:type>", "_timestamp": <epoch_ms> }`
- **Writable flag**: `"_writable": true` on settable parameters
- **Tags**: Array in `_tags` field. Query with `{"_tags": "tag_name"}`
- **Virtual parameters**: Appear as `VirtualParameters.<name>` with same `_value`/`_type` structure

### Virtual Parameters in Response

When using projection to include virtual parameters:

```bash
curl -s 'http://localhost:7557/devices/?projection=VirtualParameters.wan_status,VirtualParameters.wan_ip,VirtualParameters.optical_rx_power'
```

Response includes:
```json
{
  "_id": "...",
  "VirtualParameters": {
    "wan_status": { "_value": "Connected", "_type": "xsd:string", "_timestamp": ... },
    "wan_ip": { "_value": "10.0.0.100", "_type": "xsd:string", "_timestamp": ... },
    "optical_rx_power": { "_value": -18.5, "_type": "xsd:string", "_timestamp": ... }
  }
}
```

### Extracting Values in Code

When processing NBI responses, parameter values are nested. To extract a value:

```python
# Python example
import requests, json

devices = requests.get('http://localhost:7557/devices/', params={
    'query': json.dumps({"_id": "00E0FC-HG8245H-001000"}),
    'projection': 'DeviceID,_tags,InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username'
}).json()

for dev in devices:
    # _id is always returned; other internal fields need projection
    device_id = dev["_id"]
    tags = dev.get("_tags", [])  # only returned if in projection

    # Parameter values are nested with _value
    try:
        username = dev["InternetGatewayDevice"]["WANDevice"]["1"]["WANConnectionDevice"]["1"]["WANPPPConnection"]["1"]["Username"]["_value"]
    except (KeyError, TypeError):
        username = None
```

---

## 5. Preset Management (Provisioning Policies)

Presets are the core mechanism for automatic provisioning. They define which provisions run, when, and with what parameters.

### Create/Update Preset

```
PUT /presets/:preset_name
Content-Type: application/json
```

### Delete Preset

```
DELETE /presets/:preset_name
```

**Note**: Returns 200 even if the preset doesn't exist (idempotent DELETE).

### Preset JSON Schema

```json
{
  "weight": 10,
  "channel": "wan",
  "events": {"2 PERIODIC": true},
  "precondition": "",
  "configurations": [
    {
      "type": "provision",
      "name": "dynamic-wan-config",
      "args": ["{\"type\":\"pppoe\",\"username\":\"user@isp.com\",\"password\":\"secret\"}"]
    }
  ]
}
```

#### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `weight` | Integer | Execution priority (higher = runs later, can override lower). Default: 0 |
| `channel` | String | Grouping channel — presets on the same channel share fault scope |
| `events` | Object | Trigger events. Keys: `"0 BOOTSTRAP"`, `"1 BOOT"`, `"2 PERIODIC"`, `"3 SCHEDULED"`, `"4 VALUE CHANGE"`, etc. **Events are ANDed** — all listed events must be present |
| `precondition` | String | GenieACS expression string (see syntax below). Empty = match all devices. Example: `"Tags.vendor_huawei IS NOT NULL"` |
| `configurations` | Array | List of configuration entries to apply. Each entry has a `type` field (see 7 types below) plus type-specific fields. |

#### Configurations Entry — All 7 Types

The `configurations` array supports **7 types**, not just `provision`:

**1. `provision` — Run Provision Script** (most common for our architecture)
```json
{"type": "provision", "name": "dynamic-wan-config", "args": ["{\"type\":\"pppoe\",\"username\":\"user@isp.com\"}"]}
```
- `name`: Provision script name (must exist in `/provisions/`)
- `args`: Array of string arguments. `args[0]` is typically a JSON policy string.

**2. `value` — Set Parameter Value Directly** (no provision needed)
```json
{"type": "value", "name": "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", "value": "MyNetwork"}
```
- `name`: Full parameter path
- `value`: Boolean, number, or string value

**3. `age` — Refresh Parameter If Stale** (force re-read from device)
```json
{"type": "age", "name": "InternetGatewayDevice.DeviceInfo.SoftwareVersion", "age": 3600}
```
- `name`: Parameter path to refresh
- `age`: Maximum age in **seconds** — if cached value older than this, force device to re-report

**4. `add_tag` — Add Tag to Device**
```json
{"type": "add_tag", "tag": "provisioned"}
```
- `tag`: Tag name to add

**5. `delete_tag` — Remove Tag from Device**
```json
{"type": "delete_tag", "tag": "needs_config"}
```
- `tag`: Tag name to remove

**6. `add_object` — Create Object Instance**
```json
{"type": "add_object", "name": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.", "object": "wan-pppoe-connection"}
```
- `name`: Object path (must end with `.`)
- `object`: Reference to an Object template `_id` in the `/objects/` collection

**7. `delete_object` — Delete Object Instance**
```json
{"type": "delete_object", "name": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.", "object": "wan-pppoe-connection"}
```
- `name`: Object path
- `object`: Object template `_id` to match for deletion

#### Multi-Configuration Preset Example

A single preset can combine multiple configuration types:

```json
{
  "weight": 10,
  "channel": "setup",
  "events": {"2 PERIODIC": true},
  "precondition": "",
  "configurations": [
    {"type": "age", "name": "InternetGatewayDevice.DeviceInfo.SoftwareVersion", "age": 86400},
    {"type": "value", "name": "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", "value": "DefaultNet"},
    {"type": "add_tag", "tag": "configured"},
    {"type": "provision", "name": "dynamic-wan-config", "args": ["{\"type\":\"pppoe\",\"username\":\"user@isp\",\"password\":\"pass\"}"]}
  ]
}
```

#### Precondition Expression Syntax

Preconditions use GenieACS expression syntax (NOT MongoDB JSON). Examples:

```
# Empty = match ALL devices
""

# Match by tag
"Tags.vendor_huawei IS NOT NULL"

# Match by device ID
"DeviceID.ID = \"00E0FC-HG8245H-001000\""

# Match by manufacturer
"DeviceID.Manufacturer LIKE \"%Huawei%\""

# Logical AND
"Tags.vendor_nokia IS NOT NULL AND Tags.tr181 IS NOT NULL"

# Logical OR
"DeviceID.Manufacturer = \"Huawei\" OR DeviceID.Manufacturer = \"ZTE\""

# NOT
"NOT (Tags.configured IS NOT NULL)"

# Comparison operators
"DeviceID.OUI = \"00E0FC\""

# Combine multiple conditions
"Tags.plan_premium IS NOT NULL AND Tags.vendor_huawei IS NOT NULL"
```

**Supported operators**: `=`, `<>`, `<`, `<=`, `>`, `>=`, `IS NULL`, `IS NOT NULL`, `LIKE`, `NOT LIKE`, `AND`, `OR`, `NOT`

**Note**: Legacy MongoDB JSON format in preconditions (e.g., `{"_tags": "wifi"}`) is also supported for backwards compatibility but the expression syntax above is preferred.

#### Important Notes

- **Events are ANDed**: `{"0 BOOTSTRAP": true, "2 PERIODIC": true}` requires BOTH events in the same Inform message. Most devices send them independently. Use `{"2 PERIODIC": true}` for reliable triggering.
- **Weight determines execution order**: Presets sorted by weight ascending (0 first, then 10, then 20). Same weight sorted alphabetically by name. Higher weight presets execute later and can override values set by lower weight presets.
- **Cache invalidation**: Changes to presets, objects, provisions, and virtual parameters all invalidate the CWMP service cache. The cache reloads automatically (~30s). All four resource types trigger the same `cwmp-local-cache-hash` invalidation.

### Examples

**Create a WAN preset for all devices**:
```bash
curl -X PUT \
  -H 'Content-Type: application/json' \
  -d '{
    "weight": 10,
    "channel": "wan",
    "events": {"2 PERIODIC": true},
    "precondition": "",
    "configurations": [{
      "type": "provision",
      "name": "dynamic-wan-config",
      "args": ["{\"type\":\"pppoe\",\"username\":\"user@isp.com\",\"password\":\"changeme\",\"vlan\":100}"]
    }]
  }' \
  'http://localhost:7557/presets/wan-default'
```

**Create a preset targeting only Nokia devices**:
```bash
curl -X PUT \
  -H 'Content-Type: application/json' \
  -d '{
    "weight": 10,
    "channel": "wan",
    "events": {"2 PERIODIC": true},
    "precondition": "Tags.vendor_nokia IS NOT NULL",
    "configurations": [{
      "type": "provision",
      "name": "dynamic-wan-config",
      "args": ["{\"type\":\"pppoe\",\"username\":\"nokia_user@isp.com\",\"password\":\"nokia_pass\"}"]
    }]
  }' \
  'http://localhost:7557/presets/wan-nokia-override'
```

**Override WiFi for premium subscribers**:
```bash
curl -X PUT \
  -H 'Content-Type: application/json' \
  -d '{
    "weight": 20,
    "channel": "wifi",
    "events": {"2 PERIODIC": true},
    "precondition": "Tags.plan_premium IS NOT NULL",
    "configurations": [{
      "type": "provision",
      "name": "dynamic-wifi-config",
      "args": ["{\"password\":\"PremiumPass123\",\"bands\":{\"2.4\":{\"ssid\":\"PremiumNet\",\"security\":\"wpa2\"},\"5\":{\"ssid\":\"PremiumNet-5G\",\"security\":\"wpa2\"},\"6\":{\"ssid\":\"PremiumNet-6E\",\"security\":\"wpa3\"}}}"]
    }]
  }' \
  'http://localhost:7557/presets/wifi-premium'
```

**Delete a preset**:
```bash
curl -X DELETE 'http://localhost:7557/presets/wan-default'
```

---

## 6. Provision Management (Scripts)

Provisions are JavaScript scripts that run in the GenieACS sandbox with access to the `declare()` API.

### Create/Update Provision

```
PUT /provisions/:provision_name
Content-Type: text/plain (raw JavaScript body)
```

The server validates the JavaScript syntax before saving by wrapping the script in a strict-mode IIFE: `"use strict";(function(){...})();`. Returns 400 if the script has syntax errors or uses constructs forbidden in strict mode (e.g., `with` statements, octal literals, duplicate parameter names).

### Delete Provision

```
DELETE /provisions/:provision_name
```

**Note**: DELETE returns 200 even if the provision doesn't exist (idempotent).

### Example

```bash
# Upload a provision script
curl -X PUT \
  --data-binary @provisions/universal/dynamic-wan-config.js \
  'http://localhost:7557/provisions/dynamic-wan-config'
```

---

## 7. Virtual Parameter Management

Virtual parameters are computed values derived from device parameters. They enable uniform querying across vendor differences.

### Create/Update Virtual Parameter

```
PUT /virtual_parameters/:vp_name
Content-Type: text/plain (raw JavaScript body)
```

**Note**: Endpoint uses underscore: `/virtual_parameters/`, not `/virtualParameters/`.

The server validates JavaScript syntax before saving using the same strict-mode IIFE wrapper as provisions. Returns 400 if the script has syntax errors or uses strict-mode-forbidden constructs.

### Delete Virtual Parameter

```
DELETE /virtual_parameters/:vp_name
```

**Note**: DELETE returns 200 even if the virtual parameter doesn't exist (idempotent).

### Example

```bash
curl -X PUT \
  --data-binary @provisions/virtual-parameters/wan_status.js \
  'http://localhost:7557/virtual_parameters/wan_status'
```

---

## 8. Object Management (Templates)

Objects are templates used with `add_object` and `delete_object` configuration types in presets. They define the structure and key fields of object instances (e.g., WAN connections, port mappings).

### Create/Update Object

```
PUT /objects/:object_name
Content-Type: application/json
```

### Delete Object

```
DELETE /objects/:object_name
```

**Note**: Returns 200 even if the object doesn't exist (idempotent DELETE).

### List Objects

```bash
curl -s 'http://localhost:7557/objects/'
```

### Object JSON Schema

```json
{
  "_keys": ["ServiceType"],
  "ServiceType": "IP",
  "Enable": true,
  "ConnectionType": "IP_Routed"
}
```

- `_keys`: Array of field names that uniquely identify instances. Used for matching during `delete_object`.
- Other fields: Parameter names and default values for the object instance.

### Example: WAN Connection Template

```bash
# Create an object template for a PPPoE WAN connection
curl -X PUT \
  -H 'Content-Type: application/json' \
  -d '{
    "_keys": ["ConnectionType"],
    "ConnectionType": "PPPoE",
    "Enable": true,
    "Username": "default@isp.com",
    "Password": "changeme"
  }' \
  'http://localhost:7557/objects/wan-pppoe-template'

# Use it in a preset to auto-create WAN connections
curl -X PUT \
  -H 'Content-Type: application/json' \
  -d '{
    "weight": 5,
    "channel": "wan-setup",
    "events": {"2 PERIODIC": true},
    "precondition": "",
    "configurations": [
      {"type": "add_object", "name": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.", "object": "wan-pppoe-template"}
    ]
  }' \
  'http://localhost:7557/presets/wan-object-setup'
```

**Note**: For most OSS/BSS use cases, the `provision` configuration type with our `dynamic-*` scripts is more flexible than `add_object`/`delete_object`. Object templates are useful for simple, static object creation.

---

## 9. Task API (On-Demand Device Operations)

Tasks are the mechanism for sending on-demand operations to specific devices. This is the primary OSS/BSS integration point for per-subscriber actions.

### Create Task

```
POST /devices/:device_id/tasks/
Content-Type: application/json
```

#### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `connection_request` | If present, triggers an immediate connection request to the device and waits for the session to complete (see timing details below). Without this, the task is queued for the next device session. |
| `timeout` | Override the online threshold (in ms) for connection request mode |

#### Common Task Fields

All task types support these optional fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | **Required.** Task type name (see types below) |
| `timestamp` | Date/String | Task creation time. Default: current time |
| `expiry` | Number or Date | Task TTL. If number, interpreted as **seconds** from timestamp. If Date/string, absolute expiry time. Expired tasks are skipped. |
| `uniqueKey` | String | Deduplication key. If set, any existing task on the same device with the same `uniqueKey` is **deleted** before inserting the new one. Useful for OSS/BSS retry logic — prevents duplicate tasks from accumulating. |

Example with expiry and uniqueKey:
```json
{
  "name": "provisions",
  "expiry": 3600,
  "uniqueKey": "wan-config-sub001",
  "provisions": [["dynamic-wan-config", "{...}"]]
}
```

#### Connection Request Only (No Task)

Send just `?connection_request` with an **empty body** to wake up a device without creating a task. Useful for forcing an immediate Inform cycle:

```bash
curl -X POST 'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

Returns 200 if connection request succeeded, 504 if connection request failed (device offline, invalid URL, or HTTP error).

**Connection Request Methods** (selected automatically based on device capabilities):
- **HTTP**: Default. Sends HTTP GET to device's `ConnectionRequestURL`. Uses `ConnectionRequestUsername` and `ConnectionRequestPassword` from the device for digest auth.
- **UDP**: Used when device is behind NAT with STUN enabled (`STUNEnable=true`). Fires in parallel with HTTP/XMPP — if UDP succeeds, it overrides a failed HTTP/XMPP result. Requires `cwmp.udpConnectionRequestPort` config.
- **XMPP**: Used when device has `ConnReqJabberID` and `XMPP_JID` is configured on the server. Takes priority over HTTP when both are available.

**Connection Request Config Parameters**:
| Config Key | Description |
|------------|-------------|
| `cwmp.udpConnectionRequestPort` | Port for UDP connection requests (required for UDP method) |
| `cwmp.connectionRequestTimeout` | Timeout for HTTP/XMPP connection request attempts |
| `cwmp.connectionRequestAllowBasicAuth` | Allow basic auth (instead of digest) for HTTP connection requests. Default: false |

#### Response Codes (Task Creation: `POST /devices/:id/tasks/`)

| Code | Status Text | Meaning |
|------|-------------|---------|
| 200 | OK | Task executed successfully (with `connection_request`) |
| 202 | *(empty)* | Task queued for next session (no `connection_request`) |
| 202 | Task queued but not processed | Device didn't connect within threshold, or session didn't include this task |
| 202 | Task faulted | Task executed but produced an error — check `/faults/` |
| 202 | *(connection request error)* | Task queued, but connection request failed. Status text is the raw error string (e.g., `"Error: connect ECONNREFUSED"`). Only occurs when both task body and `connection_request` are present and the connection request fails. |
| 400 | *(error message)* | Invalid JSON body or empty body without `connection_request` |
| 404 | No such device | Device ID not found in database |
| 504 | *(error detail)* | Connection request failed (device offline, invalid ConnectionRequestURL, or HTTP error from device). Only with `connection_request` and empty body (no task). |

**Note**: Task creation **never** returns 503. If the device is in an active session when using `?connection_request`, the task is inserted and the response is 202 "Task queued but not processed". The 503 code only occurs on `DELETE /tasks/:id` and `POST /tasks/:id/retry` (see below).

#### Response Body

All task creation responses (200 and 202) include the **task JSON** in the response body, including the server-assigned `_id` field:

```json
{
  "_id": "65a4f8e2c3b2a1d0e4f5678",
  "name": "provisions",
  "device": "00E0FC-HG8245H-001000",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "provisions": [["dynamic-wan-config", "{...}"]],
  "expiry": "2024-01-15T11:30:00.000Z"
}
```

**The `_id` field is essential for OSS/BSS** — use it to:
- Check task status: `GET /tasks/?query={"_id":"<task_id>"}`
- Delete a pending task: `DELETE /tasks/<task_id>`
- Retry a faulted task: `POST /tasks/<task_id>/retry`

### Task Types

#### 1. `getParameterValues` — Read Device Parameters

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "getParameterValues",
    "parameterNames": [
      "InternetGatewayDevice.DeviceInfo.SoftwareVersion",
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username"
    ]
  }' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

#### 2. `setParameterValues` — Write Device Parameters

Each parameter is an array: `["path", value, "type"]`

Type is optional. Supported types: `"xsd:string"`, `"xsd:boolean"`, `"xsd:int"`, `"xsd:unsignedInt"`, `"xsd:dateTime"`

```bash
# Set WiFi SSID directly
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "setParameterValues",
    "parameterValues": [
      ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", "NewSSID", "xsd:string"],
      ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase", "NewPassword123", "xsd:string"]
    ]
  }' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

#### 3. `refreshObject` — Refresh Parameter Tree

Forces the device to re-report all parameters under the given path.

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "refreshObject",
    "objectName": "InternetGatewayDevice.LANDevice.1.WLANConfiguration."
  }' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

#### 4. `addObject` — Add Object Instance

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "addObject",
    "objectName": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.",
    "parameterValues": [
      ["Username", "newuser@isp.com", "xsd:string"],
      ["Password", "newpass", "xsd:string"]
    ]
  }' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

#### 5. `deleteObject` — Delete Object Instance

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "deleteObject",
    "objectName": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.2."
  }' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

#### 6. `provisions` — Run Provision Script On-Demand

Execute a provision script immediately on a specific device. Each inner array is `[provision_name, arg1, arg2, ...]`. Arguments can be `string`, `number`, `boolean`, or `null`.

```bash
# Run port forwarding on a specific device
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "provisions",
    "provisions": [
      ["dynamic-port-forward", "{\"rules\":[{\"externalPort\":8080,\"internalPort\":80,\"internalClient\":\"192.168.1.100\",\"protocol\":\"TCP\",\"description\":\"Web server\"}],\"wanType\":\"ppp\"}"]
    ]
  }' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

```bash
# Run WAN config for a single subscriber on-demand
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "provisions",
    "provisions": [
      ["dynamic-wan-config", "{\"type\":\"pppoe\",\"username\":\"subscriber123@isp.com\",\"password\":\"s3cur3P@ss\",\"vlan\":200}"]
    ]
  }' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

#### 7. `download` — Push Firmware/Config File

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "download",
    "fileType": "1 Firmware Upgrade Image",
    "fileName": "firmware-v2.1.bin",
    "targetFileName": "/tmp/firmware.bin"
  }' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

| Field | Required | Description |
|-------|----------|-------------|
| `fileType` | Yes* | File type string (see below) |
| `fileName` | Yes* | Filename as stored in GenieACS files collection |
| `file` | Yes* | Alternative to `fileType`/`fileName` — file ID directly |
| `targetFileName` | No | Target filename on the CPE device |

*Either `fileType` + `fileName` OR `file` is required.

File types: `"1 Firmware Upgrade Image"`, `"2 Web Content"`, `"3 Vendor Configuration File"`

#### 8. `reboot` — Reboot Device

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"name": "reboot"}' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

#### 9. `factoryReset` — Factory Reset Device

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"name": "factoryReset"}' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

### Delete Task

```
DELETE /tasks/:task_id
```

Deletes the task and its associated fault (if any). Returns:
- **200**: Task deleted successfully
- **404**: Task not found
- **503**: Device is in an active CWMP session (retry later)

### Retry Faulted Task

```
POST /tasks/:task_id/retry
```

Clears the fault associated with the task, allowing it to be retried in the next session. Returns:
- **200**: Fault cleared
- **503**: Device is in an active CWMP session (retry later)

**Warning**: Unlike DELETE, this endpoint does **not** check if the task exists. If the task ID is invalid or deleted, the endpoint returns 500 (unhandled error). Always verify the task exists before calling retry.

### Synchronous vs Asynchronous Execution

| Method | Behavior | Use Case |
|--------|----------|----------|
| `POST /devices/:id/tasks/` | Queues task (202) | Bulk operations, non-urgent |
| `POST /devices/:id/tasks/?connection_request` | Triggers immediate session, waits for completion (200 or 202) | OSS/BSS real-time provisioning |

With `connection_request`, the flow is:
1. Acquire session lock (if lock fails, task is queued → 202 immediately)
2. Insert task into MongoDB
3. Send HTTP/UDP/XMPP connection request to CPE
4. Wait for device to initiate a CWMP session (polls every 500ms, up to `cwmp.deviceOnlineThreshold` — configurable, or overridable via `?timeout=<ms>`)
5. Wait for session to complete (polls every 500ms, up to **120 seconds** — hardcoded)
6. Check for faults on the specific task
7. Return 200 (success) or 202 with status text ("Task faulted", "Task queued but not processed")

**Total maximum wait**: `lock acquisition (up to 5s) + onlineThreshold + 120s`. The HTTP socket timeout is extended to 300s (5 min) during this wait. The default `cwmp.deviceOnlineThreshold` is typically 4000-120000ms depending on configuration.

---

## 10. Device Tag Management

Tags are labels applied to devices. Used for grouping, preset preconditions, and monitoring.

### Add Tag

```
POST /devices/:device_id/tags/:tag_name
```

### Remove Tag

```
DELETE /devices/:device_id/tags/:tag_name
```

### Examples

```bash
# Add a tag
curl -X POST 'http://localhost:7557/devices/00E0FC-HG8245H-001000/tags/plan_premium'

# Remove a tag
curl -X DELETE 'http://localhost:7557/devices/00E0FC-HG8245H-001000/tags/plan_basic'

# Query devices by tag
curl -s 'http://localhost:7557/devices/?query=%7B%22_tags%22%3A%22plan_premium%22%7D'
```

**Idempotent**: Adding a tag that already exists returns 200 (no-op). Removing a tag that doesn't exist also returns 200 (no-op). Both return 404 only if the **device** doesn't exist. This makes tag operations safe to retry without checking current state.

**No cache invalidation**: Unlike preset/provision/VP changes, tag operations do NOT invalidate the CWMP cache. Tags are written directly to the device document in MongoDB and are immediately visible in queries.

Tags are used in preset `precondition` to target specific device groups:
```json
"precondition": "Tags.plan_premium IS NOT NULL"
```

---

## 11. File Management (Firmware)

Upload firmware images and configuration files that can be pushed to devices via `download` tasks.

### Upload File

```
PUT /files/:filename
```

Returns **201** (not 200 like other PUT endpoints). If the file already exists, it is replaced (GridFS old file is deleted first).

Headers for metadata:
| Header | MongoDB Field | Description |
|--------|---------------|-------------|
| `FileType` | `metadata.fileType` | e.g., `"1 Firmware Upgrade Image"` |
| `OUI` | `metadata.oui` | Device OUI for matching |
| `ProductClass` | `metadata.productClass` | Device product class for matching |
| `Version` | `metadata.version` | Firmware version string |

**Note**: When querying `GET /files/`, metadata fields are stored as camelCase (`fileType`, `oui`, `productClass`, `version`) inside a `metadata` object. Use these field names in queries.

```bash
curl -X PUT \
  -H 'FileType: 1 Firmware Upgrade Image' \
  -H 'OUI: 00E0FC' \
  -H 'ProductClass: HG8245H' \
  -H 'Version: V300R019C10SPC128' \
  --data-binary @firmware-v2.1.bin \
  'http://localhost:7557/files/firmware-v2.1.bin'
```

### Delete File

```
DELETE /files/:filename
```

Returns 200 on success, 404 if the file doesn't exist.

### List Files

```bash
curl -s 'http://localhost:7557/files/'
```

---

## 12. Fault Management

### Delete Fault

```
DELETE /faults/:fault_id
```

Fault IDs follow the pattern: `<device_id>:<channel>` (e.g., `00E0FC-HG8245H-001000:wan`) or `<device_id>:task_<task_id>` for task faults.

Returns:
- **200**: Fault deleted
- **503**: Device is in an active CWMP session

**Important side-effect**: Deleting a **task fault** (ID pattern `<device_id>:task_<task_id>`) also **deletes the associated task itself**. This differs from `POST /tasks/:id/retry` which only clears the fault while keeping the task for retry.

### List Faults

```bash
# All faults
curl -s 'http://localhost:7557/faults/'

# Faults for a specific device
curl -s 'http://localhost:7557/faults/?query=%7B%22_id%22%3A%7B%22%24regex%22%3A%22%5E00E0FC-HG8245H-001000%22%7D%7D'
```

---

## 13. Utility Endpoints

### Ping

```
GET /ping/:hostname
```

**Note**: The code does not enforce the HTTP method — any method (GET, POST, etc.) will execute the ping. Use GET by convention.

Returns:
- **200** with `text/plain` ping output on success (`Cache-Control: no-cache`)
- **404** if host is unreachable (ping failed) (`Cache-Control: no-cache`)
- **500** if ping command itself fails (e.g., invalid hostname format) (`Connection: close`)

```bash
curl -s 'http://localhost:7557/ping/192.168.1.1'
```

### Delete Device

```
DELETE /devices/:device_id
```

Deletes the device and all associated tasks, faults, and operations. Returns 503 if device is in an active session.

```bash
curl -X DELETE 'http://localhost:7557/devices/00E0FC-HG8245H-001000'
```

---

## 14. Preset Policy Reference (What Values to Send)

Our provisioning layer uses **policy-driven presets** where all configuration values come from JSON in `args[0]`. Here are the exact schemas for each provision type.

### 14.1 WAN Configuration (`dynamic-wan-config`)

**PPPoE**:
```json
{
  "type": "pppoe",
  "username": "subscriber001@isp.com",
  "password": "s3cur3P@ss",
  "vlan": 100,
  "cos": 0
}
```

**DHCP**:
```json
{
  "type": "dhcp"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"pppoe"` or `"dhcp"` | Yes | WAN connection type |
| `username` | String | PPPoE only | PPPoE username (typically `subscriber@realm`) |
| `password` | String | PPPoE only | PPPoE password |
| `vlan` | Integer | No | VLAN ID. Applied via vendor extensions (Huawei `X_HW_VLANMuxID`, ZTE `X_ZTE-COM_VLANID`). Nokia has no TR-069 VLAN extension. |
| `cos` | Integer | No | Class of Service (Huawei `X_HW_VLAN_CoS` only). Default: 0 |

**What happens**: Detects TR-181 vs TR-098 automatically. Sets `WANPPPConnection` (PPPoE) or `WANIPConnection` (DHCP) parameters on the correct path. Applies vendor VLAN extensions for Huawei/ZTE on TR-098 only.

### 14.2 WiFi Configuration (`dynamic-wifi-config`)

```json
{
  "password": "SharedPassword123",
  "bands": {
    "2.4": {
      "ssid": "MyNetwork",
      "security": "wpa2",
      "enabled": true,
      "password": "Optional2GOverride"
    },
    "5": {
      "ssid": "MyNetwork-5G",
      "security": "wpa2"
    },
    "6": {
      "ssid": "MyNetwork-6E",
      "security": "wpa3"
    }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `password` | String | Yes | Default password for all bands |
| `bands` | Object | Yes | Band configurations keyed by `"2.4"`, `"5"`, `"6"` |
| `bands.*.ssid` | String | Yes | Network name |
| `bands.*.security` | `"wpa2"`, `"wpa3"`, `"wpa2-wpa3"` | No | Security mode. Default: `"wpa2"`. 6 GHz always forces WPA3 regardless of this setting. `"wpa2-wpa3"` degrades to WPA2 on TR-098 devices. |
| `bands.*.enabled` | Boolean | No | Default: `true` |
| `bands.*.password` | String | No | Per-band password override. Falls back to top-level `password`. |

**What happens**: Discovers radio bands dynamically. TR-181 uses `OperatingFrequencyBand`, TR-098 uses `PossibleChannels`/`Channel` heuristic. Only configures bands present on the device and in the policy.

### 14.3 VoIP Configuration (`dynamic-voip-config`)

```json
{
  "server": "sip.isp.com",
  "port": 5060,
  "username": "0612345678",
  "password": "sipPassword",
  "registrarPort": 5060
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `server` | String | Yes | SIP proxy/registrar server hostname or IP |
| `port` | Integer | No | SIP proxy port. Default: `5060` |
| `username` | String | Yes | SIP auth username (typically phone number) |
| `password` | String | Yes | SIP auth password |
| `registrarPort` | Integer | No | Registrar server port. Default: same as `port` |

**What happens**: Sets `VoiceService.1.VoiceProfile.1.SIP` parameters (ProxyServer, ProxyServerPort, RegistrarServer, RegistrarServerPort) and `Line.1.SIP` auth. All vendors use the same `VoiceService` path structure — only the root (`Device` vs `InternetGatewayDevice`) changes.

### 14.4 Optical Monitoring (`dynamic-optical-monitor`)

```json
{
  "thresholds": {
    "warning": -25,
    "critical": -28
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `thresholds.warning` | Number (dBm) | No | Warning threshold. Default: `-25` |
| `thresholds.critical` | Number (dBm) | No | Critical threshold. Default: `-28` |

**What happens**: Reads vendor-specific RxPower path (ZTE: `X_ZTE-COM_GponInterfaceConfig.RxPower`, Nokia: `X_ALU_COM.OntOpticalParam.RxPower`). Huawei does not expose optical via TR-069. Tags devices: `optical_warning` if below warning threshold, `optical_critical` if below critical.

### 14.5 Port Forwarding (`dynamic-port-forward`)

```json
{
  "rules": [
    {
      "externalPort": 8080,
      "internalPort": 80,
      "internalClient": "192.168.1.100",
      "protocol": "TCP",
      "description": "Web server"
    },
    {
      "externalPort": 3389,
      "internalPort": 3389,
      "internalClient": "192.168.1.200",
      "protocol": "TCP",
      "description": "Remote desktop"
    }
  ],
  "wanType": "ppp"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rules` | Array | Yes | List of port mapping rules |
| `rules[].externalPort` | Integer | Yes | External (WAN) port |
| `rules[].internalPort` | Integer | Yes | Internal (LAN) port |
| `rules[].internalClient` | String (IP) | Yes | LAN IP of target device |
| `rules[].protocol` | `"TCP"`, `"UDP"`, `"BOTH"` | No | Default: `"TCP"` |
| `rules[].description` | String | No | Human-readable label |
| `wanType` | `"ip"` or `"ppp"` | No | `"ppp"` for PPPoE, `"ip"` for DHCP. Default: `"ip"` |

**Note**: Port forwarding is typically triggered on-demand via a task, not via a periodic preset. Use the `provisions` task type.

---

## 15. Auto-Tag System

The `universal-auto-tag` provision runs on every periodic inform and automatically tags devices. Understanding these tags is essential for OSS/BSS queries and preset preconditions.

### Tags Set Automatically

| Tag Pattern | Example | Source |
|-------------|---------|--------|
| `vendor_<name>` | `vendor_huawei`, `vendor_zte`, `vendor_nokia` | Manufacturer field matched against alias map |
| `<vendor>` | `huawei`, `zte`, `nokia` | Short vendor alias (same match) |
| `tr098` or `tr181` | `tr098` | Data model detection (TR-181 `Device.*` test) |
| `<ProductClass>` | `HG8245H`, `ZXHN_F660` | ProductClass with non-alphanumeric chars replaced by `_` |

### Vendor Alias Map

The auto-tag provision uses this alias map for vendor detection:

| Manufacturer Contains (case-insensitive) | Vendor Tag |
|------------------------------------------|-----------|
| `huawei` | `vendor_huawei` |
| `zte` | `vendor_zte` |
| `nokia` | `vendor_nokia` |
| `alcl` | `vendor_nokia` |
| `alu` | `vendor_nokia` |
| `fiberhome` | `vendor_fiberhome` |
| `tp-link` | `vendor_tplink` |
| `dasan` | `vendor_dasan` |

**To add a new vendor**: Add one line to the `VENDOR_ALIASES` map in `universal-auto-tag.js`. No other changes needed.

### Querying by Auto-Tags

```bash
# All Huawei devices
curl -s 'http://localhost:7557/devices/?query=%7B%22_tags%22%3A%22vendor_huawei%22%7D'

# All TR-181 devices
curl -s 'http://localhost:7557/devices/?query=%7B%22_tags%22%3A%22tr181%22%7D'

# All Nokia TR-181 devices (both tags)
curl -s 'http://localhost:7557/devices/?query=%7B%22%24and%22%3A%5B%7B%22_tags%22%3A%22vendor_nokia%22%7D%2C%7B%22_tags%22%3A%22tr181%22%7D%5D%7D'

# Specific model
curl -s 'http://localhost:7557/devices/?query=%7B%22_tags%22%3A%22HG8245H%22%7D'
```

### Using Auto-Tags in Preset Preconditions

```json
"precondition": "Tags.vendor_nokia IS NOT NULL AND Tags.tr181 IS NOT NULL"
```

---

## 16. OSS/BSS Integration Workflows

### 16.1 New Subscriber Provisioning (End-to-End)

When a new subscriber is activated in the OSS/BSS, the following sequence provisions their CPE device:

```
OSS/BSS                          GenieACS NBI
  │                                    │
  │  1. Tag device with plan type      │
  ├───────────────────────────────────>│  POST /devices/:id/tags/plan_residential
  │                                    │
  │  2. Create subscriber WAN preset   │
  ├───────────────────────────────────>│  PUT /presets/wan-sub-001
  │                                    │  (per-subscriber or use default preset)
  │                                    │
  │  3. Trigger immediate provisioning │
  ├───────────────────────────────────>│  POST /devices/:id/tasks/?connection_request
  │                                    │  body: {"name":"provisions","provisions":[
  │                                    │    ["dynamic-wan-config", "{...}"],
  │                                    │    ["dynamic-wifi-config", "{...}"]
  │                                    │  ]}
  │                                    │
  │  4. Verify configuration           │
  │<───────────────────────────────────┤  200 OK (task completed)
  │                                    │
  │  5. Check for faults               │
  ├───────────────────────────────────>│  GET /faults/?query={"_id":{"$regex":"^<device_id>"}}
  │                                    │
  │  6. Read back applied values       │
  ├───────────────────────────────────>│  POST /devices/:id/tasks/?connection_request
  │                                    │  body: {"name":"getParameterValues",
  │                                    │    "parameterNames":["...WANPPPConnection.1.Username"]}
  │                                    │
```

#### Example: Complete Subscriber Activation Script

```bash
#!/bin/bash
DEVICE_ID="00E0FC-HG8245H-001000"
NBI="http://localhost:7557"

# 1. Tag the device
curl -s -X POST "${NBI}/devices/${DEVICE_ID}/tags/plan_residential"

# 2. Provision WAN + WiFi + VoIP in one task
curl -s -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "provisions",
    "provisions": [
      ["dynamic-wan-config", "{\"type\":\"pppoe\",\"username\":\"sub001@isp.com\",\"password\":\"p@ss123\",\"vlan\":100}"],
      ["dynamic-wifi-config", "{\"password\":\"WiFiPass456\",\"bands\":{\"2.4\":{\"ssid\":\"Sub001-Net\",\"security\":\"wpa2\"},\"5\":{\"ssid\":\"Sub001-5G\",\"security\":\"wpa2\"}}}"],
      ["dynamic-voip-config", "{\"server\":\"sip.isp.com\",\"port\":5060,\"username\":\"0612345678\",\"password\":\"sippass\"}"]
    ]
  }' \
  "${NBI}/devices/${DEVICE_ID}/tasks/?connection_request"

# 3. Check result
echo "Checking for faults..."
FAULTS=$(curl -s "${NBI}/faults/?query=%7B%22_id%22%3A%7B%22%24regex%22%3A%22%5E${DEVICE_ID}%22%7D%7D")
echo "$FAULTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} faults')"
```

### 16.2 Approach A: Per-Subscriber Presets

Create a unique preset per subscriber. This approach gives maximum control but creates many presets.

```bash
# Subscriber-specific WAN preset
curl -X PUT \
  -H 'Content-Type: application/json' \
  -d '{
    "weight": 10,
    "channel": "wan",
    "events": {"2 PERIODIC": true},
    "precondition": "_id = \"00E0FC-HG8245H-001000\"",
    "configurations": [{
      "type": "provision",
      "name": "dynamic-wan-config",
      "args": ["{\"type\":\"pppoe\",\"username\":\"sub001@isp.com\",\"password\":\"unique_pass\",\"vlan\":200}"]
    }]
  }' \
  'http://localhost:7557/presets/wan-sub-001'
```

**Pros**: Full per-subscriber customization, persistent across reboots.
**Cons**: Many presets in database, cleanup needed on subscriber churn.

### 16.3 Approach B: Tag-Based Plan Presets

Use tags to group subscribers by plan type, with shared presets per plan. Best for settings that are the **same for all subscribers on a plan** (e.g., WiFi SSID scheme, QoS, VLAN).

```bash
# Step 1: Tag device with plan type
curl -X POST 'http://localhost:7557/devices/00E0FC-HG8245H-001000/tags/plan_business'

# Step 2: Create plan-level presets (one-time setup)
# Note: These can only contain SHARED values — not per-subscriber credentials
curl -X PUT \
  -H 'Content-Type: application/json' \
  -d '{
    "weight": 15,
    "channel": "wifi",
    "events": {"2 PERIODIC": true},
    "precondition": "Tags.plan_business IS NOT NULL",
    "configurations": [{
      "type": "provision",
      "name": "dynamic-wifi-config",
      "args": ["{\"password\":\"BusinessWiFi123\",\"bands\":{\"2.4\":{\"ssid\":\"Business-Net\",\"security\":\"wpa2\"},\"5\":{\"ssid\":\"Business-5G\",\"security\":\"wpa2-wpa3\"}}}"]
    }]
  }' \
  'http://localhost:7557/presets/wifi-business'
```

**Important**: GenieACS presets do NOT support per-device variable substitution. Preset args are static — the same values apply to every matching device. For per-subscriber credentials (PPPoE username/password, SIP credentials), use **Approach A** (per-subscriber presets) or **Approach C** (on-demand tasks).

### 16.4 Approach C: On-Demand Tasks Only (Recommended for Per-Subscriber)

Don't use presets for per-subscriber config. Instead, send provisioning tasks from the OSS/BSS whenever a subscriber is activated or their config changes.

```bash
# OSS/BSS sends this when subscriber is activated
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "provisions",
    "provisions": [
      ["dynamic-wan-config", "{\"type\":\"pppoe\",\"username\":\"sub001@isp.com\",\"password\":\"unique_pass\",\"vlan\":100}"]
    ]
  }' \
  'http://localhost:7557/devices/00E0FC-HG8245H-001000/tasks/?connection_request'
```

Use **default presets** (with shared values) as a baseline, and **on-demand tasks** for subscriber-specific overrides.

**Pros**: Clean, no preset proliferation, immediate execution.
**Cons**: Config not persistent — if device factory-resets, OSS/BSS must re-provision.

### 16.5 Recommended Hybrid Strategy

| Aspect | Method | Presets or Tasks? |
|--------|--------|-------------------|
| **Network-wide defaults** | Periodic presets | Preset (e.g., `wan-default`, `wifi-default`) |
| **Plan-based overrides** | Tag + higher-weight presets | Preset with precondition |
| **Per-subscriber credentials** | On-demand task | Task (`provisions` type) |
| **Port forwarding** | On-demand task | Task (`provisions` type) |
| **Firmware upgrades** | On-demand task | Task (`download` type) |
| **Monitoring** | Periodic presets | Preset (e.g., `optical-default`) |
| **Device reboot** | On-demand task | Task (`reboot` type) |

### 16.6 Monitoring & Alerting

Query tagged devices for monitoring dashboards:

```bash
# Devices with optical warning
curl -s 'http://localhost:7557/devices/?query=%7B%22_tags%22%3A%22optical_warning%22%7D&projection=DeviceID,_tags'

# Devices with optical critical (needs immediate attention)
curl -s 'http://localhost:7557/devices/?query=%7B%22_tags%22%3A%22optical_critical%22%7D&projection=DeviceID,_tags'

# Devices offline (last inform > 24h ago)
curl -s 'http://localhost:7557/devices/?query=%7B%22_lastInform%22%3A%7B%22%24lt%22%3A%222024-01-01T00%3A00%3A00%22%7D%7D&projection=DeviceID,_lastInform'

# Count total devices
curl -s -I 'http://localhost:7557/devices/' | grep -i total

# Count devices by vendor (via tag)
curl -s -I 'http://localhost:7557/devices/?query=%7B%22_tags%22%3A%22vendor_huawei%22%7D' | grep -i total
curl -s -I 'http://localhost:7557/devices/?query=%7B%22_tags%22%3A%22vendor_zte%22%7D' | grep -i total
curl -s -I 'http://localhost:7557/devices/?query=%7B%22_tags%22%3A%22vendor_nokia%22%7D' | grep -i total
```

### 16.7 Subscriber Plan Change

```bash
DEVICE_ID="00E0FC-HG8245H-001000"
NBI="http://localhost:7557"

# 1. Remove old plan tag
curl -s -X DELETE "${NBI}/devices/${DEVICE_ID}/tags/plan_basic"

# 2. Add new plan tag
curl -s -X POST "${NBI}/devices/${DEVICE_ID}/tags/plan_premium"

# 3. Apply new config immediately (premium WiFi SSID)
curl -s -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "provisions",
    "provisions": [
      ["dynamic-wifi-config", "{\"password\":\"PremiumPass\",\"bands\":{\"2.4\":{\"ssid\":\"Premium-Net\",\"security\":\"wpa2\"},\"5\":{\"ssid\":\"Premium-5G\",\"security\":\"wpa2-wpa3\"},\"6\":{\"ssid\":\"Premium-6E\",\"security\":\"wpa3\"}}}"]
    ]
  }' \
  "${NBI}/devices/${DEVICE_ID}/tasks/?connection_request"
```

### 16.8 Subscriber Deactivation

```bash
DEVICE_ID="00E0FC-HG8245H-001000"
NBI="http://localhost:7557"

# 1. Factory reset the device
curl -s -X POST \
  -H 'Content-Type: application/json' \
  -d '{"name": "factoryReset"}' \
  "${NBI}/devices/${DEVICE_ID}/tasks/?connection_request"

# 2. Delete subscriber-specific preset (if using Approach A)
curl -s -X DELETE "${NBI}/presets/wan-sub-001"

# 3. Remove subscriber tags
curl -s -X DELETE "${NBI}/devices/${DEVICE_ID}/tags/plan_premium"
```

---

## 17. Error Handling & Status Codes

### HTTP Status Codes

| Code | Meaning | Endpoints |
|------|---------|-----------|
| 200 | Success | All endpoints on success |
| 201 | Created | `PUT /files/:name` only |
| 202 | Accepted | `POST /devices/:id/tasks/` — task queued or faulted (check status text) |
| 400 | Bad Request | Invalid JSON, invalid JS syntax, malformed query, empty body without `connection_request` |
| 404 | Not Found | Unknown device, task, collection, file, or host unreachable (ping) |
| 405 | Method Not Allowed | Wrong HTTP method (includes `Allow` header with valid methods) |
| 500 | Server Error | Ping command failure, or `POST /tasks/:id/retry` with nonexistent task ID |
| 503 | Service Unavailable | `DELETE /tasks/:id`, `POST /tasks/:id/retry`, `DELETE /faults/:id`, `DELETE /devices/:id` — device in active session |
| 504 | Connection Request Failed | `POST /devices/:id/tasks/?connection_request` with empty body — device offline, invalid URL, or HTTP error |

### 202 Status Text Variants

When using `?connection_request`, a 202 response means the task was saved but something went wrong:

| Status Text | Meaning | Action |
|-------------|---------|--------|
| `"Task queued but not processed"` | Device didn't connect or session didn't complete | Retry later or check device connectivity |
| `"Task faulted"` | Task executed but produced an error | Check `/faults/` for details |
| *(raw error string)* | Connection request failed (e.g., `"Error: connect ECONNREFUSED"`) | Check device connectivity and ConnectionRequestURL |

### Fault Structure

```json
{
  "_id": "00E0FC-HG8245H-001000:wan",
  "device": "00E0FC-HG8245H-001000",
  "channel": "wan",
  "code": "script",
  "message": "dynamic-wan-config: PPPoE requires username and password",
  "detail": { "name": "Error", "message": "..." },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "retries": 0
}
```

---

## 18. Gotchas & Lessons Learned

### NBI API Quirks

1. **No single-device GET**: `GET /devices/:id` returns 405. Use the query endpoint instead:
   ```bash
   curl -s 'http://localhost:7557/devices/?query=%7B%22_id%22%3A%22DEVICE_ID%22%7D'
   ```

2. **Query parameter must be JSON**: `query=DeviceID.Manufacturer = "Huawei"` returns parse error. Must be URL-encoded JSON: `query=%7B%22DeviceID.Manufacturer%22%3A%22Huawei%22%7D`

3. **Virtual parameters use underscore in URL**: `/virtual_parameters/`, not `/virtualParameters/`

4. **Preset configurations, not provisions**: The preset JSON field for provisions is `configurations`, not `provisions`. For `provision` type entries, the shape is `{type, name, args}`. Other types have different fields (e.g., `value` has `{type, name, value}`, `add_tag` has `{type, tag}`).

5. **Preset args is an array of strings**: Even though the policy is JSON, it's passed as a string inside the args array: `"args": ["{\"key\":\"value\"}"]`

6. **Events are ANDed**: `{"0 BOOTSTRAP": true, "2 PERIODIC": true}` requires both events in the same Inform. Use just `{"2 PERIODIC": true}` for reliable operation.

7. **Device IDs contain hyphens**: Format is `OUI-ProductClass-SerialNumber` (e.g., `00E0FC-HG8245H-001000`). URL-encode if needed.

8. **Preset changes are eventually consistent**: After PUT/DELETE, the CWMP service cache takes ~30s to refresh. Tasks with `connection_request` will use the latest config since they trigger a new session.

### Provisioning Behavior

9. **Provisions are idempotent**: Running the same provision multiple times with the same policy produces the same result. Safe to retry.

10. **Vendor detection is automatic**: All `dynamic-*` provisions detect TR-181 vs TR-098 and vendor (Huawei/ZTE/Nokia) automatically. The OSS/BSS doesn't need to know the device model.

11. **Null guards everywhere**: Provisions handle missing parameters gracefully. If a device doesn't support a feature (e.g., Huawei optical monitoring), the provision logs a message and skips.

12. **6GHz always WPA3**: Regardless of the `security` field in the WiFi policy, 6 GHz band always forces WPA3-SAE (WiFi Alliance mandate).

13. **Port forwarding is on-demand only**: No periodic preset for port forwarding. Use the `provisions` task type to push rules to specific devices.

14. **405 responses include `Allow` header**: When using the wrong HTTP method, the response includes an `Allow` header listing valid methods (e.g., `Allow: PUT, DELETE`). Parse this for proper error handling.

15. **Preset `configurations` supports 7 types, not just `provision`**: `value`, `age`, `add_tag`, `delete_tag`, `add_object`, `delete_object`, and `provision`. For simple parameter sets, the `value` type avoids needing a provision script entirely.

16. **Task `uniqueKey` prevents duplicate tasks**: If your OSS/BSS retries on timeout, use `uniqueKey` to ensure only one task exists per operation per device. Without it, retries create duplicate tasks.

17. **Task `expiry` prevents stale tasks**: Set `expiry` (in seconds) to auto-discard tasks that weren't executed within a time window. Critical for time-sensitive operations like connection requests.

18. **Presets args are static, not templated**: There is no variable substitution in preset `args`. The same JSON string applies to every device that matches the precondition. For per-subscriber values, use on-demand tasks.

19. **Task creation NEVER returns 503**: Even if the device is in an active session, task creation queues the task and returns 202. The 503 code only appears on `DELETE /tasks/:id`, `POST /tasks/:id/retry`, `DELETE /faults/:id`, and `DELETE /devices/:id`.

20. **Save the task `_id` from the response**: The task creation response body (200 and 202) includes the task JSON with a server-assigned `_id`. Store this — you need it to delete, retry, or query individual tasks.

21. **Deleting a task fault deletes the task too**: `DELETE /faults/<device_id>:task_<task_id>` removes BOTH the fault AND the task. To keep the task for retry, use `POST /tasks/<task_id>/retry` instead.

22. **Tag operations are idempotent**: Adding a tag that already exists or removing a tag that doesn't exist both return 200. Safe to call without checking current state. Returns 404 only if the device doesn't exist.

23. **Tasks/Faults queries auto-convert types**: When querying `/tasks/`, the `_id` field is auto-converted to MongoDB ObjectId, `timestamp` to Date, `retries` to Number. For `/faults/`, `timestamp` and `retries` are similarly converted. Device queries expand parameter paths with `._value`.

24. **`POST /tasks/:id/retry` does not check if task exists**: Unlike `DELETE /tasks/:id` which returns 404 for nonexistent tasks, the retry endpoint has no null check — it returns 500 (unhandled TypeError) if the task doesn't exist. Always verify the task exists before calling retry.

25. **Provision/VP scripts are validated in strict mode**: When uploading via PUT, scripts are wrapped in `"use strict";(function(){ ... })();` and compiled with `vm.Script`. Scripts using strict-mode-forbidden constructs (`with` statements, octal literals, duplicate parameter names) will fail validation with a 400 error.

26. **Resource DELETEs are idempotent**: DELETE on presets, objects, provisions, virtual parameters, and faults returns 200 even if the resource doesn't exist. This makes cleanup operations safe to retry without checking current state. Exception: `DELETE /files/:name` returns 404 for nonexistent files.

27. **Connection request 202 status text may be a raw error string**: When creating a task with `?connection_request` and the connection request fails, the 202 response status text contains the raw error message (e.g., `"Error: connect ECONNREFUSED"`), not one of the documented status strings. Parse the status text carefully — don't just check for exact matches against "Task faulted" and "Task queued but not processed".

---

## Quick Reference: Active Provisions & Presets (v2.0)

### Provisions (10)

| Name | Type | Description |
|------|------|-------------|
| `universal-auto-tag` | Universal | Vendor detection + device tagging |
| `universal-firmware-log` | Universal | Firmware inventory logging |
| `dynamic-wifi-config` | Universal | WiFi configuration (all bands, WPA3 6GHz) |
| `dynamic-wan-config` | Universal | PPPoE/DHCP WAN with vendor VLAN extensions |
| `dynamic-voip-config` | Universal | SIP VoIP (all vendors) |
| `dynamic-optical-monitor` | Universal | GPON RxPower monitoring with tagging |
| `dynamic-port-forward` | Universal | Multi-rule port forwarding |
| `nokia-alu-migration` | Nokia | Legacy ALU ONT migration |
| `nokia-firmware-check` | Nokia | Nokia firmware version tagging |
| `huawei-firmware-upgrade` | Huawei | Huawei firmware upgrade checks |

### Presets (6)

| Name | Channel | Weight | Provision | Description |
|------|---------|--------|-----------|-------------|
| `universal-bootstrap` | bootstrap | 0 | `universal-auto-tag` | Vendor detection on every inform |
| `universal-firmware-log` | monitoring | 0 | `universal-firmware-log` | Firmware inventory |
| `wifi-default` | wifi | 10 | `dynamic-wifi-config` | Default WiFi policy |
| `wan-default` | wan | 10 | `dynamic-wan-config` | Default WAN policy |
| `voip-default` | voip | 20 | `dynamic-voip-config` | Default VoIP policy |
| `optical-default` | monitoring | 0 | `dynamic-optical-monitor` | Optical power monitoring |

### Virtual Parameters (9)

`wifi_ssid_2g`, `wifi_password_2g`, `wifi_ssid_5g`, `wifi_password_5g`, `wifi_ssid_6g`, `wifi_password_6g`, `wan_status`, `wan_ip`, `optical_rx_power`
