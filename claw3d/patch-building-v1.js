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

// Keep the same storage key as the already-running Sofia office so the current
// first-floor browser layout remains intact on the existing public origin.
replaceOnce(
  'src/features/retro-office/core/constants.ts',
  'export const STORAGE_KEY = "openclaw-office-furniture-v9";',
  'export const STORAGE_KEY = "sofia-ops-office-furniture-v3";',
  'storage key',
);

// Add a second OpenClaw-backed floor to the existing building model.
replaceOnce(
  'src/lib/office/floors.ts',
  '  | "openclaw-ground"\n  | "hermes-first"',
  '  | "openclaw-ground"\n  | "audit-second"\n  | "hermes-first"',
  'FloorId audit-second',
);
replaceOnce(
  'src/lib/office/floors.ts',
  '    id: "openclaw-ground",\n    label: "OpenClaw Floor",\n    shortLabel: "OpenClaw",',
  '    id: "openclaw-ground",\n    label: "1º Andar — Operação",\n    shortLabel: "Operação",',
  'first floor label',
);
replaceOnce(
  'src/lib/office/floors.ts',
  '    runtimeProfileId: "openclaw-default",\n  },\n  {\n    id: "hermes-first",',
  '    runtimeProfileId: "openclaw-default",\n  },\n  {\n    id: "audit-second",\n    label: "2º Andar — Auditoria Lab",\n    shortLabel: "Auditoria",\n    provider: "openclaw",\n    kind: "runtime",\n    zone: "building",\n    enabled: true,\n    sortOrder: 15,\n    runtimeProfileId: "openclaw-audit",\n  },\n  {\n    id: "hermes-first",',
  'audit floor definition',
);

// Give the second floor its own visual preset and browser persistence namespace.
replaceOnce(
  'src/features/retro-office/core/furnitureDefaults.ts',
  'export type OfficeLayoutPreset = "office" | "lobby";',
  'export type OfficeLayoutPreset = "office" | "lobby" | "audit";',
  'audit layout preset type',
);

