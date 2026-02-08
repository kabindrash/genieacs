# Example WiFi Presets

These are **example templates** — not deployed by default.

## wifi-plan-premium.json

Premium WiFi tier with WPA2-WPA3 mixed mode and separate SSIDs.

### Usage Notes

- **Weight 20** (higher than wifi-default's weight 10): Ensures the premium
  preset's configuration wins when both match a device tagged `plan_premium`.
- **Precondition**: Only applies to devices with `Tags.plan_premium = true`.
  Tag devices via the auto-tag provision or NBI API.
- **WPA2-WPA3 on TR-098**: TR-098 devices silently degrade to WPA2 because
  the TR-098 `WPAAuthenticationMode` has no mixed mode value. TR-181 devices
  get proper `WPA2-PSK-WPA3-SAE`. This is expected behavior.
- Both `wifi-default` and this preset match premium devices (wifi-default has
  empty precondition). The higher weight ensures this preset runs last and its
  values overwrite wifi-default.

### Deploying

```bash
curl -X PUT -H 'Content-Type: application/json' \
  --data-binary @provisions/presets/examples/wifi-plan-premium.json \
  http://localhost:7557/presets/wifi-plan-premium
```
