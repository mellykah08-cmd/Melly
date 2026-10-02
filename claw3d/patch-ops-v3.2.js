const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

function replaceOnce(file, from, to, label) {
  const text = read(file);
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`SOFIA v3.2 anchor missing: ${label} in ${file}`);
  if (text.indexOf(from, first + 1) >= 0) throw new Error(`SOFIA v3.2 anchor not unique: ${label} in ${file}`);
  write(file, text.slice(0, first) + to + text.slice(first + from.length));
}

function insertBefore(file, anchor, insertion, label) {
  const text = read(file);
  const first = text.indexOf(anchor);
  if (first < 0) throw new Error(`SOFIA v3.2 anchor missing: ${label} in ${file}`);
  write(file, text.slice(0, first) + insertion + text.slice(first));
}

// ---------------------------------------------------------------------------
// 1) Camera autonomy: never move the user's view unless they explicitly opt in.
// ---------------------------------------------------------------------------
const store = 'src/lib/sofia-ops/worldStore.ts';
replaceOnce(
  store,
  `const readAutoFollow = () => {\n  try {\n    return window.localStorage.getItem(AUTO_FOLLOW_KEY) !== "0";\n  } catch {\n    return true;\n  }\n};`,
  `const readAutoFollow = () => {\n  try {\n    return window.localStorage.getItem(AUTO_FOLLOW_KEY) === "1";\n  } catch {\n    return false;\n  }\n};`,
  'manual camera default',
);
replaceOnce(store, '  autoFollow: true,\n', '  autoFollow: false,\n', 'store auto-follow default');

// ---------------------------------------------------------------------------
// 2) HUD no longer treats operational sectors as alternate dimensions/floors.
//    The panel becomes a topology/status selector; no button changes scene.
// ---------------------------------------------------------------------------
const hud = 'src/features/sofia-ops/SofiaOpsHud.tsx';
replaceOnce(hud, '{ id: "floors", label: "andares" },', '{ id: "floors", label: "setores" },', 'floor tab label');
replaceOnce(
  hud,
  'const FLOOR_ORDER: SofiaFloorId[] = ["openclaw-ground", "audit-second", "dev-third", "infra-fourth", "intel-fifth", "command-sixth"];\n',
  'const FLOOR_ORDER: SofiaFloorId[] = ["openclaw-ground", "audit-second", "dev-third", "infra-fourth", "intel-fifth", "command-sixth"];\nconst CAMPUS_SECTORS: ZoneId[] = ["desk", "shadow", "audit", "qa", "infra", "intel", "warroom"];\n',
  'campus sector list',
);
{
  let text = read(hud);
  const focusFloorLine = /^  const focusFloorElsewhere = .*?;\n/m;
  if (!focusFloorLine.test(text)) throw new Error('SOFIA v3.2 anchor missing: focusFloorElsewhere');
  text = text.replace(focusFloorLine, '');
  const floorJump = '{focusFloorElsewhere ? <button type="button" onClick={() => onSelectFloor?.(focusFloorElsewhere)} className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-100">{FLOOR_LABEL[focusFloorElsewhere]} ↗</button> : null}';
  if (!text.includes(floorJump)) throw new Error('SOFIA v3.2 anchor missing: HUD floor jump');
  text = text.replace(floorJump, '');
  const oldFloors = `              {tab === "floors" ? (\n                <div className="space-y-1">\n                  {FLOOR_ORDER.map((floor, index) => (\n                    <button key={floor} type="button" onClick={() => onSelectFloor?.(floor)} className={"flex w-full items-center justify-between rounded border px-2 py-1.5 text-left " + (floor === floorId ? "border-cyan-400/40 bg-cyan-950/30" : "border-white/10 bg-white/5")}>\n                      <span className="text-white/80">{index + 1}º · {FLOOR_LABEL[floor]}</span>\n                      <span className={world.floorActivity[floor].hot ? "text-amber-200" : "text-white/40"}>{world.floorActivity[floor].hot ? "● ativo · " : ""}{world.floorActivity[floor].recent} eventos/5min</span>\n                    </button>\n                  ))}\n                </div>\n              ) : null}`;
  const newSectors = `              {tab === "floors" ? (\n                <div className="space-y-1">\n                  <div className="mb-1 rounded border border-cyan-400/15 bg-cyan-950/15 p-2 text-[9px] text-cyan-100/70">UM MUNDO · os setores coexistem. Selecionar aqui inspeciona o setor; não troca o cenário nem move sua câmera.</div>\n                  {CAMPUS_SECTORS.map((zone) => {\n                    const state = world.zones[zone];\n                    return (\n                      <button key={zone} type="button" onClick={() => sofiaWorld.inspect({ kind: "zone", id: zone })} className={"flex w-full items-center justify-between rounded border px-2 py-1.5 text-left " + (state.level === "alert" ? "border-red-400/35 bg-red-950/25" : state.level !== "idle" ? "border-cyan-400/30 bg-cyan-950/20" : "border-white/10 bg-white/5")}>\n                        <span className="text-white/80">{ZONE_LABEL[zone]}</span>\n                        <span className={state.level === "alert" ? "text-red-200" : state.level !== "idle" ? "text-cyan-200" : "text-white/35"}>{state.level}{state.ownerAgentId ? " · " + (names.get(state.ownerAgentId) ?? state.ownerAgentId) : ""}</span>\n                      </button>\n                    );\n                  })}\n                </div>\n              ) : null}`;
  if (!text.includes(oldFloors)) throw new Error('SOFIA v3.2 anchor missing: legacy floors tab');
  text = text.replace(oldFloors, newSectors);
  text = text.replace('AUTO {view.autoFollow ? "ON" : "OFF"}', 'CÂMERA {view.autoFollow ? "GUIADA" : "LIVRE"}');
  write(hud, text);
}

