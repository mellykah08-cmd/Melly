import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync("tests/fixtures/sofia-access-check-client.js", "utf8");
const nativeSocket = window.WebSocket;
beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = ""; delete (window as any).__sofiaAccessCheckInstalled; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); window.WebSocket = nativeSocket; });

describe("main route diagnostic client", () => {
  it("renders the actual main state and reports bounded metadata without secrets", () => {
    const canvas = document.createElement("canvas");
    canvas.dataset.sofiaMain = JSON.stringify({ revision: "R3", x: 1050, y: 1020, world: [2.7, 4.8, 2.16], target: [1390, 1710], route: true,
      state: "standing", path: 0, blocked: true, phase: "workflow.running", speed: 0.3, frame: 50,
      next: { x: 1390, y: 1480, sofiaWorld: [NaN, 4.8, 10] }, token: "MUST_NOT_REPORT", runId: "MUST_NOT_REPORT", conversation: "MUST_NOT_REPORT" });
    document.body.append(canvas);
    const send = vi.fn(() => Promise.resolve({}));
    runInNewContext(source, { window, document, fetch: send, URL, Date, Map, Set, JSON, Math, Number, String });
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(90000);
    expect(send).toHaveBeenCalledTimes(9);
    const [url, options] = send.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(url).toBe("/api/sofia-ops/client-error"); expect(options.method).toBe("POST");
    expect(options.body).not.toContain("MUST_NOT_REPORT");
    const report = JSON.parse(JSON.parse(options.body).message);
    expect(report).toMatchObject({ scene: "R3", x: 1050, y: 1020, path: 0, blocked: true, target: [1390, 1710] });
    expect(report.next.world).toEqual([null, 4.8, 10]);
    expect(document.body.textContent).toContain("Diagnóstico R4 · Cena R3");
    expect(document.body.textContent).toContain("bloqueado");
  });
  it("still reports arrival and release after periodic samples are exhausted", () => {
    const canvas = document.createElement("canvas");
    const moving = { revision: "R3", x: 1050, y: 1020, world: [2.7, 4.8, 2.16], target: [1390, 1710], route: true,
      state: "walking", path: 20, blocked: false, phase: "workflow.completed", speed: 0.3, frame: 50 };
    canvas.dataset.sofiaMain = JSON.stringify(moving); document.body.append(canvas);
    const send = vi.fn(() => Promise.resolve({}));
    runInNewContext(source, { window, document, fetch: send, URL, Date, Map, Set, JSON, Math, Number, String });
    window.dispatchEvent(new Event("load")); vi.advanceTimersByTime(180000);
    expect(send).toHaveBeenCalledTimes(9);
    canvas.dataset.sofiaMain = JSON.stringify({ ...moving, x: 1390, y: 1710, world: [14.02, 9.6, 13.18], state: "standing", path: 0 });
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(10);
    expect(document.body.textContent).toContain("Chegada confirmada ao 3º andar");
    canvas.dataset.sofiaMain = JSON.stringify({ ...moving, phase: null, target: [635, 194] });
    vi.advanceTimersByTime(120000);
    expect(send).toHaveBeenCalledTimes(11);
    const reports = send.mock.calls.map(call => JSON.parse(JSON.parse((call as any)[1].body).message));
    expect(reports.filter(r => r.milestone).map(r => r.milestone)).toEqual(["active", "arrived", "released"]);
    expect(reports.at(-2)).toMatchObject({ revision: "R4", scene: "R3", path: 0, world: [14.02, 9.6, 13.18] });
  });

});
