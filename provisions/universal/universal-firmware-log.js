// Provision: universal-firmware-log
// Log firmware information for inventory tracking across all vendors.
// Reads device identity and firmware version from both data model roots.
const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let productClass = declare("DeviceID.ProductClass", {value: now});
let serial = declare("DeviceID.SerialNumber", {value: now});

// Try both data model roots for firmware version
let fw098 = declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: now});
let fw181 = declare("Device.DeviceInfo.SoftwareVersion", {value: now});

let fw = "";
if (fw181.size && fw181.value[0]) fw = fw181.value[0];
else if (fw098.size && fw098.value[0]) fw = fw098.value[0];

log("Inventory: " + manufacturer.value[0] + " " + productClass.value[0] +
    " SN:" + serial.value[0] + " FW:" + fw);
