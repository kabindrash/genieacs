# GenieACS Data Flow

## Overview

This document traces how data moves through GenieACS from device communication to database storage and API access.

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW OVERVIEW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    DEVICE                    GENIEACS                      EXTERNAL          │
│                                                                              │
│  ┌─────────┐              ┌─────────────┐              ┌─────────────┐      │
│  │   CPE   │◀────────────▶│    CWMP     │              │    NBI      │◀────▶│ Apps
│  │ Router  │   SOAP/HTTP  │   :7547     │              │   :7557     │ REST │
│  └─────────┘              └──────┬──────┘              └──────┬──────┘      │
│                                  │                            │              │
│                                  ▼                            ▼              │
│                           ┌─────────────────────────────────────┐           │
│                           │            MongoDB                   │           │
│                           │  ┌─────────┐ ┌─────────┐ ┌───────┐  │           │
│                           │  │ devices │ │  tasks  │ │ files │  │           │
│                           │  └─────────┘ └─────────┘ └───────┘  │           │
│                           └─────────────────────────────────────┘           │
│                                          │                                   │
│                                          ▼                                   │
│                                   ┌─────────────┐                           │
│                                   │     UI      │◀────▶ Browser             │
│                                   │   :3000     │ HTTP                      │
│                                   └─────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Inbound Data Flow (Device → GenieACS)

### 1. SOAP Message Reception

```
Device                              CWMP Service
  │                                      │
  │  POST /acs HTTP/1.1                 │
  │  Content-Type: text/xml             │
  │  ──────────────────────────────────►│
  │  <soap:Envelope>                    │
  │    <soap:Body>                      │
  │      <Inform>...</Inform>           │
  │    </soap:Body>                     │
  │  </soap:Envelope>                   │
  │                                      │
  │                               ┌──────▼──────┐
  │                               │ lib/soap.ts │
  │                               │   parse()   │
  │                               └──────┬──────┘
  │                                      │
  │                               ┌──────▼──────┐
  │                               │ RPC Request │
  │                               │   Object    │
  │                               └─────────────┘
```

### 2. Inform Processing

```typescript
// Inform message structure after parsing
interface InformRequest {
  name: "Inform";
  deviceId: {
    Manufacturer: string;
    OUI: string;
    ProductClass: string;
    SerialNumber: string;
  };
  event: string[];           // ["0 BOOTSTRAP", "1 BOOT"]
  retryCount: number;
  currentTime: Date;
  parameterList: {
    name: string;
    value: [unknown, string]; // [value, type]
  }[];
}
```

### 3. Device Data Transformation

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA TRANSFORMATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input (SOAP):                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ <ParameterValueStruct>                                      ││
│  │   <Name>Device.DeviceInfo.SoftwareVersion</Name>            ││
│  │   <Value xsi:type="xsd:string">2.0.1</Value>                ││
│  │ </ParameterValueStruct>                                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  Transform (lib/session.ts):                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ deviceData.set(                                             ││
│  │   ["Device", "DeviceInfo", "SoftwareVersion"],              ││
│  │   { value: ["2.0.1", "xsd:string"], timestamp: now }        ││
│  │ )                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  Output (MongoDB):                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ {                                                           ││
│  │   "Device.DeviceInfo.SoftwareVersion": {                    ││
│  │     "_value": ["2.0.1", "xsd:string"],                      ││
│  │     "_timestamp": 1704067200000                             ││
│  │   }                                                         ││
│  │ }                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Outbound Data Flow (GenieACS → Device)

### 1. RPC Generation

