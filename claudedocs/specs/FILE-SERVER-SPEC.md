# GenieACS File Server Specification

## Overview

The File Server (genieacs-fs) is a dedicated HTTP service for serving firmware images and configuration files to CPE devices during TR-069 Download RPC operations.

**Primary Files**:
- `bin/genieacs-fs.ts` - Service entry point
- `lib/fs.ts` - File serving logic

## Service Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `FS_PORT` | int | 7567 | TCP listening port |
| `FS_INTERFACE` | string | "::" | Network interface |
| `FS_WORKER_PROCESSES` | int | 0 | Worker count |
| `FS_SSL_CERT` | string | "" | SSL certificate |
| `FS_SSL_KEY` | string | "" | SSL private key |
| `FS_URL_PREFIX` | string | auto | URL prefix for downloads |
| `FS_LOG_FILE` | path | "" | Process log file |
| `FS_ACCESS_LOG_FILE` | path | "" | Access log file |

## Storage

### GridFS Architecture

Files stored in MongoDB GridFS:
- Chunked storage (255KB default chunks)
- Atomic operations
- Replication support
- Metadata attachment

### Collections

| Collection | Purpose |
|------------|---------|
| `fs.files` | File metadata |
| `fs.chunks` | Binary file chunks |

### File Schema

```typescript
interface File {
  _id: string;           // Filename as primary key
  length: number;        // File size in bytes
  filename: string;      // Original filename
  uploadDate: Date;      // Upload timestamp
  metadata?: {
    fileType?: string;   // TR-069 file type
    oui?: string;        // Manufacturer OUI filter
    productClass?: string;
    version?: string;
  };
}
```

## HTTP API

### Endpoints

```
GET /<filename>   - Download file
HEAD /<filename>  - Get file metadata
```

### Response Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/octet-stream` |
| `Content-Length` | File size or range size |
| `Accept-Ranges` | `bytes` |
| `ETag` | MD5 hash for caching |
| `Last-Modified` | Upload timestamp (UTC) |
| `Content-Range` | For partial content |

### Status Codes

| Code | Condition |
|------|-----------|
| 200 | Full content delivery |
| 206 | Partial content (range) |
| 304 | Not Modified |
| 404 | File not found |
| 405 | Method not allowed |
| 412 | Precondition failed |
| 416 | Range not satisfiable |

## ETag Generation

```typescript
function generateETag(file): string {
  const hash = createHash("md5");
  hash.update(`${file._id}-${file.uploadDate.getTime()}-${file.length}`);
  return hash.digest("hex");
}
```

## Conditional Requests

### Supported Headers

| Header | Behavior |
|--------|----------|
| `If-Match` | 412 if ETag doesn't match |
| `If-None-Match` | 304 if ETag matches |
| `If-Modified-Since` | 304 if not modified |
| `If-Unmodified-Since` | 412 if modified |
| `If-Range` | Validates range precondition |

## Range Requests

### Supported Formats

```
Range: bytes=0-1023      # First 1024 bytes
Range: bytes=1024-       # From byte 1024 to end
Range: bytes=-1024       # Last 1024 bytes
```

### Partial Content Response

```
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/4096
Content-Length: 1024
```

### Implementation

```typescript
async function* partialContent(
  chunks: Iterable<Buffer>,
  start: number,
  end: number
): AsyncIterable<Buffer> {
  // Efficiently yields only requested byte range
}
```

## Caching

### In-Memory Cache

```typescript
const getFile = memoize(
  async (etag, size, filename): Promise<Iterable<Buffer>> => {
    // Entire file content cached
  }
);
```

### Memoization Strategy

- Two-generation cache
- 120-second rotation
- LRU-like behavior
- Rejected promises evicted

### Size Validation

Validates cached file size matches expected size.

## CWMP Integration

### Download URL Generation

When CWMP sends Download RPC:

