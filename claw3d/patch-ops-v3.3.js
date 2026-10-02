const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

function replaceOnce(file, from, to, label) {
  const text = read(file);
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`SOFIA v3.3 anchor missing: ${label} in ${file}`);
  if (text.indexOf(from, first + 1) >= 0) throw new Error(`SOFIA v3.3 anchor not unique: ${label} in ${file}`);
  write(file, text.slice(0, first) + to + text.slice(first + from.length));
}

function insertBefore(file, anchor, insertion, label) {
  const text = read(file);
  const first = text.indexOf(anchor);
  if (first < 0) throw new Error(`SOFIA v3.3 anchor missing: ${label} in ${file}`);
  write(file, text.slice(0, first) + insertion + text.slice(first));
}

// ---------------------------------------------------------------------------
// 1) Gateway authentication: OpenClaw requires its gateway credential even when
//    the browser supplies valid device auth. Upstream treated device auth as a
//    replacement for the token and forwarded a tokenless connect frame.
// ---------------------------------------------------------------------------
replaceOnce(
  'server/gateway-proxy.js',
  `      const browserHasAuth =\n        hasNonEmptyToken(frame.params) ||\n        hasNonEmptyPassword(frame.params) ||\n        hasNonEmptyDeviceToken(frame.params) ||\n        hasCompleteDeviceAuth(frame.params);\n\n      const requiresToken = upstreamAdapterType === "openclaw";\n      if (requiresToken && !upstreamToken && !browserHasAuth) {\n        sendConnectError(\n          "studio.gateway_token_missing",\n          "Upstream gateway token is not configured on the Studio host."\n        );\n        return;\n      }\n\n      const baseConnectFrame = browserHasAuth\n        ? frame\n        : {\n            ...frame,\n            params: injectAuthToken(frame.params, upstreamToken),\n          };`,
  `      // Device signatures authenticate the device, but OpenClaw can still\n      // require the gateway credential. Never let valid device auth suppress\n      // server-side token injection.\n      const browserHasGatewayCredential =\n        hasNonEmptyToken(frame.params) ||\n        hasNonEmptyPassword(frame.params) ||\n        hasNonEmptyDeviceToken(frame.params);\n      const browserHasDeviceAuth = hasCompleteDeviceAuth(frame.params);\n\n      const requiresToken = upstreamAdapterType === "openclaw";\n      if (requiresToken && !upstreamToken && !browserHasGatewayCredential) {\n        sendConnectError(\n          "studio.gateway_token_missing",\n          "Upstream gateway token is not configured on the Studio host."\n        );\n        return;\n      }\n\n      const baseConnectFrame = requiresToken && !browserHasGatewayCredential && upstreamToken\n        ? {\n            ...frame,\n            params: injectAuthToken(frame.params, upstreamToken),\n          }\n        : frame;\n      void browserHasDeviceAuth;`,
  'OpenClaw token injection with device auth',
);

// ---------------------------------------------------------------------------
// 2) Android Chrome can auto-translate pages whose document still declares EN.
//    Translation mutates text DOM outside React and is a known trigger for the
//    exact insertBefore/removeChild NotFoundError seen in Sofia client telemetry.
//    Sofia is Portuguese, so declare it correctly and block DOM translation.
// ---------------------------------------------------------------------------
replaceOnce(
  'src/app/layout.tsx',
  '<html lang="en" suppressHydrationWarning>',
  '<html lang="pt-BR" translate="no" suppressHydrationWarning>',
  'Portuguese document language',
);
replaceOnce(
  'src/app/layout.tsx',
  '      <head>\n        <script',
  '      <head>\n        <meta name="google" content="notranslate" />\n        <script',
  'disable browser DOM translation',
);

// ---------------------------------------------------------------------------
// 3) The quick button is a synthetic harness, not the product. Keep the harness
//    in the advanced panel but stop presenting simulation as the main feature.
// ---------------------------------------------------------------------------
replaceOnce(
  'src/features/sofia-ops/SofiaOpsHud.tsx',
  `        {true ? (\n          <button\n            type="button"\n            data-testid="sofia-quick-demo"`,
  `        {false ? (\n          <button\n            type="button"\n            data-testid="sofia-quick-demo"`,
  'hide prominent synthetic demo button',
);

