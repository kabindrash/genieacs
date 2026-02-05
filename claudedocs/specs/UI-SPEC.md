# GenieACS UI Frontend Specification

## Overview

The GenieACS UI is a single-page application built with Mithril.js, providing a web-based management interface for device management, configuration, and monitoring.

**Primary Files**:
- `bin/genieacs-ui.ts` - Service entry point
- `lib/ui.ts` - Backend API server
- `lib/ui/api.ts` - REST API routes
- `ui/app.ts` - Frontend entry point
- `ui/store.ts` - Reactive data store
- `ui/components.ts` - Component registry

## Architecture

### Technology Stack

- **Framework**: Mithril.js (SPA)
- **Build**: Webpack + TypeScript
- **State**: Custom reactive store with WeakMap tracking
- **Authentication**: JWT with cookies
- **Code Editor**: CodeMirror

### Component Structure

```
layout.ts (Layout Shell)
    ├── header
    │   ├── menu.ts (Navigation)
    │   ├── user-menu.ts (User dropdown)
    │   └── drawer-component.ts (Task queue)
    │
    ├── content-wrapper
    │   ├── admin-menu.ts (Admin sidebar)
    │   └── Page Component (varies by route)
    │
    ├── overlay.ts (Modal dialogs)
    └── datalist.ts (Autocomplete)
```

## Service Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `UI_PORT` | int | 3000 | TCP listening port |
| `UI_INTERFACE` | string | "::" | Network interface |
| `UI_WORKER_PROCESSES` | int | 0 | Worker count |
| `UI_SSL_CERT` | string | "" | SSL certificate |
| `UI_SSL_KEY` | string | "" | SSL private key |
| `UI_JWT_SECRET` | string | "" | JWT signing secret |

## Authentication

### JWT Flow

1. User submits login form
2. Server validates credentials via PBKDF2
3. JWT token generated and set as cookie
4. Client reloads, reads `window.username`
5. Subsequent requests include JWT cookie
6. Server validates JWT with `koa-jwt`

### Token Structure

```javascript
{
  username: string,
  authMethod: "local"
}
```

**Note**: No expiration claim currently implemented.

### Cookie Settings

```javascript
{
  sameSite: "lax",
  // Missing: httpOnly, secure
}
```

## State Management

### Store Architecture

```typescript
// Resource tracking
const resources = {
  devices: { objects: Map, count: Map, fetch: Map },
  faults: {...},
  presets: {...},
  // ...other resources
};

// Query response class
class QueryResponse {
  get fulfilled(): number;   // When fulfilled
  get fulfilling(): boolean; // In progress
  get value(): any;          // Result data
}
```

### Query Functions

**count(resource, filter)**
```typescript
function count(resourceType: string, filter: Expression): QueryResponse
```

**fetch(resource, filter, options)**
```typescript
function fetch(
  resourceType: string,
  filter: Expression,
  options: { limit?: number; sort?: object }
): QueryResponse
```

### Background Fulfillment

Queries are fulfilled after render:
1. Components call `count()` or `fetch()`
2. Returns `QueryResponse` with cached or empty value
3. After render, `fulfill()` runs
4. HTTP requests sent for unfulfilled queries
5. Cache updated, Mithril redraws

### Clock Synchronization

Health check every 3 seconds:
- Compares server/client time
- Applies clock skew correction
- Detects config/version changes

## Pages

### Overview Page

**File**: `ui/overview-page.ts`

Dashboard with pie charts:
- Device statistics by category
- Configurable via `ui.overview.charts`

### Devices Page

**File**: `ui/devices-page.ts`

Paginated device list:
- Filter by expression
- Sortable columns
- Bulk actions (reboot, reset, delete, tag)
- Configurable columns via `ui.index`

### Device Page

**File**: `ui/device-page.ts`

Single device view:
- Configurable components via `ui.device`
- Context propagation for device data

### Faults Page

**File**: `ui/faults-page.ts`

Fault management:
- View fault details
- Delete/retry faults

### Admin Pages

| Page | Resource | Features |
|------|----------|----------|
| Presets | presets | Provision selection, preconditions |
| Provisions | provisions | CodeMirror script editor |
| Virtual Parameters | virtualParameters | CodeMirror script editor |
| Files | files | Upload with metadata |
| Config | config | UI configuration |
| Users | users | Role assignment, passwords |
| Permissions | permissions | RBAC configuration |

### Login Page

**File**: `ui/login-page.ts`

- Username/password form
- Change password link

## Components

### Custom m() Wrapper

```typescript
// Enables context propagation
m.context(context, componentName, attrs);
```

### Registered Components

