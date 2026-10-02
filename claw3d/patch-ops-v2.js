const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

function replaceOnce(file, search, replacement, label) {
  const input = read(file);
  if (!input.includes(search)) {
    throw new Error(`${label}: anchor not found in ${file}`);
  }
  write(file, input.replace(search, replacement));
}

function insertBefore(file, anchor, insertion, label) {
  const input = read(file);
  const idx = input.indexOf(anchor);
  if (idx < 0) throw new Error(`${label}: anchor not found in ${file}`);
  write(file, input.slice(0, idx) + insertion + input.slice(idx));
}

// ---------------------------------------------------------------------------
// Sofia Ops MAX v2
// Applied AFTER patch-building-v1.js. This patch is deliberately additive so
// v1 remains a clean rollback point.
// ---------------------------------------------------------------------------

// Expand the OpenClaw building into functional floors while sharing the same
// gateway/runtime profile. Each floor keeps an independent furniture namespace.
replaceOnce(
  'src/lib/office/floors.ts',
  '  | "audit-second"\n  | "hermes-first"',
  '  | "audit-second"\n  | "dev-third"\n  | "infra-fourth"\n  | "intel-fifth"\n  | "command-sixth"\n  | "hermes-first"',
  'Sofia MAX floor ids',
);

replaceOnce(
  'src/lib/office/floors.ts',
  '  {\n    id: "audit-second",\n    label: "2º Andar — Auditoria Lab",\n    shortLabel: "Auditoria",\n    provider: "openclaw",\n    kind: "runtime",\n    zone: "building",\n    enabled: true,\n    sortOrder: 15,\n    runtimeProfileId: "openclaw-audit",\n  },\n  {\n    id: "hermes-first",',
  '  {\n    id: "audit-second",\n    label: "2º Andar — Auditoria Lab",\n    shortLabel: "Auditoria",\n    provider: "openclaw",\n    kind: "runtime",\n    zone: "building",\n    enabled: true,\n    sortOrder: 15,\n    runtimeProfileId: "openclaw-default",\n  },\n  {\n    id: "dev-third",\n    label: "3º Andar — Desenvolvimento & QA",\n    shortLabel: "Dev & QA",\n    provider: "openclaw",\n    kind: "runtime",\n    zone: "building",\n    enabled: true,\n    sortOrder: 16,\n    runtimeProfileId: "openclaw-default",\n  },\n  {\n    id: "infra-fourth",\n    label: "4º Andar — Infraestrutura",\n    shortLabel: "Infra",\n    provider: "openclaw",\n    kind: "runtime",\n    zone: "building",\n    enabled: true,\n    sortOrder: 17,\n    runtimeProfileId: "openclaw-default",\n  },\n  {\n    id: "intel-fifth",\n    label: "5º Andar — Inteligência & Analytics",\n    shortLabel: "Inteligência",\n    provider: "openclaw",\n    kind: "runtime",\n    zone: "building",\n    enabled: true,\n    sortOrder: 18,\n    runtimeProfileId: "openclaw-default",\n  },\n  {\n    id: "command-sixth",\n    label: "6º Andar — Command Center",\n    shortLabel: "Command",\n    provider: "openclaw",\n    kind: "runtime",\n    zone: "building",\n    enabled: true,\n    sortOrder: 19,\n    runtimeProfileId: "openclaw-default",\n  },\n  {\n    id: "hermes-first",',
  'Sofia MAX floor definitions',
);

replaceOnce(
  'src/features/retro-office/core/furnitureDefaults.ts',
  'export type OfficeLayoutPreset = "office" | "lobby" | "audit";',
  'export type OfficeLayoutPreset = "office" | "lobby" | "audit" | "dev" | "infra" | "intel" | "command";',
  'Sofia MAX layout preset type',
);

