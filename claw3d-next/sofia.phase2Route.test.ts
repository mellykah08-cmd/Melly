import { describe, it, expect, vi, afterEach } from "vitest";
import { materializeDefaults } from "@/features/retro-office/core/furnitureDefaults";
import { projectFurnitureIntoRemoteOfficeZone } from "@/features/retro-office/core/district";
import { planThirdFloorRoute, advanceThirdFloorRoute, synchronizeThirdFloorRoute, FIRST_RAMP_START, FIRST_RAMP_END, SECOND_RAMP_START, SECOND_RAMP_END } from "@/features/sofia-ops/ThirdFloorRoute";
import type { FurnitureItem, RenderAgent } from "@/features/retro-office/core/types";

const ground = materializeDefaults("office");
const upperSource = materializeDefaults("audit").filter(item => !(item.type === "wall" && item.x === 0 && item.y === 0 && item.w === 1800));
upperSource.push({ _uid: "north-left", type: "wall", x: 0, y: 0, w: 980, h: 8 }, { _uid: "north-right", type: "wall", x: 1120, y: 0, w: 680, h: 8 });
const upper = projectFurnitureIntoRemoteOfficeZone({ furniture: upperSource, sourceWidth: 1800, sourceHeight: 720 });
const destination = { x: 1390, y: 1710 };
const makeAgent = (x = 800, y = 420) => ({ id: "main", x, y, targetX: 1390, targetY: 1710, path: planThirdFloorRoute({ x, y }, destination, ground, upper), facing: 0, state: "walking", status: "working", walkSpeed: 0.3, phaseOffset: 0, frame: 0, sofiaPose: "stand" }) as RenderAgent;

