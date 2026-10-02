const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

function replaceOnce(file, from, to, label) {
  const text = read(file);
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`SOFIA v3.4 anchor missing: ${label} in ${file}`);
  if (text.indexOf(from, first + 1) >= 0) throw new Error(`SOFIA v3.4 anchor not unique: ${label} in ${file}`);
  write(file, text.slice(0, first) + to + text.slice(first + from.length));
}

function insertBefore(file, anchor, insertion, label) {
  const text = read(file);
  const first = text.indexOf(anchor);
  if (first < 0) throw new Error(`SOFIA v3.4 anchor missing: ${label} in ${file}`);
  write(file, text.slice(0, first) + insertion + text.slice(first));
}

// ---------------------------------------------------------------------------
// 1) Gateway: the server-owned token is the trust boundary. Android's persisted
//    device signature was created for a different endpoint/origin and OpenClaw
//    rejects it as "device signature invalid". When the Studio host has the real
//    private gateway token, normalize the upstream connect to token auth only.
// ---------------------------------------------------------------------------
replaceOnce(
  'server/gateway-proxy.js',
  `      const connectParams = isObject(baseConnectFrame.params)\n        ? { ...baseConnectFrame.params }\n        : {};\n      const hasDeviceAuth = hasCompleteDeviceAuth(connectParams);`,
  `      const connectParams = isObject(baseConnectFrame.params)\n        ? { ...baseConnectFrame.params }\n        : {};\n\n      if (upstreamAdapterType === "openclaw" && upstreamToken) {\n        const auth = isObject(connectParams.auth) ? { ...connectParams.auth } : {};\n        auth.token = upstreamToken;\n        delete auth.deviceToken;\n        connectParams.auth = auth;\n        // Device signatures are origin/endpoint sensitive. The browser reaches\n        // Studio while Studio reaches the private Railway gateway, so forwarding\n        // the browser signature is both unnecessary and invalid upstream.\n        if (isObject(connectParams.device)) delete connectParams.device;\n      }\n\n      const hasDeviceAuth = hasCompleteDeviceAuth(connectParams);`,
  'server token canonical auth + stale device signature removal',
);

// ---------------------------------------------------------------------------
// 2) Third physical level. Level 2 remains Audit; Level 3 becomes Dev/QA.
//    It is both higher and horizontally offset, so mobile perspective can read
//    all three levels at once instead of seeing a vertical pile.
// ---------------------------------------------------------------------------
const retro = 'src/features/retro-office/RetroOffice3D.tsx';

const thirdLevelComponent = String.raw`
const SOFIA_THIRD_LEVEL_Y = 9.6;
const SOFIA_THIRD_OFFSET_X = 5.2;
const SOFIA_THIRD_OFFSET_Z = -1.4;

const SofiaDevQaLevel = memo(function SofiaDevQaLevel({ furniture }: { furniture: FurnitureItem[] }) {
  const [floorX, , floorZ] = toWorld(900, REMOTE_OFFICE_ZONE.minY + LOCAL_OFFICE_CANVAS_HEIGHT / 2);
  const floorWidth = LOCAL_OFFICE_CANVAS_WIDTH * SCALE;
  const floorDepth = LOCAL_OFFICE_CANVAS_HEIGHT * SCALE;

  const supportPoints = [
    toWorld(160, 1120),
    toWorld(1640, 1120),
    toWorld(160, 1640),
    toWorld(1640, 1640),
  ];

  // Sky-ramp starts on level 2 and arrives on the offset level 3. It is purely
  // structural/visual; NPC A* stays in one logical coordinate plane and its
  // visual transform follows the same y-progress below.
  const [sx, , sz] = toWorld(1390, 1480);
  const [rawEx, , rawEz] = toWorld(1390, 1710);
  const start = new THREE.Vector3(sx, SOFIA_SECOND_LEVEL_Y + 0.1, sz);
  const end = new THREE.Vector3(rawEx + SOFIA_THIRD_OFFSET_X, SOFIA_THIRD_LEVEL_Y + 0.1, rawEz + SOFIA_THIRD_OFFSET_Z);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction.clone().normalize(),
  );

  return (
    <>
      {supportPoints.map(([x, , z], index) => (
        <mesh
          key={index}
          position={[x + SOFIA_THIRD_OFFSET_X, (SOFIA_SECOND_LEVEL_Y + SOFIA_THIRD_LEVEL_Y) / 2, z + SOFIA_THIRD_OFFSET_Z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.24, SOFIA_THIRD_LEVEL_Y - SOFIA_SECOND_LEVEL_Y, 0.24]} />
          <meshStandardMaterial color="#233047" roughness={0.68} metalness={0.32} />
        </mesh>
      ))}

      <mesh position={midpoint.toArray()} quaternion={quaternion} castShadow receiveShadow>
        <boxGeometry args={[2.15, 0.18, length]} />
        <meshStandardMaterial color="#344765" roughness={0.5} metalness={0.34} />
      </mesh>
      {[-1.02, 1.02].map((dx) => (
        <mesh
          key={dx}
          position={[midpoint.x + dx, midpoint.y + 0.34, midpoint.z]}
          quaternion={quaternion}
        >
          <boxGeometry args={[0.055, 0.52, length]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.54} roughness={0.22} metalness={0.5} />
        </mesh>
      ))}

      <group position={[SOFIA_THIRD_OFFSET_X, SOFIA_THIRD_LEVEL_Y, SOFIA_THIRD_OFFSET_Z]}>
        <mesh position={[floorX, -0.12, floorZ]} receiveShadow>
          <boxGeometry args={[floorWidth, 0.24, floorDepth]} />
          <meshStandardMaterial color="#b9c8da" roughness={0.78} metalness={0.12} />
        </mesh>
        {/* Blue perimeter makes Dev/QA readable without expensive lights/text. */}
        <mesh position={[floorX, 0.02, floorZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.min(floorWidth, floorDepth) * 0.33, Math.min(floorWidth, floorDepth) * 0.345, 4]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <ReadOnlyFurnitureClone furniture={furniture} />
      </group>
    </>
  );
});

`;
insertBefore(retro, 'export function RetroOffice3D({', thirdLevelComponent, 'physical Dev/QA third level');