// The flat wireframe campus was a topology prototype, not the intended world.
replaceOnce(
  'src/features/sofia-ops/SofiaSpatialLayer.tsx',
  'function CampusDistrict({ world }: { world: WorldState }) {\n  const [groundX, , groundZ] = toWorld(900, 1260);',
  'function CampusDistrict({ world }: { world: WorldState }) {\n  if (true) return null; // retired: replaced by physical multi-level architecture\n  const [groundX, , groundZ] = toWorld(900, 1260);',
  'retire flat campus prototype',
);

// Zone overlays and focus markers must live on the same physical level as the
// corresponding real furniture/NPCs.
replaceOnce(
  'src/features/sofia-ops/SofiaSpatialLayer.tsx',
  '  const [wx, , wz] = toWorld(anchor.x, anchor.y);\n  useFrame(({ clock }) => {',
  '  const [wx, , wz] = toWorld(anchor.x, anchor.y);\n  const spatialY = anchor.y >= 1020 ? 4.8 : 0;\n  useFrame(({ clock }) => {',
  'zone station level elevation',
);
replaceOnce(
  'src/features/sofia-ops/SofiaSpatialLayer.tsx',
  '    <group position={[wx, 0, wz]}>\n      <mesh ref={ring}',
  '    <group position={[wx, spatialY, wz]}>\n      <mesh ref={ring}',
  'zone station group elevation',
);
replaceOnce(
  'src/features/sofia-ops/SofiaSpatialLayer.tsx',
  '    group.current.position.set(x, 0, agent.y * SCALE - HALF_H);',
  '    const lift = agent.y <= 760 ? 0 : Math.min(4.8, ((agent.y - 760) / 260) * 4.8);\n    group.current.position.set(x, lift, agent.y * SCALE - HALF_H);',
  'agent aura level elevation',
);
replaceOnce(
  'src/features/sofia-ops/SofiaSpatialLayer.tsx',
  '    cone.current.position.set(px * SCALE - HALF_W, 1.75 + Math.sin(clock.elapsedTime * 3) * 0.08, py * SCALE - HALF_H);',
  '    const lift = py <= 760 ? 0 : Math.min(4.8, ((py - 760) / 260) * 4.8);\n    cone.current.position.set(px * SCALE - HALF_W, lift + 1.75 + Math.sin(clock.elapsedTime * 3) * 0.08, py * SCALE - HALF_H);',
  'focus marker level elevation',
);
replaceOnce(
  'src/features/sofia-ops/SofiaSpatialLayer.tsx',
  '    desired.set(px * SCALE - HALF_W, controls.target.y, py * SCALE - HALF_H);',
  '    const lift = py <= 760 ? 0 : Math.min(4.8, ((py - 760) / 260) * 4.8);\n    desired.set(px * SCALE - HALF_W, lift, py * SCALE - HALF_H);',
  'camera focus level elevation',
);

// ---------------------------------------------------------------------------
// 4) Real second floor: reuse Claw3D's own authored furniture renderer instead
//    of wireframe placeholders. The Audit layout is projected south of floor 1,
//    elevated 4.8 world units, and connected by a physical ramp. This keeps the
//    first-floor 75-item layout byte-for-byte untouched.
// ---------------------------------------------------------------------------
const retro = 'src/features/retro-office/RetroOffice3D.tsx';