const maxLayouts = `const DEFAULT_DEV_FURNITURE: FurnitureSeed[] = [
  { type: "desk_cubicle", x: 500, y: 170, id: "dev_core" },
  { type: "desk_cubicle", x: 760, y: 170, id: "dev_reviewer" },
  { type: "desk_cubicle", x: 1020, y: 170, id: "dev_qa" },
  { type: "desk_cubicle", x: 630, y: 410, id: "dev_monitor" },
  { type: "desk_cubicle", x: 900, y: 410, id: "dev_ops" },
  { type: "chair", x: 520, y: 158, facing: 180 }, { type: "computer", x: 520, y: 157 },
  { type: "chair", x: 780, y: 158, facing: 180 }, { type: "computer", x: 780, y: 157 },
  { type: "chair", x: 1040, y: 158, facing: 180 }, { type: "computer", x: 1040, y: 157 },
  { type: "chair", x: 650, y: 398, facing: 180 }, { type: "computer", x: 650, y: 397 },
  { type: "chair", x: 920, y: 398, facing: 180 }, { type: "computer", x: 920, y: 397 },
  { type: "kanban_board", x: 710, y: 32, facing: 180 },
  { type: "whiteboard", x: 1050, y: 32, w: 10, h: 100 },
  { type: "qa_terminal", x: 1380, y: 150, facing: 90 },
  { type: "test_bench", x: 1390, y: 320, facing: 90 },
  { type: "test_bench", x: 1530, y: 460, facing: 90 },
  { type: "device_rack", x: 1580, y: 145, facing: 180 },
  { type: "server_terminal", x: 190, y: 200, facing: 180 },
  { type: "round_table", x: 1170, y: 520, r: 64 },
  { type: "chair", x: 1235, y: 520, facing: 0 }, { type: "chair", x: 1105, y: 520, facing: 90 },
  { type: "plant", x: 330, y: 560 }, { type: "lamp", x: 820, y: 320 },
  { type: "wall", x: 0, y: 0, w: 1800, h: 8 }, { type: "wall", x: 0, y: 0, w: 8, h: 720 },
  { type: "wall", x: 1792, y: 0, w: 8, h: 720 }, { type: "wall", x: 0, y: 712, w: 1800, h: 8 },
];

const DEFAULT_INFRA_FURNITURE: FurnitureSeed[] = [
  { type: "desk_cubicle", x: 520, y: 190, id: "infra_supervisor" },
  { type: "desk_cubicle", x: 820, y: 190, id: "infra_railway" },
  { type: "desk_cubicle", x: 520, y: 430, id: "infra_monitor" },
  { type: "desk_cubicle", x: 820, y: 430, id: "infra_core" },
  { type: "desk_cubicle", x: 1120, y: 310, id: "infra_reviewer" },
  { type: "chair", x: 540, y: 178, facing: 180 }, { type: "computer", x: 540, y: 177 },
  { type: "chair", x: 840, y: 178, facing: 180 }, { type: "computer", x: 840, y: 177 },
  { type: "chair", x: 540, y: 418, facing: 180 }, { type: "computer", x: 540, y: 417 },
  { type: "chair", x: 840, y: 418, facing: 180 }, { type: "computer", x: 840, y: 417 },
  { type: "chair", x: 1140, y: 298, facing: 180 }, { type: "computer", x: 1140, y: 297 },
  { type: "server_rack", x: 120, y: 120, facing: 0 }, { type: "server_rack", x: 220, y: 120, facing: 0 },
  { type: "server_rack", x: 120, y: 330, facing: 0 }, { type: "server_rack", x: 220, y: 330, facing: 0 },
  { type: "server_terminal", x: 170, y: 555, facing: 180 },
  { type: "qa_terminal", x: 1450, y: 170, facing: 90 },
  { type: "device_rack", x: 1590, y: 170, facing: 180 },
  { type: "kanban_board", x: 850, y: 35, facing: 180 },
  { type: "whiteboard", x: 1280, y: 35, w: 10, h: 105 },
  { type: "plant", x: 420, y: 600 }, { type: "lamp", x: 1030, y: 540 },
  { type: "wall", x: 0, y: 0, w: 1800, h: 8 }, { type: "wall", x: 0, y: 0, w: 8, h: 720 },
  { type: "wall", x: 1792, y: 0, w: 8, h: 720 }, { type: "wall", x: 0, y: 712, w: 1800, h: 8 },
];

const DEFAULT_INTEL_FURNITURE: FurnitureSeed[] = [
  { type: "desk_cubicle", x: 500, y: 190, id: "intel_core" },
  { type: "desk_cubicle", x: 760, y: 190, id: "intel_supervisor" },
  { type: "desk_cubicle", x: 1020, y: 190, id: "intel_monitor" },
  { type: "desk_cubicle", x: 630, y: 430, id: "intel_reviewer" },
  { type: "desk_cubicle", x: 900, y: 430, id: "intel_ops" },
  { type: "chair", x: 520, y: 178, facing: 180 }, { type: "computer", x: 520, y: 177 },
  { type: "chair", x: 780, y: 178, facing: 180 }, { type: "computer", x: 780, y: 177 },
  { type: "chair", x: 1040, y: 178, facing: 180 }, { type: "computer", x: 1040, y: 177 },
  { type: "chair", x: 650, y: 418, facing: 180 }, { type: "computer", x: 650, y: 417 },
  { type: "chair", x: 920, y: 418, facing: 180 }, { type: "computer", x: 920, y: 417 },
  { type: "round_table", x: 1290, y: 260, r: 72 },
  { type: "round_table", x: 1420, y: 500, r: 60 },
  { type: "whiteboard", x: 1560, y: 115, w: 10, h: 110 },
  { type: "kanban_board", x: 830, y: 32, facing: 180 },
  { type: "couch", x: 310, y: 590, w: 130, h: 44 },
  { type: "table_rect", x: 500, y: 590, w: 82, h: 38 },
  { type: "plant", x: 370, y: 110 }, { type: "plant", x: 1160, y: 575 },
  { type: "lamp", x: 1150, y: 350 }, { type: "clock", x: 900, y: 8 },
  { type: "wall", x: 0, y: 0, w: 1800, h: 8 }, { type: "wall", x: 0, y: 0, w: 8, h: 720 },
  { type: "wall", x: 1792, y: 0, w: 8, h: 720 }, { type: "wall", x: 0, y: 712, w: 1800, h: 8 },
];

const DEFAULT_COMMAND_FURNITURE: FurnitureSeed[] = [
  { type: "desk_cubicle", x: 470, y: 170, id: "command_core" },
  { type: "desk_cubicle", x: 730, y: 170, id: "command_supervisor" },
  { type: "desk_cubicle", x: 990, y: 170, id: "command_monitor" },
  { type: "desk_cubicle", x: 600, y: 480, id: "command_reviewer" },
  { type: "desk_cubicle", x: 860, y: 480, id: "command_ops" },
  { type: "chair", x: 490, y: 158, facing: 180 }, { type: "computer", x: 490, y: 157 },
  { type: "chair", x: 750, y: 158, facing: 180 }, { type: "computer", x: 750, y: 157 },
  { type: "chair", x: 1010, y: 158, facing: 180 }, { type: "computer", x: 1010, y: 157 },
  { type: "chair", x: 620, y: 468, facing: 180 }, { type: "computer", x: 620, y: 467 },
  { type: "chair", x: 880, y: 468, facing: 180 }, { type: "computer", x: 880, y: 467 },
  { type: "round_table", x: 820, y: 325, r: 86 },
  { type: "chair", x: 907, y: 325, facing: 0 }, { type: "chair", x: 733, y: 325, facing: 90 },
  { type: "chair", x: 820, y: 412, facing: 180 }, { type: "chair", x: 820, y: 238, facing: 270 },
  { type: "kanban_board", x: 820, y: 30, facing: 180 },
  { type: "whiteboard", x: 1215, y: 30, w: 10, h: 110 },
  { type: "server_rack", x: 1400, y: 150, facing: 0 }, { type: "server_rack", x: 1530, y: 150, facing: 0 },
  { type: "qa_terminal", x: 1450, y: 390, facing: 90 },
  { type: "server_terminal", x: 240, y: 210, facing: 180 },
  { type: "device_rack", x: 250, y: 430, facing: 180 },
  { type: "plant", x: 350, y: 610 }, { type: "lamp", x: 1180, y: 520 },
  { type: "wall", x: 0, y: 0, w: 1800, h: 8 }, { type: "wall", x: 0, y: 0, w: 8, h: 720 },
  { type: "wall", x: 1792, y: 0, w: 8, h: 720 }, { type: "wall", x: 0, y: 712, w: 1800, h: 8 },
];

`;