describe("Phase 2 physical third-floor route", () => {
  it("keeps the physical route when a pose/status refresh supplies a plain A* path", () => {
    let a = makeAgent(); a.sofiaThirdFloorRoute = true;
    for (let i = 0; i < 30 * 150 && (a.sofiaWorldPosition?.[1] ?? 0) < 4.8 && a.path.length; i++) a = { ...a, ...advanceThirdFloorRoute(a, 1 / 30) };
    expect(a.sofiaWorldPosition![1]).toBeGreaterThanOrEqual(4.8);
    const committedPath = a.path;
    const legacyUpdate = { ...a, path: [{ x: 1390, y: 1710 }], sofiaPose: "sit" as const };
    const stuck = advanceThirdFloorRoute(legacyUpdate, 0.25);
    expect([stuck.x, stuck.y, stuck.sofiaWorldPosition]).toEqual([a.x, a.y, a.sofiaWorldPosition]);
    a = { ...legacyUpdate, ...synchronizeThirdFloorRoute(a, legacyUpdate, ground, upper) };
    expect(a.path).toBe(committedPath);
    expect(a.sofiaRouteBlocked).toBe(false);
    for (let i = 0; i < 30 * 150 && a.path.length; i++) a = { ...a, ...advanceThirdFloorRoute(a, 1 / 30) };
    expect(a.sofiaWorldPosition).toEqual(SECOND_RAMP_END.sofiaWorld);
    expect(a.path).toEqual([]);
  });
  it("repairs a route that already lost physical metadata at the first ramp exit", () => {
    const gate = planThirdFloorRoute(makeAgent(), destination, ground, upper).find(p => p.x === 1050 && p.y === 1055)!;
    let a: RenderAgent = { ...makeAgent(), x: gate.x, y: gate.y, sofiaWorldPosition: gate.sofiaWorld,
      sofiaThirdFloorRoute: true, path: [{ x: 1390, y: 1710 }] };
    a = { ...a, ...synchronizeThirdFloorRoute(a, a, ground, upper) };
    expect(a.path.every(p => p.sofiaWorld)).toBe(true);
    expect(a.sofiaRouteBlocked).toBe(false);
    for (let i = 0; i < 30 * 150 && a.path.length; i++) a = { ...a, ...advanceThirdFloorRoute(a, 1 / 30) };
    expect(a.sofiaWorldPosition).toEqual(SECOND_RAMP_END.sofiaWorld);
  });
  it("replans a deliberate destination change as a physical descent", () => {
    const a = { ...makeAgent(), x: 1390, y: 1710, sofiaWorldPosition: SECOND_RAMP_END.sofiaWorld, path: [], sofiaThirdFloorRoute: true };
    const update = synchronizeThirdFloorRoute(a, { targetX: 800, targetY: 420 }, ground, upper);
    expect(update.path).toContainEqual(SECOND_RAMP_START);
    expect(update.path).toContainEqual(FIRST_RAMP_START);
    expect(update.path?.every(p => p.sofiaWorld)).toBe(true);
  });
  it.each([[800, 420], [450, 420], [1050, 690], [900, 200]])("routes from %s,%s through both authored ramps", (x, y) => {
    const route = planThirdFloorRoute({ x, y }, destination, ground, upper);
    expect(route.length).toBeGreaterThan(4);
    for (const endpoint of [FIRST_RAMP_START, FIRST_RAMP_END, SECOND_RAMP_START, SECOND_RAMP_END]) expect(route).toContainEqual(endpoint);
    const skyStart = route.findIndex(p => p === SECOND_RAMP_START || (p.x === 1390 && p.y === 1480));
    const firstEnd = route.findIndex(p => p.x === 1050 && p.y === 1020);
    expect(route.slice(firstEnd, skyStart + 1).every(p => p.sofiaWorld[1] === 4.8)).toBe(true);
    expect(route.at(-1)).toEqual(SECOND_RAMP_END);
  });
  it("stays blocked rather than teleporting when a wall isolates main", () => {
    const sealed: FurnitureItem[] = [{ _uid: "sealed", type: "wall", x: 10, y: 300, w: 1780, h: 40 }];
    const route = planThirdFloorRoute({ x: 800, y: 200 }, destination, sealed, upper);
    expect(route).toEqual([]);
    const a = makeAgent(800, 200); a.path = route;
    const moved = advanceThirdFloorRoute(a, 1 / 30);
    expect([moved.x, moved.y, moved.state]).toEqual([800, 200, "standing"]);
  });
  it("moves the same physical distance at 15, 30 and 60 FPS", () => {
    const simulate = (fps: number) => {
      let a = makeAgent();
      for (let frame = 0; frame < fps * 20; frame++) a = { ...a, ...advanceThirdFloorRoute(a, 1 / fps) };
      return a;
    };
    const slow = simulate(15), mid = simulate(30), fast = simulate(60);
    expect(slow.x).toBeCloseTo(fast.x, 5); expect(slow.y).toBeCloseTo(fast.y, 5);
    expect(mid.sofiaWorldPosition).toEqual(expect.arrayContaining([expect.closeTo(fast.sofiaWorldPosition![1], 5)]));
    expect(slow.frame).toBeCloseTo(fast.frame, 5);
  });
  it("keeps every ascent frame inside the ramp line and walks before standing", () => {
    let a = makeAgent();
    for (let frame = 0; frame < 60 * 150 && a.path.length; frame++) {
      a = { ...a, ...advanceThirdFloorRoute(a, 1 / 60) };
      const world = a.sofiaWorldPosition!;
      if (world[1] > 0 && world[1] < 4.8) {
        const p = world[1] / 4.8;
        expect(a.x).toBeCloseTo(1050, 5);
        expect(world[2]).toBeCloseTo(FIRST_RAMP_START.sofiaWorld[2] + p * (FIRST_RAMP_END.sofiaWorld[2] - FIRST_RAMP_START.sofiaWorld[2]), 5);
      }
      if (world[1] > 4.8 && world[1] < 9.6) {
        const p = (world[1] - 4.8) / 4.8;
        expect(a.x).toBeCloseTo(1390, 5);
        expect(world[0]).toBeCloseTo(SECOND_RAMP_START.sofiaWorld[0] + p * 5.2, 5);
      }
      if (a.path.length) expect(a.state).toBe("walking");
    }
    expect(a.path).toEqual([]); expect(a.sofiaWorldPosition).toEqual(SECOND_RAMP_END.sofiaWorld); expect(a.state).toBe("standing");
    const down = planThirdFloorRoute(a, { x: 800, y: 420 }, ground, upper);
    expect(down.length).toBeGreaterThan(0);
    expect(down).toContainEqual(SECOND_RAMP_START); expect(down).toContainEqual(FIRST_RAMP_START);
  });
});

describe("Phase 2 event ordering and arrival", () => {
  afterEach(() => { vi.useRealTimers(); vi.resetModules(); });
  it("only consumes dev-third, retains terminal until arrival, and rejects all updates after terminal", async () => {
    vi.useFakeTimers(); vi.resetModules();
    const { thirdFloorDirector: d } = await import("@/features/sofia-ops/ThirdFloorDirector");
    const event = (status: string, sequence: number, runId = "n8n-test") => ({ type: "event", event: "sofia.ops", payload: { id: `${runId}-${sequence}`, source: "n8n", floorId: "dev-third", agentId: "main", runId, sequence, status } });
    const unrelated = event("workflow.running", 1); unrelated.payload.floorId = "audit-second";
    expect(d.ingest(unrelated)).toBe(false);
    d.ingest(event("workflow.running", 1)); d.ingest(event("workflow.completed", 2));
    vi.advanceTimersByTime(35000); expect(d.getSnapshot().main.status).toBe("workflow.completed");
    d.ingest(event("workflow.failed", 3)); d.ingest(event("workflow.running", 4));
    expect(d.getSnapshot().main.status).toBe("workflow.completed");
    d.arrived("main"); vi.advanceTimersByTime(29999); expect(d.getSnapshot().main).toBeTruthy();
    vi.advanceTimersByTime(1); expect(d.getSnapshot().main).toBeUndefined();
    d.ingest(event("workflow.running", 1, "new-run")); d.ingest(event("workflow.failed", 8));
    expect(d.getSnapshot().main.runId).toBe("new-run");
  });
});