```
Declaration from Provision
         │
         ▼
┌────────────────────┐
│   Sync State       │
│   Analysis         │
└─────────┬──────────┘
          │
    ┌─────▼─────┐
    │  Missing  │
    │  Data?    │
    └─────┬─────┘
          │
    Yes   │   No
    ┌─────┴─────┐
    ▼           ▼
┌────────┐  ┌────────┐
│Generate│  │Continue│
│  RPC   │  │ Script │
└────┬───┘  └────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ RPC Types Generated:                                             │
│                                                                  │
│ GetParameterNames  → Discover parameter paths                   │
│ GetParameterValues → Read parameter values                      │
│ SetParameterValues → Write parameter values                     │
│ AddObject         → Create object instance                      │
│ DeleteObject      → Remove object instance                      │
│ Download          → Firmware/config download                    │
│ Reboot            → Device reboot                               │
│ FactoryReset      → Reset to defaults                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2. SOAP Response Generation

```typescript
// lib/soap.ts - response()
function response(rpc: RpcRequest): string {
  return `
    <soap:Envelope xmlns:soap="..." xmlns:cwmp="...">
      <soap:Header>
        <cwmp:ID>${rpc.id}</cwmp:ID>
      </soap:Header>
      <soap:Body>
        <cwmp:${rpc.name}>
          ${generateRpcBody(rpc)}
        </cwmp:${rpc.name}>
      </soap:Body>
    </soap:Envelope>
  `;
}
```

## Database Data Flow

### Collection Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MONGODB COLLECTIONS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │   devices   │◀────────│   tasks     │         │   faults    │           │
│  │             │ device  │             │         │             │           │
│  │ _id: deviceId         │ device:     │         │ _id:        │           │
│  │ params...   │         │   deviceId  │         │ deviceId:   │           │
│  │ _tags       │         │ name: type  │         │   channel   │           │
│  └──────┬──────┘         └─────────────┘         └─────────────┘           │
│         │                                                                    │
│         │ referenced by                                                      │
│         ▼                                                                    │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │   presets   │────────▶│ provisions  │         │    files    │           │
│  │             │ uses    │             │         │  (GridFS)   │           │
│  │ provisions: │         │ _id: name   │         │             │           │
│  │   [names]   │         │ script: js  │         │ metadata    │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │   config    │         │    cache    │         │    locks    │           │
│  │             │         │             │         │             │           │
│  │ _id: key    │         │ _id: hash   │         │ _id: key    │           │
│  │ value: any  │         │ value: data │         │ token: uuid │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Write Operations

```
┌─────────────────────────────────────────────────────────────────┐
│                    WRITE OPERATIONS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Session Commit (lib/db.ts):                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ await collection.updateOne(                                 ││
│  │   { _id: deviceId },                                        ││
│  │   {                                                         ││
│  │     $set: {                                                 ││
│  │       "Device.Info.Version._value": ["2.0.1", "xsd:string"],││
│  │       "Device.Info.Version._timestamp": 1704067200000,      ││
│  │       "_lastInform": new Date()                             ││
│  │     },                                                      ││
│  │     $unset: { "Device.OldParam": 1 },                       ││
│  │     $addToSet: { "_tags": "configured" },                   ││
│  │     $pull: { "_tags": "pending" }                           ││
│  │   },                                                        ││
│  │   { upsert: true }                                          ││
│  │ )                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Read Operations

```
┌─────────────────────────────────────────────────────────────────┐
│                     READ OPERATIONS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Query Flow (API Request):                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ NBI Request: GET /devices/?query={"Tags.online":true}       ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Expression Parser (lib/common/expression/parser.ts)         ││
│  │ Input: {"Tags.online": true}                                ││
│  │ Output: ["=", ["PARAM", "Tags.online"], true]               ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Query Synthesis (lib/db/synth.ts)                           ││
│  │ Input: ["=", ["PARAM", "Tags.online"], true]                ││
│  │ Output: { "_tags": "online" }                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ MongoDB Query                                               ││
│  │ collection.find({ "_tags": "online" })                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## NBI API Data Flow

### Request Processing

```
External App                        NBI Service
     │                                   │
     │  GET /devices/ABC123             │
     │  Authorization: Bearer token     │
     │  ────────────────────────────────►
     │                                   │
     │                            ┌──────▼──────┐
     │                            │  Router     │
     │                            │ (lib/nbi.ts)│
     │                            └──────┬──────┘
     │                                   │
     │                            ┌──────▼──────┐
     │                            │    Auth     │
     │                            │  Verify     │
     │                            └──────┬──────┘
     │                                   │
     │                            ┌──────▼──────┐
     │                            │   Query     │
     │                            │  Execute    │
     │                            └──────┬──────┘
     │                                   │
     │                            ┌──────▼──────┐
     │                            │  Response   │
     │                            │  Transform  │
     │                            └──────┬──────┘
     │                                   │
     │  ◄───────────────────────────────┘
     │  200 OK                          │
     │  Content-Type: application/json  │
     │  { "_id": "ABC123", ... }        │
