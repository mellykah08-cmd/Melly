const fs = require('node:fs');

function patchFile(file, edits) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [label, from, to] of edits) {
    if (!text.includes(from)) throw new Error(`SOFIA v2.9.1 anchor missing: ${label} in ${file}`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(file, text);
}

const hud = 'src/features/sofia-ops/SofiaOpsHud.tsx';
patchFile(hud, [
  [
    'pin mobile hud controls above overlays',
    `      <div className="pointer-events-auto absolute bottom-3 right-3 z-[80] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 font-mono">`,
    `      <div className="pointer-events-auto fixed bottom-[calc(12px+env(safe-area-inset-bottom))] right-3 z-[120] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 font-mono">`,
  ],
  [
    'demo button must never disappear because of world state',
    `        {!open && world.mode === "nominal" ? (`,
    `        {true ? (`,
  ],
  [
    'clearer demo label',
    `            ▶ DEMO ESPACIAL`,
    `            ▶ VER SISTEMA TRABALHANDO`,
  ],
]);

const spatial = 'src/features/sofia-ops/SofiaSpatialLayer.tsx';
patchFile(spatial, [
  [
    'make technical floors visible at idle without dynamic lights',
    `  const opacity = active ? 0.32 : 0.16;`,
    `  const opacity = active ? 0.58 : 0.34;`,
  ],
  [
    'add lightweight floor landmark',
    `  return (\n    <group position={[wx, 0.018, wz]}>\n      <mesh rotation={[-Math.PI / 2, 0, 0]}>`,
    `  return (\n    <group position={[wx, 0.018, wz]}>\n      <mesh position={[0, 0.18, 0]}>\n        <cylinderGeometry args={[1.0, 1.28, 0.34, Math.max(3, spec.segments)]} />\n        <meshBasicMaterial color={spec.color} transparent opacity={active ? 0.72 : 0.46} depthWrite={false} />\n      </mesh>\n      {Array.from({ length: Math.min(spec.segments, 6) }, (_, index) => {\n        const angle = (index / Math.min(spec.segments, 6)) * Math.PI * 2;\n        const r = spec.radius * 0.82;\n        return (\n          <mesh key={index} position={[Math.cos(angle) * r, 0.34, Math.sin(angle) * r]}>\n            <boxGeometry args={[0.16, active ? 0.66 : 0.42, 0.16]} />\n            <meshBasicMaterial color={spec.color} transparent opacity={active ? 0.82 : 0.52} depthWrite={false} />\n          </mesh>\n        );\n      })}\n      <mesh rotation={[-Math.PI / 2, 0, 0]}>`,
  ],
]);

console.log('SOFIA_CHAIN: v2.9.1 always-visible demo + distinct lightweight floor landmarks applied');