insertBefore(
  'src/features/retro-office/core/furnitureDefaults.ts',
  'const DEFAULT_AUDIT_FURNITURE: FurnitureSeed[] = [',
  maxLayouts,
  'Sofia MAX furniture layouts',
);

replaceOnce(
  'src/features/retro-office/core/furnitureDefaults.ts',
  '(preset === "audit" ? DEFAULT_AUDIT_FURNITURE : preset === "lobby" ? DEFAULT_LOBBY_FURNITURE : DEFAULT_FURNITURE).map((item, index) => ({',
  '(preset === "command" ? DEFAULT_COMMAND_FURNITURE : preset === "intel" ? DEFAULT_INTEL_FURNITURE : preset === "infra" ? DEFAULT_INFRA_FURNITURE : preset === "dev" ? DEFAULT_DEV_FURNITURE : preset === "audit" ? DEFAULT_AUDIT_FURNITURE : preset === "lobby" ? DEFAULT_LOBBY_FURNITURE : DEFAULT_FURNITURE).map((item, index) => ({',
  'Sofia MAX materialize presets',
);

replaceOnce(
  'src/features/office/screens/OfficeScreen.tsx',
  'layoutPreset={activeFloor.id === "audit-second" ? "audit" : activeFloor.kind === "lobby" ? "lobby" : "office"}',
  'layoutPreset={activeFloor.id === "command-sixth" ? "command" : activeFloor.id === "intel-fifth" ? "intel" : activeFloor.id === "infra-fourth" ? "infra" : activeFloor.id === "dev-third" ? "dev" : activeFloor.id === "audit-second" ? "audit" : activeFloor.kind === "lobby" ? "lobby" : "office"}',
  'Sofia MAX floor-to-layout routing',
);

