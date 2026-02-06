// Provision: nokia-wan-pppoe
// Configure PPPoE WAN connection on Nokia ONTs.
// Handles both TR-098 and TR-181 data models.
//
// ===== EDIT THESE VALUES =====
const PPP_USER = "user@isp.com";
const PPP_PASS = "password";
// =============================

const now = Date.now();
let tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});

if (tr181.size) {
  // TR-181 path
  declare("Device.PPP.Interface.1.Enable", {value: now}, {value: true});
  declare("Device.PPP.Interface.1.Username", {value: now}, {value: PPP_USER});
  declare("Device.PPP.Interface.1.Password", {value: now}, {value: PPP_PASS});
} else {
  // TR-098 path
  let connPath = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1";
  declare(connPath + ".WANPPPConnection.1.Enable", {value: now}, {value: true});
  declare(connPath + ".WANPPPConnection.1.Username", {value: now}, {value: PPP_USER});
  declare(connPath + ".WANPPPConnection.1.Password", {value: now}, {value: PPP_PASS});
  declare(connPath + ".WANPPPConnection.1.ConnectionType", {value: now}, {value: "IP_Routed"});
}