const auditLayout = `const DEFAULT_AUDIT_FURNITURE: FurnitureSeed[] = [
  // Five audit workstations. Keep these first so desk UIDs are stable: audit_0..audit_4.
  { type: "desk_cubicle", x: 600, y: 180, id: "audit_supervisor" },
  { type: "desk_cubicle", x: 420, y: 400, id: "audit_n8n" },
  { type: "desk_cubicle", x: 700, y: 430, id: "audit_monitor" },
  { type: "desk_cubicle", x: 980, y: 400, id: "audit_railway" },
  { type: "desk_cubicle", x: 900, y: 180, id: "audit_core" },

  // Supervisor workstation.
  { type: "chair", x: 620, y: 168, facing: 180 },
  { type: "computer", x: 620, y: 167 },
  { type: "keyboard", x: 630, y: 175 },
  { type: "mouse", x: 652, y: 175 },

  // n8n reviewer workstation.
  { type: "chair", x: 440, y: 388, facing: 180 },
  { type: "computer", x: 440, y: 387 },
  { type: "keyboard", x: 450, y: 395 },
  { type: "mouse", x: 472, y: 395 },

  // Sofia monitor workstation.
  { type: "chair", x: 720, y: 418, facing: 180 },
  { type: "computer", x: 720, y: 417 },
  { type: "keyboard", x: 730, y: 425 },
  { type: "mouse", x: 752, y: 425 },

  // Railway ops workstation.
  { type: "chair", x: 1000, y: 388, facing: 180 },
  { type: "computer", x: 1000, y: 387 },
  { type: "keyboard", x: 1010, y: 395 },
  { type: "mouse", x: 1032, y: 395 },

  // Sofia Core workstation.
  { type: "chair", x: 920, y: 168, facing: 180 },
  { type: "computer", x: 920, y: 167 },
  { type: "keyboard", x: 930, y: 175 },
  { type: "mouse", x: 952, y: 175 },

  // Central review surface.
  { type: "kanban_board", x: 705, y: 32, facing: 180 },
  { type: "whiteboard", x: 1035, y: 28, w: 10, h: 105 },
  { type: "round_table", x: 810, y: 315, r: 62 },
  { type: "chair", x: 875, y: 315, facing: 0 },
  { type: "chair", x: 810, y: 378, facing: 180 },
  { type: "chair", x: 745, y: 315, facing: 90 },
  { type: "chair", x: 810, y: 252, facing: 270 },

  // Infrastructure / server lab, left wing.
  { type: "wall", x: 24, y: 70, w: 300, h: 8 },
  { type: "wall", x: 24, y: 70, w: 8, h: 245 },
  { type: "wall", x: 24, y: 315, w: 118, h: 8 },
  { type: "wall", x: 202, y: 315, w: 122, h: 8 },
  { type: "door", x: 142, y: 315, w: 40, h: 8, facing: 0 },
  { type: "server_rack", x: 82, y: 128, facing: 0 },
  { type: "server_rack", x: 182, y: 128, facing: 0 },
  { type: "server_terminal", x: 132, y: 245, facing: 180 },
  { type: "plant", x: 272, y: 260 },

  // QA / testing lab, right wing.
  { type: "wall", x: 1325, y: 70, w: 430, h: 8 },
  { type: "wall", x: 1325, y: 70, w: 8, h: 570 },
  { type: "wall", x: 1755, y: 70, w: 8, h: 570 },
  { type: "wall", x: 1325, y: 640, w: 160, h: 8 },
  { type: "wall", x: 1545, y: 640, w: 218, h: 8 },
  { type: "door", x: 1485, y: 640, w: 40, h: 8, facing: 0 },
  { type: "qa_terminal", x: 1390, y: 130, facing: 90 },
  { type: "device_rack", x: 1510, y: 130, facing: 180 },
  { type: "device_rack", x: 1640, y: 130, facing: 180 },
  { type: "test_bench", x: 1390, y: 320, facing: 90 },
  { type: "test_bench", x: 1515, y: 470, facing: 90 },
  { type: "plant", x: 1695, y: 585 },

  // Review meeting room.
  { type: "round_table", x: 1180, y: 190, r: 70 },
  { type: "chair", x: 1250, y: 190, facing: 0 },
  { type: "chair", x: 1180, y: 260, facing: 180 },
  { type: "chair", x: 1110, y: 190, facing: 90 },
  { type: "chair", x: 1180, y: 120, facing: 270 },
  { type: "whiteboard", x: 1278, y: 125, w: 10, h: 100 },

  // Lounge / coffee corner.
  { type: "couch", x: 350, y: 585, w: 130, h: 44, facing: 0 },
  { type: "couch", x: 590, y: 585, w: 130, h: 44, facing: 0 },
  { type: "table_rect", x: 500, y: 585, w: 82, h: 38 },
  { type: "cabinet", x: 305, y: 625, w: 80, h: 40, elevation: 0 },
  { type: "coffee_machine", x: 345, y: 618, elevation: 0.56 },
  { type: "vending", x: 690, y: 585 },

  // Accents and lighting.
  { type: "lamp", x: 545, y: 285 },
  { type: "lamp", x: 1080, y: 320 },
  { type: "plant", x: 360, y: 110 },
  { type: "plant", x: 1130, y: 510 },
  { type: "plant", x: 790, y: 600 },
  { type: "clock", x: 850, y: 8 },

  // Outer shell; second floor is a separate scene, not physically stacked over floor 1.
  { type: "wall", x: 0, y: 0, w: 1800, h: 8 },
  { type: "wall", x: 0, y: 0, w: 8, h: 720 },
  { type: "wall", x: 1792, y: 0, w: 8, h: 720 },
  { type: "wall", x: 0, y: 712, w: 1800, h: 8 },
];

`;
insertBefore(
  'src/features/retro-office/core/furnitureDefaults.ts',
  'const DEFAULT_FURNITURE: FurnitureSeed[] = [',
  auditLayout,
  'audit furniture insertion',
);
replaceOnce(
  'src/features/retro-office/core/furnitureDefaults.ts',
  '(preset === "lobby" ? DEFAULT_LOBBY_FURNITURE : DEFAULT_FURNITURE).map((item, index) => ({',
  '(preset === "audit" ? DEFAULT_AUDIT_FURNITURE : preset === "lobby" ? DEFAULT_LOBBY_FURNITURE : DEFAULT_FURNITURE).map((item, index) => ({',
  'materialize audit preset',
);

