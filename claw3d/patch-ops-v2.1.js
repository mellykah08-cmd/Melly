const fs = require('node:fs');

const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

fs.mkdirSync('src/lib/sofia-ops', { recursive: true });
fs.mkdirSync('src/features/sofia-ops', { recursive: true });
fs.mkdirSync('src/app/api/sofia-ops/events', { recursive: true });
fs.mkdirSync('src/app/api/sofia-ops/status', { recursive: true });

write('src/lib/sofia-ops/config.ts', `export const SOFIA_OPS_VERSION = "2.1.0-max";

export const SOFIA_OPS_CAPABILITIES = {
  digitalTwin: true,
  eventFabric: true,
  secureExternalIngress: true,
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

const validSources = new Set<SofiaOpsSource>(["openclaw", "n8n", "railway", "whatsapp", "github", "system"]);
const validSeverities = new Set<SofiaOpsSeverity>(["info", "success", "warning", "critical"]);

const inferSource = (text: string): SofiaOpsSource => {
  const value = text.toLowerCase();
  if (value.includes("railway")) return "railway";
  if (value.includes("n8n")) return "n8n";
  if (value.includes("whatsapp") || value.includes("evolution")) return "whatsapp";
  if (value.includes("github") || value.includes("git.")) return "github";
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
  const type = typeof body.type === "string" && body.type.trim() ? body.type.trim().slice(0, 120) : "external.event";
  const payloadText = safeText(body.payload ?? body);
  const summary = typeof body.summary === "string" && body.summary.trim()
    ? body.summary.trim().slice(0, 200)
    : payloadText.slice(0, 200) || type;
  const combined = type + " " + summary + " " + payloadText;
  const requestedSource = typeof body.source === "string" ? body.source : "";
  const requestedSeverity = typeof body.severity === "string" ? body.severity : "";
  const source = validSources.has(requestedSource as SofiaOpsSource)
    ? requestedSource as SofiaOpsSource
    : inferSource(combined);
  const severity = validSeverities.has(requestedSeverity as SofiaOpsSeverity)
    ? requestedSeverity as SofiaOpsSeverity
    : inferSeverity(combined);
  const floorHint = typeof body.floorHint === "string" ? body.floorHint.slice(0, 80) : null;
  const event: SofiaOpsServerEvent = {
    id: "ext-" + Date.now().toString(36) + "-" + (++store.sequence).toString(36),
    ts: Date.now(),
    type,
    source,
    severity,
    summary,
    payloadText,
    floorHint,
  };
  store.events = [event, ...store.events].slice(0, MAX_SERVER_EVENTS);
  return event;
};

export const listSofiaOpsServerEvents = () => store.events;
`);

write('src/app/api/sofia-ops/events/route.ts', `import { NextRequest, NextResponse } from "next/server";
import { listSofiaOpsServerEvents, pushSofiaOpsServerEvent } from "@/lib/sofia-ops/serverEventStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: listSofiaOpsServerEvents() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const expected = process.env.SOFIA_OPS_EVENT_TOKEN?.trim();
  if (!expected) return NextResponse.json({ error: "ingress_not_configured" }, { status: 503 });
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== "Bearer " + expected) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await request.text();
  if (raw.length > 16000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const event = pushSofiaOpsServerEvent(body);
  return NextResponse.json({ ok: true, event }, { status: 202 });
}
`);

write('src/app/api/sofia-ops/status/route.ts', `import { NextResponse } from "next/server";
import { SOFIA_OPS_CAPABILITIES, SOFIA_OPS_VERSION } from "@/lib/sofia-ops/config";
import { listSofiaOpsServerEvents } from "@/lib/sofia-ops/serverEventStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: SOFIA_OPS_VERSION,
    capabilities: SOFIA_OPS_CAPABILITIES,
    externalEventBuffer: listSofiaOpsServerEvents().length,
    deepHistory: "off",
    gpuFabric: "off",
  }, { headers: { "Cache-Control": "no-store" } });
}
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
  const [runtimeEvents, setRuntimeEvents] = useState<SofiaOpsEvent[]>(() => getSofiaOpsEvents());
  const [externalEvents, setExternalEvents] = useState<SofiaOpsEvent[]>([]);

  useEffect(() => subscribeSofiaOpsEvents(() => setRuntimeEvents(getSofiaOpsEvents())), []);
  useEffect(() => {
    let active = true;
    const pull = async () => {
      try {
        const response = await fetch("/api/sofia-ops/events", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const data = await response.json() as { events?: SofiaOpsEvent[] };
        if (active && Array.isArray(data.events)) setExternalEvents(data.events);
      } catch {
        // The local runtime stream remains available even when external ingress is unreachable.
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const events = useMemo(() => {
    const byId = new Map<string, SofiaOpsEvent>();
    for (const event of [...runtimeEvents, ...externalEvents]) byId.set(event.id, event);
    return [...byId.values()].sort((a, b) => b.ts - a.ts).slice(0, 240);
  }, [externalEvents, runtimeEvents]);

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
            <div className="rounded border border-emerald-500/20 bg-emerald-950/20 p-2"><div className="text-white/45">EXT. INGRESS</div><div className="mt-1 text-emerald-200">READY</div></div>
            <div className="rounded border border-white/10 bg-white/5 p-2"><div className="text-white/45">GPU / HISTORY</div><div className="mt-1 text-white/60">PREPARED · OFF</div></div>
          </div>

          <div className="border-t border-white/10 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-[9px] text-white/45"><span>LIVE EVENT STREAM</span><span>{SOFIA_OPS_CAPABILITIES.multiProjectFabric ? "MULTI-PROJECT READY" : ""}</span></div>
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

console.log('SOFIA_OPS_MAX_V21_OK: secure external ingress and server RAM event fabric enabled');
