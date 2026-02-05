# GenieACS Extension System

## Overview

The extension system allows GenieACS to call external scripts during provisioning, enabling integration with external systems like databases, APIs, and business logic services.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTENSION SYSTEM                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐     ┌────────────────┐     ┌────────────────┐          │
│  │   Provision    │     │   Extension    │     │   External     │          │
│  │   Script       │────▶│   Worker       │────▶│   Script       │          │
│  │   (sandbox)    │     │   (Node.js)    │     │   (any lang)   │          │
│  └────────────────┘     └────────────────┘     └────────────────┘          │
│         │                      │                      │                     │
│         │ ext("name",args)     │ IPC/HTTP            │ Business            │
│         │                      │                      │ Logic               │
│         │◀─────────────────────│◀─────────────────────│                     │
│         │ Return result        │ Collect output       │ Return              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Extension Types

### 1. Script Extensions (Default)

External scripts executed via child process.

**Location**: `config/ext/` directory

**Supported Languages**:
- JavaScript/Node.js
- Python
- Shell scripts
- Any executable

```
config/
└── ext/
    ├── lookup-customer.js    # Node.js script
    ├── validate-device.py    # Python script
    └── update-inventory.sh   # Shell script
```

### 2. HTTP Extensions

External HTTP endpoints for distributed processing.

**Configuration**:
```javascript
// In GenieACS config
{
  "EXT_HTTP_ENDPOINT": "http://extension-service:3000/ext"
}
```

## Extension Execution Flow

### Script Extension Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  SCRIPT EXTENSION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Provision Script:                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ const result = ext("lookup-customer", deviceId, "premium"); ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  Extension Worker (lib/extension.ts):                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 1. Resolve script path: config/ext/lookup-customer.js       ││
│  │ 2. Spawn child process                                      ││
│  │ 3. Pass arguments via stdin: JSON.stringify([deviceId,...]) ││
│  │ 4. Wait for stdout response                                 ││
│  │ 5. Parse JSON result                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  External Script (config/ext/lookup-customer.js):                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ const args = JSON.parse(require('fs').readFileSync(0));     ││
│  │ const [deviceId, tier] = args;                              ││
│  │ // Business logic...                                        ││
│  │ console.log(JSON.stringify(result));                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### HTTP Extension Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   HTTP EXTENSION FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Provision Script:                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ const result = ext("api-call", endpoint, payload);          ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  Extension Worker:                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ POST http://extension-service:3000/ext/api-call             ││
│  │ Content-Type: application/json                              ││
│  │ { "args": [endpoint, payload] }                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                          │                                       │
│                          ▼                                       │
│  External Service Response:                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 200 OK                                                      ││
│  │ { "result": { /* data */ } }                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Writing Extensions

### Node.js Extension Template

```javascript
#!/usr/bin/env node
// config/ext/my-extension.js

const fs = require('fs');

// Read arguments from stdin
let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', async () => {
  try {
    const args = JSON.parse(input);
    const result = await processRequest(args);
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
});

async function processRequest(args) {
  const [deviceId, operation] = args;

  // Your business logic here
  switch (operation) {
    case 'lookup':
      return await lookupDevice(deviceId);
    case 'validate':
      return await validateDevice(deviceId);
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

async function lookupDevice(deviceId) {
  // Example: Database lookup
  return {
    customerId: 'CUST001',
    plan: 'premium',
    config: {
      ssid: 'CustomerNetwork',
      bandwidth: 100
    }
  };
}

async function validateDevice(deviceId) {
  // Example: Validation logic
  return { valid: true, reason: null };
}
```

### Python Extension Template

```python
#!/usr/bin/env python3
# config/ext/my-extension.py

import sys
import json

def main():
    try:
        # Read arguments from stdin
        input_data = sys.stdin.read()
        args = json.loads(input_data)

        # Process request
        result = process_request(args)

        # Output result
        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

def process_request(args):
    device_id, operation = args[0], args[1]

    if operation == 'lookup':
        return lookup_device(device_id)
    elif operation == 'validate':
        return validate_device(device_id)
    else:
        raise ValueError(f'Unknown operation: {operation}')

def lookup_device(device_id):
    # Example: Database lookup
    return {
        'customerId': 'CUST001',
        'plan': 'premium',
        'config': {
            'ssid': 'CustomerNetwork',
            'bandwidth': 100
        }
    }

def validate_device(device_id):
    # Example: Validation logic
    return {'valid': True, 'reason': None}

if __name__ == '__main__':
    main()
```

### Shell Extension Template

