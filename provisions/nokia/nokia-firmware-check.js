// Provision: nokia-firmware-check
// Read and log current firmware version for staged rollout tracking.
// Tag devices by firmware version prefix for group-based upgrades.
const now = Date.now();
let currentFW = declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: now});

if (!currentFW.size) {
  currentFW = declare("Device.DeviceInfo.SoftwareVersion", {value: now});
}

let model = declare("DeviceID.ProductClass", {value: now});

log("Nokia " + model.value[0] + " firmware: " + currentFW.value[0]);

// Tag based on firmware version prefix for staged rollout
// Nokia firmware follows 3FE{xxxxx}{xxx}{yy} format
if (currentFW.value[0] && currentFW.value[0].indexOf("3FE") === 0) {
  declare("Tags.nokia_firmware_" + currentFW.value[0].substring(0, 10), null, {value: true});
}
