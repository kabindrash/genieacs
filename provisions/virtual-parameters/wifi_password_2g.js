// Virtual Parameter: wifi_password_2g
// Vendor-agnostic read/write access to the 2.4GHz WiFi password.
// Handles the critical path difference: ZTE uses KeyPassphrase directly,
// while Huawei and Nokia (TR-098) use PreSharedKey.1.KeyPassphrase.
const now = Date.now();
let m = "";

// TR-181 (Nokia newer)
let d = declare("Device.WiFi.AccessPoint.1.Security.KeyPassphrase", {value: now});

// TR-098 standard (Huawei, Nokia older)
let igd = declare(
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
  {value: now}
);

// ZTE-specific (KeyPassphrase directly on WLANConfiguration)
let zte = declare(
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
  {value: now}
);

if (args[1].value) {
  m = args[1].value[0];
  if (d.size) {
    declare("Device.WiFi.AccessPoint.1.Security.KeyPassphrase", null, {value: m});
  } else if (zte.size) {
    declare(
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
      null, {value: m}
    );
  } else if (igd.size) {
    declare(
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
      null, {value: m}
    );
  }
} else {
  if (d.size) m = d.value[0];
  else if (zte.size) m = zte.value[0];
  else if (igd.size) m = igd.value[0];
}

return {writable: true, value: [m, "xsd:string"]};
