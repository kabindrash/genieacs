// Provision: universal-auto-tag
// Auto-tag any vendor ONT on bootstrap event.
// Detects Huawei, ZTE, and Nokia/ALCL manufacturers.
// Nokia devices also get data model tags (tr098/tr181).
const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let productClass = declare("DeviceID.ProductClass", {value: now});
let mfg = manufacturer.value[0];

// Vendor detection and tagging
if (mfg.indexOf("Huawei") >= 0) {
  declare("Tags.huawei", null, {value: true});
  declare("Tags.vendor_huawei", null, {value: true});
} else if (mfg.indexOf("ZTE") >= 0) {
  declare("Tags.zte", null, {value: true});
  declare("Tags.vendor_zte", null, {value: true});
} else if (mfg.indexOf("ALCL") >= 0 || mfg.indexOf("Nokia") >= 0) {
  declare("Tags.nokia", null, {value: true});
  declare("Tags.vendor_nokia", null, {value: true});

  // Nokia-specific: detect data model
  let tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});
  if (tr181.size) {
    declare("Tags.tr181", null, {value: true});
  } else {
    declare("Tags.tr098", null, {value: true});
  }
}

// Model-specific tag (all vendors)
let model = productClass.value[0];
if (model) {
  declare("Tags." + model.replace(/[^a-zA-Z0-9]/g, "_"), null, {value: true});
}
