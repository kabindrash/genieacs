// Virtual Parameter: wifi_ssid_2g
// Vendor-agnostic read/write access to the 2.4GHz WiFi SSID.
// Supports: Huawei (TR-098), ZTE (TR-098), Nokia (TR-098 and TR-181)
const now = Date.now();
let m = "";

// TR-181 path (Nokia newer models)
let d = declare("Device.WiFi.SSID.1.SSID", {value: now});

// TR-098 path (Huawei, ZTE, Nokia older models)
let igd = declare(
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
  {value: now}
);

if (args[1].value) {
  // Write operation
  m = args[1].value[0];
  if (d.size) {
    declare("Device.WiFi.SSID.1.SSID", null, {value: m});
  } else if (igd.size) {
    declare(
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
      null, {value: m}
    );
  }
} else {
  // Read operation
  if (d.size) m = d.value[0];
  else if (igd.size) m = igd.value[0];
}

return {writable: true, value: [m, "xsd:string"]};
