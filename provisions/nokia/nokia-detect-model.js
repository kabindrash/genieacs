// Provision: nokia-detect-model
// Detect whether Nokia ONT uses TR-098 or TR-181 data model.
// Apply as a bootstrap provision (0 BOOTSTRAP) for all Nokia devices.
const now = Date.now();

// Try TR-181 first (Device root)
let tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});
let tr098 = declare("InternetGatewayDevice.DeviceInfo.Manufacturer", {value: now});

let root = "";
if (tr181.size) {
  root = "Device";
  declare("Tags.tr181", null, {value: true});
  declare("Tags.tr098", null, {value: false});
} else if (tr098.size) {
  root = "InternetGatewayDevice";
  declare("Tags.tr098", null, {value: true});
  declare("Tags.tr181", null, {value: false});
}

log("Nokia data model root: " + root);
