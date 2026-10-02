const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

function replaceOnce(file, search, replacement, label) {
  const input = read(file);
  const first = input.indexOf(search);
  if (first < 0) throw new Error(label + ': anchor not found in ' + file);
  if (input.indexOf(search, first + 1) >= 0) throw new Error(label + ': anchor is not unique in ' + file);
  write(file, input.slice(0, first) + replacement + input.slice(first + search.length));
}

// ---------------------------------------------------------------------------
// Sofia Ops MAX v2.6 — mobile/WebGL hardening on top of v2.5.
// Applied AFTER patch-ops-v2.5.js. No new services, no new storage, no GPU.
// ---------------------------------------------------------------------------

const SCENE = 'src/features/retro-office/RetroOffice3D.tsx';
const HUD = 'src/features/sofia-ops/SofiaOpsHud.tsx';

write('src/lib/sofia-ops/config.ts', `export const SOFIA_OPS_VERSION = "2.6.0-max";

export const SOFIA_OPS_CAPABILITIES = {
  digitalTwin: true,
  eventFabric: true,
  secureExternalIngress: true,
  shadowTwin: true,
  warRoom: true,
  shortReplayInMemory: true,
  worldDirector: true,
  multiProjectFabric: true,
  proceduralProjectWorld: true,
  spatialSessionMemory: true,
  simulationPortals: true,
  agentProposalGate: true,
  webglStabilityLayer: true,
  gpuGeneration: false,
  deepHistoryPersistence: false,
  longHorizonSimulation: false,
} as const;
`);

// 1) The 3D scene only re-renders when something it actually draws changes.
//    Before: every HUD poll (5 s) and every gateway frame re-rendered the whole
//    RetroOffice3D tree through setSofiaTwinScene(newObject).
replaceOnce(
  SCENE,
  '    const holder = window as Window & { __SOFIA_OPS_TWIN_STATE?: SofiaTwinSceneState };\n    if (holder.__SOFIA_OPS_TWIN_STATE) setSofiaTwinScene(holder.__SOFIA_OPS_TWIN_STATE);\n    const onDirector = (event: Event) => {\n      const detail = (event as CustomEvent<SofiaTwinSceneState>).detail;\n      if (detail && typeof detail.mode === "string") setSofiaTwinScene(detail);\n    };',
  '    const holder = window as Window & { __SOFIA_OPS_TWIN_STATE?: SofiaTwinSceneState };\n    let lastSignature = "";\n    const apply = (detail: SofiaTwinSceneState | undefined) => {\n      if (!detail || typeof detail.mode !== "string") return;\n      const signature = sofiaTwinSceneSignature(detail);\n      if (signature === lastSignature) return;\n      lastSignature = signature;\n      setSofiaTwinScene(detail);\n    };\n    apply(holder.__SOFIA_OPS_TWIN_STATE);\n    const onDirector = (event: Event) => apply((event as CustomEvent<SofiaTwinSceneState>).detail);',
  'scene director signature gate',
);

