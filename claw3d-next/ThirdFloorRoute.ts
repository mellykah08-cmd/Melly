import { CANVAS_W, CANVAS_H, SCALE } from "@/features/retro-office/core/constants";
import { getItemBounds, toWorld } from "@/features/retro-office/core/geometry";
import { astar, buildNavGrid, type NavGrid } from "@/features/retro-office/core/navigation";
import type { FurnitureItem, RenderAgent } from "@/features/retro-office/core/types";

export type WorldPoint = [number, number, number];
export type TransitPoint = { x: number; y: number; sofiaWorld: WorldPoint };
export const THIRD_FLOOR_DESTINATION = { x: 1390, y: 1710 };
const point = (x: number, y: number, height: number, ox = 0, oz = 0): TransitPoint => {
  const [wx, , wz] = toWorld(x, y);
  return { x, y, sofiaWorld: [wx + ox, height, wz + oz] };
};
export const FIRST_RAMP_START = point(1050, 720, 0);
export const FIRST_RAMP_END = point(1050, 1020, 4.8);
export const SECOND_RAMP_START = point(1390, 1480, 4.8);
export const SECOND_RAMP_END = point(1390, 1710, 9.6, 5.2, -1.4);
const groundGate = point(1050, 700, 0);
const upperGate = point(1050, 1055, 4.8);

// Each floor has its own obstacle grid. Walking on level 2 never changes height
// merely because the route passes south of the sky-ramp's logical start.
const floorGrid = (furniture: FurnitureItem[], minY: number, maxY: number): NavGrid => {
  const grid = buildNavGrid(furniture);
  const cols = Math.ceil(CANVAS_W / 25), rows = Math.ceil(CANVAS_H / 25);
  if (minY > 0) {
    // The 64px corridor between the QA wall and south shell vanished because
    // both padded wall rectangles claimed entire overlapping 25px cells.
    // Test cell centres against the same 15px wall clearance; do not clear props.
    const solids = buildNavGrid(furniture.filter(item => item.type !== "wall"));
    const walls = furniture.filter(item => item.type === "wall").map(getItemBounds);
    for (let row = 1; row < rows - 1; row++) for (let col = 1; col < cols - 1; col++) {
      const index = row * cols + col, x = col * 25 + 12.5, y = row * 25 + 12.5;
      if (grid[index] && !solids[index] && !walls.some(b => x >= b.x - 15 && x <= b.x + b.w + 15 && y >= b.y - 15 && y <= b.y + b.h + 15)) grid[index] = 0;
    }
  }
  for (let row = 0; row < rows; row++) {
    const y = row * 25 + 12.5;
    if (y < minY || y > maxY) grid.fill(1, row * cols, (row + 1) * cols);
  }
  return grid;
};

export function planThirdFloorRoute(
  start: { x: number; y: number; sofiaWorldPosition?: WorldPoint },
  target: { x: number; y: number },
  groundFurniture: FurnitureItem[],
  upperFurniture: FurnitureItem[],
): TransitPoint[] {
  const up = target.x === THIRD_FLOOR_DESTINATION.x && target.y === THIRD_FLOOR_DESTINATION.y;
  const route: TransitPoint[] = [];
  let current = { ...start };
  const height = start.sofiaWorldPosition?.[1] ?? 0;
  const append = (p: TransitPoint) => { route.push(p); current = p; };
  const walk = (destination: TransitPoint, grid: NavGrid, floorHeight: number) => {
    const path = astar(current.x, current.y, destination.x, destination.y, grid);
    if (!path.length) return false;
    for (const p of path) append(point(p.x, p.y, floorHeight));
    return true;
  };
  const ground = floorGrid(groundFurniture, 0, 719);
  const upper = floorGrid(upperFurniture, 1020, 1740);
  if (up) {
    if (height >= 9.6 - 1e-6) return [SECOND_RAMP_END];
    if (height > 4.8 + 1e-6) return [SECOND_RAMP_END];
    if (height < 4.8 - 1e-6) {
      if (height <= 1e-6 && current.y < 720) {
        if (!walk(groundGate, ground, 0)) return [];
        append(FIRST_RAMP_START);
      }
      append(FIRST_RAMP_END);
      append(upperGate);
    }
    if (!walk(SECOND_RAMP_START, upper, 4.8)) return [];
    append(SECOND_RAMP_END);
  } else {
    if (height > 4.8 + 1e-6) append(SECOND_RAMP_START);
    if (height >= 4.8 - 1e-6) {
      if (!walk(upperGate, upper, 4.8)) return [];
      append(FIRST_RAMP_END);
      append(FIRST_RAMP_START);
      append(groundGate);
    } else if (height > 1e-6 || current.y >= 720) {
      append(FIRST_RAMP_START);
      append(groundGate);
    }
    if (!walk(point(target.x, target.y, 0), ground, 0)) return [];
  }
  return route;
}

// Consume the entire elapsed-distance budget across waypoint boundaries.
// No frame-count speed, destination teleport or lost remainder at low FPS.
export function advanceThirdFloorRoute(agent: RenderAgent, delta: number): Partial<RenderAgent> {
  let x = agent.x, y = agent.y;
  let world: WorldPoint = agent.sofiaWorldPosition ?? toWorld(x, y);
  let remaining = Math.max(0, Math.min(delta, 0.25)) * (agent.walkSpeed ?? 0.3) * 3 * 60 * SCALE;
  let path = agent.path;
  let facing = agent.facing;
  while (remaining > 0 && path.length) {
    const next = path[0];
    const target = next.sofiaWorld;
    if (!target) break; // Incompatible path: stay in place, never infer a shortcut.
    const dx = target[0] - world[0], dy = target[1] - world[1], dz = target[2] - world[2];
    const distance = Math.hypot(dx, dy, dz);
    if (distance > 1e-8) facing = Math.atan2(dx, dz);
    if (distance <= remaining) {
      remaining -= distance;
      x = next.x; y = next.y; world = [...target]; path = path.slice(1);
    } else {
      const fraction = remaining / distance;
      x += (next.x - x) * fraction; y += (next.y - y) * fraction;
      world = [world[0] + dx * fraction, world[1] + dy * fraction, world[2] + dz * fraction];
      remaining = 0;
    }
  }
  const arrived = Math.hypot(x - agent.targetX, y - agent.targetY) < 0.1 && !path.length;
  return { x, y, path, sofiaWorldPosition: world, facing: arrived ? (agent.sofiaFacing ?? facing) : facing,
    state: path.length ? "walking" : arrived && agent.sofiaPose === "sit" ? "sitting" : "standing",
    frame: agent.frame + Math.max(0, Math.min(delta, 0.25)) * 60 };
}
