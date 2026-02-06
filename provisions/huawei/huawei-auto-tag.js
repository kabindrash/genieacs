// Provision: huawei-auto-tag
// Auto-tag Huawei devices on first connect (bootstrap event).
const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let productClass = declare("DeviceID.ProductClass", {value: now});

if (manufacturer.value[0].indexOf("Huawei") >= 0) {
  declare("Tags.huawei", null, {value: true});

  let model = productClass.value[0];
  if (model) {
    declare("Tags." + model.replace(/[^a-zA-Z0-9]/g, "_"), null, {value: true});
  }
}