// ---------------------------------------------------------------------------
// In-memory Digital Twin event fabric. No database, no extra service and no
// long-term storage cost. Deep replay can attach later without changing callers.
// ---------------------------------------------------------------------------
fs.mkdirSync('src/lib/sofia-ops', { recursive: true });
fs.mkdirSync('src/features/sofia-ops', { recursive: true });

write('src/lib/sofia-ops/config.ts', `export const SOFIA_OPS_VERSION = "2.0.0-max";

export const SOFIA_OPS_CAPABILITIES = {
  digitalTwin: true,
  eventFabric: true,
  shadowTwin: true,
  warRoom: true,
  shortReplayInMemory: true,
  proceduralFloors: true,
  multiProjectFabric: true,
  webglStabilityLayer: true,
  gpuGeneration: false,
  deepHistoryPersistence: false,
} as const;
`);

write('src/lib/sofia-ops/eventBus.ts', `export type SofiaOpsSeverity = "info" | "success" | "warning" | "critical";
export type SofiaOpsSource = "openclaw" | "n8n" | "railway" | "whatsapp" | "github" | "system";

export type SofiaOpsEvent = {
  id: string;
  ts: number;
  type: string;
  source: SofiaOpsSource;
  severity: SofiaOpsSeverity;
  summary: string;
  payloadText: string;
};

const MAX_EVENTS = 240;
let sequence = 0;
let ring: SofiaOpsEvent[] = [];
const listeners = new Set<() => void>();

const safeText = (value: unknown) => {
  try {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    return (raw || "").slice(0, 800);
  } catch {
    return String(value ?? "").slice(0, 800);
  }
};

const resolveSource = (haystack: string): SofiaOpsSource => {
  if (haystack.includes("railway")) return "railway";
  if (haystack.includes("n8n")) return "n8n";
  if (haystack.includes("whatsapp") || haystack.includes("evolution")) return "whatsapp";
  if (haystack.includes("github") || haystack.includes("git.")) return "github";
  return "openclaw";
};

const resolveSeverity = (haystack: string): SofiaOpsSeverity => {
  if (/crash|fatal|failed|failure|error|timeout|disconnect|denied/.test(haystack)) return "critical";
  if (/warn|retry|degraded|slow|backoff/.test(haystack)) return "warning";
  if (/success|complete|completed|connected|ready|done/.test(haystack)) return "success";
  return "info";
};

export const ingestSofiaOpsRuntimeEvent = (raw: unknown): SofiaOpsEvent => {
  const candidate = raw as { event?: unknown; type?: unknown; payload?: unknown } | null;
  const type = typeof candidate?.event === "string"
    ? candidate.event
    : typeof candidate?.type === "string"
      ? candidate.type
      : "runtime.event";
  const payloadText = safeText(candidate?.payload ?? raw);
  const haystack = (type + " " + payloadText).toLowerCase();
  const event: SofiaOpsEvent = {
    id: "ops-" + Date.now().toString(36) + "-" + (++sequence).toString(36),
    ts: Date.now(),
    type,
    source: resolveSource(haystack),
    severity: resolveSeverity(haystack),
    summary: payloadText ? payloadText.slice(0, 160) : type,
    payloadText,
  };
  ring = [event, ...ring].slice(0, MAX_EVENTS);
  listeners.forEach((listener) => listener());
  return event;
};

export const getSofiaOpsEvents = () => ring;
export const clearSofiaOpsEvents = () => {
  ring = [];
  listeners.forEach((listener) => listener());
};
export const subscribeSofiaOpsEvents = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
`);

