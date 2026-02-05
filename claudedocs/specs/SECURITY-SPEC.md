# GenieACS Security Specification

## Overview

This document details the authentication mechanisms, authorization models, and security concerns across all GenieACS services.

**Primary Files**:
- `lib/auth.ts` - Password hashing, Digest auth
- `lib/ui.ts` - JWT authentication
- `lib/ui/api.ts` - API authorization
- `lib/common/authorizer.ts` - RBAC implementation
- `lib/cwmp.ts` - CWMP authentication
- `lib/connection-request.ts` - Connection request auth

## Critical Vulnerabilities

| Severity | Issue | Location |
|----------|-------|----------|
| **CRITICAL** | NBI has NO authentication | `lib/nbi.ts` |
| **CRITICAL** | FS has NO authentication | `lib/fs.ts` |
| **HIGH** | CWMP auth disabled by default | `lib/cwmp.ts:83` |
| **HIGH** | JWT tokens never expire | `lib/ui.ts:119` |
| **HIGH** | Empty JWT secret allowed | `lib/ui.ts:24` |
| **MEDIUM** | No rate limiting on login | `lib/api-functions.ts` |
| **MEDIUM** | Missing security headers | All services |
| **MEDIUM** | No session timeout | `lib/ui.ts` |
| **MEDIUM** | Missing httpOnly cookie flag | `lib/ui.ts:119` |

## Authentication Mechanisms

### UI Authentication (JWT)

**Location**: `lib/ui.ts:24-145`

**Token Generation**:
```typescript
const token = jwt.sign({ username, authMethod }, JWT_SECRET);
ctx.cookies.set(JWT_COOKIE, token, { sameSite: "lax" });
```

**Vulnerabilities**:
1. No JWT expiration (`exp` claim)
2. No `httpOnly` flag - vulnerable to XSS theft
3. No `secure` flag for HTTPS
4. Empty JWT_SECRET defaults to empty string

**Token Validation**:
```typescript
koaJwt({
  secret: JWT_SECRET,
  passthrough: true,
  cookie: JWT_COOKIE,
  isRevoked: async (ctx, token) => {
    return !users[token["username"]];
  }
});
```

### Password Hashing

**Location**: `lib/auth.ts:162-178`

**Algorithm**: PBKDF2 with SHA-512
- 10,000 iterations
- 64-byte random salt
- 128-byte derived key

**Concern**: 10,000 iterations is below modern recommendations (100,000+).

### CWMP Authentication

**Location**: `lib/cwmp.ts:75-162`

**Default**: Authentication DISABLED

```typescript
const authExpression = localCache.getConfigExpression("cwmp.auth");
if (authExpression == null) return true;  // NO AUTH
```

**Supported Methods**:
- HTTP Digest (MD5-based)
- Configurable via `cwmp.auth` expression

**Configuration Example**:
```javascript
// In MongoDB config collection
{
  "_id": "cwmp.auth",
  "value": "\"FUNC('AUTH', Username, Password)\""
}
```

### Connection Request Authentication

**Location**: `lib/connection-request.ts:75-304`

**Methods**:
| Method | Authentication |
|--------|---------------|
| HTTP | Digest auth (Basic disabled by default) |
| UDP | HMAC-SHA1 signature |
| XMPP | Jabber credentials |

**Basic Auth**: Disabled by default for security.

### NBI Authentication

**Location**: `lib/nbi.ts`

**CRITICAL**: NO AUTHENTICATION IMPLEMENTED

Any client can:
- Query all devices
- Create/modify/delete configurations
- Upload/delete files
- Execute tasks on devices
- Delete devices

### FS Authentication

**Location**: `lib/fs.ts`

**CRITICAL**: NO AUTHENTICATION IMPLEMENTED

Files served to any client that knows the filename.

## Authorization (RBAC)

### Permission Model

**Location**: `lib/common/authorizer.ts`

**Access Levels**:
| Level | Description |
|-------|-------------|
| 1 | Count |
| 2 | Read |
| 3 | Write |

**Permission Structure**:
```typescript
interface Permissions {
  [role: string]: {
    [access: number]: {
      [resource: string]: {
        access: number;
        filter: Expression;      // Row-level filter
        validate?: Expression;   // Mutation validation
      };
    };
  };
}
```

### Authorizer API

```typescript
class Authorizer {
  hasAccess(resourceType: string, access: number): boolean;
  getFilter(resourceType: string, access: number): Expression;
  getValidator(resourceType: string, resource: unknown): ValidatorFn;
}
```

### Filter-Based Access Control

Expressions restrict which records a user can access:
```javascript
{
  "role": "operator",
  "resource": "devices",
  "access": 2,
  "filter": "Tags.region = 'west'"
}
```

### Validation Expressions

Validates mutations:
- Delete operations
- Put operations
- Task creation
- Tag updates
- Password changes

## Session Management

### UI Sessions

**Vulnerabilities**:
1. JWT remains valid after logout (no server-side invalidation)
2. No session timeout
3. No forced logout capability

**Logout**:
```typescript
router.post("/logout", (ctx) => {
  ctx.cookies.set(JWT_COOKIE);  // Delete cookie only
});
```

### CWMP Sessions

**Location**: `lib/cwmp.ts:61-66`

**Limits**:
| Limit | Value |
|-------|-------|
| Max duration | 5 minutes |
| Lock refresh | 10 seconds |
| Request timeout | 10 seconds |

**Session Locking**:
- Redis-based distributed locking
- Prevents concurrent sessions per device
- Lock: `cwmp_session_{deviceId}`

## SSL/TLS Configuration

### Service Configuration

