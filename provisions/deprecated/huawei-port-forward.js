// Provision: huawei-port-forward
// Add a port forwarding rule on Huawei ONTs.
// Works with WANIPConnection (DHCP WAN). For PPPoE, use WANPPPConnection path.
//
// ===== EDIT THESE VALUES =====
const EXTERNAL_PORT = 8080;
const INTERNAL_PORT = 80;
const INTERNAL_CLIENT = "192.168.1.100";
const PROTOCOL = "TCP";
const DESCRIPTION = "Web Server";
// =============================

const now = Date.now();
const natBase = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1" +
  ".WANIPConnection.1.PortMapping";

let rules = declare(natBase + ".*", {path: now});
let nextIdx = rules.size + 1;

let rulePath = natBase + "." + nextIdx;
declare(rulePath + ".PortMappingEnabled", {value: now}, {value: true});
declare(rulePath + ".PortMappingProtocol", {value: now}, {value: PROTOCOL});
declare(rulePath + ".ExternalPort", {value: now}, {value: EXTERNAL_PORT});
declare(rulePath + ".InternalPort", {value: now}, {value: INTERNAL_PORT});
declare(rulePath + ".InternalClient", {value: now}, {value: INTERNAL_CLIENT});
declare(rulePath + ".PortMappingDescription", {value: now}, {value: DESCRIPTION});
