const fs = require('node:fs');

const file = '/tmp/v22.js';
let text = fs.readFileSync(file, 'utf8');
const startAnchor = "write('src/features/sofia-ops/SofiaOpsHud.tsx', `";
const endAnchor = "\n`);\n\nconsole.log('SOFIA_OPS_MAX_V22_OK";
const start = text.indexOf(startAnchor);
if (start < 0) throw new Error('v22 HUD start anchor not found');
const contentStart = start + startAnchor.length;
const end = text.indexOf(endAnchor, contentStart);
if (end < 0) throw new Error('v22 HUD end anchor not found');
const repaired = text.slice(contentStart, end).replace(/`/g, '\\`');
text = text.slice(0, contentStart) + repaired + text.slice(end);
fs.writeFileSync(file, text, 'utf8');
console.log('SOFIA_V22_REPAIR_OK');
