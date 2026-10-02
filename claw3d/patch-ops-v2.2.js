const fs = require('node:fs');

const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

fs.mkdirSync('src/lib/sofia-ops', { recursive: true });
fs.mkdirSync('src/features/sofia-ops', { recursive: true });
fs.mkdirSync('src/app/api/sofia-ops/snapshot', { recursive: true });
fs.mkdirSync('src/app/api/sofia-ops/manifest', { recursive: true });

write('src/lib/sofia-ops/config.ts', `export const SOFIA_OPS_VERSION = "2.2.0-max";

export const SOFIA_OPS_CAPABILITIES = {
  digitalTwin: true,
  eventFabric: true,
  secureExternalIngress: true,
  shadowTwin: true,
  warRoom: true,
  shortReplayInMemory: true,
  worldDirector: true,
  multiProjectFabric: true,
  webglStabilityLayer: true,
  gpuGeneration: false,
  deepHistoryPersistence: false,
  longHorizonSimulation: false,
} as const;
`);

write('src/lib/sofia-ops/manifest.ts', `export const SOFIA_OPS_BUILDING = [
  { id: "openclaw-ground", shortLabel: "Operação", purpose: "atendimento, execução e Shadow Twin" },
  { id: "audit-second", shortLabel: "Auditoria", purpose: "revisão, incidentes, qualidade e debugging" },
  { id: "dev-third", shortLabel: "Dev & QA", purpose: "desenvolvimento, testes e regressão" },
  { id: "infra-fourth", shortLabel: "Infra", purpose: "Railway, serviços, deploys e disponibilidade" },
  { id: "intel-fifth", shortLabel: "Inteligência", purpose: "analytics, padrões e comparação" },
  { id: "command-sixth", shortLabel: "Command", purpose: "coordenação de incidentes e visão global" },
] as const;

export const SOFIA_OPS_FUTURE_MODULES = [
  { id: "deep-history", state: "prepared-off", dependency: "persistent storage" },
  { id: "gpu-generation", state: "prepared-off", dependency: "GPU" },
  { id: "long-simulation", state: "prepared-off", dependency: "model/API budget" },
  { id: "xr", state: "future-device", dependency: "compatible XR device/browser" },
] as const;
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
  activeProjects: string[];
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
  const projects = [...new Set(events.map((event) => event.project).filter((value): value is string => Boolean(value)))].slice(0, 12);
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
    activeProjects: projects,
    recommendedFloor: director.floor,
    recommendedReason: director.reason,
  };
};

export const replayEventsAt = (events: TwinEvent[], cutoffTs: number) =>
  events.filter((event) => event.ts <= cutoffTs);
`);

write('src/lib/sofia-ops/serverEventStore.ts', `import type { SofiaOpsSeverity, SofiaOpsSource } from "@/lib/sofia-ops/eventBus";

export type SofiaOpsServerEvent = {
  id: string;
  ts: number;
  type: string;
  source: SofiaOpsSource;
  severity: SofiaOpsSeverity;
  summary: string;
  payloadText: string;
  floorHint?: string | null;
  project?: string | null;
  agentId?: string | null;
  correlationId?: string | null;
};

type Store = { events: SofiaOpsServerEvent[]; sequence: number };
const root = globalThis as typeof globalThis & { __sofiaOpsEventStore?: Store };
const store: Store = root.__sofiaOpsEventStore ?? { events: [], sequence: 0 };
root.__sofiaOpsEventStore = store;
const MAX_SERVER_EVENTS = 240;

const safeText = (value: unknown) => {
  try {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    return (raw || "").slice(0, 1200);
  } catch {
    return String(value ?? "").slice(0, 1200);
  }
};

const safeField = (value: unknown, max = 100) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
const validSources = new Set<SofiaOpsSource>(["openclaw", "n8n", "railway", "whatsapp", "github", "system"]);
const validSeverities = new Set<SofiaOpsSeverity>(["info", "success", "warning", "critical"]);

const inferSource = (text: string): SofiaOpsSource => {
  const value = text.toLowerCase();
  if (value.includes("railway")) return "railway";
  if (value.includes("n8n")) return "n8n";
  if (value.includes("whatsapp") || value.includes("evolution")) return "whatsapp";
  if (value.includes("github") || value.includes("git.")) return "github";
  if (value.includes("openclaw") || value.includes("agent")) return "openclaw";
  return "system";
};

const inferSeverity = (text: string): SofiaOpsSeverity => {
  const value = text.toLowerCase();
  if (/crash|fatal|failed|failure|error|timeout|disconnect|denied/.test(value)) return "critical";
  if (/warn|retry|degraded|slow|backoff/.test(value)) return "warning";
  if (/success|complete|completed|connected|ready|done/.test(value)) return "success";
  return "info";
};

export const pushSofiaOpsServerEvent = (input: unknown): SofiaOpsServerEvent => {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const type = safeField(body.type, 120) || "external.event";
  const payloadText = safeText(body.payload ?? body);
  const summary = safeField(body.summary, 200) || payloadText.slice(0, 200) || type;
  const combined = type + " " + summary + " " + payloadText;
  const requestedSource = safeField(body.source, 40) || "";
  const requestedSeverity = safeField(body.severity, 40) || "";
  const source = validSources.has(requestedSource as SofiaOpsSource) ? requestedSource as SofiaOpsSource : inferSource(combined);
  const severity = validSeverities.has(requestedSeverity as SofiaOpsSeverity) ? requestedSeverity as SofiaOpsSeverity : inferSeverity(combined);
  const event: SofiaOpsServerEvent = {
    id: "ext-" + Date.now().toString(36) + "-" + (++store.sequence).toString(36),
    ts: Date.now(),
    type,
    source,
    severity,
    summary,
    payloadText,
    floorHint: safeField(body.floorHint, 80),
    project: safeField(body.project, 100),
    agentId: safeField(body.agentId, 100),
    correlationId: safeField(body.correlationId, 120),
  };
  store.events = [event, ...store.events].slice(0, MAX_SERVER_EVENTS);
  return event;
};

export const listSofiaOpsServerEvents = () => store.events;
`);