| Component | Purpose |
|-----------|---------|
| `parameter` | Display/edit parameter |
| `parameter-list` | Table of parameters |
| `parameter-table` | Grid of parameters |
| `overview-dot` | Status indicator |
| `container` | Dynamic component container |
| `summon-button` | Action button |
| `device-faults` | Device fault list |
| `all-parameters` | Searchable parameter tree |
| `device-actions` | Action buttons |
| `tags` | Tag display/management |
| `ping` | Ping utility |
| `device-link` | Link to device |
| `long-text` | Text truncation |
| `loading` | Loading overlay |

### Parameter Component

```typescript
// Display parameter with edit capability
m("parameter", {
  parameter: "Device.DeviceInfo.SoftwareVersion"
})
```

### All Parameters Component

Features:
- Searchable parameter tree
- Refresh/add/delete actions
- CSV export

## Task Queue

### Architecture

```typescript
const queue: Set<QueueTask> = new Set();    // Active tasks
const staging: Set<StageTask> = new Set();  // Being edited
```

### API

```typescript
function queueTask(...tasks: QueueTask[]): void;
function deleteTask(task: QueueTask): void;
function getQueue(): Set<QueueTask>;
function clear(): void;
function getStaging(): Set<StageTask>;
function stageSpv(task: StageTask): void;
function stageDownload(task: StageTask): void;
function commit(tasks, callback): Promise<void>;
```

### Commit Flow

1. Group tasks by device
2. Call `store.postTasks()` per device
3. Update task statuses

## Filter System

### Filter Component

Features:
- Autocomplete via smart-query
- Expression validation
- Multiple filter inputs

### Smart Query

User-friendly query syntax:
- `>=5` (number)
- `>2024-01-01` (timestamp)
- `%router%` (string pattern)
- `AA:BB:CC` (MAC address)
- `production` (tag)

## Form System

### Put Form Component

**Field Types**:
| Type | Element |
|------|---------|
| `combo` | `<select>` |
| `multi` | Checkbox list |
| `code` | CodeMirror |
| `file` | File input |
| `textarea` | Multi-line text |
| default | Text input |

## Overlay System

### API

```typescript
function open(callback: OverlayCallback, closeCb: CloseCallback): void;
function close(callback: OverlayCallback, force: boolean): boolean;
function render(): Children;
```

### Features

- Escape key closes
- Browser back closes
- Stack of overlays

## Notifications

### API

```typescript
function push(type: string, message: string, actions?: object): Notification;
function dismiss(n: Notification): void;
function getNotifications(): Set<Notification>;
```

### Auto-dismiss

Non-action notifications dismiss after 4 seconds.

## API Endpoints (Backend)

| Method | Path | Description |
|--------|------|-------------|
| HEAD | `/{resource}` | Count |
| GET | `/{resource}` | Query |
| GET | `/{resource}.csv` | CSV export |
| HEAD | `/{resource}/:id` | Check existence |
| GET | `/{resource}/:id` | Get single |
| DELETE | `/{resource}/:id` | Delete |
| PUT | `/{resource}/:id` | Create/update |
| GET | `/devices/:id.csv` | Device CSV |
| GET | `/blob/files/:id` | File download |
| PUT | `/files/:id` | File upload |
| POST | `/devices/:id/tasks` | Submit tasks |
| POST | `/devices/:id/tags` | Update tags |
| GET | `/ping/:host` | Ping |
| PUT | `/users/:id/password` | Change password |
| POST | `/login` | Login |
| POST | `/logout` | Logout |

## Configuration

### UI Config Structure

```typescript
interface UiConfig {
  filters: Record<string, FilterConfig>;
  device: Record<string, ComponentConfig>;
  index: Record<string, ColumnConfig>;
  overview: {
    groups: Record<string, GroupConfig>;
    charts: Record<string, ChartConfig>;
  };
  pageSize: number;
}
```

### Filter Config

```javascript
{
  "filters": {
    "online": {
      "label": "Online",
      "parameter": "Events.Inform",
      "type": "date"
    }
  }
}
```

### Index Config

```javascript
{
  "index": {
    "serial": {
      "label": "Serial Number",
      "parameter": "DeviceID.SerialNumber"
    }
  }
}
```

### Device Config

```javascript
{
  "device": {
    "info": {
      "type": "parameter-list",
      "parameters": [
        "DeviceID.Manufacturer",
        "DeviceID.ProductClass"
      ]
    }
  }
}
```

## Authorization

### Client-Side

```typescript
window.authorizer = new Authorizer(window.permissionSets);

// Check access
if (window.authorizer.hasAccess("devices", 2)) {
  // Can read devices
}

// Get filter
const filter = window.authorizer.getFilter("devices", 2);
```

### Permission Levels

| Level | Access |
|-------|--------|
| 1 | Count |
| 2 | Read |
| 3 | Write |

## Dynamic Loading

### Lazy Imports

```typescript
function loadCodeMirror(): Promise<void>;
function loadYaml(): Promise<void>;
```

CodeMirror and YAML loaded on demand for editor pages.
