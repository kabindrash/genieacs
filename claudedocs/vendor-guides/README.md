# GenieACS Vendor ONT Guides

## Overview

Operational guides for managing vendor-specific ONTs (Optical Network Terminals) with GenieACS. Each guide covers device models, TR-069 parameter paths, provision scripts, vendor-specific quirks, and troubleshooting procedures.

## Guide Index

| Guide | Vendor | Data Model | Models Covered |
|-------|--------|------------|----------------|
| [HUAWEI-ONT-GUIDE.md](HUAWEI-ONT-GUIDE.md) | Huawei | TR-098 (`InternetGatewayDevice`) | HG8245H, EG8145V5, HS8145V5, +9 more |
| [ZTE-ONT-GUIDE.md](ZTE-ONT-GUIDE.md) | ZTE | TR-098 (`InternetGatewayDevice`) | F601, F660, F670L, F680, +10 more |
| [NOKIA-ONT-GUIDE.md](NOKIA-ONT-GUIDE.md) | Nokia / ALU | TR-098 + TR-181 (dual) | G-240W-A, I-240W-A, G-2425G-A, +12 more |
| [CROSS-VENDOR-COMPARISON.md](CROSS-VENDOR-COMPARISON.md) | All | Multi-model | Parameter mapping, virtual params, presets |

## Quick Reference

### Vendor Summary

| Property | Huawei | ZTE | Nokia |
|----------|--------|-----|-------|
| **Root Path** | `InternetGatewayDevice` | `InternetGatewayDevice` | `InternetGatewayDevice` or `Device` |
| **Extension Prefix** | `X_HW_` | `X_ZTE-COM_` | `X_ALU_COM_`, `X_NOKIA_COM_` |
| **Common OUI** | `00E0FC` | `ZTEG` / `000000` | `ALCL` |
| **WLAN Instances** | Non-sequential | Sequential from 1 | Sequential from 1 |
| **Firmware Upload** | OUI + ProductClass match | Standard | OUI + ProductClass match |
| **Default Data Model** | TR-098 only | TR-098 only | TR-098 or TR-181 (model-dependent) |

### Parameter Path Quick Reference

| Operation | Huawei (TR-098) | ZTE (TR-098) | Nokia (TR-098) |
|-----------|-----------------|--------------|----------------|
| Device Manufacturer | `DeviceID.Manufacturer` | `DeviceID.Manufacturer` | `DeviceID.Manufacturer` |
| Serial Number | `DeviceID.SerialNumber` | `DeviceID.SerialNumber` | `DeviceID.SerialNumber` |
| WiFi SSID (2.4G) | `*.LANDevice.1.WLANConfiguration.1.SSID` | `*.LANDevice.1.WLANConfiguration.1.SSID` | `*.LANDevice.1.WLANConfiguration.1.SSID` |
| WiFi Password | `*.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase` | `*.LANDevice.1.WLANConfiguration.1.KeyPassphrase` | `*.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase` |
| WAN IP Address | `*.WANDevice.1.WANConnectionDevice.*.WANIPConnection.*.ExternalIPAddress` | `*.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress` | `*.WANDevice.1.WANConnectionDevice.*.WANIPConnection.*.ExternalIPAddress` |
| Periodic Inform | `*.ManagementServer.PeriodicInformInterval` | `*.ManagementServer.PeriodicInformInterval` | `*.ManagementServer.PeriodicInformInterval` |
| Reboot | Task: `reboot` | Task: `reboot` | Task: `reboot` |
| Firmware Upgrade | Task: `download` | Task: `download` | Task: `download` |

**Note**: `*` stands for `InternetGatewayDevice` (TR-098) or `Device` (TR-181).

## Related Documentation

- [PROVISIONING-SPEC.md](../specs/PROVISIONING-SPEC.md) - Provision script API (`declare()`, `commit()`, `ext()`)
- [CWMP-SPEC.md](../specs/CWMP-SPEC.md) - TR-069 protocol handling and session lifecycle
- [NBI-API-SPEC.md](../specs/NBI-API-SPEC.md) - REST API for device management
- [03-PROVISIONING-SYSTEM.md](../workflow/03-PROVISIONING-SYSTEM.md) - Provisioning workflow overview
- [04-DATA-FLOW.md](../workflow/04-DATA-FLOW.md) - Data flow between services
