const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

function replaceOnce(file, from, to, label) {
  const text = read(file);
  if (!text.includes(from)) throw new Error(`SOFIA v3.0 anchor missing: ${label} in ${file}`);
  write(file, text.replace(from, to));
}

function insertBefore(file, anchor, insertion, label) {
  const text = read(file);
  const idx = text.indexOf(anchor);
  if (idx < 0) throw new Error(`SOFIA v3.0 anchor missing: ${label} in ${file}`);
  write(file, text.slice(0, idx) + insertion + text.slice(idx));
}

// 1) HUD: AUTO now means spatial auto-follow, including floor transitions.
const hud = 'src/features/sofia-ops/SofiaOpsHud.tsx';
replaceOnce(
  hud,
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useMemo, useRef, useState } from "react";',
  'HUD useRef import',
);
replaceOnce(
  hud,
  '  const focusFloorElsewhere = focus && focus.floorId !== floorId && FLOOR_ORDER.includes(floorId as SofiaFloorId) ? focus.floorId : null;\n',
  '  const focusFloorElsewhere = focus && focus.floorId !== floorId && FLOOR_ORDER.includes(focus.floorId as SofiaFloorId) ? focus.floorId : null;\n  const selectFloorRef = useRef(onSelectFloor);\n  useEffect(() => { selectFloorRef.current = onSelectFloor; }, [onSelectFloor]);\n  useEffect(() => {\n    if (!view.autoFollow || view.replay.active || !focusFloorElsewhere) return;\n    const timer = window.setTimeout(() => selectFloorRef.current?.(focusFloorElsewhere), 420);\n    return () => window.clearTimeout(timer);\n  }, [view.autoFollow, view.replay.active, focusFloorElsewhere]);\n\n  useEffect(() => {\n    const report = (kind, value) => {\n      try {\n        const error = value instanceof Error ? value : new Error(typeof value === "string" ? value : String(value));\n        void fetch("/api/sofia-ops/client-error", {\n          method: "POST",\n          headers: { "content-type": "application/json" },\n          body: JSON.stringify({ scope: "window", kind, message: error.message.slice(0, 900), stack: (error.stack || "").slice(0, 2800) }),\n        }).catch(() => {});\n      } catch {}\n    };\n    const onError = (event) => report("error", event.error || event.message);\n    const onRejection = (event) => report("unhandledrejection", event.reason);\n    window.addEventListener("error", onError);\n    window.addEventListener("unhandledrejection", onRejection);\n    return () => {\n      window.removeEventListener("error", onError);\n      window.removeEventListener("unhandledrejection", onRejection);\n    };\n  }, []);\n',
  'AUTO floor follow + client telemetry',
);

// 2) Spatial world: less debug text, much stronger physical architecture.
const spatial = 'src/features/sofia-ops/SofiaSpatialLayer.tsx';
let spatialText = read(spatial);
for (const [from, to] of [
  ['size={0.24}', 'size={0.14}'],
  ['size={0.21}', 'size={0.12}'],
  ['size={0.19}', 'size={0.11}'],
  ['size={0.17}', 'size={0.10}'],
  ['size={0.15}', 'size={0.09}'],
]) spatialText = spatialText.split(from).join(to);
write(spatial, spatialText);