```

### Task Queue Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      TASK QUEUE FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Task Creation (NBI POST /devices/ABC123/tasks):             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ {                                                           ││
│  │   "name": "setParameterValues",                             ││
│  │   "parameterValues": [                                      ││
│  │     ["Device.WiFi.SSID.1.SSID", "NewNetwork", "xsd:string"] ││
│  │   ]                                                         ││
│  │ }                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  2. Task Stored in MongoDB:                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ {                                                           ││
│  │   _id: ObjectId("..."),                                     ││
│  │   device: "ABC123",                                         ││
│  │   name: "setParameterValues",                               ││
│  │   parameterValues: [...],                                   ││
│  │   timestamp: Date()                                         ││
│  │ }                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  3. Connection Request Sent to Device                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ GET http://device-ip:port/wakeup                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  4. Device Initiates Session, Task Executed                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ CWMP Session processes pending tasks                        ││
│  │ Task deleted after successful execution                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Cache Data Flow

### Local Cache (Per-Worker)

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOCAL CACHE SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Cache Structure (lib/cache.ts):                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ const cache = new Map<string, {                             ││
│  │   value: unknown,                                           ││
│  │   timestamp: number,                                        ││
│  │   hash: string         // For invalidation                  ││
│  │ }>();                                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Cache Keys:                                                     │
│  • presets_hash          → Current presets configuration        │
│  • provisions_hash       → Provision scripts                    │
│  • virtualParams_hash    → Virtual parameter scripts            │
│  • config_hash          → System configuration                  │
│                                                                  │
│  Invalidation:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ // On MongoDB change                                        ││
│  │ const newHash = computeHash(data);                          ││
│  │ if (newHash !== cache.get(key).hash) {                      ││
│  │   cache.delete(key);  // Force reload                       ││
│  │ }                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Distributed Cache (MongoDB)

```
┌─────────────────────────────────────────────────────────────────┐
│                  DISTRIBUTED CACHE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Collection: cache                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ {                                                           ││
│  │   _id: "presets_compiled",                                  ││
│  │   value: { /* compiled preset data */ },                    ││
│  │   hash: "abc123...",                                        ││
│  │   timestamp: ISODate()                                      ││
│  │ }                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Use Cases:                                                      │
│  • Compiled presets (expensive to compute)                      │
│  • Parsed expressions                                           │
│  • Aggregated statistics                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Session State Flow

### VersionedMap for Parameters

