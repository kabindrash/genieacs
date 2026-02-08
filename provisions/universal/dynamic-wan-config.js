// Provision: dynamic-wan-config
// Universal WAN configuration — replaces all vendor-specific WAN scripts.
// Detects data model (TR-181/TR-098) and vendor for VLAN extensions.
// All settings (type, credentials, VLAN) come from preset JSON args.
//
// Policy JSON schema (passed as args[0]):
// {
//   "type": "pppoe",           // "pppoe" or "dhcp"
//   "username": "user@isp.com", // PPPoE only
//   "password": "secret",       // PPPoE only
//   "vlan": 100,                // optional, vendor VLAN extension
//   "cos": 0                    // optional, Class of Service (Huawei only)
// }

if (!args[0]) {
  log("dynamic-wan-config: no policy provided in args[0], skipping", {});
} else {

var policy;
try {
  policy = JSON.parse(args[0]);
} catch (e) {
  log("dynamic-wan-config: invalid policy JSON in args[0], skipping", {});
}

if (policy && policy.type) {

var now = Date.now();

// --- Detect data model ---
var tr181Test = declare("Device.DeviceInfo.Manufacturer", {value: now});
var isTR181 = tr181Test.size > 0;

// --- Detect vendor for VLAN extensions ---
var mfgDeclare = declare("DeviceID.Manufacturer", {value: now});
var mfg = (mfgDeclare.value && mfgDeclare.value[0]) ? mfgDeclare.value[0] : "";
var mfgLower = mfg.toLowerCase();

var connPath = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1";

if (policy.type === "pppoe") {
  if (!policy.username || !policy.password) {
    log("dynamic-wan-config: PPPoE requires username and password", {});
  } else if (isTR181) {
    // TR-181 PPPoE
    declare("Device.PPP.Interface.1.Enable", {value: now}, {value: true});
    declare("Device.PPP.Interface.1.Username", {value: now}, {value: policy.username});
    declare("Device.PPP.Interface.1.Password", {value: now}, {value: policy.password});
  } else {
    // TR-098 PPPoE
    declare(connPath + ".WANPPPConnection.1.Enable", {value: now}, {value: true});
    declare(connPath + ".WANPPPConnection.1.Username", {value: now}, {value: policy.username});
    declare(connPath + ".WANPPPConnection.1.Password", {value: now}, {value: policy.password});
    declare(connPath + ".WANPPPConnection.1.ConnectionType", {value: now}, {value: "IP_Routed"});
  }

  // Apply vendor-specific VLAN extension (TR-098 only)
  if (policy.vlan !== undefined && !isTR181) {
    if (mfgLower.indexOf("huawei") >= 0) {
      declare(connPath + ".X_HW_VLANMuxID", {value: now}, {value: policy.vlan});
      var cos = (policy.cos !== undefined) ? policy.cos : 0;
      declare(connPath + ".X_HW_VLAN_CoS", {value: now}, {value: cos});
    } else if (mfgLower.indexOf("zte") >= 0) {
      declare(connPath + ".X_ZTE-COM_VLANID", {value: now}, {value: policy.vlan});
    }
    // Nokia and others: no vendor VLAN extension via TR-069
  }

} else if (policy.type === "dhcp") {
  if (isTR181) {
    // TR-181 DHCP
    declare("Device.IP.Interface.1.Enable", {value: now}, {value: true});
  } else {
    // TR-098 DHCP
    declare(connPath + ".WANIPConnection.1.Enable", {value: now}, {value: true});
    declare(connPath + ".WANIPConnection.1.ConnectionType", {value: now}, {value: "IP_Routed"});
    declare(connPath + ".WANIPConnection.1.AddressingType", {value: now}, {value: "DHCP"});
  }

} else {
  log("dynamic-wan-config: unknown WAN type '" + policy.type + "', expected 'pppoe' or 'dhcp'", {});
}

} else if (policy) {
  log("dynamic-wan-config: policy missing 'type' field", {});
}

} // end outer if(!args[0]) else block