const surreal = String.raw`
function SurrealArchitecture({ floorId, world }: { floorId: SofiaFloorId; world: WorldState }) {
  if (floorId === "openclaw-ground") return null;
  const [wx, , wz] = toWorld(900, 420);
  const active = world.mode !== "nominal";
  const incident = world.mode === "incident";
  const shadow = world.mode === "shadow";
  const audit = world.mode === "audit";
  const deploy = world.mode === "deploy" || world.mode === "working";
  const recovery = world.mode === "recovery";
  const color = floorId === "audit-second" ? "#f59e0b"
    : floorId === "dev-third" ? "#22d3ee"
    : floorId === "infra-fourth" ? "#3b82f6"
    : floorId === "intel-fifth" ? "#34d399"
    : "#ef4444";
  const accent = incident ? "#ff1744" : shadow ? "#a78bfa" : recovery ? "#10b981" : color;

  const bars = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return [Math.cos(a) * 2.45, Math.sin(a) * 2.45, a] as const;
  });

  return (
    <group position={[wx, 0.025, wz]}>
      {/* Persistent floor identity: a large but cheap spatial landmark. */}
      <mesh position={[0, 1.35, 0]} rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[1.12, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={active ? 0.48 : 0.20} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.72, 0.045, 6, 28]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.62 : 0.28} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[1.38, 0.032, 6, 24]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.44 : 0.18} depthWrite={false} />
      </mesh>

      {floorId === "audit-second" ? (
        <group>
          {[-1.9, -0.65, 0.65, 1.9].map((x, i) => (
            <mesh key={i} position={[x, 0.72, i % 2 ? 1.25 : -1.25]} rotation={[0, i % 2 ? 0.34 : -0.34, i % 2 ? 0.18 : -0.18]}>
              <boxGeometry args={[0.18, 1.45, 1.55]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={audit ? 0.68 : 0.30} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ) : null}

      {floorId === "dev-third" ? (
        <group>
          {[-1.45, 1.45].map((x, i) => (
            <group key={i} position={[x, 0, 0]}>
              <mesh position={[0, 1.1, 0]}><boxGeometry args={[0.16, 2.2, 0.16]} /><meshBasicMaterial color="#22d3ee" transparent opacity={0.55} /></mesh>
              <mesh position={[0, 2.15, 0]}><boxGeometry args={[1.0, 0.16, 0.16]} /><meshBasicMaterial color="#22d3ee" transparent opacity={0.55} /></mesh>
              <mesh position={[0, 1.1, 0]}><boxGeometry args={[1.0, 0.16, 0.16]} /><meshBasicMaterial color="#22d3ee" transparent opacity={deploy ? 0.78 : 0.28} /></mesh>
            </group>
          ))}
        </group>
      ) : null}

      {floorId === "infra-fourth" ? (
        <group>
          {[-1.55, 0, 1.55].map((x, i) => (
            <group key={i} position={[x, 0, i === 1 ? -0.65 : 0.65]}>
              <mesh position={[0, 1.0 + i * 0.18, 0]}><boxGeometry args={[0.72, 2.0 + i * 0.36, 0.72]} /><meshBasicMaterial color="#0f172a" transparent opacity={0.88} /></mesh>
              {[0.45, 0.85, 1.25, 1.65].map((y, j) => <mesh key={j} position={[0, y, 0.37]}><boxGeometry args={[0.5, 0.05, 0.02]} /><meshBasicMaterial color={incident ? "#ff1744" : "#38bdf8"} transparent opacity={0.86} /></mesh>)}
            </group>
          ))}
        </group>
      ) : null}

      {floorId === "intel-fifth" ? (
        <group>
          <mesh position={[0, 1.1, 0]}><coneGeometry args={[1.3, 2.2, 4]} /><meshBasicMaterial color="#34d399" wireframe transparent opacity={0.48} /></mesh>
          {[0.8, 1.3, 1.8].map((r, i) => <mesh key={i} position={[0, 1.05 + i * 0.18, 0]} rotation={[Math.PI / 2, i * 0.35, 0]}><torusGeometry args={[r, 0.025, 5, 24]} /><meshBasicMaterial color="#34d399" transparent opacity={0.34 + i * 0.08} /></mesh>)}
        </group>
      ) : null}

      {floorId === "command-sixth" ? (
        <group>
          {bars.map(([x, z, a], i) => (
            <mesh key={i} position={[x, 1.05, z]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.22, 2.1, 0.72]} />
              <meshBasicMaterial color={incident ? "#ff1744" : "#ef4444"} transparent opacity={incident ? 0.82 : 0.34} depthWrite={false} />
            </mesh>
          ))}
          <mesh position={[0, 2.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.45, 0.08, 6, 6]} /><meshBasicMaterial color={accent} transparent opacity={incident ? 0.9 : 0.38} /></mesh>
        </group>
      ) : null}

      {/* Event architecture: the room itself changes shape instead of just showing labels. */}
      {shadow ? (
        <group>
          <mesh position={[-1.05, 1.15, 0]}><boxGeometry args={[0.72, 2.3, 0.72]} /><meshBasicMaterial color="#8b5cf6" wireframe transparent opacity={0.72} /></mesh>
          <mesh position={[1.05, 1.15, 0]}><boxGeometry args={[0.72, 2.3, 0.72]} /><meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.72} /></mesh>
          <mesh position={[0, 1.15, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.035, 0.035, 2.1, 6]} /><meshBasicMaterial color="#e9d5ff" transparent opacity={0.75} /></mesh>
        </group>
      ) : null}

      {incident ? (
        <group>
          <mesh position={[0, 1.4, 0]}><sphereGeometry args={[2.15, 12, 8]} /><meshBasicMaterial color="#ff1744" wireframe transparent opacity={0.22} depthWrite={false} /></mesh>
          {bars.map(([x, z], i) => <mesh key={i} position={[x, 1.55, z]}><cylinderGeometry args={[0.055, 0.055, 3.1, 6]} /><meshBasicMaterial color="#ff1744" transparent opacity={0.74} /></mesh>)}
          <mesh position={[0, 2.95, 0]} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[1.3, 2.4, 6]} /><meshBasicMaterial color="#ff1744" transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        </group>
      ) : null}

      {recovery ? (
        <group>
          <mesh position={[0, 1.0, 0]}><sphereGeometry args={[1.45, 10, 7]} /><meshBasicMaterial color="#10b981" wireframe transparent opacity={0.28} /></mesh>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.2, 2.5, 24]} /><meshBasicMaterial color="#10b981" transparent opacity={0.42} side={THREE.DoubleSide} /></mesh>
        </group>
      ) : null}
    </group>
  );
}

`;
insertBefore(spatial, 'export function SofiaSpatialLayer({', surreal, 'SurrealArchitecture component');
replaceOnce(
  spatial,
  '      {floorId ? <FloorSignature floorId={floorId} mode={world.mode} /> : null}\n      <SpatialProbe',
  '      {floorId ? <FloorSignature floorId={floorId} mode={world.mode} /> : null}\n      {floorId ? <SurrealArchitecture floorId={floorId} world={world} /> : null}\n      <SpatialProbe',
  'render SurrealArchitecture',
);

