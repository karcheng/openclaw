
import { buildDeviceAuthPayloadV3 } from "../src/gateway/device-auth.js";

const deviceId = "test-device";
const clientId = "gateway-client";
const clientMode = "ui";
const role = "operator";
const scopes = ["operator.admin"];
const signedAtMs = 1700000000000;
const token = "1ca31bdc34964464d5c581e191be7a419a7a7f5a3b765556";
const nonce = "test-nonce";
const platform = "win32";
const deviceFamily = undefined;

const payloadV3 = buildDeviceAuthPayloadV3({
  deviceId,
  clientId,
  clientMode,
  role,
  scopes,
  signedAtMs,
  token,
  nonce,
  platform,
  deviceFamily,
});

console.log("Payload:", payloadV3);
