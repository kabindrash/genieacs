// Provision: nokia-alu-migration
// Bootstrap provision for migrating legacy ALU ONTs to GenieACS.
// Clears stale cached data and sets up periodic inform.
var now = Date.now();

// Clear stale cached data from previous ACS sessions
clear("InternetGatewayDevice", now);
clear("Device", now);

var manufacturer = declare("DeviceID.Manufacturer", {value: now});
var model = declare("DeviceID.ProductClass", {value: now});
var serial = declare("DeviceID.SerialNumber", {value: now});

var mfgVal = (manufacturer.value && manufacturer.value[0]) ? manufacturer.value[0] : "unknown";
var mdlVal = (model.value && model.value[0]) ? model.value[0] : "unknown";
var snVal = (serial.value && serial.value[0]) ? serial.value[0] : "unknown";

log("Migration: " + mfgVal + " " + mdlVal + " SN:" + snVal, {});

// Tag for tracking migration status
declare("Tags.migrated", null, {value: true});
declare("Tags.needs_config", null, {value: true});

// Set periodic inform to ensure ongoing management connectivity
// Detect data model for correct root path
var tr181Test = declare("Device.DeviceInfo.Manufacturer", {value: now});
var mgmtRoot = tr181Test.size > 0
  ? "Device.ManagementServer"
  : "InternetGatewayDevice.ManagementServer";
declare(mgmtRoot + ".PeriodicInformEnable", {value: now}, {value: true});
declare(mgmtRoot + ".PeriodicInformInterval", {value: now}, {value: 300});
