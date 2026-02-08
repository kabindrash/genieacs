// Provision: universal-auto-tag
// Auto-tag any vendor ONT on periodic/bootstrap events.
// Uses alias map for extensible vendor detection — add new vendors with one line.
// Detects data model (TR-098/TR-181) for ALL vendors, not just Nokia.

// -- VENDOR ALIAS MAP --
// To add a new vendor: add one entry here. No other code changes needed.
var VENDOR_ALIASES = {
  "huawei": "huawei",
  "zte": "zte",
  "nokia": "nokia",
  "alcl": "nokia",
  "alu": "nokia",
  "fiberhome": "fiberhome",
  "tp-link": "tplink",
  "dasan": "dasan"
};

const now = Date.now();
var manufacturer = declare("DeviceID.Manufacturer", {value: now});
var productClass = declare("DeviceID.ProductClass", {value: now});
var mfg = (manufacturer.value[0] || "").toLowerCase();

// Find matching vendor from alias map
var vendorTag = null;
var keys = Object.keys(VENDOR_ALIASES);
for (var i = 0; i < keys.length; i++) {
  if (mfg.indexOf(keys[i]) >= 0) {
    vendorTag = VENDOR_ALIASES[keys[i]];
    break;
  }
}

// Apply vendor tag
if (vendorTag) {
  declare("Tags." + vendorTag, null, {value: true});
  declare("Tags.vendor_" + vendorTag, null, {value: true});
}

// Data model detection (ALL vendors, not just Nokia)
var tr181 = declare("Device.DeviceInfo.Manufacturer", {value: now});
if (tr181.size) {
  declare("Tags.tr181", null, {value: true});
} else {
  declare("Tags.tr098", null, {value: true});
}

// Model-specific tag (all vendors)
var model = productClass.value[0];
if (model) {
  declare("Tags." + model.replace(/[^a-zA-Z0-9]/g, "_"), null, {value: true});
}