```bash
#!/bin/bash
# config/ext/my-extension.sh

# Read JSON arguments from stdin
INPUT=$(cat)

# Parse arguments using jq
DEVICE_ID=$(echo "$INPUT" | jq -r '.[0]')
OPERATION=$(echo "$INPUT" | jq -r '.[1]')

case "$OPERATION" in
  "lookup")
    # Example: Call external API
    RESULT=$(curl -s "http://api.example.com/devices/$DEVICE_ID")
    echo "$RESULT"
    ;;
  "validate")
    # Example: Check device existence
    if [ -f "/var/lib/devices/$DEVICE_ID" ]; then
      echo '{"valid": true}'
    else
      echo '{"valid": false, "reason": "Device not found"}'
    fi
    ;;
  *)
    echo '{"error": "Unknown operation"}' >&2
    exit 1
    ;;
esac
```

## Using Extensions in Provisions

### Basic Usage

```javascript
// Provision: configure-device

// Call extension with arguments
const customerInfo = ext("lookup-customer", deviceId);

// Use returned data to configure device
if (customerInfo.plan === "premium") {
  declare("Device.WiFi.Radio.1.MaxBitRate", null, {value: 1000});
} else {
  declare("Device.WiFi.Radio.1.MaxBitRate", null, {value: 100});
}

// Configure SSID from customer data
declare("Device.WiFi.SSID.1.SSID", null, {value: customerInfo.config.ssid});
```

### Error Handling

```javascript
// Provision: safe-configure

try {
  const config = ext("fetch-config", deviceId);

  if (config.error) {
    log(`Configuration error: ${config.error}`);
    declare("Tags.config_error", null, {value: true});
    return;
  }

  // Apply configuration
  declare("Device.WiFi.SSID.1.SSID", null, {value: config.ssid});
  declare("Tags.configured", null, {value: true});

} catch (err) {
  log(`Extension failed: ${err.message}`);
  declare("Tags.extension_error", null, {value: true});
}
```

### Caching Extension Results

```javascript
// Provision: cached-config

// Check if we already have cached config
const cachedConfig = declare("Tags.customer_config", {value: 1});

let config;
if (cachedConfig.value && cachedConfig.value[0]) {
  // Use cached config
  config = JSON.parse(cachedConfig.value[0][0]);
} else {
  // Fetch from extension and cache
  config = ext("lookup-customer", deviceId);
  declare("Tags.customer_config", null, {value: JSON.stringify(config)});
}

// Use config
declare("Device.WiFi.SSID.1.SSID", null, {value: config.ssid});
```

## Extension Configuration

### Environment Variables

```bash
# Extension timeout (milliseconds)
GENIEACS_EXT_TIMEOUT=30000

# Extension script directory
GENIEACS_EXT_DIR=/opt/genieacs/config/ext

# HTTP extension endpoint (optional)
GENIEACS_EXT_HTTP_ENDPOINT=http://localhost:3001/ext

# Maximum concurrent extension calls
GENIEACS_EXT_MAX_CONCURRENT=10
```

### Config Collection Settings

```javascript
// MongoDB config collection
{
  "_id": "cwmp.extensionTimeout",
  "value": 30000
}

{
  "_id": "cwmp.extensionDir",
  "value": "/opt/genieacs/config/ext"
}
```

## Common Extension Patterns

### 1. Customer Database Lookup

```javascript
// config/ext/customer-lookup.js

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'genieacs',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'provisioning'
});

async function processRequest(args) {
  const [serialNumber] = args;

  const [rows] = await pool.execute(
    `SELECT c.*, p.*
     FROM customers c
     JOIN provisioning_profiles p ON c.profile_id = p.id
     WHERE c.device_serial = ?`,
    [serialNumber]
  );

  if (rows.length === 0) {
    return { found: false };
  }

  const customer = rows[0];
  return {
    found: true,
    customerId: customer.id,
    name: customer.name,
    plan: customer.plan_name,
    config: {
      ssid: customer.wifi_ssid || `${customer.name}-WiFi`,
      password: customer.wifi_password,
      bandwidth: customer.bandwidth_limit,
      voipEnabled: customer.voip_enabled === 1
    }
  };
}
```

### 2. Inventory Management

```javascript
// config/ext/update-inventory.js

const axios = require('axios');

async function processRequest(args) {
  const [deviceId, event, data] = args;

  try {
    const response = await axios.post(
      `${process.env.INVENTORY_API}/devices/${deviceId}/events`,
      {
        event: event,
        timestamp: new Date().toISOString(),
        data: data
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.INVENTORY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return { success: true, inventoryId: response.data.id };

  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}
```

### 3. Firmware Selection

```javascript
// config/ext/select-firmware.js

const semver = require('semver');

const firmwareMatrix = {
  'Acme-Router-100': {
    stable: '3.2.1',
    beta: '3.3.0-beta.1',
    urls: {
      '3.2.1': 'http://firmware.example.com/acme/router100/3.2.1.bin',
      '3.3.0-beta.1': 'http://firmware.example.com/acme/router100/3.3.0-beta.1.bin'
    }
  },
  // ... more models
};

async function processRequest(args) {
  const [model, currentVersion, channel = 'stable'] = args;

  const modelFirmware = firmwareMatrix[model];
  if (!modelFirmware) {
    return { upgrade: false, reason: 'Unknown model' };
  }

  const targetVersion = modelFirmware[channel] || modelFirmware.stable;

  if (semver.gte(currentVersion, targetVersion)) {
    return { upgrade: false, reason: 'Already up to date' };
  }

  return {
    upgrade: true,
    targetVersion: targetVersion,
    downloadUrl: modelFirmware.urls[targetVersion],
    fileType: '1 Firmware Upgrade Image'
  };
}
```

