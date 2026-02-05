# GenieACS Operations & Runtime Specification

## Overview

This document covers runtime operational components including the extension system, connection request mechanisms, caching, locking, XML parsing, and utility functions.

**Primary Files**:
- `lib/extensions.ts` - External script execution
- `lib/connection-request.ts` - Device wakeup (HTTP/UDP/XMPP)
- `lib/xmpp-client.ts` - XMPP protocol client
- `lib/cache.ts` - Distributed caching
- `lib/lock.ts` - Distributed locking
- `lib/xml-parser.ts` - SOAP XML processing
- `lib/ping.ts` - Network diagnostics
- `lib/util.ts` - Utility functions

## Extension System

### Architecture

Extensions run in separate child processes for isolation and fault tolerance.

```
Main Process                    Extension Process
(genieacs-cwmp)                 (genieacs-ext)
      |                               |
      |--spawn(scriptName)----------->|
      |                               |--require(script)
      |--IPC: [id, args]------------->|
      |                               |--script.func(args, callback)
      |<--IPC: [id, fault, result]----|
      |                               |
```

### Extension Runner (`lib/extensions.ts`)

```typescript
// Run extension function
export function run(args: string[]): Promise<{ fault: Fault; value: any }>

// Graceful shutdown all extensions
export async function killAll(): Promise<void>
```

**Configuration**:
| Option | Default | Description |
|--------|---------|-------------|
| `EXT_TIMEOUT` | 3000ms | Extension execution timeout |
| `GENIEACS_EXT_DIR` | - | Directory containing extension scripts |

**Process Management**:
- One process per extension script (pooled)
- Automatic restart on crash
- Graceful kill with 5-second SIGKILL fallback
- stdout/stderr captured to logger

### Extension Script Format

```javascript
// extensions/my-extension.js
exports.authenticate = function(args, callback) {
  const [username, password] = args;

  // Perform authentication logic
  if (valid) {
    callback(null, { authenticated: true, roles: ['admin'] });
  } else {
    callback(new Error('Invalid credentials'));
  }
};

exports.lookupDevice = function(args, callback) {
  const [serialNumber] = args;
  // ... async operations
  callback(null, deviceInfo);
};
```

### Calling Extensions from Provisions

```javascript
// In provision script
const result = ext('my-extension', 'authenticate', username, password);
if (result.authenticated) {
  declare('Tags.authenticated', {value: Date.now()}, {value: true});
}
```

### Fault Handling

Extension errors generate faults with code `ext.<ErrorName>`:
- `ext.timeout` - Execution timeout
- `ext.Error` - Generic error
- `ext.TypeError` - Type error in script
- Stack traces trimmed at extension boundary

## Connection Request Mechanisms

### HTTP Connection Request

Standard TR-069 connection request over HTTP.

```typescript
export async function httpConnectionRequest(
  address: string,         // URL (http://device:port/path)
  authExp: Expression,     // Authentication expression
  allowBasicAuth: boolean, // Allow Basic auth (insecure)
  timeout: number,         // Request timeout
  _debug: boolean,         // Enable debug logging
  deviceId: string,        // Device ID for logging
): Promise<string>         // Empty string on success, error message on failure
```

**Authentication Flow**:
1. Initial request without credentials
2. On 401, parse `WWW-Authenticate` header
3. Evaluate auth expression to get username/password
4. Retry with Digest (preferred) or Basic (if allowed)

**Status Codes**:
| Code | Meaning |
|------|---------|
| 200/204 | Success |
| 401 | Authentication required |
| 503 | Device offline (proxy response) |
| Other | Error |

### UDP Connection Request

For NAT traversal using STUN-discovered address.

```typescript
export async function udpConnectionRequest(
  host: string,            // Device IP address
  port: number,            // Device port
  authExp: Expression,     // Authentication expression
  sourcePort: number,      // Source port (for NAT traversal)
  _debug: boolean,         // Enable debug logging
  deviceId: string,        // Device ID for logging
): Promise<void>
```

**Message Format**:
```
GET http://host:port?ts=<timestamp>&id=<id>&un=<username>&cn=<cnonce>&sig=<hmac> HTTP/1.1
Host: host:port
```

**Signature**: HMAC-SHA1 of `ts|id|username|cnonce` with password as key