1. Check `FS_URL_PREFIX` configuration
2. If not set, auto-generate:
   - Use request origin hostname
   - Apply `FS_PORT`
   - Determine SSL from `FS_SSL_CERT`
3. Append encoded filename
4. Lookup file size from cache

### Generated URL Format

```
http://<hostname>:7567/<filename>
https://<hostname>:7567/<filename>
```

### Download RPC Structure

```xml
<cwmp:Download>
  <CommandKey>key123</CommandKey>
  <FileType>1 Firmware Upgrade Image</FileType>
  <URL>http://acs.example.com:7567/firmware.bin</URL>
  <Username></Username>
  <Password></Password>
  <FileSize>4096000</FileSize>
  <TargetFileName>firmware.img</TargetFileName>
  <DelaySeconds>0</DelaySeconds>
  <SuccessURL></SuccessURL>
  <FailureURL></FailureURL>
</cwmp:Download>
```

## File Upload (via NBI)

### Endpoint

```
PUT /files/<filename>
```

### Headers

| Header | Description |
|--------|-------------|
| `FileType` | TR-069 file type |
| `OUI` | Manufacturer OUI filter |
| `ProductClass` | Product class filter |
| `Version` | Version string |

### Behavior

1. Delete existing file if present
2. Upload new file to GridFS
3. Attach metadata
4. Return `201 Created`

### Example

```bash
curl -X PUT \
  -H "FileType: 1 Firmware Upgrade Image" \
  -H "OUI: 000000" \
  -H "Version: 2.0.0" \
  --data-binary @firmware.bin \
  http://localhost:7557/files/firmware.bin
```

## Provisioning Integration

### Download Provision

```javascript
download("1 Firmware Upgrade Image", "firmware.bin", "target.img")
```

### Virtual Downloads Data Model

| Parameter | Type | Description |
|-----------|------|-------------|
| FileType | string | TR-069 file type |
| FileName | string | File in storage |
| TargetFileName | string | Target on device |
| Download | dateTime | Trigger timestamp |
| LastFileType | string | Last downloaded type |
| LastFileName | string | Last downloaded file |
| StartTime | dateTime | Download start |
| CompleteTime | dateTime | Download complete |

## Security

### Authentication

**WARNING**: No built-in authentication. Files served to any client.

### Recommendations

- Use firewall rules
- Deploy behind reverse proxy
- Enable SSL/TLS
- Network segmentation

### SSL Configuration

```bash
FS_SSL_CERT=/path/to/cert.pem
FS_SSL_KEY=/path/to/key.pem
```

## Logging

### Access Log

```javascript
{
  message: "Fetch file",
  filename: "firmware.bin",
  remoteAddress: "192.168.1.100",
  method: "GET"
}
```

### Error Log

```javascript
{
  message: "Fetch file not found",
  filename: "missing.bin",
  remoteAddress: "192.168.1.100",
  method: "GET"
}
```

## Process Management

### Cluster Architecture

- Worker processes based on CPU cores
- 2-second respawn delay
- Crash rate limiting
- Graceful shutdown (5 seconds)

### Timeouts

| Timeout | Value | Purpose |
|---------|-------|---------|
| Request | 30s | Socket timeout |
| Shutdown | 5s | Graceful drain |

## Performance

### Memory Usage

- Entire file cached per worker
- Multiple workers = multiple cache copies
- Cache eviction every 120 seconds

### Scalability

- Horizontal scaling via workers
- Stateless design
- GridFS supports sharding

## Integration Flow

```
1. Admin uploads file (NBI/UI)
   └── PUT /files/<name>

2. Provision triggers download
   └── download("FileType", "filename")

3. CWMP generates Download RPC
   └── URL: http://<host>:7567/<filename>

4. CPE requests file (FS)
   └── GET /<filename>

5. FS serves from GridFS
   └── Supports range requests

6. CPE reports TransferComplete
   └── Updates Downloads.*.CompleteTime
```