// 3) Contain failures from Sofia's 3D overlay so the base office survives.
const retro = 'src/features/retro-office/RetroOffice3D.tsx';
replaceOnce(
  retro,
  '  type ComponentProps,\n  memo,',
  '  Component,\n  type ComponentProps,\n  type ReactNode,\n  memo,',
  'React Component import for boundary',
);
const boundary = String.raw`
class SofiaSpatialBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    const value = error instanceof Error ? error : new Error(String(error));
    console.error("[sofia-spatial-boundary]", value);
    try {
      void fetch("/api/sofia-ops/client-error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "spatial-boundary", message: value.message.slice(0, 900), stack: (value.stack || "").slice(0, 2800) }),
      }).catch(() => {});
    } catch {}
  }
  render() { return this.state.failed ? null : this.props.children; }
}

`;
insertBefore(retro, 'export function RetroOffice3D({', boundary, 'Sofia spatial error boundary');
let retroText = read(retro);
const match = retroText.match(/<SofiaSpatialLayer[\s\S]*?\/>/);
if (!match) throw new Error('SOFIA v3.0 anchor missing: SofiaSpatialLayer render');
retroText = retroText.replace(match[0], `<SofiaSpatialBoundary>\n              ${match[0]}\n            </SofiaSpatialBoundary>`);
write(retro, retroText);

// 4) Client-side error telemetry endpoint. No secrets or payload data are stored.
const errDir = 'src/app/api/sofia-ops/client-error';
fs.mkdirSync(errDir, { recursive: true });
write(path.join(errDir, 'route.ts'), `import { NextRequest, NextResponse } from "next/server";\n\nexport const runtime = "nodejs";\nexport const dynamic = "force-dynamic";\n\nexport async function POST(request: NextRequest) {\n  try {\n    const raw = await request.text();\n    if (raw.length > 6000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });\n    const body = raw ? JSON.parse(raw) : {};\n    const safe = {\n      scope: typeof body.scope === "string" ? body.scope.slice(0, 80) : "client",\n      kind: typeof body.kind === "string" ? body.kind.slice(0, 80) : undefined,\n      message: typeof body.message === "string" ? body.message.slice(0, 900) : "unknown",\n      stack: typeof body.stack === "string" ? body.stack.slice(0, 2800) : "",\n    };\n    console.error("[sofia-client-error]", JSON.stringify(safe));\n    return NextResponse.json({ ok: true }, { status: 202 });\n  } catch {\n    return NextResponse.json({ error: "invalid_json" }, { status: 400 });\n  }\n}\n`);

// 5) Demo reaches the wow states faster; it still uses the real Event Fabric.
const harness = 'src/app/api/sofia-ops/harness/route.ts';
replaceOnce(
  harness,
  'const SCENARIO: { at: number; kind: string }[] = [\n  { at: 0, kind: "deploy.started" },\n  { at: 9000, kind: "audit.started" },\n  { at: 18000, kind: "shadow.candidate" },\n  { at: 23000, kind: "shadow.human" },\n  { at: 28000, kind: "shadow.compare" },\n  { at: 38000, kind: "deploy.failed" },\n  { at: 70000, kind: "recovery" },\n];',
  'const SCENARIO: { at: number; kind: string }[] = [\n  { at: 0, kind: "deploy.started" },\n  { at: 5000, kind: "audit.started" },\n  { at: 10000, kind: "shadow.candidate" },\n  { at: 14000, kind: "shadow.human" },\n  { at: 18000, kind: "shadow.compare" },\n  { at: 26000, kind: "deploy.failed" },\n  { at: 45000, kind: "recovery" },\n];',
  'faster spatial demo scenario',
);

console.log('SOFIA_CHAIN: v3.0 surreal architecture + floor auto-follow + crash containment applied');