| Service | Cert Option | Key Option |
|---------|-------------|------------|
| CWMP | `CWMP_SSL_CERT` | `CWMP_SSL_KEY` |
| NBI | `NBI_SSL_CERT` | `NBI_SSL_KEY` |
| FS | `FS_SSL_CERT` | `FS_SSL_KEY` |
| UI | `UI_SSL_CERT` | `UI_SSL_KEY` |

### Vulnerabilities

1. No TLS version configuration
2. No cipher suite restrictions
3. No HSTS header
4. SSL is optional, not enforced

## Security Headers

### Missing Headers

All services lack:
- `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`
- `X-Content-Type-Options`
- `X-XSS-Protection`
- `Strict-Transport-Security`
- `Content-Security-Policy`
- `Referrer-Policy`

### Recommendation

```javascript
app.use((ctx, next) => {
  ctx.set('X-Frame-Options', 'DENY');
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('X-XSS-Protection', '1; mode=block');
  ctx.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  ctx.set('Content-Security-Policy', "default-src 'self'");
  return next();
});
```

## Proxy Header Handling

**Location**: `lib/forwarded.ts`

### Configuration

```
FORWARDED_HEADER=192.168.1.0/24,10.0.0.0/8
```

### Behavior

- Only trusts `Forwarded` header from configured CIDRs
- Parses: `for`, `by`, `proto`, `host`
- Requires explicit configuration

### Risk

Misconfiguration could enable IP spoofing.

## Input Validation

### Provision Scripts

**Location**: `lib/sandbox.ts`

**Security Measures**:
- Isolated V8 context
- 50ms execution timeout
- Restricted global scope
- Seeded random for reproducibility

**Concerns**:
- Arbitrary JavaScript execution
- `ext()` allows external script calls
- Limited resource controls

### Expression Evaluation

**Location**: `lib/common/expression/`

**Risk**: Complex expressions could cause ReDoS or CPU exhaustion.

### API Input

Limited validation on API endpoints. JSON parsing errors may leak information.

## Recommendations

### Critical (Immediate)

1. **Implement NBI Authentication**
   ```typescript
   // Add JWT middleware to NBI
   app.use(koaJwt({ secret: NBI_SECRET }));
   ```

2. **Implement FS Authentication**
   - Token-based file access
   - Device-specific credentials

3. **Enable CWMP Auth by Default**
   ```typescript
   if (authExpression == null) return false;  // REQUIRE AUTH
   ```

4. **Fix JWT Implementation**
   ```typescript
   const token = jwt.sign(
     { username, authMethod },
     JWT_SECRET,
     { expiresIn: '8h' }
   );
   ctx.cookies.set(JWT_COOKIE, token, {
     sameSite: 'lax',
     httpOnly: true,
     secure: process.env.NODE_ENV === 'production'
   });
   ```

5. **Require JWT Secret**
   ```typescript
   if (!JWT_SECRET) throw new Error("UI_JWT_SECRET required");
   ```

### High Priority

6. Add security headers (CSP, HSTS, etc.)
7. Implement rate limiting
8. Add account lockout
9. Upgrade PBKDF2 to 100,000+ iterations or Argon2id

### Medium Priority

10. Add audit logging
11. Implement session tracking
12. Configure TLS minimum version
13. Add password complexity requirements

## Secure Configuration

```yaml
Required:
  UI_JWT_SECRET: "<32+ character random secret>"

SSL (all services):
  CWMP_SSL_CERT: "/path/to/cert.pem"
  CWMP_SSL_KEY: "/path/to/key.pem"
  NBI_SSL_CERT: "/path/to/cert.pem"
  NBI_SSL_KEY: "/path/to/key.pem"
  FS_SSL_CERT: "/path/to/cert.pem"
  FS_SSL_KEY: "/path/to/key.pem"
  UI_SSL_CERT: "/path/to/cert.pem"
  UI_SSL_KEY: "/path/to/key.pem"

CWMP Authentication:
  # In MongoDB config collection
  cwmp.auth: "FUNC('AUTH', Username, Password)"

Connection Request:
  CONNECTION_REQUEST_ALLOW_BASIC_AUTH: false

Proxy Trust:
  FORWARDED_HEADER: "192.168.1.0/24"

Network:
  - NBI on isolated network
  - FS on isolated network
  - CWMP on dedicated CPE VLAN
```

## Compliance Status

| Standard | Status | Notes |
|----------|--------|-------|
| OWASP Top 10 | Partial | Missing A01, A04, A07 mitigations |
| PCI DSS | Non-compliant | No encryption at rest, weak logging |
| GDPR | Partial | Device data handling needs review |
| SOC 2 | Non-compliant | Access controls insufficient |

## Authentication Flow Diagrams

### UI Login

```
User                    UI Server              MongoDB
  |                         |                     |
  |--POST /login----------->|                     |
  |  {username, password}   |                     |
  |                         |--getUsers()-------->|
  |                         |<--users data--------|
  |                         |                     |
  |                         |--hashPassword()     |
  |                         |  (PBKDF2-SHA512)    |
  |                         |                     |
  |                         |--compare hashes-----|
  |                         |                     |
  |<--Set-Cookie: JWT-------|                     |
  |<--200 OK + token--------|                     |
```

### CWMP Authentication

```
CPE                     CWMP Server            MongoDB
  |                         |                     |
  |--POST Inform----------->|                     |
  |                         |--get cwmp.auth----->|
  |                         |<--auth expression---|
  |                         |                     |
  |<--401 + WWW-Auth--------|                     |
  |  (Digest challenge)     |                     |
  |                         |                     |
  |--POST + Authorization-->|                     |
  |  (Digest response)      |                     |
  |                         |--verify digest------|
  |                         |                     |
  |<--200 InformResponse----|                     |
```