**Reliability**: Sent 3 times (UDP is unreliable)

### XMPP Connection Request

For devices using XMPP push notifications.

```typescript
export async function xmppConnectionRequest(
  jid: string,             // Device JID
  authExp: Expression,     // Authentication expression
  timeout: number,         // Request timeout
  _debug: boolean,         // Enable debug logging
  deviceId: string,        // Device ID for logging
): Promise<string>         // Empty string on success, error message on failure
```

**Configuration**:
| Option | Description |
|--------|-------------|
| `XMPP_JID` | ACS XMPP JID (user@host) |
| `XMPP_PASSWORD` | ACS XMPP password |

**Message Format** (TR-069 Annex K):
```xml
<connectionRequest xmlns="urn:broadband-forum-org:cwmp:xmppConnReq-1-0">
  <username>device_user</username>
  <password>device_pass</password>
</connectionRequest>
```

## XMPP Client

### Connection Flow

```
1. TCP Connect (port 5222)
2. Stream negotiation
3. Feature discovery
4. STARTTLS upgrade (if required)
5. SASL authentication (SCRAM-SHA-1 or PLAIN)
6. Resource binding
7. Ready for IQ stanzas
```

### Supported Authentication

| Method | Priority | Description |
|--------|----------|-------------|
| SCRAM-SHA-1 | 1 | Challenge-response with salted password |
| PLAIN | 2 | Base64 encoded credentials (requires TLS) |

### Client API

```typescript
class XmppClient extends EventEmitter {
  static async connect(opts: XmppClientOptions): Promise<XmppClient>

  send(msg: string): void
  sendIqStanza(from, to, type, body, timeout): Promise<{rawReq, rawRes, res}>
  close(): void
  ref(): void    // Keep process alive
  unref(): void  // Allow process exit

  // Events: 'stanza', 'error', 'close'
}
```

## Distributed Caching

### Cache API (`lib/cache.ts`)

```typescript
// Get cached value
export async function get(key: string): Promise<string>

// Set cached value with TTL
export async function set(key: string, value: string, ttl?: number): Promise<void>

// Delete cached value
export async function del(key: string): Promise<void>

// Atomic get and delete
export async function pop(key: string): Promise<string>
```

**Configuration**:
| Option | Default | Description |
|--------|---------|-------------|
| `MAX_CACHE_TTL` | 86400s | Maximum cache TTL |

**Storage**: MongoDB `cache` collection with TTL index

### Cache Document Schema

```typescript
{
  _id: string,       // Cache key
  value: string,     // Cached value (JSON serialized)
  timestamp: Date,   // Creation time
  expire: Date       // Expiration (TTL index)
}
```

## Distributed Locking

### Lock API (`lib/lock.ts`)

```typescript
// Acquire lock with timeout and retry
export async function acquireLock(
  lockName: string,     // Lock identifier
  ttl: number,          // Time-to-live in ms
  timeout?: number,     // Max wait time (0 = no wait)
  token?: string,       // Lock token (for renewal)
): Promise<string>      // Token on success, null on failure

// Release lock
export async function releaseLock(
  lockName: string,
  token: string,
): Promise<void>

// Get current lock token
export async function getToken(lockName: string): Promise<string>
```

### Lock Acquisition Algorithm

1. Attempt upsert with random token
2. On duplicate key error (already locked):
   - If timeout > 0: Wait 50-100ms (jitter), retry
   - If timeout = 0: Return null immediately
3. Validate database clock skew (30-second tolerance)
4. Return token on success

### Lock Usage Patterns

**CWMP Session Lock**:
```typescript
const lockName = `cwmp_session_${deviceId}`;
const token = await acquireLock(lockName, ttl, 0);
if (!token) {
  // Device already in session
  return res.status(400).send('CPE already in session');
}
try {
  // Process session
} finally {
  await releaseLock(lockName, token);
}
```

**Lock Refresh** (for long sessions):
```typescript
// Refresh every 10 seconds
setInterval(async () => {
  await acquireLock(lockName, ttl, 0, existingToken);
}, 10000);
```

## XML Parser

### Custom XML Parser (`lib/xml-parser.ts`)

Lightweight XML parser optimized for SOAP message processing.

