// Provision: universal-firmware-log
// Log firmware information for inventory tracking across all vendors.
// Reads device identity and firmware version from both data model roots.
var now = Date.now();
var manufacturer = declare("DeviceID.Manufacturer", {value: now});
var productClass = declare("DeviceID.ProductClass", {value: now});
var serial = declare("DeviceID.SerialNumber", {value: now});

// Try both data model roots for firmware version
var fw098 = declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: now});
var fw181 = declare("Device.DeviceInfo.SoftwareVersion", {value: now});

var fw = "";
if (fw181.size && fw181.value && fw181.value[0]) fw = fw181.value[0];
else if (fw098.size && fw098.value && fw098.value[0]) fw = fw098.value[0];

var mfgVal = (manufacturer.value && manufacturer.value[0]) ? manufacturer.value[0] : "unknown";
var pcVal = (productClass.value && productClass.value[0]) ? productClass.value[0] : "unknown";
var snVal = (serial.value && serial.value[0]) ? serial.value[0] : "unknown";

log("Inventory: " + mfgVal + " " + pcVal + " SN:" + snVal + " FW:" + fw, {});
