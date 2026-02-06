// Virtual Parameter: wan_status
// Read-only: returns WAN connection status across all vendors.
// Checks PPP (TR-181), PPP (TR-098), and IP connection (TR-098 DHCP WAN).
const now = Date.now();
let m = "";

// TR-181 PPP status
let d = declare("Device.PPP.Interface.1.Status", {value: now});

// TR-098 PPP status
let igd = declare(
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ConnectionStatus",
  {value: now}
);

// TR-098 IP connection status (DHCP WAN)
let igdIp = declare(
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ConnectionStatus",
  {value: now}
);

if (d.size) m = d.value[0];
else if (igd.size) m = igd.value[0];
else if (igdIp.size) m = igdIp.value[0];

return {writable: false, value: [m, "xsd:string"]};
