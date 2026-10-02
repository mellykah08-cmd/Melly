const fs = require('node:fs');

function replaceOnce(file, from, to, label) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(from)) throw new Error(`SOFIA v3.0.1 anchor missing: ${label} in ${file}`);
  text = text.replace(from, to);
  fs.writeFileSync(file, text, 'utf8');
}

const retro = 'src/features/retro-office/RetroOffice3D.tsx';
{
  let text = fs.readFileSync(retro, 'utf8');
  const patterns = [
    'import { Component, type ReactNode } from "react";\n',
    'import { Component, ReactNode } from "react";\n',
    'import { Component } from "react";\n',
  ];
  const found = patterns.find((pattern) => text.includes(pattern));
  if (found) {
    text = text.replace(found, '');
    fs.writeFileSync(retro, text, 'utf8');
  } else {
    const componentImports = (text.match(/\bComponent\b/g) || []).length;
    if (componentImports < 1) throw new Error('SOFIA v3.0.1: Component import unavailable after v3.0');
    console.log('SOFIA v3.0.1: no standalone Component import to remove');
  }
}

const hud = 'src/features/sofia-ops/SofiaOpsHud.tsx';
replaceOnce(hud, '    const report = (kind, value) => {', '    const report = (kind: string, value: unknown) => {', 'type client error reporter');
replaceOnce(hud, '    const onError = (event) => report("error", event.error || event.message);', '    const onError = (event: ErrorEvent) => report("error", event.error || event.message);', 'type window error event');
replaceOnce(hud, '    const onRejection = (event) => report("unhandledrejection", event.reason);', '    const onRejection = (event: PromiseRejectionEvent) => report("unhandledrejection", event.reason);', 'type rejection event');

console.log('SOFIA_CHAIN: v3.0.1 import/type corrections applied');
