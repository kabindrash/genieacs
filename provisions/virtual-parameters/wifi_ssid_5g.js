// Virtual Parameter: wifi_ssid_5g
// Vendor-agnostic read/write access to the 5GHz WiFi SSID.
// Discovers the 5GHz radio dynamically — no hardcoded instance numbers.
// Detects data model first (TR-181 vs TR-098) to avoid unnecessary RPCs.
const now = Date.now();
let m = "";

// --- Band classification for TR-098 ---
function classifyBand(chVal, possStr) {
  var ch = parseInt(chVal, 10) || 0;
  if (possStr) {
    var maxCh = 0;
    var parts = possStr.replace(/;/g, ",").split(",");
    for (var p = 0; p < parts.length; p++) {
      var seg = parts[p].trim();
      if (!seg) continue;
      var rp = seg.split("-");
      var val = parseInt(rp[rp.length - 1], 10) || 0;
      if (val > maxCh) maxCh = val;
    }
    if (maxCh > 177) return "6";
    if (maxCh > 14) return "5";
    if (maxCh > 0) return "2.4";
  }
  // Fallback: channel-only (6GHz channels 1-177 overlap; PossibleChannels above is authoritative)
  if (ch > 177) return "6";
  if (ch >= 36) return "5";
  if (ch > 0 && ch <= 14) return "2.4";
  return null;
}

// --- Detect data model ---
let tr181Test = declare("Device.DeviceInfo.Manufacturer", {value: now});
let isTR181 = tr181Test.size > 0;

if (isTR181) {
  // --- TR-181 discovery ---
  let found = null;
  let radios = declare("Device.WiFi.Radio.*", {path: now});
  for (let r of radios) {
    let fb = declare(r.path + ".OperatingFrequencyBand", {value: now});
    if (fb.value && fb.value[0] && (fb.value[0] === "5GHz" || (fb.value[0].indexOf("5") >= 0 && fb.value[0].indexOf("2") < 0 && fb.value[0].indexOf("6") < 0))) {
      found = r.path.split(".")[3];
      break;
    }
  }
  if (found) {
    let d = declare("Device.WiFi.SSID." + found + ".SSID", {value: now});
    if (args[1].value) {
      m = args[1].value[0];
      declare("Device.WiFi.SSID." + found + ".SSID", null, {value: m});
    } else {
      if (d.size) m = d.value[0];
    }
  }
} else {
  // --- TR-098 discovery ---
  let found = null;
  let wlans = declare("InternetGatewayDevice.LANDevice.1.WLANConfiguration.*", {path: now});
  for (let w of wlans) {
    let ch = declare(w.path + ".Channel", {value: now});
    let poss = declare(w.path + ".PossibleChannels", {value: now});
    let chVal = ch.value ? ch.value[0] : 0;
    let possStr = poss.value ? poss.value[0] : "";
    if (classifyBand(chVal, possStr) === "5") {
      found = w.path;
      break;
    }
  }
  if (found) {
    let igd = declare(found + ".SSID", {value: now});
    if (args[1].value) {
      m = args[1].value[0];
      declare(found + ".SSID", null, {value: m});
    } else {
      if (igd.size) m = igd.value[0];
    }
  }
}

return {writable: true, value: [m, "xsd:string"]};
