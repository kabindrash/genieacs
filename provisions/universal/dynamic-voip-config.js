// Provision: dynamic-voip-config
// Universal VoIP/SIP configuration — replaces all vendor-specific VoIP scripts.
// Detects data model (TR-181/TR-098) for root path selection.
// All vendors use the same VoiceService path structure.
//
// Policy JSON schema (passed as args[0]):
// {
//   "server": "sip.isp.com",
//   "port": 5060,
//   "username": "0612345678",
//   "password": "sippass",
//   "registrarPort": 5060  // optional, defaults to port
// }

if (!args[0]) {
  log("dynamic-voip-config: no policy provided in args[0], skipping", {});
} else {

var policy;
try {
  policy = JSON.parse(args[0]);
} catch (e) {
  log("dynamic-voip-config: invalid policy JSON in args[0], skipping", {});
}

if (policy && policy.server && policy.username && policy.password) {

var now = Date.now();

// --- Detect data model ---
var tr181Test = declare("Device.DeviceInfo.Manufacturer", {value: now});
var root = tr181Test.size > 0 ? "Device" : "InternetGatewayDevice";

var port = policy.port || 5060;
var registrarPort = policy.registrarPort || port;

var voipBase = root + ".Services.VoiceService.1.VoiceProfile.1";

// SIP server settings
declare(voipBase + ".SIP.ProxyServer", {value: now}, {value: policy.server});
declare(voipBase + ".SIP.ProxyServerPort", {value: now}, {value: port});
declare(voipBase + ".SIP.RegistrarServer", {value: now}, {value: policy.server});
declare(voipBase + ".SIP.RegistrarServerPort", {value: now}, {value: registrarPort});

// Line configuration
declare(voipBase + ".Line.1.Enable", {value: now}, {value: "Enabled"});
declare(voipBase + ".Line.1.SIP.AuthUserName", {value: now}, {value: policy.username});
declare(voipBase + ".Line.1.SIP.AuthPassword", {value: now}, {value: policy.password});
declare(voipBase + ".Line.1.SIP.URI", {value: now}, {value: policy.username});

} else if (policy) {
  log("dynamic-voip-config: policy missing required fields (server, username, password)", {});
}

} // end outer if(!args[0]) else block
