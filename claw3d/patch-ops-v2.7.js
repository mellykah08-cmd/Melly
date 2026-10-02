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
// Sofia Ops v2.7 — World Director drives the agents physically.
// Event Fabric (runtime + external ingress) -> worldDirector -> agent holds
// (desk / QA lab / War Room meeting) consumed by the existing walk/path system.
// ---------------------------------------------------------------------------

const OFFICE = 'src/features/office/screens/OfficeScreen.tsx';
const HUD = 'src/features/sofia-ops/SofiaOpsHud.tsx';
const SCENE = 'src/features/retro-office/RetroOffice3D.tsx';

write('src/lib/sofia-ops/worldDirector.ts', `import type { TwinEvent } from "@/lib/sofia-ops/twinEngine";

export type SofiaAgentSpatialState = "idle" | "working" | "auditing" | "incident" | "meeting";

export type SofiaWarRoom = {
  incidentId: string;
  type: string;
  source: string;
  summary: string;
  responsibleAgentIds: string[];
  openedAt: number;
  state: "convocando" | "em andamento";
};

export type SofiaDirective = {
  stateByAgentId: Record<string, SofiaAgentSpatialState>;
  deskHoldByAgentId: Record<string, boolean>;
  qaHoldByAgentId: Record<string, boolean>;
  warRoom: SofiaWarRoom | null;
  reasonByAgentId: Record<string, string>;
};

// Who owns what. Real agent ids from the Sofia gateway; unknown ids fall back
// to whatever agents are online so the world still reacts.
const OWNER_BY_SOURCE: Record<string, string> = {
  railway: "railway-ops",
  n8n: "n8n-reviewer",
  whatsapp: "sofia-monitor",
  github: "supervisor",
  openclaw: "main",
  system: "supervisor",
};

const WINDOW_MS = 3 * 60 * 1000;
const WAR_ROOM_MS = 5 * 60 * 1000;

const text = (event: TwinEvent) => (event.type + " " + event.summary + " " + (event.payloadText || "")).toLowerCase();

export const directAgents = (events: TwinEvent[], agentIds: string[], now = Date.now()): SofiaDirective => {
  const online = new Set(agentIds);
  const pick = (preferred: string, used: Set<string>) => {
    if (online.has(preferred)) return preferred;
    return agentIds.find((id) => !used.has(id)) ?? null;
  };
  const directive: SofiaDirective = { stateByAgentId: {}, deskHoldByAgentId: {}, qaHoldByAgentId: {}, warRoom: null, reasonByAgentId: {} };
  for (const id of agentIds) directive.stateByAgentId[id] = "idle";

  const incident = events.find((event) => event.severity === "critical" && now - event.ts <= WAR_ROOM_MS);
  const assigned = new Set<string>();
  if (incident) {
    const responsible: string[] = [];
    for (const preferred of [OWNER_BY_SOURCE[incident.source] ?? "supervisor", "supervisor", "main"]) {
      const id = pick(preferred, assigned);
      if (id && !assigned.has(id)) { assigned.add(id); responsible.push(id); }
    }
    for (const id of responsible) {
      directive.stateByAgentId[id] = "meeting";
      directive.reasonByAgentId[id] = "War Room: " + incident.type;
    }
    directive.warRoom = {
      incidentId: incident.id,
      type: incident.type,
      source: incident.source,
      summary: incident.summary,
      responsibleAgentIds: responsible,
      openedAt: incident.ts,
      state: now - incident.ts < 20000 ? "convocando" : "em andamento",
    };
  }

  // Newest first: the first event that claims an agent wins.
  for (const event of events) {
    if (now - event.ts > WINDOW_MS) break;
    if (event.severity === "critical") continue;
    const haystack = text(event);
    const auditing = event.source === "n8n" || haystack.includes("audit") || haystack.includes("review") || haystack.includes("qa") || haystack.includes("test");
    const preferred = haystack.includes("shadow") ? "sofia-monitor" : OWNER_BY_SOURCE[event.source] ?? "main";
    const id = pick(preferred, assigned);
    if (!id || assigned.has(id)) continue;
    assigned.add(id);
    if (auditing) {
      directive.qaHoldByAgentId[id] = true;
      directive.stateByAgentId[id] = "auditing";
    } else {
      directive.deskHoldByAgentId[id] = true;
      directive.stateByAgentId[id] = "working";
    }
    directive.reasonByAgentId[id] = event.type;
  }
  return directive;
};

export const directiveSignature = (directive: SofiaDirective) =>
  JSON.stringify([directive.stateByAgentId, directive.warRoom?.incidentId ?? null, directive.warRoom?.state ?? null]);
`);