### Element Interface

```typescript
interface Element {
  name: string;       // Full tag name (namespace:localName)
  namespace: string;  // Namespace prefix
  localName: string;  // Local tag name
  attrs: string;      // Raw attribute string
  text: string;       // Text content (leaf nodes only)
  bodyIndex: number;  // Character index in source
  children: Element[];
}
```

### API Functions

```typescript
// Parse XML document
export function parseXml(string: string): Element

// Parse XML declaration (encoding detection)
export function parseXmlDeclaration(buffer: Buffer): Attribute[]

// Parse attribute string
export function parseAttrs(string: string): Attribute[]

// Entity encoding/decoding
export function encodeEntities(string: string): string
export function decodeEntities(string: string): string
```

### Supported Entities

| Entity | Character |
|--------|-----------|
| `&quot;` | `"` |
| `&amp;` | `&` |
| `&apos;` | `'` |
| `&lt;` | `<` |
| `&gt;` | `>` |
| `&#xHH;` | Hex code |
| `&#DDD;` | Decimal code |

### Parser Characteristics

- Single-pass state machine
- No CDATA support (throws error)
- Comment nodes ignored
- XML declarations ignored
- Namespace-aware (extracts prefix)

## Ping Diagnostics

### Ping API (`lib/ping.ts`)

```typescript
interface PingResult {
  packetsTransmitted: number;
  packetsReceived: number;
  packetLoss: number;    // Percentage
  min: number;           // ms (null if no response)
  avg: number;           // ms
  max: number;           // ms
  mdev: number;          // ms (standard deviation)
}

export function ping(
  host: string,
  callback: (err: Error, res?: PingResult, stdout?: string) => void,
): void
```

**Supported Platforms**:
| Platform | Command |
|----------|---------|
| Linux | `ping -w 1 -i 0.2 -c 3 <host>` |
| FreeBSD | `ping -t 1 -c 3 <host>` |

**Security**: Input validation prevents command injection (RCE).

## Utility Functions

### Device ID Generation (`lib/util.ts`)

```typescript
// Generate TR-069 compliant device ID
export function generateDeviceId(deviceIdStruct: Record<string, string>): string
```

**Format**:
- With ProductClass: `{OUI}-{ProductClass}-{SerialNumber}`
- Without ProductClass: `{OUI}-{SerialNumber}`
- Special characters URL-encoded

### Tag Encoding

```typescript
// Encode tag for use in parameter paths
export function encodeTag(tag: string): string

// Decode tag from parameter path
export function decodeTag(tag: string): string
```

Uses `0x` prefix instead of `%` for URL encoding (MongoDB field name safe).

### Event Utilities

```typescript
// Wait for event with timeout
export function once(
  emitter: EventEmitter,
  event: string,
  timeout: number,
): Promise<unknown[]>

// Promise-based setTimeout
export function setTimeoutPromise(delay: number, ref?: boolean): Promise<void>
```

### Regex Escaping

```typescript
// Escape special regex characters
export function escapeRegExp(str: string): string
```

## Debug Logging

### Debug API (`lib/debug.ts`)

```typescript
// HTTP request/response logging
export function outgoingHttpRequest(req, deviceId, method, url, body): void
export function incomingHttpResponse(res, deviceId, body): void
export function outgoingHttpRequestError(req, deviceId, method, url, err): void

// UDP message logging
export function outgoingUdpMessage(host, deviceId, port, msg): void

// XMPP stanza logging
export function outgoingXmppStanza(deviceId, stanza): void
export function incomingXmppStanza(deviceId, stanza): void
```

Controlled by `_debug` parameter in connection request functions.

## Configuration Reference

### Runtime Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `EXT_TIMEOUT` | 3000 | Extension timeout (ms) |
| `MAX_CACHE_TTL` | 86400 | Maximum cache TTL (s) |
| `XMPP_JID` | - | ACS XMPP identifier |
| `XMPP_PASSWORD` | - | ACS XMPP password |
| `CONNECTION_REQUEST_TIMEOUT` | 2000 | HTTP CR timeout (ms) |
| `CONNECTION_REQUEST_ALLOW_BASIC_AUTH` | false | Allow Basic auth |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GENIEACS_EXT_DIR` | Extension scripts directory |
