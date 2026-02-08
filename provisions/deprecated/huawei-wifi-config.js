// Provision: huawei-wifi-config
// Configure WiFi on Huawei ONTs.
// IMPORTANT: Instance numbers may not be sequential on dual-band models.
//
// ===== EDIT THESE VALUES =====
const SSID_24 = "MyNetwork";
const SSID_5 = "MyNetwork-5G";
const PASSWORD = "SecurePassword123";
// =============================

const now = Date.now();

// Discover all WLAN instances on the device
let wlanInstances = declare(
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.*",
  {path: now}
);

let instances = [];
for (let inst of wlanInstances) {
  instances.push(inst);
}

// Configure 2.4GHz radio (first discovered instance)
if (instances.length >= 1) {
  let path24 = instances[0].path;
  declare(path24 + ".Enable", {value: now}, {value: true});
  declare(path24 + ".SSID", {value: now}, {value: SSID_24});
  declare(path24 + ".BeaconType", {value: now}, {value: "11i"});
  declare(path24 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
  declare(path24 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
  declare(path24 + ".PreSharedKey.1.KeyPassphrase", {value: now}, {value: PASSWORD});
}

// Configure 5GHz radio if available (second discovered instance)
if (instances.length >= 2) {
  let path5 = instances[1].path;
  declare(path5 + ".Enable", {value: now}, {value: true});
  declare(path5 + ".SSID", {value: now}, {value: SSID_5});
  declare(path5 + ".BeaconType", {value: now}, {value: "11i"});
  declare(path5 + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
  declare(path5 + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
  declare(path5 + ".PreSharedKey.1.KeyPassphrase", {value: now}, {value: PASSWORD});
}
