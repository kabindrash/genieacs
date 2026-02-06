// Provision: universal-wifi-config
// Configure WiFi across Huawei, ZTE, and Nokia using virtual parameters.
// Requires: wifi_ssid_2g, wifi_password_2g virtual parameters.
//
// ===== EDIT THESE VALUES =====
const SSID_24 = "MyNetwork";
const PASSWORD_24 = "SecurePassword123";
// =============================

const now = Date.now();

declare("VirtualParameters.wifi_ssid_2g", {value: now}, {value: SSID_24});
declare("VirtualParameters.wifi_password_2g", {value: now}, {value: PASSWORD_24});