const devQaFurnitureMemo = String.raw`
  const sofiaDevQaLevelFurniture = useMemo(() => {
    if (layoutPreset !== "office") return EMPTY_FURNITURE_ITEMS;
    const excluded = new Set([
      "couch",
      "couch_v",
      "beanbag",
      "pingpong",
      "coffee_machine",
      "fridge",
      "water_cooler",
      "round_table",
      "table_rect",
    ]);
    const source = materializeDefaults("audit").filter((item) => !excluded.has(item.type));
    return projectFurnitureIntoRemoteOfficeZone({
      furniture: source,
      sourceWidth: LOCAL_OFFICE_CANVAS_WIDTH,
      sourceHeight: LOCAL_OFFICE_CANVAS_HEIGHT,
    });
  }, [layoutPreset]);
`;
insertBefore(
  retro,
  '  useEffect(() => {\n    setFurniture(\n      buildInitialFurnitureLayout(storageNamespace, layoutPreset).filter(',
  devQaFurnitureMemo,
  'Dev/QA level furniture memo',
);

replaceOnce(
  retro,
  `            {layoutPreset === "office" && sofiaAuditLevelFurniture.length > 0 ? (\n              <SofiaAuditLevel furniture={sofiaAuditLevelFurniture} />\n            ) : null}`,
  `            {layoutPreset === "office" && sofiaAuditLevelFurniture.length > 0 ? (\n              <SofiaAuditLevel furniture={sofiaAuditLevelFurniture} />\n            ) : null}\n\n            {layoutPreset === "office" && sofiaDevQaLevelFurniture.length > 0 ? (\n              <SofiaDevQaLevel furniture={sofiaDevQaLevelFurniture} />\n            ) : null}`,
  'render third physical Dev/QA level',
);

// Audit remains on level 2; QA/Dev is now a genuine level-3 destination.
replaceOnce(
  retro,
  '      qa: { x: 1390, y: 1340 },',
  '      qa: { x: 1390, y: 1710 },',
  'QA anchor to level 3',
);
replaceOnce(
  retro,
  '      qa: { x: 1390, y: 1400 },',
  '      qa: { x: 1390, y: 1710 },',
  'QA stand target to level 3',
);