```
┌─────────────────────────────────────────────────────────────────┐
│                   VERSIONEDMAP DATA FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Purpose: Track parameter changes during session iterations     │
│                                                                  │
│  Iteration 1:                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ versionedMap.set(["Device", "SSID"], "OldValue", rev=1)     ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│  Iteration 2 (after RPC): │                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ versionedMap.set(["Device", "SSID"], "NewValue", rev=2)     ││
│  │                                                             ││
│  │ // Can query by revision:                                   ││
│  │ versionedMap.get(["Device", "SSID"], rev=1) → "OldValue"    ││
│  │ versionedMap.get(["Device", "SSID"], rev=2) → "NewValue"    ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│  Commit (collapse to latest):                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ versionedMap.collapse()                                     ││
│  │ → Only rev=2 values remain                                  ││
│  │ → Ready for MongoDB persistence                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## File Server Data Flow

```
Device                           File Server                    MongoDB
  │                                   │                            │
  │  GET /files/firmware.bin         │                            │
  │  Range: bytes=0-1023             │                            │
  │  ─────────────────────────────────►                            │
  │                                   │                            │
  │                            ┌──────▼──────┐                     │
  │                            │ Parse Path  │                     │
  │                            │ & Headers   │                     │
  │                            └──────┬──────┘                     │
  │                                   │                            │
  │                                   │  GridFS Query             │
  │                                   │  ────────────────────────►│
  │                                   │                            │
  │                                   │◄────────────────────────── │
  │                                   │  File Stream              │
  │                            ┌──────▼──────┐                     │
  │                            │   Stream    │                     │
  │                            │  Response   │                     │
  │                            └──────┬──────┘                     │
  │                                   │                            │
  │  ◄─────────────────────────────────                            │
  │  206 Partial Content             │                            │
  │  Content-Range: bytes 0-1023/... │                            │
  │  [binary data]                   │                            │
```

## Expression Evaluation Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                EXPRESSION EVALUATION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input Expression:                                               │
│  "Device.DeviceInfo.SoftwareVersion = '2.0' AND Tags.online"    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Parser (lib/common/expression/parser.ts)                    ││
│  │ → ["AND",                                                   ││
│  │     ["=", ["PARAM", "Device.DeviceInfo.SoftwareVersion"],   ││
│  │           "2.0"],                                           ││
│  │     ["PARAM", "Tags.online"]]                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Evaluator (lib/common/expression/evaluator.ts)              ││
│  │ Context: { deviceData, now, ... }                           ││
│  │ → true / false                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  OR                                                              │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Query Synthesizer (lib/db/synth.ts)                         ││
│  │ → MongoDB Query Document                                    ││
│  │ { "$and": [                                                 ││
│  │   {"Device.DeviceInfo.SoftwareVersion._value.0": "2.0"},    ││
│  │   {"_tags": "online"}                                       ││
│  │ ]}                                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Summary: Complete Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE REQUEST LIFECYCLE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. DEVICE CONNECTS                                                          │
│     └─► CWMP receives SOAP Inform                                           │
│         └─► Parse XML to RPC object                                         │
│             └─► Generate deviceId from OUI/ProductClass/Serial              │
│                                                                              │
│  2. SESSION INITIALIZATION                                                   │
│     └─► Acquire distributed lock                                            │
│         └─► Load device data from MongoDB                                   │
│             └─► Initialize VersionedMap with current state                  │
│                                                                              │
│  3. PRESET MATCHING                                                          │
│     └─► Load presets from cache/DB                                          │
│         └─► Evaluate event filters                                          │
│             └─► Evaluate preconditions against device                       │
│                 └─► Sort by weight, group by channel                        │
│                                                                              │
│  4. PROVISION EXECUTION                                                      │
│     └─► For each matched provision:                                         │
│         └─► Execute in sandbox                                              │
│             └─► Collect declarations                                        │
│                 └─► Check cache for required data                           │
│                     └─► Generate RPCs for missing data                      │
│                                                                              │
│  5. RPC EXCHANGE                                                             │
│     └─► Send RPC request to device                                          │
│         └─► Receive RPC response                                            │
│             └─► Update VersionedMap                                         │
│                 └─► Re-execute provisions (loop until stable)               │
│                                                                              │
│  6. SESSION COMMIT                                                           │
│     └─► Collapse VersionedMap                                               │
│         └─► Generate MongoDB update operations                              │
│             └─► Write to devices collection                                 │
│                 └─► Delete completed tasks                                  │
│                     └─► Release distributed lock                            │
│                                                                              │
│  7. SESSION END                                                              │
│     └─► Send empty SOAP response                                            │
│         └─► Device closes connection                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```