write('src/features/sofia-ops/SofiaOpsHud.tsx', `"use client";

import { useEffect, useMemo, useState } from "react";
import { SOFIA_OPS_CAPABILITIES, SOFIA_OPS_VERSION } from "@/lib/sofia-ops/config";
import { getSofiaOpsEvents, subscribeSofiaOpsEvents, type SofiaOpsEvent } from "@/lib/sofia-ops/eventBus";

const badge = (severity: SofiaOpsEvent["severity"]) =>
  severity === "critical" ? "text-red-300 border-red-500/40 bg-red-950/60" :
  severity === "warning" ? "text-amber-200 border-amber-500/35 bg-amber-950/50" :
  severity === "success" ? "text-emerald-200 border-emerald-500/35 bg-emerald-950/45" :
  "text-cyan-200 border-cyan-500/30 bg-cyan-950/40";

export function SofiaOpsHud({ floorLabel }: { floorLabel: string }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<SofiaOpsEvent[]>(() => getSofiaOpsEvents());

  useEffect(() => subscribeSofiaOpsEvents(() => setEvents(getSofiaOpsEvents())), []);

  const latest = events[0] ?? null;
  const critical = useMemo(
    () => events.find((event) => event.severity === "critical" && Date.now() - event.ts < 300000) ?? null,
    [events],
  );

  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 z-[80] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 font-mono">
      {open ? (
        <div className="w-[min(92vw,390px)] overflow-hidden rounded-xl border border-cyan-500/25 bg-[#071019]/94 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div>
              <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-200">SOFIA DIGITAL TWIN</div>
              <div className="text-[9px] text-white/45">{floorLabel} · v{SOFIA_OPS_VERSION}</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-[10px] text-white/60 hover:bg-white/10">FECHAR</button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-2 text-[9px]">
            <div className="rounded border border-emerald-500/25 bg-emerald-950/30 p-2"><div className="text-white/45">EVENT FABRIC</div><div className="mt-1 text-emerald-200">LIVE</div></div>
            <div className="rounded border border-violet-500/25 bg-violet-950/30 p-2"><div className="text-white/45">SHADOW TWIN</div><div className="mt-1 text-violet-200">ARMED</div></div>
            <div className={"rounded border p-2 " + (critical ? "border-red-500/35 bg-red-950/40" : "border-cyan-500/20 bg-cyan-950/25")}><div className="text-white/45">WAR ROOM</div><div className={"mt-1 " + (critical ? "text-red-200" : "text-cyan-200")}>{critical ? "INCIDENT" : "STANDBY"}</div></div>
            <div className="rounded border border-cyan-500/20 bg-cyan-950/25 p-2"><div className="text-white/45">REPLAY RAM</div><div className="mt-1 text-cyan-200">{events.length}/240</div></div>
            <div className="rounded border border-white/10 bg-white/5 p-2"><div className="text-white/45">DEEP HISTORY</div><div className="mt-1 text-white/60">PREPARED · OFF</div></div>
            <div className="rounded border border-white/10 bg-white/5 p-2"><div className="text-white/45">GPU FABRIC</div><div className="mt-1 text-white/60">PREPARED · OFF</div></div>
          </div>

          <div className="border-t border-white/10 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-[9px] text-white/45"><span>LIVE EVENT STREAM</span><span>{SOFIA_OPS_CAPABILITIES.proceduralFloors ? "PROCEDURAL READY" : ""}</span></div>
            <div className="max-h-44 space-y-1 overflow-auto">
              {events.length === 0 ? <div className="rounded bg-white/5 px-2 py-2 text-[10px] text-white/45">Aguardando eventos do runtime OpenClaw…</div> : events.slice(0, 8).map((event) => (
                <div key={event.id} className={"rounded border px-2 py-1.5 text-[9px] " + badge(event.severity)}>
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">{event.source.toUpperCase()} · {event.type}</span><span className="opacity-60">{new Date(event.ts).toLocaleTimeString()}</span></div>
                  <div className="mt-0.5 truncate opacity-75">{event.summary}</div>
                </div>
              ))}
            </div>
          </div>
          {latest ? <div className="border-t border-white/10 px-3 py-1.5 text-[9px] text-white/35">Último evento: {latest.type}</div> : null}
        </div>
      ) : null}

      <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full border border-cyan-400/30 bg-[#071019]/92 px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-cyan-100 shadow-xl backdrop-blur-md hover:border-cyan-300/50 hover:bg-[#0b1926]">
        SOFIA OPS · {critical ? "ALERTA" : events.length ? "LIVE" : "READY"}
      </button>
    </div>
  );
}
`);

