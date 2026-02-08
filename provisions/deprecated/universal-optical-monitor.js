// Provision: universal-optical-monitor
// Monitor GPON optical power across ZTE and Nokia.
// Huawei does not expose standard optical monitoring via TR-069.
// Tags devices: optical_critical (< -28 dBm), optical_warning (< -25 dBm)
//
// NOTE: Superseded by dynamic-optical-monitor.js which adds configurable
// thresholds via policy JSON. This file is kept for backward compatibility.
var now = Date.now();
var manufacturer = declare("DeviceID.Manufacturer", {value: now});
var mfg = (manufacturer.value && manufacturer.value[0]) ? manufacturer.value[0] : "";
var mfgLower = mfg.toLowerCase();
var rxPower = null;

if (mfgLower.indexOf("zte") >= 0) {
  rxPower = declare(
    "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.RxPower",
    {value: now}
  );
} else if (mfgLower.indexOf("alcl") >= 0 || mfgLower.indexOf("nokia") >= 0) {
  // Try TR-098 first
  rxPower = declare(
    "InternetGatewayDevice.X_ALU_COM.OntOpticalParam.RxPower",
    {value: now}
  );
  if (!rxPower.size) {
    // Fallback to TR-181
    rxPower = declare(
      "Device.X_ALU_COM.OntOpticalParam.RxPower",
      {value: now}
    );
  }
}

if (rxPower && rxPower.size && rxPower.value && rxPower.value[0]) {
  var rx = parseFloat(rxPower.value[0]);
  if (isNaN(rx)) return;

  log("Optical RX Power: " + rx + " dBm (" + mfg + ")", {});

  if (rx < -28) {
    declare("Tags.optical_critical", null, {value: true});
    declare("Tags.optical_warning", null, {value: true});
  } else if (rx < -25) {
    declare("Tags.optical_warning", null, {value: true});
    declare("Tags.optical_critical", null, {value: false});
  } else {
    declare("Tags.optical_warning", null, {value: false});
    declare("Tags.optical_critical", null, {value: false});
  }
}
