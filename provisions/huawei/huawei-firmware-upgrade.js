// Provision: huawei-firmware-upgrade
// Pre/post firmware upgrade checks for Huawei ONTs.
// The actual firmware download is triggered via the NBI task API.
const now = Date.now();

let currentFW = declare(
  "InternetGatewayDevice.DeviceInfo.SoftwareVersion",
  {value: now}
);
log("Current firmware: " + currentFW.value[0]);

let model = declare("DeviceID.ProductClass", {value: now});
log("Device model: " + model.value[0]);

let hwVersion = declare(
  "InternetGatewayDevice.DeviceInfo.HardwareVersion",
  {value: now}
);
log("Hardware version: " + hwVersion.value[0]);
