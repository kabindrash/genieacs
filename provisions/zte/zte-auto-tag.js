// Provision: zte-auto-tag
// Auto-tag ZTE devices on first connect.
const now = Date.now();
let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let productClass = declare("DeviceID.ProductClass", {value: now});

if (manufacturer.value[0].indexOf("ZTE") >= 0) {
  declare("Tags.zte", null, {value: true});
  let model = productClass.value[0];
  if (model) {
    declare("Tags." + model.replace(/[^a-zA-Z0-9]/g, "_"), null, {value: true});
  }

  // Detect vendor prefix variant for downstream provisions
  let gpon = declare("InternetGatewayDevice.WANDevice.1.X_ZTE-COM_GponInterfaceConfig.*", {path: now});
  if (gpon.size) {
    declare("Tags.zte_hyphen_prefix", null, {value: true});
  }
}
