const fs = require('node:fs');

function replaceOnce(file, from, to, label) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(from)) throw new Error(`SOFIA v3.0.1 anchor missing: ${label} in ${file}`);
  text = text.replace(from, to);
  fs.writeFileSync(file, text, 'utf8');
}

const retro = 'src/features/retro-office/RetroOffice3D.tsx';
replaceOnce(
  retro,
  'import { Component } from "react";\n',
  '',
  'dedupe existing Component import',
);

const hud = 'src/features/sofia-ops/SofiaOpsHud.tsx';
replaceOnce(hud, '    const report = (kind, value) => {', '    const report = (kind: string, value: unknown) => {', 'type client error reporter');
replaceOnce(hud, '    const onError = (event) => report("error", event.error || event.message);', '    const onError = (event: ErrorEvent) => report("error", event.error || event.message);', 'type window error event');
replaceOnce(hud, '    const onRejection = (event) => report("unhandledrejection", event.reason);', '    const onRejection = (event: PromiseRejectionEvent) => report("unhandledrejection", event.reason);', 'type rejection event');

console.log('SOFIA_CHAIN: v3.0.1 import/type corrections applied');