// 2) Constant light count. three.js recompiles every lit material whenever the
//    number of lights in the scene changes, which on phones shows up as frame
//    freezes (and, under memory pressure, lost WebGL contexts). Keep exactly one
//    status light mounted and draw holograms/towers with unlit materials.
replaceOnce(
  SCENE,
  'function SofiaOpsSceneSignals({ state }: { state: SofiaTwinSceneState }) {',
  'const sofiaTwinSceneSignature = (state: SofiaTwinSceneState) =>\n  [\n    state.mode,\n    Math.min(5, Math.max(0, state.shadowCandidateCount - state.shadowCompareCount)),\n    Math.min(6, state.activeProjects.length),\n    Math.min(3, state.simulationCount),\n    Math.min(8, state.memoryAnchorCount),\n  ].join("|");\n\nfunction SofiaOpsSceneSignals({ state }: { state: SofiaTwinSceneState }) {',
  'scene signature helper',
);
replaceOnce(
  SCENE,
  '      {incident ? (\n        <>\n          <pointLight position={[0, 4.2, 0]} color="#ff334d" intensity={5.5} distance={13} decay={2} />\n          <mesh position={[0, 2.45, 0]}>\n            <octahedronGeometry args={[0.22, 0]} />\n            <meshBasicMaterial color="#ff3655" wireframe transparent opacity={0.9} />\n          </mesh>\n        </>\n      ) : null}\n      {simulation ? <pointLight position={[0, 3.2, 0]} color="#22d3ee" intensity={2.2} distance={11} decay={2} /> : null}\n      {audit ? <pointLight position={[0, 3.1, 0]} color="#f59e0b" intensity={1.5} distance={9} decay={2} /> : null}',
  '      <pointLight\n        position={[0, incident ? 4.2 : 3.2, 0]}\n        color={incident ? "#ff334d" : simulation ? "#22d3ee" : audit ? "#f59e0b" : "#ffffff"}\n        intensity={incident ? 5.5 : simulation ? 2.2 : audit ? 1.5 : 0}\n        distance={incident ? 13 : 11}\n        decay={2}\n      />\n      {incident ? (\n        <mesh position={[0, 2.45, 0]}>\n          <octahedronGeometry args={[0.22, 0]} />\n          <meshBasicMaterial color="#ff3655" wireframe transparent opacity={0.9} />\n        </mesh>\n      ) : null}',
  'single persistent status light',
);
replaceOnce(
  SCENE,
  '                <pointLight position={[0, height + 0.1, 0]} color="#22d3ee" intensity={0.25} distance={1.5} decay={2} />\n',
  '',
  'drop per-project point lights',
);
replaceOnce(
  SCENE,
  '                <pointLight position={[0, 0.62, 0]} color="#8b5cf6" intensity={0.35} distance={1.8} decay={2} />\n',
  '',
  'drop per-ghost point lights',
);

// 3) WebGL context loss: let three.js restore the context in place; if the
//    browser does not give it back within a few seconds, rebuild only the Canvas
//    (scene state lives in React, so furniture/agents come straight back).
replaceOnce(
  SCENE,
  '  const canvasResetKey = "sofia-stable-canvas";',
  '  const [sofiaCanvasEpoch, setSofiaCanvasEpoch] = useState(0);\n  const sofiaContextTimerRef = useRef<number | null>(null);\n  useEffect(() => () => {\n    if (sofiaContextTimerRef.current !== null) window.clearTimeout(sofiaContextTimerRef.current);\n  }, []);\n  const canvasResetKey = "sofia-stable-canvas-" + sofiaCanvasEpoch;',
  'context-loss canvas epoch',
);
replaceOnce(
  SCENE,
  '              canvas.addEventListener("webglcontextlost", (event) => {\n                event.preventDefault();\n                console.warn("SOFIA_WEBGL_CONTEXT_LOST");\n              });\n              canvas.addEventListener("webglcontextrestored", () => {\n                console.info("SOFIA_WEBGL_CONTEXT_RESTORED");\n              });',
  '              canvas.addEventListener("webglcontextlost", (event) => {\n                event.preventDefault();\n                // r3f calls forceContextLoss() ~500 ms after a Canvas unmounts (floor\n                // switch, epoch rebuild). That canvas is already detached: ignore it.\n                if (!canvas.isConnected) return;\n                console.warn("SOFIA_WEBGL_CONTEXT_LOST");\n                if (sofiaContextTimerRef.current !== null) window.clearTimeout(sofiaContextTimerRef.current);\n                sofiaContextTimerRef.current = window.setTimeout(() => {\n                  sofiaContextTimerRef.current = null;\n                  if (!canvas.isConnected) return;\n                  console.warn("SOFIA_WEBGL_CONTEXT_REBUILD");\n                  setSofiaCanvasEpoch((value) => value + 1);\n                }, 4000);\n              });\n              canvas.addEventListener("webglcontextrestored", () => {\n                if (sofiaContextTimerRef.current !== null) window.clearTimeout(sofiaContextTimerRef.current);\n                sofiaContextTimerRef.current = null;\n                console.info("SOFIA_WEBGL_CONTEXT_RESTORED");\n              });',
  'context-loss rebuild fallback',
);

