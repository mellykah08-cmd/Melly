const fs = require('node:fs');

const file = 'server/studio-settings.js';
let text = fs.readFileSync(file, 'utf8');
const marker = 'SOFIA_V361_ENV_GATEWAY_SETTINGS';

if (text.includes(marker)) {
  console.log('SOFIA_CHAIN: v3.6.1 env gateway settings already present');
  process.exit(0);
}

const from = `const loadUpstreamGatewaySettings = (env = process.env) => {\n  const settingsPath = resolveStudioSettingsPath(env);`;
const to = `const loadUpstreamGatewaySettings = (env = process.env) => {\n  const settingsPath = resolveStudioSettingsPath(env);\n\n  // SOFIA_V361_ENV_GATEWAY_SETTINGS\n  // In Railway the Studio and Gateway are separate services. Server-owned env\n  // credentials are authoritative and must never silently fall back to localhost.\n  const envUrl = typeof env.CLAW3D_GATEWAY_URL === "string" ? env.CLAW3D_GATEWAY_URL.trim() : "";\n  const envToken = typeof env.CLAW3D_GATEWAY_TOKEN === "string" ? env.CLAW3D_GATEWAY_TOKEN.trim() : "";\n  const envAdapterType =\n    typeof env.CLAW3D_GATEWAY_ADAPTER_TYPE === "string" && env.CLAW3D_GATEWAY_ADAPTER_TYPE.trim()\n      ? env.CLAW3D_GATEWAY_ADAPTER_TYPE.trim()\n      : "openclaw";\n\n  if (envUrl || envToken) {\n    if (!envUrl || !envToken) {\n      throw new Error("Incomplete server-owned Claw3D gateway configuration.");\n    }\n    return {\n      url: envUrl,\n      token: envToken,\n      adapterType: envAdapterType,\n      settingsPath,\n    };\n  }`;

const index = text.indexOf(from);
if (index < 0 || text.indexOf(from, index + 1) >= 0) {
  throw new Error(`SOFIA v3.6.1 settings anchor missing/non-unique in ${file}`);
}

text = text.slice(0, index) + to + text.slice(index + from.length);
fs.writeFileSync(file, text, 'utf8');
console.log('SOFIA_CHAIN: v3.6.1 Railway gateway settings made authoritative');