// ---------------------------------------------------------------------------
// 3) Functional phase gate in the global nav grid. The exact 75-item first-floor
//    furniture stays untouched; only collision is opened at the south wall and
//    a visible transit gate is rendered over that point by CampusDistrict.
// ---------------------------------------------------------------------------
const navigation = 'src/features/retro-office/core/navigation.ts';
replaceOnce(
  navigation,
  '  return grid;\n}\n\n// True when the canvas point lies in a walkable nav cell.',
  `  // Sofia continuous-world transit gate: a narrow pass through the authored\n  // south shell. Visual furniture is NOT modified; CampusDistrict renders the\n  // gate, while these cells make it genuinely traversable by A*.\n  for (let row = Math.floor(690 / GRID_CELL); row <= Math.floor(785 / GRID_CELL); row += 1) {\n    for (let column = Math.floor(1000 / GRID_CELL); column <= Math.floor(1100 / GRID_CELL); column += 1) {\n      if (row >= 0 && column >= 0 && row < GRID_ROWS && column < GRID_COLS) grid[row * GRID_COLS + column] = 0;\n    }\n  }\n\n  return grid;\n}\n\n// True when the canvas point lies in a walkable nav cell.`,
  'continuous-world transit gate nav cells',
);

// Intelligence is now a real destination, not an alias for the agent desk.
const targets = 'src/features/sofia-ops/spatialTargets.ts';
replaceOnce(
  targets,
  '    const anchor = zone === "desk" || zone === "intel" ? null : anchors[zone];',
  '    const anchor = zone === "desk" ? null : anchors[zone];',
  'intel physical destination',
);

// ---------------------------------------------------------------------------
// 4) One persistent Canvas gets campus-wide physical anchors. World Director
//    can now place different agents in different sectors simultaneously.
// ---------------------------------------------------------------------------
const retro = 'src/features/retro-office/RetroOffice3D.tsx';
const oldTargetBlock = `  const sofiaWarSeats = sofiaLayout?.warSeats ?? EMPTY_SOFIA_SEATS;\n  const sofiaAnchors = sofiaLayout?.anchors ?? null;\n  const sofiaTargets = useMemo(\n    () =>\n      sofiaAnchors\n        ? resolveSofiaTargets(sofiaZoneMap, sofiaAnchors, sofiaWarSeats, sofiaLayout?.stands)\n        : EMPTY_SOFIA_TARGET_SET,\n    [sofiaAnchors, sofiaLayout, sofiaZoneMap, sofiaWarSeats],\n  );`;
const newTargetBlock = `  // Continuous Sofia Campus: all operational sectors occupy the same 1800x1800\n  // world. Operation + Shadow keep the original authored office; specialized\n  // sectors live south of it in the already-supported district coordinate space.\n  const sofiaCampusMode = sofiaFloorId === "openclaw-ground";\n  const sofiaAnchors = useMemo(() => {\n    const base = sofiaLayout?.anchors ?? null;\n    if (!base || !sofiaCampusMode) return base;\n    return {\n      ...base,\n      audit: { x: 260, y: 1080 },\n      qa: { x: 620, y: 1080 },\n      infra: { x: 980, y: 1080 },\n      intel: { x: 1420, y: 1080 },\n      warroom: { x: 900, y: 1500 },\n    };\n  }, [sofiaCampusMode, sofiaLayout]);\n  const sofiaStands = useMemo(() => {\n    const base = sofiaLayout?.stands ?? null;\n    if (!base || !sofiaCampusMode) return base ?? undefined;\n    return {\n      ...base,\n      audit: { x: 260, y: 1170 },\n      qa: { x: 620, y: 1170 },\n      infra: { x: 980, y: 1170 },\n      intel: { x: 1420, y: 1170 },\n      warroom: { x: 900, y: 1500 },\n    };\n  }, [sofiaCampusMode, sofiaLayout]);\n  const sofiaWarSeats = useMemo(\n    () =>\n      sofiaCampusMode\n        ? [\n            { x: 810, y: 1490, facing: Math.PI / 2 },\n            { x: 855, y: 1565, facing: Math.PI },\n            { x: 945, y: 1565, facing: Math.PI },\n            { x: 990, y: 1490, facing: -Math.PI / 2 },\n            { x: 945, y: 1420, facing: 0 },\n            { x: 855, y: 1420, facing: 0 },\n          ]\n        : sofiaLayout?.warSeats ?? EMPTY_SOFIA_SEATS,\n    [sofiaCampusMode, sofiaLayout],\n  );\n  const sofiaTargets = useMemo(\n    () =>\n      sofiaAnchors\n        ? resolveSofiaTargets(sofiaZoneMap, sofiaAnchors, sofiaWarSeats, sofiaStands)\n        : EMPTY_SOFIA_TARGET_SET,\n    [sofiaAnchors, sofiaStands, sofiaWarSeats, sofiaZoneMap],\n  );`;
replaceOnce(retro, oldTargetBlock, newTargetBlock, 'campus anchors and independent agent targets');