write('src/app/api/sofia-ops/snapshot/route.ts', `import { NextResponse } from "next/server";
import { listSofiaOpsServerEvents } from "@/lib/sofia-ops/serverEventStore";
import { deriveTwinSnapshot } from "@/lib/sofia-ops/twinEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const events = listSofiaOpsServerEvents();
  return NextResponse.json({ snapshot: deriveTwinSnapshot(events), events: events.slice(0, 40) }, { headers: { "Cache-Control": "no-store" } });
}
`);

write('src/app/api/sofia-ops/manifest/route.ts', `import { NextResponse } from "next/server";
import { SOFIA_OPS_BUILDING, SOFIA_OPS_FUTURE_MODULES } from "@/lib/sofia-ops/manifest";
import { SOFIA_OPS_CAPABILITIES, SOFIA_OPS_VERSION } from "@/lib/sofia-ops/config";

export async function GET() {
  return NextResponse.json({ version: SOFIA_OPS_VERSION, capabilities: SOFIA_OPS_CAPABILITIES, building: SOFIA_OPS_BUILDING, futureModules: SOFIA_OPS_FUTURE_MODULES });
}
`);

write('src/features/sofia-ops/SofiaOpsHud.tsx', `"use client";

import { useEffect, useMemo, useState } from "react";
import { SOFIA_OPS_CAPABILITIES, SOFIA_OPS_VERSION } from "@/lib/sofia-ops/config";
import { getSofiaOpsEvents, subscribeSofiaOpsEvents, type SofiaOpsEvent } from "@/lib/sofia-ops/eventBus";
import { deriveTwinSnapshot, replayEventsAt, type TwinEvent } from "@/lib/sofia-ops/twinEngine";

type Tab = "live" | "replay" | "shadow" | "war" | "system";

const badge = (severity: TwinEvent["severity"]) =>
  severity === "critical" ? "text-red-300 border-red-500/40 bg-red-950/60" :
  severity === "warning" ? "text-amber-200 border-amber-500/35 bg-amber-950/50" :
  severity === "success" ? "text-emerald-200 border-emerald-500/35 bg-emerald-950/45" :
  "text-cyan-200 border-cyan-500/30 bg-cyan-950/40";

const eventHas = (event: TwinEvent, value: string) =>
  (event.type + " " + event.summary + " " + (event.payloadText || "")).toLowerCase().includes(value);

export function SofiaOpsHud({ floorLabel }: { floorLabel: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("live");
  const [runtimeEvents, setRuntimeEvents] = useState<SofiaOpsEvent[]>(() => getSofiaOpsEvents());
  const [externalEvents, setExternalEvents] = useState<TwinEvent[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);

  useEffect(() => subscribeSofiaOpsEvents(() => setRuntimeEvents(getSofiaOpsEvents())), []);
  useEffect(() => {
    let active = true;
    const pull = async () => {
      try {
        const response = await fetch("/api/sofia-ops/events", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const data = await response.json() as { events?: TwinEvent[] };
        if (active && Array.isArray(data.events)) setExternalEvents(data.events);
      } catch {}
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const events = useMemo<TwinEvent[]>(() => {
    const byId = new Map<string, TwinEvent>();
    for (const event of [...runtimeEvents, ...externalEvents] as TwinEvent[]) byId.set(event.id, event);
    return [...byId.values()].sort((a, b) => b.ts - a.ts).slice(0, 240);
  }, [externalEvents, runtimeEvents]);

  useEffect(() => {
    if (replayIndex > Math.max(0, events.length - 1)) setReplayIndex(Math.max(0, events.length - 1));
  }, [events.length, replayIndex]);

  const snapshot = useMemo(() => deriveTwinSnapshot(events), [events]);
  const selectedReplay = events[replayIndex] ?? null;
  const replayEvents = useMemo(() => selectedReplay ? replayEventsAt(events, selectedReplay.ts) : events, [events, selectedReplay]);
  const replaySnapshot = useMemo(() => deriveTwinSnapshot(replayEvents), [replayEvents]);
  const shadowEvents = useMemo(() => events.filter((event) => eventHas(event, "shadow")), [events]);
  const incidents = useMemo(() => events.filter((event) => event.severity === "critical").slice(0, 12), [events]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("sofia-ops:director", { detail: snapshot }));
  }, [snapshot]);

  const statusText = snapshot.mode === "incident" ? "ALERTA" : events.length ? "LIVE" : "READY";

  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 z-[80] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 font-mono">
      {open ? (
        <div className="w-[min(94vw,430px)] overflow-hidden rounded-xl border border-cyan-500/25 bg-[#071019]/95 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div>
              <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-200">SOFIA DIGITAL TWIN</div>
              <div className="text-[9px] text-white/45">{floorLabel} · v{SOFIA_OPS_VERSION} · saúde {snapshot.healthScore}%</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-[10px] text-white/60 hover:bg-white/10">FECHAR</button>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-white/10 p-2 text-[9px]">
            {(["live", "replay", "shadow", "war", "system"] as Tab[]).map((name) => (
              <button key={name} type="button" onClick={() => setTab(name)} className={"whitespace-nowrap rounded px-2 py-1.5 uppercase " + (tab === name ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5 text-white/45")}>{name}</button>
            ))}
          </div>

          <div className="p-2">
            {tab === "live" ? (
              <div>
                <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                  <div className="rounded border border-emerald-500/25 bg-emerald-950/30 p-2"><div className="text-white/45">FABRIC</div><div className="mt-1 text-emerald-200">LIVE</div></div>
                  <div className="rounded border border-violet-500/25 bg-violet-950/30 p-2"><div className="text-white/45">MODE</div><div className="mt-1 text-violet-200">{snapshot.mode.toUpperCase()}</div></div>
                  <div className={"rounded border p-2 " + (snapshot.incidentCount ? "border-red-500/35 bg-red-950/40" : "border-cyan-500/20 bg-cyan-950/25")}><div className="text-white/45">WAR ROOM</div><div className={"mt-1 " + (snapshot.incidentCount ? "text-red-200" : "text-cyan-200")}>{snapshot.incidentCount ? "INCIDENT" : "STANDBY"}</div></div>
                </div>
                <div className="mt-2 rounded border border-cyan-500/20 bg-cyan-950/20 p-2 text-[9px]"><span className="text-white/45">WORLD DIRECTOR → </span><span className="text-cyan-200">{snapshot.recommendedFloor}</span><span className="text-white/35"> · {snapshot.recommendedReason}</span></div>
                <div className="mt-2 max-h-44 space-y-1 overflow-auto">
                  {events.length === 0 ? <div className="rounded bg-white/5 px-2 py-2 text-[10px] text-white/45">Aguardando eventos…</div> : events.slice(0, 9).map((event) => (
                    <div key={event.id} className={"rounded border px-2 py-1.5 text-[9px] " + badge(event.severity)}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{event.source.toUpperCase()} · {event.type}</span><span className="opacity-60">{new Date(event.ts).toLocaleTimeString()}</span></div><div className="mt-0.5 truncate opacity-75">{event.summary}</div></div>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === "replay" ? (
              <div className="text-[9px]">
                <div className="rounded border border-cyan-500/20 bg-cyan-950/20 p-2"><div className="text-white/45">RAM TIME MACHINE</div><div className="mt-1 text-cyan-100">{selectedReplay ? new Date(selectedReplay.ts).toLocaleTimeString() : "sem eventos"} · saúde {replaySnapshot.healthScore}% · modo {replaySnapshot.mode}</div></div>
                <input aria-label="Replay timeline" className="mt-3 w-full" type="range" min="0" max={Math.max(0, events.length - 1)} value={replayIndex} onChange={(event) => setReplayIndex(Number(event.target.value))} />
                <div className="mt-2 rounded bg-white/5 p-2 text-white/55">{selectedReplay ? selectedReplay.type + " · " + selectedReplay.summary : "O replay começa a funcionar assim que houver atividade. O histórico profundo permanece desligado."}</div>
                <div className="mt-2 text-white/35">Eventos existentes naquele ponto: {replayEvents.length}. Nada é salvo permanentemente.</div>
              </div>
            ) : null}

            {tab === "shadow" ? (
              <div className="text-[9px]">
                <div className="grid grid-cols-3 gap-1.5"><div className="rounded border border-violet-500/25 bg-violet-950/25 p-2"><div className="text-white/45">CANDIDATAS</div><div className="mt-1 text-violet-200">{snapshot.shadowCandidateCount}</div></div><div className="rounded border border-cyan-500/20 bg-cyan-950/20 p-2"><div className="text-white/45">HUMANAS</div><div className="mt-1 text-cyan-200">{snapshot.shadowHumanCount}</div></div><div className="rounded border border-emerald-500/20 bg-emerald-950/20 p-2"><div className="text-white/45">COMPARADAS</div><div className="mt-1 text-emerald-200">{snapshot.shadowCompareCount}</div></div></div>
                <div className="mt-2 max-h-44 space-y-1 overflow-auto">{shadowEvents.length ? shadowEvents.slice(0, 10).map((event) => <div key={event.id} className="rounded border border-violet-500/20 bg-violet-950/20 p-2 text-violet-100"><div>{event.type}</div><div className="mt-0.5 truncate opacity-60">{event.summary}</div></div>) : <div className="rounded bg-white/5 p-2 text-white/45">Shadow Twin operacional e aguardando eventos <code>shadow.*</code> da Sofia. Nenhuma mensagem é enviada por esta camada.</div>}</div>
              </div>
            ) : null}

            {tab === "war" ? (
              <div className="text-[9px]">
                <div className={"rounded border p-2 " + (snapshot.incidentCount ? "border-red-500/35 bg-red-950/35 text-red-100" : "border-emerald-500/20 bg-emerald-950/20 text-emerald-100")}><div className="font-semibold">{snapshot.incidentCount ? "SALA DE GUERRA ATIVA" : "SALA DE GUERRA EM STANDBY"}</div><div className="mt-1 opacity-60">{snapshot.incidentCount ? "Diretor recomenda o Command Center. Incidentes recentes: " + snapshot.incidentCount : "Nenhum incidente crítico nos últimos 5 minutos."}</div></div>
                <div className="mt-2 max-h-44 space-y-1 overflow-auto">{incidents.map((event) => <div key={event.id} className="rounded border border-red-500/25 bg-red-950/25 p-2 text-red-100"><div>{event.source.toUpperCase()} · {event.type}</div><div className="mt-0.5 truncate opacity-60">{event.summary}</div></div>)}</div>
              </div>
            ) : null}

            {tab === "system" ? (
              <div className="space-y-1.5 text-[9px]">
                <div className="grid grid-cols-2 gap-1.5"><div className="rounded border border-emerald-500/20 bg-emerald-950/20 p-2 text-emerald-200">EXTERNAL INGRESS · ON</div><div className="rounded border border-emerald-500/20 bg-emerald-950/20 p-2 text-emerald-200">WORLD DIRECTOR · ON</div><div className="rounded border border-emerald-500/20 bg-emerald-950/20 p-2 text-emerald-200">RAM REPLAY · ON</div><div className="rounded border border-emerald-500/20 bg-emerald-950/20 p-2 text-emerald-200">MULTI-PROJECT FABRIC · READY</div><div className="rounded border border-white/10 bg-white/5 p-2 text-white/50">DEEP HISTORY · OFF</div><div className="rounded border border-white/10 bg-white/5 p-2 text-white/50">GPU FABRIC · OFF</div></div>
                <div className="rounded bg-white/5 p-2 text-white/40">Projetos vistos nesta sessão: {snapshot.activeProjects.length ? snapshot.activeProjects.join(", ") : "somente runtime Sofia"}. Simulações registradas: {snapshot.simulationCount}.</div>
                <div className="rounded bg-white/5 p-2 text-white/35">Recursos caros permanecem desligados por projeto: {String(!SOFIA_OPS_CAPABILITIES.gpuGeneration && !SOFIA_OPS_CAPABILITIES.deepHistoryPersistence)}.</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <button type="button" onClick={() => setOpen((value) => !value)} className={"rounded-full border px-3 py-2 text-[10px] font-semibold tracking-[0.12em] shadow-xl backdrop-blur-md " + (snapshot.mode === "incident" ? "border-red-400/40 bg-red-950/90 text-red-100" : "border-cyan-400/30 bg-[#071019]/92 text-cyan-100 hover:border-cyan-300/50")}>
        SOFIA OPS · {statusText}
      </button>
    </div>
  );
}
`);

console.log('SOFIA_OPS_MAX_V22_OK: RAM time-machine, operational Shadow Twin, War Room and world director enabled');