// 4) Adaptive DPR with hysteresis. Upstream could step the drawing buffer size
//    every ~45 frames; each step reallocates the WebGL framebuffer, which on
//    phones reads as the scene blinking. Touch devices are capped at 1.25, the
//    DPR drops quickly when frames are slow and only climbs back after ~6 s of
//    sustained headroom, never more than once every 4 s.
replaceOnce(
  SCENE,
  '  useEffect(() => {\n    const initialDpr = Math.min(window.devicePixelRatio || 1, 1.5);\n    currentDprRef.current = initialDpr;\n    setDpr(initialDpr);',
  '  const lastDprChangeRef = useRef(0);\n  const healthyWindowsRef = useRef(0);\n  const maxDprForDevice = () =>\n    Math.min(\n      window.devicePixelRatio || 1,\n      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches ? 1.25 : 1.5,\n    );\n\n  useEffect(() => {\n    const initialDpr = maxDprForDevice();\n    currentDprRef.current = initialDpr;\n    lastDprChangeRef.current = performance.now();\n    setDpr(initialDpr);',
  'adaptive DPR device cap',
);
replaceOnce(
  SCENE,
  '      const restoredDpr = Math.min(window.devicePixelRatio || 1, 1.5);\n      currentDprRef.current = restoredDpr;\n      setDpr(restoredDpr);',
  '      const restoredDpr = maxDprForDevice();\n      currentDprRef.current = restoredDpr;\n      lastDprChangeRef.current = performance.now();\n      healthyWindowsRef.current = 0;\n      setDpr(restoredDpr);',
  'adaptive DPR restore cap',
);
replaceOnce(
  SCENE,
  '    const maxDpr = Math.min(window.devicePixelRatio || 1, 1.5);\n    const minDpr = 0.85;\n    let nextDpr = currentDprRef.current;\n    if (avgDeltaRef.current > 1 / 42) {\n      nextDpr = Math.max(minDpr, currentDprRef.current - 0.1);\n    } else if (avgDeltaRef.current < 1 / 57) {\n      nextDpr = Math.min(maxDpr, currentDprRef.current + 0.05);\n    }\n    if (Math.abs(nextDpr - currentDprRef.current) < 0.025) return;\n    currentDprRef.current = nextDpr;',
  '    const maxDpr = maxDprForDevice();\n    const minDpr = 0.85;\n    const now = performance.now();\n    let nextDpr = currentDprRef.current;\n    if (avgDeltaRef.current > 1 / 40) {\n      healthyWindowsRef.current = 0;\n      nextDpr = Math.max(minDpr, currentDprRef.current - 0.15);\n    } else if (avgDeltaRef.current < 1 / 57) {\n      healthyWindowsRef.current += 1;\n      if (healthyWindowsRef.current >= 8) nextDpr = Math.min(maxDpr, currentDprRef.current + 0.1);\n    } else {\n      healthyWindowsRef.current = 0;\n    }\n    if (Math.abs(nextDpr - currentDprRef.current) < 0.025) return;\n    if (now - lastDprChangeRef.current < 4000) return;\n    lastDprChangeRef.current = now;\n    healthyWindowsRef.current = 0;\n    currentDprRef.current = nextDpr;',
  'adaptive DPR hysteresis',
);

