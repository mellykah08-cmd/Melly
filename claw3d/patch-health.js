const fs = require('node:fs');

// Versioned replacement for the SOFIA_HEALTH_PATCH_JS Railway variable:
// answer /healthz before the Studio access gate so Railway and the login proxy
// can probe the service without the studio_access cookie. Nothing else is
// exposed: every other path still goes through the gate.
const file = 'server/index.js';
const marker = 'SOFIA_HEALTHZ_BEFORE_GATE';
let text = fs.readFileSync(file, 'utf8');

if (text.includes(marker) || /["']\/healthz["']/.test(text)) {
  console.log('SOFIA_HEALTH_PATCH_SKIPPED: /healthz already handled');
  process.exit(0);
}

const gate = '          if (accessGate.handleHttp(req, res)) return;';
const count = text.split(gate).length - 1;
if (count !== 2) throw new Error(`health patch: expected 2 access gate call sites in ${file}, found ${count}`);

text = text.split(gate).join(
  '          if (resolvePathname(req.url) === "/healthz") { // ' + marker + '\n' +
  '            res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });\n' +
  '            res.end("ok");\n' +
  '            return;\n' +
  '          }\n' +
  gate,
);
fs.writeFileSync(file, text, 'utf8');
console.log('SOFIA_HEALTH_PATCH_OK: /healthz answered before access gate');
