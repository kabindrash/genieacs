// Virtual Parameter: wan_ip
// Read-only: returns the WAN IP address regardless of vendor.
// Checks TR-181 IP interface, TR-098 PPP, and TR-098 IP connection.
const now = Date.now();
let m = "";

// TR-181
let d = declare("Device.IP.Interface.1.IPv4Address.1.IPAddress", {value: now});

// TR-098 PPP
let igdPpp = declare(
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress",
  {value: now}
);

// TR-098 IP
let igdIp = declare(
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress",
  {value: now}
);

if (d.size && d.value[0]) m = d.value[0];
else if (igdPpp.size && igdPpp.value[0]) m = igdPpp.value[0];
else if (igdIp.size && igdIp.value[0]) m = igdIp.value[0];

return {writable: false, value: [m, "xsd:string"]};
