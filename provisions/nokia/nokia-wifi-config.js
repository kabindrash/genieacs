// Provision: nokia-wifi-config
// Configure WiFi on Nokia ONTs with automatic data model detection.
// Handles both TR-098 (G-240W series) and TR-181 (G-2425G, XS series).
//
// ===== EDIT THESE VALUES =====
const SSID_24 = "MyNetwork";
const SSID_5 = "MyNetwork-5G";
const PASSWORD = "SecurePassword123";
// =============================

const now = Date.now();

let tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});
let tr098 = declare("InternetGatewayDevice.DeviceInfo.Manufacturer", {value: now});

if (tr181.size) {
  // TR-181 path (G-2425G-A, G-2426G-A, XS-series)
  declare("Device.WiFi.Radio.1.Enable", {value: now}, {value: true});
  declare("Device.WiFi.SSID.1.SSID", {value: now}, {value: SSID_24});
  declare("Device.WiFi.AccessPoint.1.Security.ModeEnabled", {value: now}, {value: "WPA2-Personal"});
  declare("Device.WiFi.AccessPoint.1.Security.KeyPassphrase", {value: now}, {value: PASSWORD});

  // 5GHz radio
  declare("Device.WiFi.Radio.2.Enable", {value: now}, {value: true});
  declare("Device.WiFi.SSID.2.SSID", {value: now}, {value: SSID_5});
  declare("Device.WiFi.AccessPoint.2.Security.ModeEnabled", {value: now}, {value: "WPA2-Personal"});
  declare("Device.WiFi.AccessPoint.2.Security.KeyPassphrase", {value: now}, {value: PASSWORD});
} else if (tr098.size) {
  // TR-098 path (G-240W series, all I-series)
  let wlan24 = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1";
  declare(wlan24 + ".Enable", {value: now}, {value: true});
  declare(wlan24 + ".SSID", {value: now}, {value: SSID_24});
  declare(wlan24 + ".BeaconType", {value: now}, {value: "11i"});
  declare(wlan24 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
  declare(wlan24 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
  declare(wlan24 + ".PreSharedKey.1.KeyPassphrase", {value: now}, {value: PASSWORD});

  // 5GHz radio (if available)
  let wlan5 = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5";
  let w5 = declare(wlan5 + ".*", {path: now});
  if (w5.size) {
    declare(wlan5 + ".Enable", {value: now}, {value: true});
    declare(wlan5 + ".SSID", {value: now}, {value: SSID_5});
    declare(wlan5 + ".BeaconType", {value: now}, {value: "11i"});
    declare(wlan5 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
    declare(wlan5 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
    declare(wlan5 + ".PreSharedKey.1.KeyPassphrase", {value: now}, {value: PASSWORD});
  }
}
