const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');

const legacyLayout = [{"type":"desk_cubicle","x":610,"y":180,"id":"desk_sofia"},{"type":"desk_cubicle","x":900,"y":180,"id":"desk_supervisor"},{"type":"desk_cubicle","x":470,"y":390,"id":"desk_monitor"},{"type":"desk_cubicle","x":755,"y":430,"id":"desk_n8n"},{"type":"desk_cubicle","x":1040,"y":390,"id":"desk_railway"},{"type":"chair","x":630,"y":168,"facing":180},{"type":"computer","x":630,"y":167},{"type":"keyboard","x":640,"y":175},{"type":"mouse","x":662,"y":175},{"type":"chair","x":920,"y":168,"facing":180},{"type":"computer","x":920,"y":167},{"type":"keyboard","x":930,"y":175},{"type":"mouse","x":952,"y":175},{"type":"chair","x":490,"y":378,"facing":180},{"type":"computer","x":490,"y":377},{"type":"keyboard","x":500,"y":385},{"type":"mouse","x":522,"y":385},{"type":"chair","x":775,"y":418,"facing":180},{"type":"computer","x":775,"y":417},{"type":"keyboard","x":785,"y":425},{"type":"mouse","x":807,"y":425},{"type":"chair","x":1060,"y":378,"facing":180},{"type":"computer","x":1060,"y":377},{"type":"keyboard","x":1070,"y":385},{"type":"mouse","x":1092,"y":385},{"type":"round_table","x":1450,"y":190,"r":76},{"type":"chair","x":1515,"y":190,"facing":0},{"type":"chair","x":1490,"y":250,"facing":220},{"type":"chair","x":1410,"y":252,"facing":140},{"type":"chair","x":1385,"y":190,"facing":90},{"type":"chair","x":1410,"y":128,"facing":40},{"type":"chair","x":1490,"y":130,"facing":320},{"type":"whiteboard","x":1630,"y":115,"w":10,"h":100},{"type":"clock","x":1450,"y":40},{"type":"couch","x":1370,"y":515,"w":130,"h":44,"facing":0},{"type":"couch","x":1600,"y":505,"w":44,"h":130,"vertical":true,"facing":180},{"type":"table_rect","x":1480,"y":520,"w":86,"h":42},{"type":"beanbag","x":1390,"y":620,"color":"#1565c0","facing":140},{"type":"beanbag","x":1540,"y":620,"color":"#7c3aed","facing":220},{"type":"plant","x":1325,"y":650},{"type":"plant","x":1690,"y":650},{"type":"lamp","x":1655,"y":450},{"type":"wall","x":30,"y":60,"w":300,"h":8},{"type":"wall","x":30,"y":60,"w":8,"h":240},{"type":"wall","x":30,"y":300,"w":120,"h":8},{"type":"wall","x":210,"y":300,"w":120,"h":8},{"type":"door","x":150,"y":300,"w":40,"h":8,"facing":0},{"type":"server_rack","x":95,"y":120,"facing":0},{"type":"server_rack","x":190,"y":120,"facing":0},{"type":"server_terminal","x":145,"y":235,"facing":180},{"type":"plant","x":285,"y":250},{"type":"kanban_board","x":730,"y":35,"facing":180},{"type":"whiteboard","x":1060,"y":35,"w":10,"h":90},{"type":"coffee_machine","x":1160,"y":65,"elevation":0.56},{"type":"cabinet","x":1120,"y":70,"w":80,"h":40,"elevation":0},{"type":"vending","x":1240,"y":55},{"type":"pingpong","x":345,"y":590,"w":130,"h":70},{"type":"couch","x":560,"y":610,"w":130,"h":44},{"type":"table_rect","x":700,"y":610,"w":70,"h":36},{"type":"couch","x":820,"y":610,"w":130,"h":44},{"type":"plant","x":380,"y":250},{"type":"plant","x":520,"y":105},{"type":"plant","x":1010,"y":105},{"type":"plant","x":1190,"y":320},{"type":"plant","x":330,"y":470},{"type":"lamp","x":550,"y":300},{"type":"lamp","x":970,"y":300},{"type":"trash","x":560,"y":200},{"type":"trash","x":850,"y":200},{"type":"trash","x":420,"y":410},{"type":"trash","x":990,"y":410},{"type":"wall","x":0,"y":0,"w":1800,"h":8},{"type":"wall","x":0,"y":0,"w":8,"h":720},{"type":"wall","x":1792,"y":0,"w":8,"h":720},{"type":"wall","x":0,"y":712,"w":1800,"h":8}];

{
  const file = 'src/features/retro-office/core/furnitureDefaults.ts';
  let text = read(file);
  const replacement = 'const DEFAULT_FURNITURE: FurnitureSeed[] = ' + JSON.stringify(legacyLayout, null, 2) + ';';
  const pattern = /const DEFAULT_FURNITURE: FurnitureSeed\[\] = \[[\s\S]*?\n\];\n\nexport const materializeDefaults/;
  if (!pattern.test(text)) throw new Error('legacy DEFAULT_FURNITURE anchor not found');
  text = text.replace(pattern, replacement + '\n\nexport const materializeDefaults');
  write(file, text);
}

// Carry over the visual camera/ambience tweaks that were part of the stable
// legacy Sofia build, not only its furniture array.
{
  const file = 'src/features/retro-office/core/district.ts';
  let text = read(file);
  if (text.includes('export const DISTRICT_CAMERA_ZOOM = 34;')) {
    text = text.replace('export const DISTRICT_CAMERA_ZOOM = 34;', 'export const DISTRICT_CAMERA_ZOOM = 38;');
  }
  write(file, text);
}

{
  const file = 'src/features/retro-office/systems/cameraLighting.tsx';
  let text = read(file);
  if (text.includes('const DAY_NIGHT_PERIOD = 300;')) {
    text = text.replace('const DAY_NIGHT_PERIOD = 300;', 'const DAY_NIGHT_PERIOD = 1200;');
  }
  if (text.includes('const timeRef = useRef(0.25);')) {
    text = text.replace('const timeRef = useRef(0.25);', 'const timeRef = useRef(0.38);');
  }
  write(file, text);
}

console.log('SOFIA_OPS_MAX_V25_OK: exact 75-item legacy floor-1 baseline and legacy ambience ported');