// Camera overview understands the full world but remains entirely user controlled.
replaceOnce(
  retro,
  `  const LOCAL_CAMERA_TARGET = useMemo(\n    () =>\n      toWorld(LOCAL_OFFICE_CANVAS_WIDTH / 2, LOCAL_OFFICE_CANVAS_HEIGHT / 2),\n    [],\n  );`,
  `  const LOCAL_CAMERA_TARGET = useMemo(\n    () =>\n      toWorld(LOCAL_OFFICE_CANVAS_WIDTH / 2, layoutPreset === "office" ? CANVAS_H / 2 : LOCAL_OFFICE_CANVAS_HEIGHT / 2),\n    [layoutPreset],\n  );`,
  'continuous-world camera target',
);
replaceOnce(
  retro,
  '  const cameraZoom = remoteOfficeEnabled ? DISTRICT_CAMERA_ZOOM : 56;',
  '  const cameraZoom = remoteOfficeEnabled ? DISTRICT_CAMERA_ZOOM : layoutPreset === "office" ? 31 : 56;',
  'continuous-world overview zoom',
);

// Hide the legacy scene-switch floor directory while Sofia Campus is active.
// It stays mounted (and therefore rollback-compatible), but cannot lure the user
// into alternate scene universes. Sector topology lives in the Sofia HUD.
replaceOnce(retro === '' ? '' : 'src/features/office/screens/OfficeScreen.tsx', '      <OfficeFloorNav\n', '      <div className="hidden" aria-hidden="true">\n        <OfficeFloorNav\n', 'hide legacy floor directory start');
replaceOnce(
  'src/features/office/screens/OfficeScreen.tsx',
  '        activeAdapterType={(selectedAdapterType as FloorProvider) ?? null}\n      />\n      <section className="relative h-full min-h-0 min-w-0 overflow-hidden">',
  '        activeAdapterType={(selectedAdapterType as FloorProvider) ?? null}\n      />\n      </div>\n      <section className="relative h-full min-h-0 min-w-0 overflow-hidden">',
  'hide legacy floor directory end',
);

