// Provision: huawei-voip
// Configure SIP VoIP service on Huawei ONTs.
//
// ===== EDIT THESE VALUES =====
const SIP_SERVER = "sip.isp.com";
const SIP_PORT = 5060;
const SIP_USER = "1001";
const SIP_PASS = "sippassword";
// =============================

const now = Date.now();
const voipBase = "InternetGatewayDevice.Services.VoiceService.1.VoiceProfile.1";

declare(voipBase + ".SIP.ProxyServer", {value: now}, {value: SIP_SERVER});
declare(voipBase + ".SIP.ProxyServerPort", {value: now}, {value: SIP_PORT});
declare(voipBase + ".SIP.RegistrarServer", {value: now}, {value: SIP_SERVER});
declare(voipBase + ".SIP.RegistrarServerPort", {value: now}, {value: SIP_PORT});

declare(voipBase + ".Line.1.Enable", {value: now}, {value: "Enabled"});
declare(voipBase + ".Line.1.SIP.AuthUserName", {value: now}, {value: SIP_USER});
declare(voipBase + ".Line.1.SIP.AuthPassword", {value: now}, {value: SIP_PASS});
declare(voipBase + ".Line.1.SIP.URI", {value: now}, {value: SIP_USER});
