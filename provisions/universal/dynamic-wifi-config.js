// Provision: dynamic-wifi-config
// Universal WiFi configuration — replaces all vendor-specific WiFi scripts.
// Discovers bands dynamically from device data model (TR-181 or TR-098).
// All settings (SSIDs, passwords, security) come from preset JSON args.
// WiFi Alliance mandate: 6 GHz always forced to WPA3-SAE.
//
// Policy JSON schema (passed as args[0]):
// {
//   "password": "SharedPassword",
//   "bands": {
//     "2.4": {"ssid": "Net", "security": "wpa2", "enabled": true, "password": "Override"},
//     "5":   {"ssid": "Net-5G", "security": "wpa2"},
//     "6":   {"ssid": "Net-6E", "security": "wpa3"}
//   }
// }

// --- Parse policy from preset args ---
if (!args[0]) {
  log("dynamic-wifi-config: no policy provided in args[0], skipping", {});
  // Exit gracefully — no configuration applied
} else {

var policy;
try {
  policy = JSON.parse(args[0]);
} catch (e) {
  log("dynamic-wifi-config: invalid policy JSON in args[0], skipping", {});
}

if (policy && policy.bands && policy.password) {

var now = Date.now();

// --- Detect data model ---
var tr181Test = declare("Device.DeviceInfo.Manufacturer", {value: now});
var isTR181 = tr181Test.size > 0;

// --- Band classification helper for TR-098 ---
// Parses PossibleChannels (e.g. "1-11" or "36,40,44,48") and Channel value
// to determine which band a WLAN instance belongs to.
function classifyBandTR098(channelVal, possibleStr) {
  var ch = parseInt(channelVal, 10) || 0;

  // Parse PossibleChannels to find max channel
  if (possibleStr) {
    var maxCh = 0;
    var parts = possibleStr.replace(/;/g, ",").split(",");
    for (var p = 0; p < parts.length; p++) {
      var segment = parts[p].trim();
      if (!segment) continue;
      var rangeParts = segment.split("-");
      var val = parseInt(rangeParts[rangeParts.length - 1], 10) || 0;
      if (val > maxCh) maxCh = val;
    }
    if (maxCh > 177) return "6";
    if (maxCh > 14) return "5";
    if (maxCh > 0) return "2.4";
  }

  // Fallback: classify by current channel value only.
  // Note: 6GHz channels 1-177 overlap with 2.4/5GHz numbers. Without PossibleChannels,
  // only channels > 177 are uniquely 6GHz. Channels 36-177 default to 5GHz.
  // PossibleChannels-based detection above is authoritative and avoids this ambiguity.
  if (ch > 177) return "6";
  if (ch >= 36) return "5";
  if (ch > 0 && ch <= 14) return "2.4";
  return null;
}

// --- Apply security settings ---
function applySecurityTR181(apPath, securityMode) {
  if (securityMode === "wpa3") {
    declare(apPath + ".Security.ModeEnabled", {value: now}, {value: "WPA3-SAE"});
    declare(apPath + ".Security.MFPConfig", {value: now}, {value: "Required"});
  } else if (securityMode === "wpa2-wpa3") {
    declare(apPath + ".Security.ModeEnabled", {value: now}, {value: "WPA2-PSK-WPA3-SAE"});
    declare(apPath + ".Security.MFPConfig", {value: now}, {value: "Optional"});
  } else {
    // Default: wpa2
    declare(apPath + ".Security.ModeEnabled", {value: now}, {value: "WPA2-Personal"});
  }
}

function applySecurityTR098(wlanPath, securityMode) {
  declare(wlanPath + ".BeaconType", {value: now}, {value: "11i"});
  declare(wlanPath + ".WPAEncryptionModes", {value: now}, {value: "AESEncryption"});
  if (securityMode === "wpa3") {
    declare(wlanPath + ".WPAAuthenticationMode", {value: now}, {value: "SAEAuthentication"});
  } else {
    // TR-098 standard does not define WPA2-WPA3 mixed mode in WPAAuthenticationMode.
    // "wpa2-wpa3" gracefully degrades to WPA2 (PSKAuthentication) on TR-098 devices.
    // TR-181 devices get proper WPA2-PSK-WPA3-SAE mixed mode via applySecurityTR181().
    declare(wlanPath + ".WPAAuthenticationMode", {value: now}, {value: "PSKAuthentication"});
  }
}

// --- Set password (tries multiple paths for TR-098 vendor differences) ---
function setPasswordTR181(apPath, password) {
  declare(apPath + ".Security.KeyPassphrase", {value: now}, {value: password});
}

function setPasswordTR098(wlanPath, password) {
  // Try ZTE-style first (KeyPassphrase directly on WLANConfiguration)
  var kp = declare(wlanPath + ".KeyPassphrase", {value: now});
  if (kp.size) {
    declare(wlanPath + ".KeyPassphrase", {value: now}, {value: password});
    return;
  }
  // Standard path (Huawei, Nokia TR-098)
  var psk = declare(wlanPath + ".PreSharedKey.1.KeyPassphrase", {value: now});
  if (psk.size) {
    declare(wlanPath + ".PreSharedKey.1.KeyPassphrase", {value: now}, {value: password});
  }
}

// --- Configure a single band ---
function configureBand(band, bandConfig, path, isTR181Path) {
  // Skip if no SSID specified — avoids setting undefined on the device
  if (!bandConfig.ssid) return;

  // Enforce WPA3 on 6 GHz (WiFi Alliance mandate)
  var security = bandConfig.security || "wpa2";
  if (band === "6") security = "wpa3";

  var password = bandConfig.password || policy.password;
  var enabled = bandConfig.enabled !== false;

  if (isTR181Path) {
    // TR-181: path is like "Device.WiFi.Radio.1"
    // Assumes Radio.{i}, SSID.{i}, and AccessPoint.{i} use matching instance numbers.
    // This holds for Nokia/ALCL and most TR-181 devices. If a vendor uses different
    // numbering, the LowerLayers reference should be followed instead.
    var inst = path.split(".")[3];
    var ssidPath = "Device.WiFi.SSID." + inst;
    var apPath = "Device.WiFi.AccessPoint." + inst;

    declare(ssidPath + ".SSID", {value: now}, {value: bandConfig.ssid});
    declare(ssidPath + ".Enable", {value: now}, {value: enabled});
    applySecurityTR181(apPath, security);
    setPasswordTR181(apPath, password);
  } else {
    // TR-098: path is like "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1"
    declare(path + ".SSID", {value: now}, {value: bandConfig.ssid});
    declare(path + ".Enable", {value: now}, {value: enabled});
    applySecurityTR098(path, security);
    setPasswordTR098(path, password);
  }
}

// --- TR-181 discovery and configuration ---
if (isTR181) {
  var radios = declare("Device.WiFi.Radio.*", {path: now});
  for (var r of radios) {
    var freqBand = declare(r.path + ".OperatingFrequencyBand", {value: now});
    if (!freqBand.value || !freqBand.value[0]) continue;

    var bandStr = freqBand.value[0]; // e.g. "2.4GHz", "5GHz", "6GHz"
    var band = null;
    if (bandStr === "2.4GHz" || bandStr.indexOf("2.4") >= 0) band = "2.4";
    else if (bandStr === "5GHz") band = "5";
    else if (bandStr === "6GHz") band = "6";
    // Fallback: partial match for non-standard values
    else if (bandStr.indexOf("5") >= 0 && bandStr.indexOf("2") < 0 && bandStr.indexOf("6") < 0) band = "5";
    else if (bandStr.indexOf("6") >= 0 && bandStr.indexOf("60") < 0) band = "6";

    if (band && policy.bands[band]) {
      configureBand(band, policy.bands[band], r.path, true);
    }
  }
}

// --- TR-098 discovery and configuration ---
if (!isTR181) {
  var wlans = declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.*", {path: now});
  for (var w of wlans) {
    var channel = declare(w.path + ".Channel", {value: now});
    var possible = declare(w.path + ".PossibleChannels", {value: now});

    var chVal = channel.value ? channel.value[0] : 0;
    var possStr = possible.value ? possible.value[0] : "";
    var band = classifyBandTR098(chVal, possStr);

    if (band && policy.bands[band]) {
      configureBand(band, policy.bands[band], w.path, false);
    }
  }
}

} else if (policy) {
  log("dynamic-wifi-config: policy missing 'bands' or 'password' fields", {});
}

} // end outer if(!args[0]) else block