// HUD publishes the merged event stream (runtime + ingress) for the director.
replaceOnce(
  HUD,
  '    (window as Window & { __SOFIA_OPS_TWIN_STATE?: typeof snapshot }).__SOFIA_OPS_TWIN_STATE = snapshot;',
  '    (window as Window & { __SOFIA_OPS_TWIN_STATE?: typeof snapshot }).__SOFIA_OPS_TWIN_STATE = snapshot;\n    (window as Window & { __SOFIA_OPS_EVENTS?: TwinEvent[] }).__SOFIA_OPS_EVENTS = events;\n    window.dispatchEvent(new CustomEvent("sofia-ops:events"));',
  'HUD publishes events',
);
replaceOnce(HUD, '  }, [snapshot]);', '  }, [snapshot, events]);', 'HUD director deps');

// War Room panel: incident, origin, responsible agents and state.
replaceOnce(
  HUD,
  '                <div className="mt-2 max-h-44 space-y-1 overflow-auto">{incidents.map(',
  '                {warRoom ? <div className="mt-2 rounded border border-red-500/30 bg-red-950/30 p-2 text-red-100"><div className="font-semibold">{warRoom.type}</div><div className="mt-0.5 opacity-70">origem: {warRoom.source} · estado: {warRoom.state}</div><div className="mt-0.5 opacity-70">responsáveis: {warRoom.responsibleAgentIds.join(", ") || "—"}</div><div className="mt-0.5 truncate opacity-50">{warRoom.summary}</div></div> : null}\n                <div className="mt-2 max-h-44 space-y-1 overflow-auto">{incidents.map(',
  'HUD war room panel',
);
replaceOnce(
  HUD,
  '  const statusText = snapshot.mode === "incident" ? "ALERTA" : events.length ? "LIVE" : "READY";',
  '  const [warRoom, setWarRoom] = useState<SofiaWarRoom | null>(null);\n  useEffect(() => {\n    const onWarRoom = (event: Event) => setWarRoom((event as CustomEvent<SofiaWarRoom | null>).detail ?? null);\n    window.addEventListener("sofia-ops:war-room", onWarRoom);\n    return () => window.removeEventListener("sofia-ops:war-room", onWarRoom);\n  }, []);\n  useEffect(() => {\n    if (warRoom) { setOpen(true); setTab("war"); }\n  }, [warRoom?.incidentId]); // eslint-disable-line react-hooks/exhaustive-deps\n  const statusText = snapshot.mode === "incident" ? "ALERTA" : events.length ? "LIVE" : "READY";',
  'HUD war room state',
);
replaceOnce(
  HUD,
  'import { deriveTwinSnapshot, replayEventsAt, type TwinEvent } from "@/lib/sofia-ops/twinEngine";',
  'import { deriveTwinSnapshot, replayEventsAt, type TwinEvent } from "@/lib/sofia-ops/twinEngine";\nimport type { SofiaWarRoom } from "@/lib/sofia-ops/worldDirector";',
  'HUD war room import',
);

