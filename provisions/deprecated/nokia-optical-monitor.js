// Provision: nokia-optical-monitor
// Monitor GPON optical power levels on Nokia ONTs.
// Works with both TR-098 and TR-181 devices.
// Tags devices: optical_critical (< -28 dBm), optical_warning (< -25 dBm)
const now = Date.now();

// Try TR-098 path first
let rxPower = declare("InternetGatewayDevice.X_ALU_COM.OntOpticalParam.RxPower", {value: now});

if (!rxPower.size) {
  // Try TR-181 path
  rxPower = declare("Device.X_ALU_COM.OntOpticalParam.RxPower", {value: now});
}

if (rxPower.size && rxPower.value[0]) {
  let rx = parseFloat(rxPower.value[0]);
  log("Nokia GPON RX Power: " + rx + " dBm");

  if (rx < -28) {
    declare("Tags.optical_critical", null, {value: true});
    declare("Tags.optical_warning", null, {value: false});
    log("CRITICAL: Low optical RX power: " + rx + " dBm");
  } else if (rx < -25) {
    declare("Tags.optical_warning", null, {value: true});
    declare("Tags.optical_critical", null, {value: false});
  } else {
    declare("Tags.optical_warning", null, {value: false});
    declare("Tags.optical_critical", null, {value: false});
  }
}
