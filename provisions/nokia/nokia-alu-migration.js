// Provision: nokia-alu-migration
// Bootstrap provision for migrating legacy ALU ONTs to GenieACS.
// Clears stale cached data and sets up periodic inform.
const now = Date.now();

// Clear stale cached data from previous ACS sessions
clear("InternetGatewayDevice", now);
clear("Device", now);

let manufacturer = declare("DeviceID.Manufacturer", {value: now});
let model = declare("DeviceID.ProductClass", {value: now});
let serial = declare("DeviceID.SerialNumber", {value: now});

log("Migration: " + manufacturer.value[0] + " " + model.value[0] + " SN:" + serial.value[0]);

// Tag for tracking migration status
declare("Tags.migrated", null, {value: true});
declare("Tags.needs_config", null, {value: true});

// Set periodic inform to ensure ongoing management connectivity
declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", {value: now}, {value: true});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", {value: now}, {value: 300});