// OfficeScreen: run the director and merge its holds into the movement system.
replaceOnce(
  OFFICE,
  'import { SofiaOpsHud } from "@/features/sofia-ops/SofiaOpsHud";',
  'import { SofiaOpsHud } from "@/features/sofia-ops/SofiaOpsHud";\nimport { directAgents, directiveSignature, type SofiaDirective } from "@/lib/sofia-ops/worldDirector";\nimport type { TwinEvent } from "@/lib/sofia-ops/twinEngine";\nimport type { StandupMeeting } from "@/lib/office/standup/types";',
  'office director imports',
);
replaceOnce(
  OFFICE,
  '    const skillTriggerHoldMaps = buildOfficeSkillTriggerHoldMaps(\n      skillTriggers.movementTargetByAgentId,\n    );\n',
  '    const skillTriggerHoldMaps = buildOfficeSkillTriggerHoldMaps(\n      skillTriggers.movementTargetByAgentId,\n    );\n    // Sofia World Director holds win over idle wandering, never over explicit user actions above.\n    Object.assign(skillTriggerHoldMaps.deskHoldByAgentId, sofiaDirective.deskHoldByAgentId);\n    Object.assign(skillTriggerHoldMaps.qaHoldByAgentId, sofiaDirective.qaHoldByAgentId);\n',
  'merge director holds',
);
replaceOnce(
  OFFICE,
  '    officeTriggerState,\n    skillTriggers.movementTargetByAgentId,\n    state.agents,\n  ]);',
  '    officeTriggerState,\n    skillTriggers.movementTargetByAgentId,\n    sofiaDirective,\n    state.agents,\n  ]);',
  'director hold deps',
);
replaceOnce(
  OFFICE,
  '  const [settingsCoordinator] = useState(() =>\n    createStudioSettingsCoordinator(),\n  );',
  '  const [settingsCoordinator] = useState(() =>\n    createStudioSettingsCoordinator(),\n  );\n  const [sofiaDirective, setSofiaDirective] = useState<SofiaDirective>(() => directAgents([], []));',
  'director state',
);
replaceOnce(
  OFFICE,
  '  const allVisibleAgents = useMemo(',
  '  const sofiaAgentIdsKey = state.agents.map((agent) => agent.agentId).join("|");\n  useEffect(() => {\n    let lastSignature = "";\n    const run = () => {\n      const events = ((window as Window & { __SOFIA_OPS_EVENTS?: TwinEvent[] }).__SOFIA_OPS_EVENTS ?? []);\n      const next = directAgents(events, sofiaAgentIdsKey ? sofiaAgentIdsKey.split("|") : []);\n      const signature = directiveSignature(next);\n      if (signature === lastSignature) return;\n      lastSignature = signature;\n      setSofiaDirective(next);\n      window.dispatchEvent(new CustomEvent("sofia-ops:war-room", { detail: next.warRoom }));\n      (window as Window & { __SOFIA_OPS_DIRECTIVE?: SofiaDirective }).__SOFIA_OPS_DIRECTIVE = next;\n    };\n    run();\n    window.addEventListener("sofia-ops:events", run);\n    const timer = window.setInterval(run, 10000);\n    return () => { window.removeEventListener("sofia-ops:events", run); window.clearInterval(timer); };\n  }, [sofiaAgentIdsKey]);\n  const sofiaWarRoomMeeting = useMemo<StandupMeeting | null>(() => {\n    const room = sofiaDirective.warRoom;\n    if (!room || room.responsibleAgentIds.length === 0) return null;\n    const opened = new Date(room.openedAt).toISOString();\n    return {\n      id: "sofia-war-room-" + room.incidentId,\n      trigger: "manual",\n      phase: room.state === "convocando" ? "gathering" : "in_progress",\n      scheduledFor: null,\n      startedAt: opened,\n      updatedAt: opened,\n      completedAt: null,\n      currentSpeakerAgentId: room.responsibleAgentIds[0] ?? null,\n      speakerStartedAt: opened,\n      speakerDurationMs: 30000,\n      participantOrder: room.responsibleAgentIds,\n      arrivedAgentIds: [],\n      cards: [],\n    } as StandupMeeting;\n  }, [sofiaDirective.warRoom]);\n  const allVisibleAgents = useMemo(',
  'director effect and war room meeting',
);
replaceOnce(
  OFFICE,
  '          standupMeeting={standupController.meeting}',
  '          standupMeeting={sofiaWarRoomMeeting ?? standupController.meeting}',
  'war room drives meeting',
);

// Shadow Twin: candidate (Sofia) and human answers side by side, distinct colours.
replaceOnce(
  SCENE,
  '                <mesh position={[0, 0.48, 0]}>\n                  <cylinderGeometry args={[0.13, 0.16, 0.55, 10]} />\n                  <meshBasicMaterial color="#a78bfa" transparent opacity={0.24} wireframe />\n                </mesh>',
  '                <mesh position={[0, 0.48, 0]}>\n                  <cylinderGeometry args={[0.13, 0.16, 0.55, 10]} />\n                  <meshBasicMaterial color="#a78bfa" transparent opacity={0.24} wireframe />\n                </mesh>\n                {index < Math.min(5, state.shadowHumanCount ?? 0) ? (\n                  <mesh position={[0.32, 0.55, 0]}>\n                    <boxGeometry args={[0.2, 0.7, 0.2]} />\n                    <meshBasicMaterial color="#22d3ee" transparent opacity={0.35} wireframe />\n                  </mesh>\n                ) : null}',
  'shadow human twin',
);
replaceOnce(
  SCENE,
  '  simulationCount: number;\n  memoryAnchorCount: number;\n  activeProjects: string[];\n  activeAgents: string[];\n};',
  '  simulationCount: number;\n  memoryAnchorCount: number;\n  activeProjects: string[];\n  activeAgents: string[];\n  shadowHumanCount?: number;\n};',
  'scene state human count',
);
replaceOnce(
  SCENE,
  '    Math.min(8, state.memoryAnchorCount),\n  ].join("|");',
  '    Math.min(8, state.memoryAnchorCount),\n    Math.min(5, state.shadowHumanCount ?? 0),\n  ].join("|");',
  'scene signature human count',
);

write('src/lib/sofia-ops/config.ts', read('src/lib/sofia-ops/config.ts').replace('"2.6.0-max"', '"2.7.0-max"'));

console.log('SOFIA_OPS_MAX_V27_OK: world director moves agents (desk/QA/War Room), war room panel, shadow candidate vs human twin');
