// Provision: huawei-firmware-upgrade
// Pre/post firmware upgrade checks for Huawei ONTs.
// The actual firmware download is triggered via the NBI task API.
var now = Date.now();

var currentFW = declare(
  "InternetGatewayDevice.DeviceInfo.SoftwareVersion",
  {value: now}
);
var fwVal = (currentFW.value && currentFW.value[0]) ? currentFW.value[0] : "unknown";
log("Current firmware: " + fwVal, {});

var model = declare("DeviceID.ProductClass", {value: now});
var mdlVal = (model.value && model.value[0]) ? model.value[0] : "unknown";
log("Device model: " + mdlVal, {});

var hwVersion = declare(
  "InternetGatewayDevice.DeviceInfo.HardwareVersion",
  {value: now}
);
var hwVal = (hwVersion.value && hwVersion.value[0]) ? hwVersion.value[0] : "unknown";
log("Hardware version: " + hwVal, {});
