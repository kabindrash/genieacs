// Provision: dynamic-optical-monitor
// Universal GPON optical power monitoring — replaces all vendor-specific optical scripts.
// Detects vendor (case-insensitive) and data model for correct RxPower path.
// Huawei does not expose optical monitoring via TR-069 — skipped gracefully.
// Tags devices: optical_critical, optical_warning based on configurable thresholds.
//
// Policy JSON schema (passed as args[0], optional — uses defaults if missing):
// {
//   "thresholds": {
//     "warning": -25,
//     "critical": -28
//   }
// }

var WARNING_THRESHOLD = -25;
var CRITICAL_THRESHOLD = -28;

// Parse optional policy for custom thresholds
if (args[0]) {
  try {
    var policy = JSON.parse(args[0]);
    if (policy && policy.thresholds) {
      if (typeof policy.thresholds.warning === "number") WARNING_THRESHOLD = policy.thresholds.warning;
      if (typeof policy.thresholds.critical === "number") CRITICAL_THRESHOLD = policy.thresholds.critical;
    }
  } catch (e) {
    log("dynamic-optical-monitor: invalid policy JSON, using defaults", {});
  }
}

var now = Date.now();

// --- Detect vendor (case-insensitive) ---
var mfgDeclare = declare("DeviceID.Manufacturer", {value: now});
var mfg = (mfgDeclare.value && mfgDeclare.value[0]) ? mfgDeclare.value[0] : "";
var mfgLower = mfg.toLowerCase();

// --- Detect data model ---
var tr181Test = declare("Device.DeviceInfo.Manufacturer", {value: now});
var isTR181 = tr181Test.size > 0;

var rxPower = null;

if (mfgLower.indexOf("zte") >= 0) {
  // ZTE: GPON interface config (TR-098 only)
  var zteGponBase = "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig";
  rxPower = declare(zteGponBase + ".RxPower", {value: now});

  // Also read TxPower and Temperature for telemetry logging
  var txPower = declare(zteGponBase + ".TxPower", {value: now});
  var temperature = declare(zteGponBase + ".Temperature", {value: now});
  var txVal = (txPower.value && txPower.value[0]) ? txPower.value[0] : "N/A";
  var tempVal = (temperature.value && temperature.value[0]) ? temperature.value[0] : "N/A";
  log("Optical telemetry (ZTE): TxPower=" + txVal + " Temperature=" + tempVal, {});
} else if (mfgLower.indexOf("alcl") >= 0 || mfgLower.indexOf("nokia") >= 0) {
  // Nokia/ALCL: select path based on detected data model
  if (isTR181) {
    rxPower = declare("Device.X_ALU_COM.OntOpticalParam.RxPower", {value: now});
  } else {
    rxPower = declare("InternetGatewayDevice.X_ALU_COM.OntOpticalParam.RxPower", {value: now});
  }
} else if (mfgLower.indexOf("huawei") >= 0) {
  // Huawei does not expose optical monitoring via TR-069
  log("dynamic-optical-monitor: Huawei optical not available via TR-069, skipping", {});
} else if (mfg) {
  // Unknown vendor — log for debugging
  log("dynamic-optical-monitor: no optical path for vendor '" + mfg + "', skipping", {});
}

if (rxPower && rxPower.size && rxPower.value && rxPower.value[0]) {
  var rx = parseFloat(rxPower.value[0]);
  if (isNaN(rx)) {
    log("dynamic-optical-monitor: RxPower is NaN, skipping tagging", {});
  } else {
    log("Optical RX Power: " + rx + " dBm (" + mfg + ")", {});

    if (rx < CRITICAL_THRESHOLD) {
      declare("Tags.optical_critical", null, {value: true});
      declare("Tags.optical_warning", null, {value: true});
    } else if (rx < WARNING_THRESHOLD) {
      declare("Tags.optical_warning", null, {value: true});
      declare("Tags.optical_critical", null, {value: false});
    } else {
      declare("Tags.optical_warning", null, {value: false});
      declare("Tags.optical_critical", null, {value: false});
    }
  }
}
