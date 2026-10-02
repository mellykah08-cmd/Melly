const fs = require('node:fs');
const file = 'src/features/sofia-ops/SofiaOpsHud.tsx';
let text = fs.readFileSync(file, 'utf8');
if (!text.includes('state.ownerAgentId')) throw new Error('SOFIA v3.2.1: ownerAgentId anchor missing');
text = text.split('state.ownerAgentId').join('state.owner');
fs.writeFileSync(file, text, 'utf8');
console.log('SOFIA_CHAIN: v3.2.1 real zone owner field applied');