// Route the new floor to the audit scene while preserving per-floor localStorage.
replaceOnce(
  'src/features/office/screens/OfficeScreen.tsx',
  'layoutPreset={activeFloor.kind === "lobby" ? "lobby" : "office"}',
  'layoutPreset={activeFloor.id === "audit-second" ? "audit" : activeFloor.kind === "lobby" ? "lobby" : "office"}',
  'OfficeScreen audit layout routing',
);

// Stable display names even if runtime metadata is sparse.
{
  const file = 'src/features/office/screens/OfficeScreen.tsx';
  let text = read(file);
  const anchor = 'name: agent.name || "Unknown",';
  if (text.includes(anchor)) {
    text = text.replace(
      anchor,
      'name: new Map<string, string>([["main","Sofia Core"],["supervisor","Supervisor"],["sofia-monitor","Sofia Monitor"],["n8n-reviewer","n8n Reviewer"],["railway-ops","Railway Ops"]]).get(agent.agentId) ?? agent.name ?? "Unknown",',
    );
    write(file, text);
  }
}

// Mobile camera: closer zoom and faster pinch/scroll, while keeping the polar-angle
// guard that prevents rotating through/under the floor.
replaceOnce(
  'src/features/retro-office/RetroOffice3D.tsx',
  '              zoomSpeed={0.8}\n              panSpeed={0.6}\n              minZoom={25}\n              maxZoom={120}\n              maxPolarAngle={Math.PI / 2.2}',
  '              zoomSpeed={1.15}\n              panSpeed={0.6}\n              minZoom={18}\n              maxZoom={200}\n              maxPolarAngle={Math.PI / 2.2}',
  'mobile zoom limits',
);

// Default title for fresh sessions.
{
  const file = 'src/lib/studio/settings.ts';
  let text = read(file);
  text = text.replace(
    'const DEFAULT_OFFICE_TITLE = "Luke Headquarters";',
    'const DEFAULT_OFFICE_TITLE = "Sofia Ops HQ";',
  );
  write(file, text);
}

// Seed Studio settings. The browser furniture itself stays per floor because
// RetroOffice3D uses storageNamespace={activeFloor.id}.
const stateDir = process.env.OPENCLAW_STATE_DIR || '/tmp/openclaw-state';
const gatewayUrl = process.env.CLAW3D_GATEWAY_URL || 'ws://openclaw-gateway.railway.internal:8080';
const settingsDir = path.join(stateDir, 'claw3d');
fs.mkdirSync(settingsDir, { recursive: true });
const settings = {
  version: 1,
  activeFloorId: 'openclaw-ground',
  focused: {
    [gatewayUrl]: { mode: 'focused', selectedAgentId: 'main', filter: 'all' },
  },
  avatars: {
    [gatewayUrl]: {
      main: 'sofia-core',
      supervisor: 'supervisor',
      'sofia-monitor': 'sofia-monitor',
      'n8n-reviewer': 'n8n-reviewer',
      'railway-ops': 'railway-ops',
    },
  },
  deskAssignments: {
    [gatewayUrl]: {
      office_0: 'main',
      office_1: 'supervisor',
      office_2: 'sofia-monitor',
      office_3: 'n8n-reviewer',
      office_4: 'railway-ops',
      audit_0: 'supervisor',
      audit_1: 'n8n-reviewer',
      audit_2: 'sofia-monitor',
      audit_3: 'railway-ops',
      audit_4: 'main',
    },
  },
  office: {
    [gatewayUrl]: {
      title: 'Sofia Ops HQ',
      companyName: 'Sofia Ops',
      companySummary: '1º andar: operação. 2º andar: auditoria, testes, revisão e melhoria contínua.',
      companyRoleTitles: ['Sofia Core', 'Supervisor', 'Sofia Monitor', 'n8n Reviewer', 'Railway Ops'],
    },
  },
};
write(path.join(settingsDir, 'settings.json'), JSON.stringify(settings, null, 2));

console.log('SOFIA_BUILDING_PATCH_OK: floor1 preserved by storage namespace, audit-second added, mobile zoom 18-200');
