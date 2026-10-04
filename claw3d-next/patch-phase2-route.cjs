'use strict';
const fs = require('node:fs');
const path = require('node:path');
if (process.env.SOFIA_THIRD_FLOOR_TELEMETRY !== '1') {
  console.log('SOFIA_PHASE2_ROUTE_R1: disabled'); process.exit(0);
}
const marker = 'SOFIA_PHASE2_ROUTE_R1';
const files = {
  scene: 'src/features/retro-office/RetroOffice3D.tsx',
  model: 'src/features/retro-office/objects/agents.tsx',
  types: 'src/features/retro-office/core/types.ts',
  loop: 'src/features/retro-office/systems/sceneRuntime.tsx',
  spatial: 'src/features/sofia-ops/SofiaSpatialLayer.tsx',
  collision: 'src/features/retro-office/systems/NavigationSystem.tsx',
};
const original = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const changed = { ...original };
function replace(key, anchor, replacement) {
  if (changed[key].split(anchor).length !== 2) throw Error(`${marker}: missing/nonunique ${key} anchor: ${anchor.slice(0, 80)}`);
  changed[key] = changed[key].replace(anchor, replacement);
}
const applied = Object.values(original).filter(text => text.includes(marker)).length;
if (applied !== 0 && applied !== Object.keys(files).length) throw Error(`${marker}: partial installation; rebuild from the pinned base`);
if (!applied) {
  if (!original.scene.includes('SOFIA_THIRD_FLOOR_DIRECTOR')) throw Error(`${marker}: third floor director must be installed first`);
  replace('scene', '"use client";', `"use client";\n// ${marker}\nimport { planThirdFloorRoute, advanceThirdFloorRoute } from "@/features/sofia-ops/ThirdFloorRoute";\nimport { thirdFloorDirector } from "@/features/sofia-ops/ThirdFloorDirector";`);
  replace('scene', '  sofiaDeskHoldByAgentId: Record<string, boolean> = EMPTY_BOOLEAN_RECORD,\n)', '  sofiaDeskHoldByAgentId: Record<string, boolean> = EMPTY_BOOLEAN_RECORD,\n  sofiaUpperFurniture: FurnitureItem[] = EMPTY_FURNITURE_ITEMS,\n)');
  replace('scene', '              ns.path.length === 0 &&\n              Math.hypot(existing.x - sofiaTarget.x, existing.y - sofiaTarget.y) > 30', '              !(sofiaTarget.x === 1390 && sofiaTarget.y === 1710) && !existing.sofiaThirdFloorRoute &&\n              ns.path.length === 0 &&\n              Math.hypot(existing.x - sofiaTarget.x, existing.y - sofiaTarget.y) > 30');
  replace('scene', '      next.push({ ...agent, ...ns, status: effectiveStatus } as RenderAgent);', `      const thirdFloorTarget = sofiaTarget?.x === 1390 && sofiaTarget?.y === 1710;
      if (!agent.id.startsWith("remote:") && (thirdFloorTarget || existing?.sofiaThirdFloorRoute)) {
        const start = existing ?? ns;
        const tx = ns.targetX ?? existing?.targetX ?? start.x!;
        const ty = ns.targetY ?? existing?.targetY ?? start.y!;
        const needsRoute = !existing?.sofiaThirdFloorRoute || existing.targetX !== tx || existing.targetY !== ty || existing.sofiaRouteBlocked;
        ns.x = start.x; ns.y = start.y;
        ns.sofiaWorldPosition = start.sofiaWorldPosition ?? toWorld(start.x!, start.y!);
        ns.sofiaThirdFloorRoute = true;
        if (needsRoute) ns.path = planThirdFloorRoute({ x: start.x!, y: start.y!, sofiaWorldPosition: start.sofiaWorldPosition }, { x: tx, y: ty }, furnitureRef.current ?? [], sofiaUpperFurniture);
        const arrived = Math.hypot(start.x! - tx, start.y! - ty) < 0.1;
        ns.sofiaRouteBlocked = !ns.path?.length && !arrived;
        ns.state = ns.path?.length ? "walking" : arrived && ns.sofiaPose === "sit" ? "sitting" : "standing";
        ns.bumpedUntil = undefined; ns.bumpTalkUntil = undefined;
      }
      next.push({ ...agent, ...ns, status: effectiveStatus } as RenderAgent);`);
  replace('scene', '    sofiaTargetByAgentId,\n    standupActive,', '    sofiaTargetByAgentId,\n    sofiaUpperFurniture,\n    standupActive,');
  replace('scene', '  const tick = () => {', '  const tick = (delta = 1 / 60) => {');
  replace('scene', '    const moved = renderAgentsRef.current.map((agent) => {', `    const moved = renderAgentsRef.current.map((agent) => {
      if (agent.sofiaThirdFloorRoute) {
        const update = advanceThirdFloorRoute(agent, delta);
        const atThird = update.sofiaWorldPosition && update.sofiaWorldPosition[1] >= 9.6 - 1e-6 && update.state !== "walking" && !agent.sofiaRouteBlocked;
        if (atThird) thirdFloorDirector.arrived(agent.id);
        const retain = (update.path?.length ?? 0) > 0 || (update.sofiaWorldPosition?.[1] ?? 0) > 0 || (agent.targetX === 1390 && agent.targetY === 1710);
        return { ...agent, ...update, sofiaThirdFloorRoute: retain, sofiaWorldPosition: retain ? update.sofiaWorldPosition : undefined, bumpedUntil: undefined, bumpTalkUntil: undefined };
      }`);
  replace('scene', '    sofiaTargets.deskHolds,\n  );', '    sofiaTargets.deskHolds,\n    sofiaAuditLevelFurniture,\n  );');
  replace('types', '  path: { x: number; y: number }[];', `  // ${marker}: physical waypoint metadata is only used by third-floor travel.\n  path: { x: number; y: number; sofiaWorld?: [number, number, number] }[];\n  sofiaThirdFloorRoute?: boolean;\n  sofiaWorldPosition?: [number, number, number];\n  sofiaRouteBlocked?: boolean;`);
  replace('loop', 'export function GameLoop({ tick }: { tick: () => void }) {\n  useFrame(() => tick());', `// ${marker}: elapsed time is consumed only by third-floor travel.\nexport function GameLoop({ tick }: { tick: (delta?: number) => void }) {\n  useFrame((_, delta) => tick(delta));`);
  replace('model', '  useFrame(() => {', `  // ${marker}: keep the avatar on the authored physical route.\n  useFrame((_, delta) => {`);
  replace('model', '    const sofiaElevation = campusRampProgress * 4.8 + thirdRampProgress * 4.8;', '    const sofiaElevation = agent.sofiaWorldPosition?.[1] ?? (campusRampProgress * 4.8 + thirdRampProgress * 4.8);');
  replace('model', '    groupRef.current.position.lerp(pos.current, 0.15);', `    if (agent.sofiaWorldPosition) {
      groupRef.current.position.x = agent.sofiaWorldPosition[0];
      groupRef.current.position.z = agent.sofiaWorldPosition[2];
    } else groupRef.current.position.lerp(pos.current, 0.15);`);
  replace('model', '    groupRef.current.rotation.y += rotDelta * 0.12;', '    groupRef.current.rotation.y += rotDelta * (agent.sofiaWorldPosition ? 1 - Math.pow(0.88, Math.min(delta, 0.25) * 60) : 0.12);');
  replace('model', '    groupRef.current.position.y += (sofiaElevation + bounce + breathe - groupRef.current.position.y) * 0.18;', `    if (agent.sofiaWorldPosition) groupRef.current.position.y = sofiaElevation + bounce + breathe;
    else groupRef.current.position.y += (sofiaElevation + bounce + breathe - groupRef.current.position.y) * 0.18;`);
  replace('spatial', '"use client";', `"use client";\n// ${marker}\nimport { thirdFloorDirector } from "@/features/sofia-ops/ThirdFloorDirector";`);
  replace('spatial', '    group.current.position.set(x + l3 * 5.2, lift, agent.y * SCALE - HALF_H + l3 * -1.4);', '    if (agent.sofiaWorldPosition) group.current.position.set(...agent.sofiaWorldPosition);\n    else group.current.position.set(x + l3 * 5.2, lift, agent.y * SCALE - HALF_H + l3 * -1.4);');
  replace('spatial', '    desired.set(px * SCALE - HALF_W + l3 * 5.2, lift, py * SCALE - HALF_H + l3 * -1.4);', '    if (agent?.sofiaWorldPosition) desired.set(...agent.sofiaWorldPosition);\n    else desired.set(px * SCALE - HALF_W + l3 * 5.2, lift, py * SCALE - HALF_H + l3 * -1.4);');
  replace('spatial', '    cone.current.position.set(px * SCALE - HALF_W + l3 * 5.2, lift + 1.75 + Math.sin(clock.elapsedTime * 3) * 0.08, py * SCALE - HALF_H + l3 * -1.4);', `    const markerLift = 1.75 + Math.sin(clock.elapsedTime * 3) * 0.08;
    if (agent?.sofiaWorldPosition) cone.current.position.set(agent.sofiaWorldPosition[0], agent.sofiaWorldPosition[1] + markerLift, agent.sofiaWorldPosition[2]);
    else cone.current.position.set(px * SCALE - HALF_W + l3 * 5.2, lift + markerLift, py * SCALE - HALF_H + l3 * -1.4);`);
  replace('spatial', '    const holder = window as Window & { __SOFIA_AGENT_POS?: typeof out; __SOFIA_CAMERA_TARGET?: number[] };', `    const main = lookupRef.current?.get("main");
    const state = thirdFloorDirector.getSnapshot().main;
    gl.domElement.dataset.sofiaMain = JSON.stringify(main ? { x: main.x, y: main.y, world: main.sofiaWorldPosition, state: main.state, path: main.path?.length ?? 0, blocked: main.sofiaRouteBlocked ?? false, phase: state?.status ?? null, runId: state?.runId ?? null, frame: main.frame } : null);
    const holder = window as Window & { __SOFIA_AGENT_POS?: typeof out; __SOFIA_CAMERA_TARGET?: number[] };`);
  replace('collision', '    const mi = moved[i];', `    const mi = moved[i];\n    // ${marker}: a committed physical transit cannot be rerouted to a random ground roam target.\n    if (mi.sofiaThirdFloorRoute) continue;`);
  replace('collision', '          const mj = moved[j];', '          const mj = moved[j];\n          if (mj.sofiaThirdFloorRoute) continue;');
}

