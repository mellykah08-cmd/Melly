const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

function replaceOnce(file, search, replacement, label) {
  const input = read(file);
  if (!input.includes(search)) throw new Error(`${label}: anchor not found in ${file}`);
  write(file, input.replace(search, replacement));
}

function insertBefore(file, anchor, insertion, label) {
  const input = read(file);
  const idx = input.indexOf(anchor);
  if (idx < 0) throw new Error(`${label}: anchor not found in ${file}`);
  write(file, input.slice(0, idx) + insertion + input.slice(idx));
}

// Persist the latest Digital Twin snapshot on window so the 3D scene can consume
// it even when the HUD effect fires before RetroOffice3D mounts.
replaceOnce(
  'src/features/sofia-ops/SofiaOpsHud.tsx',
  '  useEffect(() => {\n    window.dispatchEvent(new CustomEvent("sofia-ops:director", { detail: snapshot }));\n  }, [snapshot]);',
  '  useEffect(() => {\n    (window as Window & { __SOFIA_OPS_TWIN_STATE?: typeof snapshot }).__SOFIA_OPS_TWIN_STATE = snapshot;\n    window.dispatchEvent(new CustomEvent("sofia-ops:director", { detail: snapshot }));\n  }, [snapshot]);',
  'persist world-director snapshot',
);

const sceneSignals = `type SofiaTwinSceneState = {
  mode: "nominal" | "shadow" | "audit" | "incident" | "simulation";
  healthScore: number;
  incidentCount: number;
  shadowCandidateCount: number;
  shadowCompareCount: number;
};

const DEFAULT_SOFIA_TWIN_SCENE_STATE: SofiaTwinSceneState = {
  mode: "nominal",
  healthScore: 100,
  incidentCount: 0,
  shadowCandidateCount: 0,
  shadowCompareCount: 0,
};

function SofiaOpsSceneSignals({ state }: { state: SofiaTwinSceneState }) {
  const pendingGhosts = Math.min(
    5,
    Math.max(0, state.shadowCandidateCount - state.shadowCompareCount),
  );
  const incident = state.mode === "incident";
  const simulation = state.mode === "simulation";
  const audit = state.mode === "audit";
  const shadow = state.mode === "shadow" || pendingGhosts > 0;

  return (
    <>
      {incident ? (
        <>
          <pointLight position={[0, 4.2, 0]} color="#ff334d" intensity={5.5} distance={13} decay={2} />
          <mesh position={[0, 2.45, 0]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshBasicMaterial color="#ff3655" wireframe transparent opacity={0.9} />
          </mesh>
        </>
      ) : null}
      {simulation ? <pointLight position={[0, 3.2, 0]} color="#22d3ee" intensity={2.2} distance={11} decay={2} /> : null}
      {audit ? <pointLight position={[0, 3.1, 0]} color="#f59e0b" intensity={1.5} distance={9} decay={2} /> : null}
      {shadow ? (
        <group position={[0, 0, 2.7]}>
          {Array.from({ length: pendingGhosts }).map((_, index) => {
            const offset = index - (pendingGhosts - 1) / 2;
            return (
              <group key={index} position={[offset * 0.58, 0, 0]}>
                <mesh position={[0, 0.48, 0]}>
                  <cylinderGeometry args={[0.13, 0.16, 0.55, 10]} />
                  <meshBasicMaterial color="#a78bfa" transparent opacity={0.24} wireframe />
                </mesh>
                <mesh position={[0, 0.86, 0]}>
                  <sphereGeometry args={[0.14, 12, 8]} />
                  <meshBasicMaterial color="#c4b5fd" transparent opacity={0.32} wireframe />
                </mesh>
                <pointLight position={[0, 0.62, 0]} color="#8b5cf6" intensity={0.35} distance={1.8} decay={2} />
              </group>
            );
          })}
        </group>
      ) : null}
    </>
  );
}

`;

insertBefore(
  'src/features/retro-office/RetroOffice3D.tsx',
  'export function RetroOffice3D({',
  sceneSignals,
  'Sofia 3D reactive scene component',
);

replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '  const [heatmapMode, setHeatmapMode] = useState(false);\n  const [trailMode, setTrailMode] = useState(false);',
  '  const [heatmapMode, setHeatmapMode] = useState(false);\n  const [trailMode, setTrailMode] = useState(false);\n  const [sofiaTwinScene, setSofiaTwinScene] = useState<SofiaTwinSceneState>(DEFAULT_SOFIA_TWIN_SCENE_STATE);\n  useEffect(() => {\n    const holder = window as Window & { __SOFIA_OPS_TWIN_STATE?: SofiaTwinSceneState };\n    if (holder.__SOFIA_OPS_TWIN_STATE) setSofiaTwinScene(holder.__SOFIA_OPS_TWIN_STATE);\n    const onDirector = (event: Event) => {\n      const detail = (event as CustomEvent<SofiaTwinSceneState>).detail;\n      if (detail && typeof detail.mode === "string") setSofiaTwinScene(detail);\n    };\n    window.addEventListener("sofia-ops:director", onDirector);\n    return () => window.removeEventListener("sofia-ops:director", onDirector);\n  }, []);',
  'Sofia 3D director state listener',
);

replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '            {/* Keep office lighting static to avoid extra scene churn from ambience effects. */}\n            <ambientLight intensity={0.72} color="#d8d4c8" />',
  '            {/* Sofia Ops world director: cheap scene-level signals, no extra API/GPU service. */}\n            <SofiaOpsSceneSignals state={sofiaTwinScene} />\n            <ambientLight\n              intensity={sofiaTwinScene.mode === "incident" ? 0.56 : sofiaTwinScene.mode === "shadow" ? 0.64 : 0.72}\n              color={sofiaTwinScene.mode === "incident" ? "#ffd0d5" : sofiaTwinScene.mode === "shadow" ? "#ddd6fe" : "#d8d4c8"}\n            />',
  'Sofia reactive world lighting',
);

console.log('SOFIA_OPS_MAX_V23_OK: 3D scene reacts to incidents, simulation, audit and Shadow Twin holograms');
