// Provision: zte-wifi-config
// Configure WiFi on ZTE ONTs.
// Note: ZTE uses KeyPassphrase directly, not PreSharedKey.1.KeyPassphrase.
// Instance 1 = 2.4GHz, Instance 5 = 5GHz on dual-band models.
//
// ===== EDIT THESE VALUES =====
const SSID_24 = "MyNetwork";
const SSID_5 = "MyNetwork-5G";
const PASSWORD = "SecurePassword123";
// =============================

const now = Date.now();

// 2.4GHz radio (instance 1)
const wlan24 = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1";
declare(wlan24 + ".Enable", {value: now}, {value: true});
declare(wlan24 + ".SSID", {value: now}, {value: SSID_24});
declare(wlan24 + ".BeaconType", {value: now}, {value: "11i"});
declare(wlan24 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
declare(wlan24 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
declare(wlan24 + ".KeyPassphrase", {value: now}, {value: PASSWORD});

// 5GHz radio (instance 5 on dual-band models)
const wlan5 = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5";
declare(wlan5 + ".Enable", {value: now}, {value: true});
declare(wlan5 + ".SSID", {value: now}, {value: SSID_5});
declare(wlan5 + ".BeaconType", {value: now}, {value: "11i"});
declare(wlan5 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
declare(wlan5 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
declare(wlan5 + ".KeyPassphrase", {value: now}, {value: PASSWORD});