// Upgrade an existing R1 installation as well as a clean pinned scene.
if (!changed.scene.includes('SOFIA_PHASE2_ROUTE_SYNC_R2')) {
  replace('scene', 'import { planThirdFloorRoute, advanceThirdFloorRoute } from "@/features/sofia-ops/ThirdFloorRoute";', 'import { synchronizeThirdFloorRoute, advanceThirdFloorRoute } from "@/features/sofia-ops/ThirdFloorRoute";');
  replace('scene', '        const start = existing ?? ns;\n        const tx = ns.targetX ?? existing?.targetX ?? start.x!;\n        const ty = ns.targetY ?? existing?.targetY ?? start.y!;\n        const needsRoute = !existing?.sofiaThirdFloorRoute || existing.targetX !== tx || existing.targetY !== ty || existing.sofiaRouteBlocked;\n        ns.x = start.x; ns.y = start.y;\n        ns.sofiaWorldPosition = start.sofiaWorldPosition ?? toWorld(start.x!, start.y!);\n        ns.sofiaThirdFloorRoute = true;\n        if (needsRoute) ns.path = planThirdFloorRoute({ x: start.x!, y: start.y!, sofiaWorldPosition: start.sofiaWorldPosition }, { x: tx, y: ty }, furnitureRef.current ?? [], sofiaUpperFurniture);\n        const arrived = Math.hypot(start.x! - tx, start.y! - ty) < 0.1;\n        ns.sofiaRouteBlocked = !ns.path?.length && !arrived;\n        ns.state = ns.path?.length ? "walking" : arrived && ns.sofiaPose === "sit" ? "sitting" : "standing";\n        ns.bumpedUntil = undefined; ns.bumpTalkUntil = undefined;', '        // SOFIA_PHASE2_ROUTE_SYNC_R2: preserve the route through pose/status updates.\n        Object.assign(ns, synchronizeThirdFloorRoute((existing ?? ns) as RenderAgent, ns, furnitureRef.current ?? [], sofiaUpperFurniture));');
}

