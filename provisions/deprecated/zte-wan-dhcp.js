// Provision: zte-wan-dhcp
// Configure DHCP WAN connection on ZTE ONTs.
const now = Date.now();
const connPath = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1";

declare(connPath + ".WANIPConnection.1.Enable", {value: now}, {value: true});
declare(connPath + ".WANIPConnection.1.ConnectionType", {value: now}, {value: "IP_Routed"});
declare(connPath + ".WANIPConnection.1.AddressingType", {value: now}, {value: "DHCP"});
