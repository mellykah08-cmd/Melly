const fs = require('node:fs');

const file = 'server/gateway-proxy.js';
const text = fs.readFileSync(file, 'utf8');

const from = `        if (isObject(connectParams.device)) delete connectParams.device;\n      }\n\n      const hasDeviceAuth = hasCompleteDeviceAuth(connectParams);`;

const to = `        if (isObject(connectParams.device)) delete connectParams.device;\n\n        // The proxy itself is the trusted OpenClaw Control UI client once the\n        // browser has passed Studio authentication. Mirror the official Control\n        // UI role/scope request instead of forwarding an empty/stale browser grant.\n        connectParams.role = "operator";\n        connectParams.scopes = [\n          "operator.admin",\n          "operator.read",\n          "operator.write",\n          "operator.approvals",\n          "operator.questions",\n          "operator.pairing",\n        ];\n      }\n\n      const hasDeviceAuth = hasCompleteDeviceAuth(connectParams);`;

const first = text.indexOf(from);
if (first < 0) {
  throw new Error(`SOFIA v3.5 anchor missing in ${file}`);
}
if (text.indexOf(from, first + 1) >= 0) {
  throw new Error(`SOFIA v3.5 anchor not unique in ${file}`);
}

fs.writeFileSync(file, text.slice(0, first) + to + text.slice(first + from.length), 'utf8');
console.log('SOFIA_CHAIN: v3.5 canonical OpenClaw operator role/scopes applied');