// ---------------------------------------------------------------------------
// 5) Physical campus. These are not decorative alternate scenes: each pad is
//    bound to the real WorldState zone, can open the real inspector, and shares
//    coordinates with the agents' A* destinations above. Idle detail hibernates
//    by camera distance; base topology remains visible.
// ---------------------------------------------------------------------------
const spatial = 'src/features/sofia-ops/SofiaSpatialLayer.tsx';
const campusCode = String.raw`
type CampusZoneSpec = { zone: ZoneId; x: number; y: number; w: number; h: number; label: string };

const CAMPUS_ZONE_SPECS: CampusZoneSpec[] = [
  { zone: "audit", x: 260, y: 1080, w: 280, h: 230, label: "AUDIT" },
  { zone: "qa", x: 620, y: 1080, w: 280, h: 230, label: "DEV · QA" },
  { zone: "infra", x: 980, y: 1080, w: 280, h: 230, label: "INFRA" },
  { zone: "intel", x: 1420, y: 1080, w: 300, h: 230, label: "INTEL" },
  { zone: "warroom", x: 900, y: 1500, w: 520, h: 300, label: "COMMAND" },
];

function CampusPath({ ax, ay, bx, by, width = 0.16 }: { ax: number; ay: number; bx: number; by: number; width?: number }) {
  const [awx, , awz] = toWorld(ax, ay);
  const [bwx, , bwz] = toWorld(bx, by);
  const dx = bwx - awx;
  const dz = bwz - awz;
  const length = Math.hypot(dx, dz);
  return (
    <mesh position={[(awx + bwx) / 2, 0.015, (awz + bwz) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
      <boxGeometry args={[length, 0.025, width]} />
      <meshBasicMaterial color="#164e63" transparent opacity={0.58} depthWrite={false} />
    </mesh>
  );
}

function CampusZone({ spec, world }: { spec: CampusZoneSpec; world: WorldState }) {
  const details = useRef<THREE.Group>(null);
  const [wx, , wz] = toWorld(spec.x, spec.y);
  const zoneState = world.zones[spec.zone];
  const active = zoneState.level !== "idle";
  const focused = world.focus?.zone === spec.zone;
  const color = levelColor(spec.zone, zoneState.level);
  const worldPoint = useMemo(() => new THREE.Vector3(wx, 0, wz), [wx, wz]);
  useFrame(({ camera }) => {
    if (!details.current) return;
    // Fine geometry sleeps while an idle sector is far away. No React state,
    // no remount, and no extra Canvas: just a visibility bit on the group.
    details.current.visible = active || focused || camera.position.distanceToSquared(worldPoint) < 360;
  });

  return (
    <group
      position={[wx, 0, wz]}
      onClick={(event) => {
        event.stopPropagation();
        sofiaWorld.inspect({ kind: "zone", id: spec.zone });
      }}
    >
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[spec.w * SCALE, 0.05, spec.h * SCALE]} />
        <meshBasicMaterial color="#07151d" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[spec.w * SCALE, 0.035, spec.h * SCALE]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={active ? 0.65 : 0.24} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.43, spec.zone === "warroom" ? 6 : 24]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.72 : 0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <group ref={details}>
        {spec.zone === "audit" ? (
          <>
            {[-1.35, 0, 1.35].map((x, i) => (
              <mesh key={i} position={[x, 0.68, i % 2 ? 0.5 : -0.5]} rotation={[0, i % 2 ? 0.16 : -0.16, 0]}>
                <boxGeometry args={[0.08, 1.25, 1.15]} />
                <meshBasicMaterial color="#f59e0b" transparent opacity={active ? 0.58 : 0.25} />
              </mesh>
            ))}
            <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.72, 0.72, 0.12, 24]} /><meshBasicMaterial color="#78350f" /></mesh>
          </>
        ) : null}

        {spec.zone === "qa" ? (
          <>
            {[-1.0, 1.0].map((x, i) => (
              <group key={i} position={[x, 0, 0]}>
                <mesh position={[0, 0.72, 0]}><boxGeometry args={[0.12, 1.45, 1.55]} /><meshBasicMaterial color="#22d3ee" transparent opacity={0.34} /></mesh>
                {[0.3, 0.72, 1.12].map((y, j) => <mesh key={j} position={[0, y, 0]}><boxGeometry args={[1.05, 0.055, 0.11]} /><meshBasicMaterial color="#67e8f9" transparent opacity={active ? 0.72 : 0.28} /></mesh>)}
              </group>
            ))}
          </>
        ) : null}

        {spec.zone === "infra" ? (
          <>
            {[-1.05, 0, 1.05].map((x, i) => (
              <group key={i} position={[x, 0, i === 1 ? -0.45 : 0.35]}>
                <mesh position={[0, 0.72, 0]}><boxGeometry args={[0.62, 1.45, 0.7]} /><meshBasicMaterial color="#020617" /></mesh>
                {[0.28, 0.54, 0.8, 1.06, 1.3].map((y, j) => <mesh key={j} position={[0, y, 0.36]}><boxGeometry args={[0.42, 0.035, 0.018]} /><meshBasicMaterial color={zoneState.level === "alert" ? "#ff2d55" : "#38bdf8"} /></mesh>)}
              </group>
            ))}
          </>
        ) : null}

        {spec.zone === "intel" ? (
          <>
            <mesh position={[0, 1.0, 0]}><octahedronGeometry args={[0.92, 1]} /><meshBasicMaterial color="#34d399" wireframe transparent opacity={active ? 0.55 : 0.26} /></mesh>
            {[0.72, 1.12, 1.52].map((r, i) => <mesh key={i} position={[0, 0.75 + i * 0.17, 0]} rotation={[Math.PI / 2, i * 0.35, 0]}><torusGeometry args={[r, 0.025, 5, 28]} /><meshBasicMaterial color="#34d399" transparent opacity={0.28 + i * 0.08} /></mesh>)}
          </>
        ) : null}

        {spec.zone === "warroom" ? (
          <>
            <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[1.25, 1.25, 0.24, 6]} /><meshBasicMaterial color="#1f2937" /></mesh>
            {Array.from({ length: 6 }).map((_, i) => {
              const angle = (i / 6) * Math.PI * 2;
              return <mesh key={i} position={[Math.cos(angle) * 1.75, 0.82, Math.sin(angle) * 1.75]} rotation={[0, -angle, 0]}><boxGeometry args={[0.18, 1.55, 0.62]} /><meshBasicMaterial color={zoneState.level === "alert" ? "#ff1744" : "#ef4444"} transparent opacity={zoneState.level === "alert" ? 0.75 : 0.30} /></mesh>;
            })}
            <mesh position={[0, 2.0, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.15, 0.045, 6, 6]} /><meshBasicMaterial color={color} transparent opacity={active ? 0.7 : 0.25} /></mesh>
          </>
        ) : null}
      </group>

      <Label y={spec.zone === "warroom" ? 2.35 : 1.9} size={0.12} color={color} text={spec.label + (active ? " · " + zoneState.level.toUpperCase() : "")} />
    </group>
  );
}

function CampusDistrict({ world }: { world: WorldState }) {
  const [groundX, , groundZ] = toWorld(900, 1260);
  const [gateX, , gateZ] = toWorld(1050, 715);
  return (
    <group>
      {/* Physical south campus on the SAME coordinate world as the original office. */}
      <mesh position={[groundX, -0.01, groundZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1800 * SCALE, 1040 * SCALE]} />
        <meshStandardMaterial color="#071018" roughness={0.96} metalness={0.04} />
      </mesh>
      <mesh position={[groundX, -0.005, groundZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1720 * SCALE, 960 * SCALE]} />
        <meshBasicMaterial color="#0b1720" />
      </mesh>

      {/* Real A* transit gate through the untouched authored south wall. */}
      <group position={[gateX, 0, gateZ]}>
        <mesh position={[-0.7, 1.0, 0]}><boxGeometry args={[0.12, 2.0, 0.18]} /><meshBasicMaterial color="#22d3ee" /></mesh>
        <mesh position={[0.7, 1.0, 0]}><boxGeometry args={[0.12, 2.0, 0.18]} /><meshBasicMaterial color="#22d3ee" /></mesh>
        <mesh position={[0, 1.95, 0]}><boxGeometry args={[1.52, 0.12, 0.18]} /><meshBasicMaterial color="#22d3ee" /></mesh>
        <mesh position={[0, 1.0, 0]}><planeGeometry args={[1.25, 1.75]} /><meshBasicMaterial color="#22d3ee" transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      </group>

      <CampusPath ax={1050} ay={735} bx={1050} by={900} width={0.22} />
      <CampusPath ax={1050} ay={900} bx={260} by={900} />
      <CampusPath ax={260} ay={900} bx={260} by={1080} />
      <CampusPath ax={1050} ay={900} bx={620} by={900} />
      <CampusPath ax={620} ay={900} bx={620} by={1080} />
      <CampusPath ax={1050} ay={900} bx={980} by={1080} />
      <CampusPath ax={1050} ay={900} bx={1420} by={900} />
      <CampusPath ax={1420} ay={900} bx={1420} by={1080} />
      <CampusPath ax={900} ay={1200} bx={900} by={1500} width={0.22} />

      {CAMPUS_ZONE_SPECS.map((spec) => <CampusZone key={spec.zone} spec={spec} world={world} />)}
    </group>
  );
}

`;
insertBefore(spatial, 'export function SofiaSpatialLayer({', campusCode, 'CampusDistrict component');
replaceOnce(
  spatial,
  '          <FloorBoard floorId={floorId} world={world} />',
  '          {floorId === "openclaw-ground" ? <CampusDistrict world={world} /> : <FloorBoard floorId={floorId} world={world} />}',
  'render continuous campus on operation world',
);

console.log('SOFIA_CHAIN: v3.2 continuous single-world campus + independent sector routing + manual camera + LOD applied');