### 4. RADIUS/AAA Integration

```javascript
// config/ext/radius-auth.js

const radius = require('radius');
const dgram = require('dgram');

async function processRequest(args) {
  const [username, password] = args;

  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4');

    const packet = radius.encode({
      code: 'Access-Request',
      secret: process.env.RADIUS_SECRET,
      attributes: [
        ['User-Name', username],
        ['User-Password', password],
        ['NAS-IP-Address', process.env.NAS_IP || '127.0.0.1']
      ]
    });

    client.send(packet, 0, packet.length, 1812, process.env.RADIUS_HOST);

    client.on('message', (msg) => {
      const response = radius.decode({
        packet: msg,
        secret: process.env.RADIUS_SECRET
      });

      client.close();

      if (response.code === 'Access-Accept') {
        resolve({
          authenticated: true,
          attributes: response.attributes
        });
      } else {
        resolve({
          authenticated: false,
          code: response.code
        });
      }
    });

    setTimeout(() => {
      client.close();
      resolve({ authenticated: false, error: 'Timeout' });
    }, 5000);
  });
}
```

## Security Considerations

### Script Security

```
┌─────────────────────────────────────────────────────────────────┐
│                  SECURITY BEST PRACTICES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Input Validation                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ // Always validate input from provisions                    ││
│  │ const deviceId = args[0];                                   ││
│  │ if (!deviceId || !/^[A-Za-z0-9-]+$/.test(deviceId)) {       ││
│  │   throw new Error('Invalid device ID');                     ││
│  │ }                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  2. File Permissions                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ chmod 750 config/ext/*                                      ││
│  │ chown genieacs:genieacs config/ext/*                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  3. Environment Variables                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ // Never hardcode credentials                               ││
│  │ const apiKey = process.env.API_KEY;                         ││
│  │ const dbPassword = process.env.DB_PASSWORD;                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  4. Network Isolation                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ // Use internal network for extension services              ││
│  │ // Firewall rules to limit external access                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Timeout Handling

```javascript
// Extension with proper timeout handling

const TIMEOUT = parseInt(process.env.EXT_TIMEOUT) || 10000;

async function processRequest(args) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), TIMEOUT);
  });

  const operationPromise = performOperation(args);

  return Promise.race([operationPromise, timeoutPromise]);
}
```

## Debugging Extensions

### Logging

```javascript
// Enable debug logging in extensions

const debug = process.env.DEBUG === 'true';

function log(...args) {
  if (debug) {
    console.error('[EXT]', new Date().toISOString(), ...args);
  }
}

async function processRequest(args) {
  log('Received args:', args);

  const result = await doWork(args);

  log('Returning result:', result);
  return result;
}
```

### Testing Extensions Standalone

```bash
# Test extension directly
echo '["DEVICE123", "lookup"]' | node config/ext/my-extension.js

# Test with Python
echo '["DEVICE123", "lookup"]' | python3 config/ext/my-extension.py

# View extension logs
tail -f /var/log/genieacs/extension.log
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Extension timeout | Slow external service | Increase timeout, add caching |
| Invalid JSON output | Script prints extra text | Ensure only JSON on stdout |
| Permission denied | Wrong file permissions | `chmod +x` on script |
| Module not found | Missing dependencies | Install in extension directory |
| Connection refused | Service not running | Check service status |

## Performance Optimization

### Connection Pooling

```javascript
// Reuse database connections across calls
const pool = mysql.createPool({
  connectionLimit: 10,
  // ...
});

// Don't create new connections per request
// Use the pool instead
```

### Response Caching

```javascript
// Cache frequently requested data
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

async function processRequest(args) {
  const [deviceId] = args;
  const cacheKey = `device:${deviceId}`;

  let result = cache.get(cacheKey);
  if (result) {
    return result;
  }

  result = await fetchFromDatabase(deviceId);
  cache.set(cacheKey, result);
  return result;
}
```

### Batch Operations

```javascript
// In provision: batch multiple ext() calls
const devices = ["DEV1", "DEV2", "DEV3"];
const results = ext("batch-lookup", devices);

// In extension: process batch efficiently
async function processRequest(args) {
  const [deviceIds] = args;

  // Single query for all devices
  const placeholders = deviceIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT * FROM devices WHERE serial IN (${placeholders})`,
    deviceIds
  );

  // Return as map
  return Object.fromEntries(
    rows.map(row => [row.serial, row])
  );
}
```