if (!changed.spatial.includes('SOFIA_PHASE2_ROUTE_DIAG_R3')) {
  replace('spatial', 'gl.domElement.dataset.sofiaMain = JSON.stringify(main ? { x: main.x, y: main.y, world: main.sofiaWorldPosition, state: main.state, path: main.path?.length ?? 0, blocked: main.sofiaRouteBlocked ?? false, phase: state?.status ?? null, runId: state?.runId ?? null, frame: main.frame } : null);', '// SOFIA_PHASE2_ROUTE_DIAG_R3\n    gl.domElement.dataset.sofiaMain = JSON.stringify(main ? { revision: "R3", x: main.x, y: main.y, world: main.sofiaWorldPosition, target: [main.targetX, main.targetY], route: Boolean(main.sofiaThirdFloorRoute), next: main.path?.[0] ?? null, speed: main.walkSpeed, state: main.state, path: main.path?.length ?? 0, blocked: main.sofiaRouteBlocked ?? false, phase: state?.status ?? null, frame: main.frame } : null);');
}

// Resolve every anchor before modifying any source. Copy the canonical modules;
// scene, renderer and state store must import the same names.
const target = 'src/features/sofia-ops';
fs.mkdirSync(target, { recursive: true });
for (const name of ['ThirdFloorRoute.ts', 'ThirdFloorDirector.ts', 'ThirdFloorStatusIcon.tsx']) fs.copyFileSync(path.join(__dirname, name), path.join(target, name));
for (const [key, file] of Object.entries(files)) fs.writeFileSync(file, changed[key]);
console.log(`${marker}: physical route, elapsed-time walk and color source installed`);
console.log('SOFIA_PHASE2_ROUTE_SYNC_R2: physical route preserved across status/pose updates');

console.log('SOFIA_PHASE2_ROUTE_DIAG_R3: main-only route diagnostics installed');
