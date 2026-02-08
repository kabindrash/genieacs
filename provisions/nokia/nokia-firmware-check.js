// Provision: nokia-firmware-check
// Read and log current firmware version for staged rollout tracking.
// Tag devices by firmware version prefix for group-based upgrades.
var now = Date.now();
var currentFW = declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: now});

if (!currentFW.size) {
  currentFW = declare("Device.DeviceInfo.SoftwareVersion", {value: now});
}

var model = declare("DeviceID.ProductClass", {value: now});

var mdlVal = (model.value && model.value[0]) ? model.value[0] : "unknown";
var fwVal = (currentFW.value && currentFW.value[0]) ? currentFW.value[0] : "";

log("Nokia " + mdlVal + " firmware: " + fwVal, {});

// Tag based on firmware version prefix for staged rollout
// Nokia firmware follows 3FE{xxxxx}{xxx}{yy} format
if (fwVal && fwVal.length >= 10 && fwVal.indexOf("3FE") === 0) {
  declare("Tags.nokia_firmware_" + fwVal.substring(0, 10), null, {value: true});
}
