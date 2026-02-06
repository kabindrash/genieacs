// Virtual Parameter: optical_rx_power
// Read-only: returns GPON optical RX power across ZTE and Nokia.
// Huawei does not expose standard optical monitoring via TR-069.
const now = Date.now();
let m = "";

// ZTE
let zte = declare(
  "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.RxPower",
  {value: now}
);

// Nokia (TR-098)
let nokia098 = declare(
  "InternetGatewayDevice.X_ALU_COM.OntOpticalParam.RxPower",
  {value: now}
);

// Nokia (TR-181)
let nokia181 = declare(
  "Device.X_ALU_COM.OntOpticalParam.RxPower",
  {value: now}
);

if (zte.size && zte.value[0]) m = zte.value[0];
else if (nokia098.size && nokia098.value[0]) m = nokia098.value[0];
else if (nokia181.size && nokia181.value[0]) m = nokia181.value[0];

return {writable: false, value: [m, "xsd:string"]};
