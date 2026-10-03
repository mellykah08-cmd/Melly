const fs=require("node:fs");
const f="server/gateway-proxy.js";
let s=fs.readFileSync(f,"utf8");
const marker="SOFIA_V36_PROXY_DEVICE";
if(s.includes(marker)){
  console.log("SOFIA_CHAIN: v3.6 proxy device already present");
  process.exit(0);
}
function rep(from,to,label){
  const i=s.indexOf(from);
  if(i<0||s.indexOf(from,i+1)>=0) throw new Error("SOFIA v3.6 anchor missing/non-unique: "+label);
  s=s.slice(0,i)+to+s.slice(i+from.length);
}
rep(
`    let pendingUpstreamSetupError = null;\n    let closed = false;`,
`    let pendingUpstreamSetupError = null;\n    let upstreamConnectNonce = "";\n    let upstreamConnectChallengeTs = 0;\n    let closed = false;`,
"connection challenge state"
);
rep(
`        const upParsed = safeJsonParse(String(upRaw ?? ""));\n        if (upParsed && isObject(upParsed) && upParsed.type === "res") {`,
`        const upParsed = safeJsonParse(String(upRaw ?? ""));\n        if (\n          upParsed &&\n          isObject(upParsed) &&\n          upParsed.type === "event" &&\n          upParsed.event === "connect.challenge" &&\n          isObject(upParsed.payload)\n        ) {\n          upstreamConnectNonce =\n            typeof upParsed.payload.nonce === "string" ? upParsed.payload.nonce.trim() : "";\n          const challengeTs = Number(upParsed.payload.ts);\n          upstreamConnectChallengeTs = Number.isFinite(challengeTs) ? challengeTs : 0;\n        }\n        if (upParsed && isObject(upParsed) && upParsed.type === "res") {`,
"capture upstream challenge"
);
rep(
`        if (isObject(connectParams.device)) delete connectParams.device;\n      }\n\n      const hasDeviceAuth = hasCompleteDeviceAuth(connectParams);`,
`        if (isObject(connectParams.device)) delete connectParams.device;\n\n        // SOFIA_V36_PROXY_DEVICE\n        // The Studio owns the upstream secret, so it owns a stable Ed25519\n        // device identity and signs the exact normalized upstream payload.\n        const seedHex = String(process.env.SOFIA_PROXY_DEVICE_SEED || "").trim();\n        if (!/^[0-9a-f]{64}$/i.test(seedHex)) {\n          sendConnectError(\n            "studio.proxy_device_seed_invalid",\n            "Studio proxy device identity is not configured."\n          );\n          return;\n        }\n        if (!upstreamConnectNonce || !Number.isFinite(upstreamConnectChallengeTs) || upstreamConnectChallengeTs <= 0) {\n          sendConnectError(\n            "studio.proxy_device_challenge_missing",\n            "OpenClaw connect challenge is not available."\n          );\n          return;\n        }\n\n        const crypto = require("node:crypto");\n        const seed = Buffer.from(seedHex, "hex");\n        const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");\n        const privateKey = crypto.createPrivateKey({\n          key: Buffer.concat([pkcs8Prefix, seed]),\n          format: "der",\n          type: "pkcs8",\n        });\n        const spki = crypto.createPublicKey(privateKey).export({ format: "der", type: "spki" });\n        const rawPublicKey = Buffer.from(spki).subarray(-32);\n        const deviceId = crypto.createHash("sha256").update(rawPublicKey).digest("hex");\n        const publicKey = rawPublicKey.toString("base64url");\n        const scopes = [\n          "operator.admin",\n          "operator.read",\n          "operator.write",\n          "operator.approvals",\n          "operator.questions",\n          "operator.pairing",\n        ];\n        const client = isObject(connectParams.client) ? { ...connectParams.client } : {};\n        client.id = "webchat-ui";\n        client.mode = "webchat";\n        client.version =\n          typeof client.version === "string" && client.version.trim()\n            ? client.version\n            : "sofia-proxy-v3.6";\n        connectParams.client = client;\n        connectParams.role = "operator";\n        connectParams.scopes = scopes;\n\n        const signedAt = upstreamConnectChallengeTs;\n        const payload = [\n          "v2",\n          deviceId,\n          client.id,\n          client.mode,\n          connectParams.role,\n          scopes.join(","),\n          String(signedAt),\n          upstreamToken,\n          upstreamConnectNonce,\n        ].join("|");\n        connectParams.device = {\n          id: deviceId,\n          publicKey,\n          signature: crypto.sign(null, Buffer.from(payload, "utf8"), privateKey).toString("base64url"),\n          signedAt,\n          nonce: upstreamConnectNonce,\n        };\n      }\n\n      const hasDeviceAuth = hasCompleteDeviceAuth(connectParams);`,
"server-owned paired device"
);
fs.writeFileSync(f,s,"utf8");
console.log("SOFIA_CHAIN: v3.6 paired proxy device patch applied");
