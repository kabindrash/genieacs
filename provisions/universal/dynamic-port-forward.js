// Provision: dynamic-port-forward
// Universal port forwarding — replaces vendor-specific port forward scripts.
// Configures PortMapping entries on the WAN connection.
// Supports both TR-098 and TR-181 data models.
// Typically triggered on-demand via NBI task, not periodic preset.
//
// Policy JSON schema (passed as args[0]):
// {
//   "rules": [
//     {
//       "externalPort": 8080,
//       "internalPort": 80,
//       "internalClient": "192.168.1.100",
//       "protocol": "TCP",
//       "description": "Web server"
//     }
//   ],
//   "wanType": "ip"  // "ip" for WANIPConnection/DHCP, "ppp" for WANPPPConnection/PPPoE
// }

if (!args[0]) {
  log("dynamic-port-forward: no policy provided in args[0], skipping", {});
} else {

var policy;
try {
  policy = JSON.parse(args[0]);
} catch (e) {
  log("dynamic-port-forward: invalid policy JSON in args[0], skipping", {});
}

if (policy && policy.rules && policy.rules.length > 0) {

var now = Date.now();

// --- Detect data model ---
var tr181Test = declare("Device.DeviceInfo.Manufacturer", {value: now});
var isTR181 = tr181Test.size > 0;

var natBase;
if (isTR181) {
  // TR-181: Device.NAT.PortMapping
  natBase = "Device.NAT.PortMapping";
} else {
  // TR-098: WAN connection based PortMapping
  var wanType = policy.wanType || "ip";
  var wanConn;
  if (wanType === "ppp") {
    wanConn = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1";
  } else {
    wanConn = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1";
  }
  natBase = wanConn + ".PortMapping";
}

// Discover existing PortMapping instances
var existing = declare(natBase + ".*", {path: now});
var nextIdx = existing.size + 1;

for (var i = 0; i < policy.rules.length; i++) {
  var rule = policy.rules[i];
  if (!rule.externalPort || !rule.internalPort || !rule.internalClient) {
    log("dynamic-port-forward: rule " + i + " missing required fields, skipping", {});
    continue;
  }

  var rulePath = natBase + "." + nextIdx;
  declare(rulePath + ".PortMappingEnabled", {value: now}, {value: true});
  declare(rulePath + ".ExternalPort", {value: now}, {value: rule.externalPort});
  declare(rulePath + ".InternalPort", {value: now}, {value: rule.internalPort});
  declare(rulePath + ".InternalClient", {value: now}, {value: rule.internalClient});
  declare(rulePath + ".PortMappingProtocol", {value: now}, {value: rule.protocol || "TCP"});
  declare(rulePath + ".PortMappingDescription", {value: now}, {value: rule.description || ""});

  nextIdx++;
}

} else if (policy) {
  log("dynamic-port-forward: policy missing 'rules' array or empty", {});
}

} // end outer if(!args[0]) else block
