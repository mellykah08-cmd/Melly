const fs = require('node:fs');

function patchFile(file, edits) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [label, from, to] of edits) {
    if (!text.includes(from)) throw new Error(`SOFIA v2.9 anchor missing: ${label} in ${file}`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(file, text);
}

const spatial = 'src/features/sofia-ops/SofiaSpatialLayer.tsx';
patchFile(spatial, [
  [
    'remove expensive dynamic point light',
    `  return (\n    <>\n      <ambientLight ref={ambient} intensity={0.72} color="#d8d4c8" />\n      <pointLight ref={point} position={[0, 4.2, -9.5]} intensity={0} distance={22} decay={1.4} color="#ffffff" />\n    </>\n  );`,
    `  // Keep world-state tinting but avoid a scene-wide dynamic PointLight.\n  // Even at intensity 0, a mounted PointLight expands the lighting shader path\n  // for the whole scene on mobile GPUs. War Room/Shadow already have cheap\n  // meshBasicMaterial beacons, so the semantic signal remains visible.\n  return <ambientLight ref={ambient} intensity={0.72} color="#d8d4c8" />;`,
  ],
  [
    'hide idle 3d station labels',
    `      ) : remote ? null : (\n        <Label y={0.1} size={0.13} color="#94a3b8" text={ZONE_LABEL[zone].toUpperCase()} />\n      )}`,
    `      ) : null}`,
  ],
  [
    'hide idle project towers',
    `  const count = world.projects.length;\n  if (count === 0) return null;`,
    `  const count = world.projects.length;\n  // Towers are an activity signal, not permanent decoration. Keeping them out\n  // of the nominal frame removes meshes + Troika text from the mobile idle path.\n  if (count === 0 || (world.mode === "nominal" && world.projects.every((project) => !project.incident && project.recentCount === 0))) return null;`,
  ],
  [
    'inject lightweight floor signature',
    `export function SofiaSpatialLayer({`,
    `const FLOOR_SIGNATURE: Partial<Record<SofiaFloorId, { color: string; segments: number; radius: number }>> = {\n  "audit-second": { color: "#f59e0b", segments: 4, radius: 3.4 },\n  "dev-third": { color: "#22d3ee", segments: 8, radius: 3.0 },\n  "infra-fourth": { color: "#3b82f6", segments: 6, radius: 3.8 },\n  "intel-fifth": { color: "#34d399", segments: 3, radius: 3.2 },\n  "command-sixth": { color: "#ef4444", segments: 6, radius: 4.2 },\n};\n\nfunction FloorSignature({ floorId, mode }: { floorId: SofiaFloorId; mode: WorldState["mode"] }) {\n  const spec = FLOOR_SIGNATURE[floorId];\n  if (!spec) return null; // first floor remains visually untouched\n  const [wx, , wz] = toWorld(900, 420);\n  const active = mode !== "nominal" && mode !== "working";\n  const opacity = active ? 0.32 : 0.16;\n  return (\n    <group position={[wx, 0.018, wz]}>\n      <mesh rotation={[-Math.PI / 2, 0, 0]}>\n        <ringGeometry args={[spec.radius, spec.radius + 0.18, spec.segments]} />\n        <meshBasicMaterial color={spec.color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />\n      </mesh>\n      <mesh rotation={[-Math.PI / 2, Math.PI / Math.max(3, spec.segments), 0]}>\n        <ringGeometry args={[spec.radius * 0.72, spec.radius * 0.72 + 0.08, spec.segments]} />\n        <meshBasicMaterial color={spec.color} transparent opacity={opacity * 0.55} depthWrite={false} side={THREE.DoubleSide} />\n      </mesh>\n    </group>\n  );\n}\n\nexport function SofiaSpatialLayer({`,
  ],
  [
    'render floor signature',
    `      <AlertLighting world={world} replay={view.replay.active} />\n      <SpatialProbe lookupRef={agentLookupRef} orbitRef={orbitRef} anchors={anchors} />`,
    `      <AlertLighting world={world} replay={view.replay.active} />\n      {floorId ? <FloorSignature floorId={floorId} mode={world.mode} /> : null}\n      <SpatialProbe lookupRef={agentLookupRef} orbitRef={orbitRef} anchors={anchors} />`,
  ],
]);

const hud = 'src/features/sofia-ops/SofiaOpsHud.tsx';
patchFile(hud, [
  [
    'quick spatial demo button',
    `      <div className="pointer-events-auto absolute bottom-3 right-3 z-[80] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 font-mono">\n        {open ? (`,
    `      <div className="pointer-events-auto absolute bottom-3 right-3 z-[80] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 font-mono">\n        {!open && world.mode === "nominal" ? (\n          <button\n            type="button"\n            data-testid="sofia-quick-demo"\n            onClick={() => void fire({ scenario: "full" })}\n            className="rounded-full border border-violet-400/45 bg-violet-950/90 px-3 py-2 text-[10px] font-bold tracking-[0.12em] text-violet-100 shadow-xl"\n          >\n            ▶ DEMO ESPACIAL\n          </button>\n        ) : null}\n        {open ? (`,
  ],
]);

console.log('SOFIA_CHAIN: v2.9 performance + visible spatial demo applied');
