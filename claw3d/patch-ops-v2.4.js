const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

function replaceOnce(file, search, replacement, label) {
  const input = read(file);
  if (!input.includes(search)) throw new Error(`${label}: anchor not found in ${file}`);
  write(file, input.replace(search, replacement));
}

write('src/lib/sofia-ops/config.ts', `export const SOFIA_OPS_VERSION = "2.4.0-max";

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

write('src/lib/sofia-ops/twinEngine.ts', `export type TwinEvent = {
  id: string;
  ts: number;
  type: string;
  source: string;
  severity: "info" | "success" | "warning" | "critical";
  summary: string;
  payloadText?: string;
  floorHint?: string | null;
  project?: string | null;
  agentId?: string | null;
  correlationId?: string | null;
};

export type TwinSnapshot = {
  mode: "nominal" | "shadow" | "audit" | "incident" | "simulation";
  healthScore: number;
  incidentCount: number;
  warningCount: number;
  shadowCandidateCount: number;
  shadowHumanCount: number;
  shadowCompareCount: number;
  simulationCount: number;
  memoryAnchorCount: number;
  agentProposalCount: number;
  pendingApprovalCount: number;
  activeProjects: string[];
  activeAgents: string[];
  sourceActivity: Record<string, number>;
  recommendedFloor: string;
  recommendedReason: string;
};

const has = (event: TwinEvent, value: string) =>
  (event.type + " " + event.summary + " " + (event.payloadText || "")).toLowerCase().includes(value);

export const recommendTwinFloor = (events: TwinEvent[]) => {
  const recent = events[0];
  if (!recent) return { floor: "Operação", reason: "aguardando atividade" };
  if (recent.severity === "critical") return { floor: "Command", reason: "incidente crítico ativo" };
  if (recent.source === "railway" || has(recent, "deploy") || has(recent, "infra")) return { floor: "Infra", reason: "atividade de infraestrutura" };
  if (recent.source === "github" || has(recent, "test") || has(recent, "qa") || has(recent, "build")) return { floor: "Dev & QA", reason: "atividade de desenvolvimento/teste" };
  if (recent.source === "n8n" || has(recent, "audit") || has(recent, "review")) return { floor: "Auditoria", reason: "workflow/revisão em foco" };
  if (has(recent, "analytic") || has(recent, "metric") || has(recent, "compare")) return { floor: "Inteligência", reason: "análise/comparação em foco" };
  return { floor: "Operação", reason: "atividade operacional" };
};

export const deriveTwinSnapshot = (events: TwinEvent[]): TwinSnapshot => {
  const now = Date.now();
  const recent = events.filter((event) => now - event.ts <= 300000);
  const incidents = recent.filter((event) => event.severity === "critical");
  const warnings = recent.filter((event) => event.severity === "warning");
  const shadowCandidates = events.filter((event) => has(event, "shadow.candidate") || has(event, "shadow_candidate"));
  const shadowHumans = events.filter((event) => has(event, "shadow.human") || has(event, "shadow_human"));
  const shadowComparisons = events.filter((event) => has(event, "shadow.compare") || has(event, "shadow_compare"));
  const simulations = events.filter((event) => has(event, "simulation") || has(event, "dry-run") || has(event, "dry_run"));
  const memoryAnchors = events.filter((event) => Boolean(event.floorHint) || has(event, "memory.anchor") || has(event, "memory_anchor"));
  const agentProposals = events.filter((event) => has(event, "agent.proposal") || has(event, "agent_proposal"));
  const approvals = events.filter((event) => has(event, "approval.request") || has(event, "approval_request"));
  const projects = [...new Set(events.map((event) => event.project).filter((value): value is string => Boolean(value)))].slice(0, 12);
  const agents = [...new Set(events.map((event) => event.agentId).filter((value): value is string => Boolean(value)))].slice(0, 24);
  const sourceActivity: Record<string, number> = {};
  for (const event of events) sourceActivity[event.source] = (sourceActivity[event.source] || 0) + 1;
  const director = recommendTwinFloor(events);
  const penalty = Math.min(80, incidents.length * 25 + warnings.length * 7);
  const mode: TwinSnapshot["mode"] = incidents.length
    ? "incident"
    : simulations.length && events[0] && (has(events[0], "simulation") || has(events[0], "dry-run") || has(events[0], "dry_run"))
      ? "simulation"
      : shadowCandidates.length && events[0] && has(events[0], "shadow")
        ? "shadow"
        : events[0] && (events[0].source === "n8n" || has(events[0], "audit") || has(events[0], "review"))
          ? "audit"
          : "nominal";
  return {
    mode,
    healthScore: Math.max(0, 100 - penalty),
    incidentCount: incidents.length,
    warningCount: warnings.length,
    shadowCandidateCount: shadowCandidates.length,
    shadowHumanCount: shadowHumans.length,
    shadowCompareCount: shadowComparisons.length,
    simulationCount: simulations.length,
    memoryAnchorCount: memoryAnchors.length,
    agentProposalCount: agentProposals.length,
    pendingApprovalCount: approvals.length,
    activeProjects: projects,
    activeAgents: agents,
    sourceActivity,
    recommendedFloor: director.floor,
    recommendedReason: director.reason,
  };
};

export const replayEventsAt = (events: TwinEvent[], cutoffTs: number) =>
  events.filter((event) => event.ts <= cutoffTs);
`);

// Add a topology view to the Digital Twin HUD. It appears automatically as soon
// as external projects/agents identify themselves in ingress events.
replaceOnce(
  'src/features/sofia-ops/SofiaOpsHud.tsx',
  'type Tab = "live" | "replay" | "shadow" | "war" | "system";',
  'type Tab = "live" | "replay" | "shadow" | "war" | "topology" | "system";',
  'topology tab type',
);
replaceOnce(
  'src/features/sofia-ops/SofiaOpsHud.tsx',
  '            {(["live", "replay", "shadow", "war", "system"] as Tab[]).map((name) => (',
  '            {(["live", "replay", "shadow", "war", "topology", "system"] as Tab[]).map((name) => (',
  'topology tab nav',
);
replaceOnce(
  'src/features/sofia-ops/SofiaOpsHud.tsx',
  '            {tab === "system" ? (',
  '            {tab === "topology" ? (\n              <div className="space-y-2 text-[9px]">\n                <div className="grid grid-cols-3 gap-1.5"><div className="rounded border border-cyan-500/20 bg-cyan-950/20 p-2"><div className="text-white/45">PROJECTS</div><div className="mt-1 text-cyan-200">{snapshot.activeProjects.length}</div></div><div className="rounded border border-violet-500/20 bg-violet-950/20 p-2"><div className="text-white/45">EXT. AGENTS</div><div className="mt-1 text-violet-200">{snapshot.activeAgents.length}</div></div><div className="rounded border border-amber-500/20 bg-amber-950/20 p-2"><div className="text-white/45">MEMORY</div><div className="mt-1 text-amber-200">{snapshot.memoryAnchorCount}</div></div></div>\n                <div className="rounded border border-cyan-500/15 bg-white/5 p-2 text-white/55"><div className="text-white/35">PROCEDURAL PROJECT WORLD</div><div className="mt-1">{snapshot.activeProjects.length ? snapshot.activeProjects.join(" · ") : "Nenhum projeto externo conectado ainda. Quando um projeto enviar eventos com o campo project, uma presença espacial nasce automaticamente."}</div></div>\n                <div className="rounded border border-violet-500/15 bg-white/5 p-2 text-white/55"><div className="text-white/35">AGENT FABRIC</div><div className="mt-1">{snapshot.activeAgents.length ? snapshot.activeAgents.join(" · ") : "Aguardando agentes externos identificados por agentId."}</div></div>\n                <div className="rounded bg-white/5 p-2 text-white/40">Propostas de novos agentes: {snapshot.agentProposalCount} · aprovações pendentes sinalizadas: {snapshot.pendingApprovalCount} · portais de simulação: {snapshot.simulationCount}.</div>\n              </div>\n            ) : null}\n\n            {tab === "system" ? (',
  'topology tab content',
);

// Extend the 3D director state so projects and simulations become spatial objects.
replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  'type SofiaTwinSceneState = {\n  mode: "nominal" | "shadow" | "audit" | "incident" | "simulation";\n  healthScore: number;\n  incidentCount: number;\n  shadowCandidateCount: number;\n  shadowCompareCount: number;\n};',
  'type SofiaTwinSceneState = {\n  mode: "nominal" | "shadow" | "audit" | "incident" | "simulation";\n  healthScore: number;\n  incidentCount: number;\n  shadowCandidateCount: number;\n  shadowCompareCount: number;\n  simulationCount: number;\n  memoryAnchorCount: number;\n  activeProjects: string[];\n  activeAgents: string[];\n};',
  'extend Sofia scene state type',
);
replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '  shadowCompareCount: 0,\n};',
  '  shadowCompareCount: 0,\n  simulationCount: 0,\n  memoryAnchorCount: 0,\n  activeProjects: [],\n  activeAgents: [],\n};',
  'extend Sofia scene default',
);

replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '  const shadow = state.mode === "shadow" || pendingGhosts > 0;\n\n  return (',
  '  const shadow = state.mode === "shadow" || pendingGhosts > 0;\n  const projectCount = Math.min(6, state.activeProjects.length);\n  const portalCount = Math.min(3, state.simulationCount);\n  const memoryCount = Math.min(8, state.memoryAnchorCount);\n\n  return (',
  'derive procedural world counts',
);

replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '      {shadow ? (\n        <group position={[0, 0, 2.7]}>',
  '      {projectCount > 0 ? (\n        <group position={[0, 0, -3.15]}>\n          {Array.from({ length: projectCount }).map((_, index) => {\n            const offset = index - (projectCount - 1) / 2;\n            const height = 0.7 + (index % 3) * 0.22;\n            return (\n              <group key={"project-" + index} position={[offset * 0.72, 0, 0]}>\n                <mesh position={[0, height / 2, 0]}>\n                  <boxGeometry args={[0.42, height, 0.42]} />\n                  <meshBasicMaterial color="#22d3ee" transparent opacity={0.22} wireframe />\n                </mesh>\n                <pointLight position={[0, height + 0.1, 0]} color="#22d3ee" intensity={0.25} distance={1.5} decay={2} />\n              </group>\n            );\n          })}\n        </group>\n      ) : null}\n      {portalCount > 0 ? (\n        <group position={[3.4, 0.7, 1.8]} rotation={[Math.PI / 2, 0, 0]}>\n          {Array.from({ length: portalCount }).map((_, index) => (\n            <mesh key={"portal-" + index} position={[index * 0.48, 0, 0]}>\n              <torusGeometry args={[0.24, 0.035, 8, 24]} />\n              <meshBasicMaterial color="#67e8f9" transparent opacity={0.5} wireframe />\n            </mesh>\n          ))}\n        </group>\n      ) : null}\n      {memoryCount > 0 ? (\n        <group position={[-3.2, 0.12, 1.8]}>\n          {Array.from({ length: memoryCount }).map((_, index) => (\n            <mesh key={"memory-" + index} position={[(index % 4) * 0.28, 0.14 + Math.floor(index / 4) * 0.28, 0]}>\n              <tetrahedronGeometry args={[0.08, 0]} />\n              <meshBasicMaterial color="#fbbf24" transparent opacity={0.65} />\n            </mesh>\n          ))}\n        </group>\n      ) : null}\n      {shadow ? (\n        <group position={[0, 0, 2.7]}>',
  'procedural project towers, simulation portals and spatial memory anchors',
);

console.log('SOFIA_OPS_MAX_V24_OK: procedural project towers, simulation portals, spatial session memory and topology view enabled');