const auditLevelComponent = String.raw`
const SOFIA_SECOND_LEVEL_Y = 4.8;

const SofiaAuditLevel = memo(function SofiaAuditLevel({ furniture }: { furniture: FurnitureItem[] }) {
  const [floorX, , floorZ] = toWorld(900, REMOTE_OFFICE_ZONE.minY + LOCAL_OFFICE_CANVAS_HEIGHT / 2);
  const [startX, , startZ] = toWorld(1050, 720);
  const [endX, , endZ] = toWorld(1050, REMOTE_OFFICE_ZONE.minY);
  const dz = endZ - startZ;
  const rampLength = Math.hypot(dz, SOFIA_SECOND_LEVEL_Y);
  const rampAngle = -Math.atan2(SOFIA_SECOND_LEVEL_Y, Math.max(0.001, dz));
  const rampMidZ = (startZ + endZ) / 2;
  const floorWidth = LOCAL_OFFICE_CANVAS_WIDTH * SCALE;
  const floorDepth = LOCAL_OFFICE_CANVAS_HEIGHT * SCALE;
  const columnPoints = [
    toWorld(110, 1100),
    toWorld(1690, 1100),
    toWorld(110, 1660),
    toWorld(1690, 1660),
  ];

  return (
    <>
      {/* Structural supports make this visibly one physical building, not a scene swap. */}
      {columnPoints.map(([x, , z], index) => (
        <mesh key={index} position={[x, SOFIA_SECOND_LEVEL_Y / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[0.28, SOFIA_SECOND_LEVEL_Y, 0.28]} />
          <meshStandardMaterial color="#334155" roughness={0.72} metalness={0.22} />
        </mesh>
      ))}

      {/* Walkable visual ramp between the exact first-floor shell and level 2. */}
      <group>
        <mesh position={[startX, SOFIA_SECOND_LEVEL_Y / 2, rampMidZ]} rotation={[rampAngle, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.5, 0.18, rampLength]} />
          <meshStandardMaterial color="#475569" roughness={0.58} metalness={0.3} />
        </mesh>
        {[-1.18, 1.18].map((dx) => (
          <mesh key={dx} position={[startX + dx, SOFIA_SECOND_LEVEL_Y / 2 + 0.34, rampMidZ]} rotation={[rampAngle, 0, 0]}>
            <boxGeometry args={[0.06, 0.58, rampLength]} />
            <meshStandardMaterial color="#67e8f9" transparent opacity={0.52} roughness={0.25} metalness={0.42} />
          </mesh>
        ))}
      </group>

      <group position={[0, SOFIA_SECOND_LEVEL_Y, 0]}>
        <mesh position={[floorX, -0.12, floorZ]} receiveShadow>
          <boxGeometry args={[floorWidth, 0.24, floorDepth]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.82} metalness={0.08} />
        </mesh>
        <ReadOnlyFurnitureClone furniture={furniture} />
      </group>
    </>
  );
});

`;
insertBefore(retro, 'export function RetroOffice3D({', auditLevelComponent, 'physical audit level component');

