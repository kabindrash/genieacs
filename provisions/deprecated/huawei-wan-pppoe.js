// Provision: huawei-wan-pppoe
// Configure PPPoE WAN connection on Huawei ONTs.
//
// ===== EDIT THESE VALUES =====
const PPP_USER = "user@isp.com";
const PPP_PASS = "password";
const VLAN_ID = 100;
// =============================

const now = Date.now();

let wanConn = declare(
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.*",
  {path: now}
);

let connPath = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1";
declare(connPath + ".WANPPPConnection.1.Enable", {value: now}, {value: true});
declare(connPath + ".WANPPPConnection.1.Username", {value: now}, {value: PPP_USER});
declare(connPath + ".WANPPPConnection.1.Password", {value: now}, {value: PPP_PASS});
declare(connPath + ".WANPPPConnection.1.ConnectionType", {value: now}, {value: "IP_Routed"});

// Set VLAN using Huawei vendor extension
declare(connPath + ".X_HW_VLANMuxID", {value: now}, {value: VLAN_ID});
declare(connPath + ".X_HW_VLAN_CoS", {value: now}, {value: 0});
