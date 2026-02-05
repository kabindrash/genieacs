# GenieACS Workflow Documentation

This directory contains detailed workflow documentation explaining how GenieACS operates.

## Contents

| Document | Description |
|----------|-------------|
| [01-ARCHITECTURE-OVERVIEW.md](./01-ARCHITECTURE-OVERVIEW.md) | System architecture and service layout |
| [02-SESSION-LIFECYCLE.md](./02-SESSION-LIFECYCLE.md) | Device session workflow from Inform to completion |
| [03-PROVISIONING-SYSTEM.md](./03-PROVISIONING-SYSTEM.md) | Deep dive into presets, provisions, and sandbox |
| [04-DATA-FLOW.md](./04-DATA-FLOW.md) | How data flows through the system |
| [05-EXTENSION-SYSTEM.md](./05-EXTENSION-SYSTEM.md) | External script execution and integration |

## Quick Reference

### Service Ports
| Service | Port | Purpose |
|---------|------|---------|
| CWMP | 7547 | TR-069 ACS (device communication) |
| NBI | 7557 | REST API (external integration) |
| FS | 7567 | File server (firmware/config files) |
| UI | 3000 | Web admin interface |

### Key Concepts
- **Preset**: Rules that match devices and trigger provisions
- **Provision**: JavaScript scripts declaring device operations
- **Virtual Parameter**: Computed values not on device
- **Task**: One-time queued operations
- **Session**: Stateful device communication context

### Typical Flow
```
Device Inform → Preset Matching → Provision Execution → RPC Generation → Device Sync → Commit
```