const auditFurnitureMemo = String.raw`
  const sofiaAuditLevelFurniture = useMemo(() => {
    if (layoutPreset !== "office") return EMPTY_FURNITURE_ITEMS;
    const source = materializeDefaults("audit").filter(
      (item) => !(item.type === "wall" && item.x === 0 && item.y === 0 && item.w === 1800),
    );
    // Open the north wall exactly where the ramp arrives. The original audit
    // preset is never persisted or edited; these are read-only clone items.
    source.push(
      { _uid: nextUid(), type: "wall", x: 0, y: 0, w: 980, h: 8 } as FurnitureItem,
      { _uid: nextUid(), type: "wall", x: 1120, y: 0, w: 680, h: 8 } as FurnitureItem,
    );
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
  auditFurnitureMemo,
  'audit level furniture memo',
);

replaceOnce(
  retro,
  `            {remoteLayoutFurniture.length > 0 ? (\n              <ReadOnlyFurnitureClone furniture={remoteLayoutFurniture} />\n            ) : null}`,
  `            {layoutPreset === "office" && sofiaAuditLevelFurniture.length > 0 ? (\n              <SofiaAuditLevel furniture={sofiaAuditLevelFurniture} />\n            ) : null}\n\n            {remoteLayoutFurniture.length > 0 ? (\n              <ReadOnlyFurnitureClone furniture={remoteLayoutFurniture} />\n            ) : null}`,
  'render physical audit level',
);

// Route only Audit + QA upstairs. Infrastructure and War Room remain bound to
// the real rooms already present on floor 1 until their physical levels exist.
replaceOnce(
  retro,
  `      audit: { x: 260, y: 1080 },\n      qa: { x: 620, y: 1080 },\n      infra: { x: 980, y: 1080 },\n      intel: { x: 1420, y: 1080 },\n      warroom: { x: 900, y: 1500 },`,
  `      audit: { x: 440, y: 1408 },\n      qa: { x: 1390, y: 1340 },\n      infra: base.infra,\n      intel: base.intel,\n      warroom: base.warroom,`,
  'real level-2 zone anchors',
);
replaceOnce(
  retro,
  `      audit: { x: 260, y: 1170 },\n      qa: { x: 620, y: 1170 },\n      infra: { x: 980, y: 1170 },\n      intel: { x: 1420, y: 1170 },\n      warroom: { x: 900, y: 1500 },`,
  `      audit: { x: 440, y: 1460 },\n      qa: { x: 1390, y: 1400 },\n      infra: base.infra,\n      intel: base.intel,\n      warroom: base.warroom,`,
  'real level-2 walk targets',
);

const oldWarSeats = `  const sofiaWarSeats = useMemo(\n    () =>\n      sofiaCampusMode\n        ? [\n            { x: 810, y: 1490, facing: Math.PI / 2 },\n            { x: 855, y: 1565, facing: Math.PI },\n            { x: 945, y: 1565, facing: Math.PI },\n            { x: 990, y: 1490, facing: -Math.PI / 2 },\n            { x: 945, y: 1420, facing: 0 },\n            { x: 855, y: 1420, facing: 0 },\n          ]\n        : sofiaLayout?.warSeats ?? EMPTY_SOFIA_SEATS,\n    [sofiaCampusMode, sofiaLayout],\n  );`;
replaceOnce(
  retro,
  oldWarSeats,
  '  const sofiaWarSeats = sofiaLayout?.warSeats ?? EMPTY_SOFIA_SEATS;',
  'War Room stays on real floor-1 meeting room',
);

// ---------------------------------------------------------------------------
// 5) NPC vertical traversal. The existing X/Z A* path continues through the
//    same global 1800x1800 world; crossing the ramp interval lifts only that NPC.
//    Other agents remain at their own level, fixing the all-NPCs-move-together
//    limitation without creating a second Canvas.
// ---------------------------------------------------------------------------
const agents = 'src/features/retro-office/objects/agents.tsx';
replaceOnce(
  agents,
  `    const [wx, , wz] = toWorld(agent.x, agent.y);\n    pos.current.set(wx, 0, wz);\n    groupRef.current.position.lerp(pos.current, 0.15);`,
  `    const [wx, , wz] = toWorld(agent.x, agent.y);\n    const isRemoteRuntimeAgent = agent.id.startsWith("remote:");\n    const campusRampProgress = isRemoteRuntimeAgent ? 0 : Math.max(0, Math.min(1, (agent.y - 760) / 260));\n    const sofiaElevation = campusRampProgress * 4.8;\n    pos.current.set(wx, groupRef.current.position.y, wz);\n    groupRef.current.position.lerp(pos.current, 0.15);`,
  'per-agent campus elevation',
);
replaceOnce(
  agents,
  '    groupRef.current.position.y = bounce + breathe;',
  '    groupRef.current.position.y += (sofiaElevation + bounce + breathe - groupRef.current.position.y) * 0.18;',
  'smooth vertical NPC traversal',
);

// ---------------------------------------------------------------------------
// 6) Contain Sofia HUD commit failures: even if a future custom panel breaks,
//    the base office + Canvas remain alive instead of Next replacing the page.
// ---------------------------------------------------------------------------
const office = 'src/features/office/screens/OfficeScreen.tsx';
replaceOnce(
  office,
  '  type ReactNode,\n  useCallback,',
  '  Component,\n  type ReactNode,\n  useCallback,',
  'OfficeScreen Component import',
);
const hudBoundary = String.raw`
class SofiaHudBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    const value = error instanceof Error ? error : new Error(String(error));
    console.error("[sofia-hud-boundary]", value);
    try {
      void fetch("/api/sofia-ops/client-error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "hud-boundary", message: value.message.slice(0, 900), stack: (value.stack || "").slice(0, 2800) }),
      }).catch(() => {});
    } catch {}
  }
  render() { return this.state.failed ? null : this.props.children; }
}

`;
insertBefore(office, 'export function OfficeScreen({', hudBoundary, 'HUD error boundary class');
replaceOnce(
  office,
  `        <SofiaOpsHud\n          floorId={activeFloor.id}\n          floorLabel={activeFloor.shortLabel}\n          onSelectFloor={(floorId) => {\n            void handleSelectFloor(floorId as FloorId);\n          }}\n        />`,
  `        <SofiaHudBoundary>\n          <SofiaOpsHud\n            floorId={activeFloor.id}\n            floorLabel={activeFloor.shortLabel}\n            onSelectFloor={(floorId) => {\n              void handleSelectFloor(floorId as FloorId);\n            }}\n          />\n        </SofiaHudBoundary>`,
  'contain Sofia HUD',
);

console.log('SOFIA_CHAIN: v3.3 real elevated Audit/QA floor + per-agent ramp + gateway auth + mobile DOM hardening applied');
