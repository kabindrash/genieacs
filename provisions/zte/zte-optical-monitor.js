// Provision: zte-optical-monitor
// Monitor optical power levels on ZTE GPON ONTs.
// Tags devices: optical_critical (< -28 dBm), optical_warning (< -25 dBm)
const now = Date.now();
const gponBase = "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig";

let rxPower = declare(gponBase + ".RxPower", {value: now});
let txPower = declare(gponBase + ".TxPower", {value: now});
let temperature = declare(gponBase + ".Temperature", {value: now});

if (rxPower.size && rxPower.value[0]) {
  let rx = parseFloat(rxPower.value[0]);
  log("ZTE GPON RX Power: " + rx + " dBm");

  if (rx < -28) {
    declare("Tags.optical_critical", null, {value: true});
    log("CRITICAL: Low optical RX power");
  } else if (rx < -25) {
    declare("Tags.optical_warning", null, {value: true});
    declare("Tags.optical_critical", null, {value: false});
  } else {
    declare("Tags.optical_warning", null, {value: false});
    declare("Tags.optical_critical", null, {value: false});
  }
}

if (temperature.size && temperature.value[0]) {
  log("ZTE GPON Temperature: " + temperature.value[0] + " C");
}
