// Provision: nokia-auto-tag
// Auto-tag Nokia/ALU devices on first connect.
const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let productClass = declare("DeviceID.ProductClass", {value: now});

if (manufacturer.value[0].indexOf("ALCL") >= 0 || manufacturer.value[0].indexOf("Nokia") >= 0) {
  declare("Tags.nokia", null, {value: true});

  let model = productClass.value[0];
  if (model) {
    declare("Tags." + model.replace(/-/g, "_"), null, {value: true});
  }

  // Detect and tag data model
  let dev = declare("Device.DeviceInfo.Manufacturer", {value: now});
  if (dev.size) {
    declare("Tags.tr181", null, {value: true});
  } else {
    declare("Tags.tr098", null, {value: true});
  }
}