// 5) HUD: no work while the tab is hidden, no state churn when the ingress
//    buffer did not change, runtime bursts coalesced, and incidents still age
//    out of the 5-minute window without new traffic.
replaceOnce(
  HUD,
  '  useEffect(() => subscribeSofiaOpsEvents(() => setRuntimeEvents(getSofiaOpsEvents())), []);',
  '  const [clockTick, setClockTick] = useState(0);\n  useEffect(() => {\n    const timer = window.setInterval(() => setClockTick((value) => value + 1), 30000);\n    return () => window.clearInterval(timer);\n  }, []);\n  useEffect(() => {\n    let frame: number | null = null;\n    const unsubscribe = subscribeSofiaOpsEvents(() => {\n      if (frame !== null) return;\n      frame = window.setTimeout(() => {\n        frame = null;\n        setRuntimeEvents(getSofiaOpsEvents());\n      }, 400);\n    });\n    return () => {\n      if (frame !== null) window.clearTimeout(frame);\n      unsubscribe();\n    };\n  }, []);',
  'HUD runtime event coalescing',
);
replaceOnce(
  HUD,
  '    const pull = async () => {\n      try {',
  '    let lastKey = "";\n    const pull = async () => {\n      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;\n      try {',
  'HUD pause polling when hidden',
);
replaceOnce(
  HUD,
  '        if (active && Array.isArray(data.events)) setExternalEvents(data.events);',
  '        if (!active || !Array.isArray(data.events)) return;\n        const key = data.events.length + ":" + (data.events[0]?.id ?? "") + ":" + (data.events[data.events.length - 1]?.id ?? "");\n        if (key === lastKey) return;\n        lastKey = key;\n        setExternalEvents(data.events);',
  'HUD skip unchanged ingress polls',
);
replaceOnce(
  HUD,
  '  const snapshot = useMemo(() => deriveTwinSnapshot(events), [events]);',
  '  // clockTick re-derives the snapshot so the 5-minute incident window can expire.\n  // eslint-disable-next-line react-hooks/exhaustive-deps\n  const snapshot = useMemo(() => deriveTwinSnapshot(events), [events, clockTick]);',
  'HUD snapshot ageing',
);

// 5b) Environment map. drei's preset="city" downloads a 1.5 MB HDR from
//     raw.githack.com at runtime; when that fetch fails (flaky mobile network,
//     CDN hiccup) the error escapes Suspense and Next shows "Application error"
//     for the whole office. Serve the HDR from our own origin when the build put
//     it in public/ (see Dockerfile), and in every case contain loader failures
//     to the environment lighting so the office keeps rendering.
const HDR_PUBLIC = 'public/sofia-assets/potsdamer_platz_1k.hdr';
const environmentProps = fs.existsSync(HDR_PUBLIC)
  ? 'files="/sofia-assets/potsdamer_platz_1k.hdr"'
  : 'preset="city"';
replaceOnce(
  SCENE,
  'function SofiaOpsSceneSignals({ state }: { state: SofiaTwinSceneState }) {',
  'class SofiaSceneErrorBoundary extends Component<{ label: string; children?: ReactNode }, { failed: boolean }> {\n  state = { failed: false };\n  static getDerivedStateFromError() {\n    return { failed: true };\n  }\n  componentDidCatch(error: unknown) {\n    console.warn("SOFIA_SCENE_ASSET_FALLBACK", this.props.label, error instanceof Error ? error.message : String(error));\n  }\n  render() {\n    return this.state.failed ? null : this.props.children;\n  }\n}\n\nfunction SofiaOpsSceneSignals({ state }: { state: SofiaTwinSceneState }) {',
  'scene asset error boundary',
);
replaceOnce(
  SCENE,
  'import { Canvas, useFrame, useThree } from "@react-three/fiber";',
  'import { Component, type ReactNode } from "react";\nimport { Canvas, useFrame, useThree } from "@react-three/fiber";',
  'error boundary imports',
);
replaceOnce(
  SCENE,
  '            <Suspense fallback={null}>\n              <Environment preset="city" />\n            </Suspense>',
  '            <SofiaSceneErrorBoundary label="environment">\n              <Suspense fallback={null}>\n                <Environment ' + environmentProps + ' />\n              </Suspense>\n            </SofiaSceneErrorBoundary>',
  'contained environment map',
);
replaceOnce(
  'src/features/agents/components/AgentAvatarPreview3D.tsx',
  '        <Environment preset="city" />',
  '        <Environment ' + environmentProps + ' />',
  'avatar preview environment map',
);