// Bridge every runtime gateway event into the in-memory Digital Twin fabric.
replaceOnce(
  'src/features/office/screens/OfficeScreen.tsx',
  'import { RetroOffice3D } from "@/features/retro-office/RetroOffice3D";',
  'import { RetroOffice3D } from "@/features/retro-office/RetroOffice3D";\nimport { SofiaOpsHud } from "@/features/sofia-ops/SofiaOpsHud";\nimport { ingestSofiaOpsRuntimeEvent } from "@/lib/sofia-ops/eventBus";',
  'Sofia Ops imports',
);

replaceOnce(
  'src/features/office/screens/OfficeScreen.tsx',
  '      taskBoardEventHandlerRef.current(event);\n      runtimeHandler.handleEvent(event);',
  '      taskBoardEventHandlerRef.current(event);\n      ingestSofiaOpsRuntimeEvent(event);\n      runtimeHandler.handleEvent(event);',
  'Sofia Ops gateway event bridge',
);

replaceOnce(
  'src/features/office/screens/OfficeScreen.tsx',
  '      <section className="relative h-full min-h-0 min-w-0 overflow-hidden">\n        <RetroOffice3D',
  '      <section className="relative h-full min-h-0 min-w-0 overflow-hidden">\n        <SofiaOpsHud floorLabel={activeFloor.shortLabel} />\n        <RetroOffice3D',
  'Sofia Ops HUD mount',
);

