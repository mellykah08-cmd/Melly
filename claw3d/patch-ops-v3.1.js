const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

const hud = 'src/features/sofia-ops/SofiaOpsHud.tsx';
let h = read(hud);
const autoBlock = `  const selectFloorRef = useRef(onSelectFloor);\n  useEffect(() => { selectFloorRef.current = onSelectFloor; }, [onSelectFloor]);\n  useEffect(() => {\n    if (!view.autoFollow || view.replay.active || !focusFloorElsewhere) return;\n    const timer = window.setTimeout(() => selectFloorRef.current?.(focusFloorElsewhere), 420);\n    return () => window.clearTimeout(timer);\n  }, [view.autoFollow, view.replay.active, focusFloorElsewhere]);\n`;
if (!h.includes(autoBlock)) throw new Error('SOFIA v3.1: forced floor-follow block not found');
h = h.replace(autoBlock, '');
h = h.replace('import { useEffect, useMemo, useRef, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";');
h = h.split('AUTOMÁTICO LIGADO').join('FOCO GUIADO');
h = h.split('AUTOMÁTICO DESLIGADO').join('FOCO LIVRE');
write(hud, h);

const office = 'src/features/office/screens/OfficeScreen.tsx';
let o = read(office);
const keyed = '        <RetroOffice3D\n          key={activeFloor.id}\n';
if (!o.includes(keyed)) throw new Error('SOFIA v3.1: keyed RetroOffice3D mount not found');
o = o.replace(keyed, '        <RetroOffice3D\n');
write(office, o);

console.log('SOFIA_CHAIN: v3.1 manual spatial focus + stable single Canvas across floor navigation applied');