// 5c) CSP: three-stdlib's meshopt decoder (enabled by drei useGLTF) compiles an
//     inline WebAssembly module. The production CSP blocked it, raising an
//     uncaught error on every load. 'wasm-unsafe-eval' allows WebAssembly
//     compilation only; JavaScript eval stays blocked.
replaceOnce(
  'next.config.ts',
  '        : ["script-src \'self\' \'unsafe-inline\' blob:"]),',
  '        : ["script-src \'self\' \'unsafe-inline\' \'wasm-unsafe-eval\' blob:"]),',
  'CSP wasm-unsafe-eval',
);

// 5d) 3D text. drei <Text> (troika) has no font configured upstream, so every
//     label resolves its glyphs through unicode-font-resolver on jsDelivr and
//     *suspends* until that download finishes. r3f forwards an uncaught
//     suspension out of the Canvas, so the page-level Suspense swapped the whole
//     office for "Loading..." — the scene and NPCs vanished and came back
//     whenever a label with new characters (ç, ã, emoji in a bubble) appeared.
//     SofiaSafeText serves the Latin font from our origin and gives every label
//     its own Suspense, so a slow glyph fetch can only delay that one label.
const LATIN_FONT_PUBLIC = 'public/sofia-assets/fonts/latin-sans-400.woff';
write('src/features/sofia-ops/SafeText.tsx', [
  '"use client";',
  '',
  'import { Suspense, type ComponentProps } from "react";',
  'import { Text } from "@react-three/drei";',
  '',
  'const SOFIA_TEXT_FONT: string | undefined = ' + (fs.existsSync(LATIN_FONT_PUBLIC) ? '"/sofia-assets/fonts/latin-sans-400.woff"' : 'undefined') + ';',
  '',
  'export function SofiaSafeText(props: ComponentProps<typeof Text>) {',
  '  return (',
  '    <Suspense fallback={null}>',
  '      <Text {...props} font={props.font ?? SOFIA_TEXT_FONT} />',
  '    </Suspense>',
  '  );',
  '}',
  '',
].join('\n'));
for (const file of [
  'src/features/retro-office/objects/machines.tsx',
  'src/features/retro-office/objects/agents.tsx',
  'src/features/retro-office/objects/Jukebox.tsx',
  'src/features/retro-office/systems/visualSystems.tsx',
]) {
  const input = read(file);
  let output = input;
  if (input.includes('import { Billboard, Text } from "@react-three/drei";')) {
    output = input.replace('import { Billboard, Text } from "@react-three/drei";', 'import { Billboard } from "@react-three/drei";\nimport { SofiaSafeText as Text } from "@/features/sofia-ops/SafeText";');
  } else if (input.includes('import { Text } from "@react-three/drei";')) {
    output = input.replace('import { Text } from "@react-three/drei";', 'import { SofiaSafeText as Text } from "@/features/sofia-ops/SafeText";');
  } else {
    throw new Error('safe text import: drei Text import not found in ' + file);
  }
  write(file, output);
}

// 6) External ingress: constant-time bearer comparison.
replaceOnce(
  'src/app/api/sofia-ops/events/route.ts',
  '  const auth = request.headers.get("authorization") ?? "";\n  if (auth !== "Bearer " + expected) return NextResponse.json({ error: "unauthorized" }, { status: 401 });',
  '  const auth = request.headers.get("authorization") ?? "";\n  const given = Buffer.from(auth, "utf8");\n  const wanted = Buffer.from("Bearer " + expected, "utf8");\n  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {\n    return NextResponse.json({ error: "unauthorized" }, { status: 401 });\n  }',
  'ingress constant-time auth',
);
replaceOnce(
  'src/app/api/sofia-ops/events/route.ts',
  'import { NextRequest, NextResponse } from "next/server";',
  'import { timingSafeEqual } from "node:crypto";\nimport { NextRequest, NextResponse } from "next/server";',
  'ingress crypto import',
);

console.log("SOFIA_OPS_MAX_V26_OK: scene re-render gate, constant light count, context-loss rebuild, DPR hysteresis, HUD throttling, self-hosted HDR/font, contained 3D text suspense");
