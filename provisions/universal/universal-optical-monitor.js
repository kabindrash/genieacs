// Provision: universal-optical-monitor
// Monitor GPON optical power across ZTE and Nokia.
// Huawei does not expose standard optical monitoring via TR-069.
// Tags devices: optical_critical (< -28 dBm), optical_warning (< -25 dBm)
const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let mfg = manufacturer.value[0];
let rxPower = null;

if (mfg.indexOf("ZTE") >= 0) {
  rxPower = declare(
    "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.RxPower",
    {value: now}
  );
} else if (mfg.indexOf("ALCL") >= 0 || mfg.indexOf("Nokia") >= 0) {
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

if (rxPower && rxPower.size && rxPower.value[0]) {
  let rx = parseFloat(rxPower.value[0]);
  log("Optical RX Power: " + rx + " dBm (" + mfg + ")");

  if (rx < -28) {
    declare("Tags.optical_critical", null, {value: true});
    declare("Tags.optical_warning", null, {value: false});
  } else if (rx < -25) {
    declare("Tags.optical_warning", null, {value: true});
    declare("Tags.optical_critical", null, {value: false});
  } else {
    declare("Tags.optical_warning", null, {value: false});
    declare("Tags.optical_critical", null, {value: false});
  }
}