// ---------------------------------------------------------------------------
// WebGL/mobile stability layer.
// The upstream key deliberately remounts the Canvas whenever agent count,
// gateway status or center signal changes. On mobile that can repeatedly destroy
// and recreate the WebGL context. Sofia keeps one stable Canvas instead.
// ---------------------------------------------------------------------------
replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '  const canvasResetKey = useMemo(\n    () =>\n      [\n        remoteOfficeEnabled ? "remote" : "local",\n        gatewayStatus ?? "unknown",\n        String(agents.length),\n        String(officeCenterSignal),\n      ].join(":"),\n    [agents.length, gatewayStatus, officeCenterSignal, remoteOfficeEnabled],\n  );',
  '  const canvasResetKey = "sofia-stable-canvas";',
  'stable WebGL canvas key',
);

replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '        {!immersiveOverlayActive ? (\n          <Canvas',
  '        <Canvas',
  'keep Canvas mounted under immersive overlays',
);
replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '          </Canvas>\n        ) : null}\n      </div>',
  '          </Canvas>\n      </div>',
  'persistent Canvas closing',
);

replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '            dpr={[0.85, 1.5]}',
  '            dpr={[0.75, 1.3]}',
  'mobile DPR ceiling',
);

replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '            gl={{ antialias: true, powerPreference: "high-performance" }}\n            style={{ width: "100%", height: "100%" }}',
  '            gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false }}\n            onCreated={({ gl }) => {\n              const canvas = gl.domElement;\n              canvas.addEventListener("webglcontextlost", (event) => {\n                event.preventDefault();\n                console.warn("SOFIA_WEBGL_CONTEXT_LOST");\n              });\n              canvas.addEventListener("webglcontextrestored", () => {\n                console.info("SOFIA_WEBGL_CONTEXT_RESTORED");\n              });\n            }}\n            style={{ width: "100%", height: "100%", visibility: immersiveOverlayActive ? "hidden" : "visible" }}',
  'WebGL context recovery hooks',
);

replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '              shadow-mapSize={[1024, 1024]}',
  '              shadow-mapSize={[512, 512]}',
  'mobile shadow map budget',
);

replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '              mouseButtons={{\n                LEFT: spaceDown ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,\n                MIDDLE: THREE.MOUSE.DOLLY,\n                RIGHT: THREE.MOUSE.PAN,\n              }}',
  '              mouseButtons={{\n                LEFT: spaceDown ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,\n                MIDDLE: THREE.MOUSE.DOLLY,\n                RIGHT: THREE.MOUSE.PAN,\n              }}\n              touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}',
  'mobile touch controls',
);

// Extend the seeded desk map for the additional floors without touching secrets.
{
  const stateDir = process.env.OPENCLAW_STATE_DIR || '/tmp/openclaw-state';
  const gatewayUrl = process.env.CLAW3D_GATEWAY_URL || 'ws://openclaw-gateway.railway.internal:8080';
  const settingsPath = path.join(stateDir, 'claw3d', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(read(settingsPath));
    settings.deskAssignments ??= {};
    settings.deskAssignments[gatewayUrl] = {
      ...(settings.deskAssignments[gatewayUrl] || {}),
      dev_0: 'main', dev_1: 'n8n-reviewer', dev_2: 'sofia-monitor', dev_3: 'supervisor', dev_4: 'railway-ops',
      infra_0: 'supervisor', infra_1: 'railway-ops', infra_2: 'sofia-monitor', infra_3: 'main', infra_4: 'n8n-reviewer',
      intel_0: 'main', intel_1: 'supervisor', intel_2: 'sofia-monitor', intel_3: 'n8n-reviewer', intel_4: 'railway-ops',
      command_0: 'main', command_1: 'supervisor', command_2: 'sofia-monitor', command_3: 'n8n-reviewer', command_4: 'railway-ops',
    };
    write(settingsPath, JSON.stringify(settings, null, 2));
  }
}

console.log('SOFIA_OPS_MAX_V2_OK: stable canvas, six-floor digital twin, event fabric, war-room HUD and RAM replay enabled');