// ---------------------------------------------------------------------------
// 3) NPCs traverse 1 -> 2 -> 3 independently. The second ramp is encoded by
//    y=1480..1700 and adds both height and the same X/Z offset as level 3.
// ---------------------------------------------------------------------------
const agents = 'src/features/retro-office/objects/agents.tsx';
replaceOnce(
  agents,
  `    const isRemoteRuntimeAgent = agent.id.startsWith("remote:");\n    const campusRampProgress = isRemoteRuntimeAgent ? 0 : Math.max(0, Math.min(1, (agent.y - 760) / 260));\n    const sofiaElevation = campusRampProgress * 4.8;\n    pos.current.set(wx, groupRef.current.position.y, wz);`,
  `    const isRemoteRuntimeAgent = agent.id.startsWith("remote:");\n    const campusRampProgress = isRemoteRuntimeAgent ? 0 : Math.max(0, Math.min(1, (agent.y - 760) / 260));\n    const thirdRampProgress = isRemoteRuntimeAgent ? 0 : Math.max(0, Math.min(1, (agent.y - 1480) / 220));\n    const sofiaElevation = campusRampProgress * 4.8 + thirdRampProgress * 4.8;\n    const sofiaOffsetX = thirdRampProgress * 5.2;\n    const sofiaOffsetZ = thirdRampProgress * -1.4;\n    pos.current.set(wx + sofiaOffsetX, groupRef.current.position.y, wz + sofiaOffsetZ);`,
  'per-agent third-level traversal',
);

// ---------------------------------------------------------------------------
// 4) Sofia spatial overlays/focus/camera use the exact same transform as NPCs.
// ---------------------------------------------------------------------------
const spatial = 'src/features/sofia-ops/SofiaSpatialLayer.tsx';
replaceOnce(
  spatial,
  '  const spatialY = anchor.y >= 1020 ? 4.8 : 0;\n  useFrame(({ clock }) => {',
  '  const level2Progress = Math.max(0, Math.min(1, (anchor.y - 760) / 260));\n  const level3Progress = Math.max(0, Math.min(1, (anchor.y - 1480) / 220));\n  const spatialY = level2Progress * 4.8 + level3Progress * 4.8;\n  const spatialX = level3Progress * 5.2;\n  const spatialZ = level3Progress * -1.4;\n  useFrame(({ clock }) => {',
  'zone overlay 3-level transform',
);
replaceOnce(
  spatial,
  '    <group position={[wx, spatialY, wz]}>\n      <mesh ref={ring}',
  '    <group position={[wx + spatialX, spatialY, wz + spatialZ]}>\n      <mesh ref={ring}',
  'zone overlay third-level offset',
);

replaceOnce(
  spatial,
  '    const lift = agent.y <= 760 ? 0 : Math.min(4.8, ((agent.y - 760) / 260) * 4.8);\n    group.current.position.set(x, lift, agent.y * SCALE - HALF_H);',
  '    const l2 = Math.max(0, Math.min(1, (agent.y - 760) / 260));\n    const l3 = Math.max(0, Math.min(1, (agent.y - 1480) / 220));\n    const lift = l2 * 4.8 + l3 * 4.8;\n    group.current.position.set(x + l3 * 5.2, lift, agent.y * SCALE - HALF_H + l3 * -1.4);',
  'agent aura third-level transform',
);
replaceOnce(
  spatial,
  '    const lift = py <= 760 ? 0 : Math.min(4.8, ((py - 760) / 260) * 4.8);\n    cone.current.position.set(px * SCALE - HALF_W, lift + 1.75 + Math.sin(clock.elapsedTime * 3) * 0.08, py * SCALE - HALF_H);',
  '    const l2 = Math.max(0, Math.min(1, (py - 760) / 260));\n    const l3 = Math.max(0, Math.min(1, (py - 1480) / 220));\n    const lift = l2 * 4.8 + l3 * 4.8;\n    cone.current.position.set(px * SCALE - HALF_W + l3 * 5.2, lift + 1.75 + Math.sin(clock.elapsedTime * 3) * 0.08, py * SCALE - HALF_H + l3 * -1.4);',
  'focus marker third-level transform',
);
replaceOnce(
  spatial,
  '    const lift = py <= 760 ? 0 : Math.min(4.8, ((py - 760) / 260) * 4.8);\n    desired.set(px * SCALE - HALF_W, lift, py * SCALE - HALF_H);',
  '    const l2 = Math.max(0, Math.min(1, (py - 760) / 260));\n    const l3 = Math.max(0, Math.min(1, (py - 1480) / 220));\n    const lift = l2 * 4.8 + l3 * 4.8;\n    desired.set(px * SCALE - HALF_W + l3 * 5.2, lift, py * SCALE - HALF_H + l3 * -1.4);',
  'camera third-level transform',
);

console.log('SOFIA_CHAIN: v3.4 real Dev/QA third level + independent 3-level traversal + canonical gateway token auth applied');
