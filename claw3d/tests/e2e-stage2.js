// Sofia Spatial OS — stage 2/3 E2E: auto-follow ON/OFF, 3D station tap,
// inspectors (incident/project), functional floors (focus chip -> floor),
// gateway drop -> RECONNECTING without destroying the scene -> reconcile.
// Usage: node e2e-stage2.js <baseUrl> <label> [--no-reconnect]
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { execSync, spawn } = require('node:child_process');
const fs = require('node:fs');

const BASE = process.argv[2] || 'http://127.0.0.1:3100';
const LABEL = process.argv[3] || 'stage2';
const RECONNECT = !process.argv.includes('--no-reconnect');
const OUT = '/home/user/work/shots/' + LABEL;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' :: ' + JSON.stringify(detail).slice(0, 260) : ''));
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1 });
  await context.addCookies([{ name: 'studio_access', value: 'local-test-token', domain: new URL(BASE).hostname, path: '/' }]);
  await context.addInitScript(() => {
    try { localStorage.setItem('claw3d:onboarding:completed', 'true'); } catch {}
    window.__canvasMounts = 0;
    const seen = new WeakSet();
    new MutationObserver(() => {
      for (const c of document.querySelectorAll('canvas')) if (!seen.has(c)) { seen.add(c); window.__canvasMounts += 1; }
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(BASE + '/office', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 120000 });
  for (let i = 0; i < 60; i += 1) {
    const n = await page.evaluate(() => Object.keys(window.__SOFIA_AGENT_POS ?? {}).length);
    if (n >= 5) break;
    await sleep(1000);
  }
  await sleep(3000);
  const harness = (body) => page.evaluate(async (b) => (await fetch('/api/sofia-ops/harness', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sofia-harness': '1' }, body: JSON.stringify(b) })).status, body);
  const cam = () => page.evaluate(() => window.__SOFIA_CAMERA_TARGET);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const toWorld = (x, y) => [x * 0.018 - 16.2, 0, y * 0.018 - 16.2];
  await harness({ scenario: 'reset' });
  // The active floor is persisted server-side: always start on the 1st floor (via the HUD).
  const goFloor = async (label) => {
    await page.locator('[data-testid="sofia-ops-toggle"]').click();
    await page.locator('[data-testid="sofia-tab-floors"]').click();
    await page.getByRole('button', { name: new RegExp(label) }).first().click();
    await page.locator('[data-testid="sofia-ops-toggle"]').click();
    for (let i = 0; i < 40; i += 1) {
      await sleep(1000);
      const ok = await page.evaluate(() => Object.keys(window.__SOFIA_AGENT_POS ?? {}).length >= 5 && window.__SOFIA_ANCHORS);
      if (ok) break;
    }
    await sleep(2000);
  };
  const floor1 = await page.evaluate(() => window.__SOFIA_ANCHORS?.infra && window.__SOFIA_ANCHORS.infra.y < 330);
  if (!floor1) await goFloor('1º · Operação');
  await sleep(2500);

  const directoryOpen = await page.locator('text=Building Directory').count() && await page.getByRole('button', { name: 'Collapse building directory' }).count();
  check('mobile: building directory starts collapsed in a clean browser', !directoryOpen);

  // --- auto-follow ON: camera glides toward the focus (Railway Ops -> server room)
  const anchors = await page.evaluate(() => window.__SOFIA_ANCHORS);
  const infraWorld = toWorld(anchors.infra.x, anchors.infra.y);
  const c0 = await cam();
  await harness({ kind: 'deploy.started' });
  let c1 = c0;
  for (let i = 0; i < 24; i += 1) {
    await sleep(1000);
    c1 = await cam();
    if (dist(c1, c0) > 1) break;
  }
  check('auto-follow ON: camera glides toward the activity', dist(c1, c0) > 1, { from: c0.map((v) => +v.toFixed(2)), to: c1.map((v) => +v.toFixed(2)), infraWorld });
  await page.screenshot({ path: OUT + '/01-autofollow.png' });

  // --- auto-follow OFF: user keeps control; "ver" glides once
  await page.locator('[data-testid="sofia-autofollow"]').click();
  await sleep(1500);
  const off0 = await cam();
  await harness({ kind: 'audit.started' });
  await sleep(8000);
  const off1 = await cam();
  check('auto-follow OFF: camera stays where the user left it', dist(off0, off1) < 0.05, { moved: +dist(off0, off1).toFixed(3) });
  const chip = page.locator('[data-testid="sofia-focus-chip"]');
  check('auto-follow OFF: visual indication chip shown', (await chip.count()) > 0, await chip.textContent().catch(() => null));
  await chip.getByRole('button', { name: 'ver' }).click();
  let off2 = off1;
  for (let i = 0; i < 20; i += 1) {
    await sleep(1000);
    off2 = await cam();
    if (dist(off2, off1) > 1) break;
  }
  check('auto-follow OFF: "ver" glides to the focus once', dist(off2, off1) > 1, { moved: +dist(off2, off1).toFixed(2) });
  await page.locator('[data-testid="sofia-autofollow"]').click();

  // --- 3D tap on the active Audit station opens the station inspector
  await sleep(2000);
  // Tap stations nearest to the screen centre first; the canvas must be the
  // element under the finger (no HUD on top). Up to 4 stations are tried.
  const candidates = await page.evaluate(() => {
    const out = [];
    for (const zone of ['audit', 'infra', 'shadow', 'qa']) {
      const a = window.__SOFIA_ANCHORS[zone];
      if (!a) continue;
      // Tap the front (south) edge of the station, where a finger naturally lands.
      const p = window.__SOFIA_PROJECT(a.x, a.y + 30, 0.3);
      const top = document.elementFromPoint(p.x, p.y);
      if (p.x > 20 && p.x < innerWidth - 20 && p.y > 100 && p.y < innerHeight - 150 && top && top.tagName === 'CANVAS') {
        out.push({ zone, point: p, d: Math.hypot(p.x - innerWidth / 2, p.y - innerHeight / 2) });
      }
    }
    return out.sort((x, y) => x.d - y.d);
  });
  let tapZone = { zone: null, point: null };
  for (const candidate of candidates) {
    await page.mouse.click(candidate.point.x, candidate.point.y);
    await sleep(1200);
    const text = await page.locator('[data-testid="sofia-inspector"]').textContent().catch(() => '');
    tapZone = candidate;
    if (/estação/.test(text)) break;
  }
  await sleep(300);
  const zoneInspector = await page.locator('[data-testid="sofia-inspector"]').textContent().catch(() => '');
  check('inspector: tapping a 3D station shows function/owner/activity', /estação/.test(zoneInspector) && /função/.test(zoneInspector), { tapZone, tried: candidates.length, text: zoneInspector.slice(0, 120) });
  await page.screenshot({ path: OUT + '/02-station-inspector.png' });

  // --- incident + project inspectors
  await harness({ kind: 'incident' });
  await page.locator('[data-testid="sofia-war-banner"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="sofia-war-banner"]').click();
  const incInspector = await page.locator('[data-testid="sofia-inspector"]').textContent().catch(() => '');
  check('inspector: incident shows origin/timeline/evidence/state', /origem/.test(incInspector) && /estado/.test(incInspector) && /responsáveis/.test(incInspector), incInspector.slice(0, 160));
  await page.screenshot({ path: OUT + '/03-incident-inspector.png' });
  await harness({ kind: 'recovery' });
  await harness({ kind: 'deploy.started', project: 'clinica-norte' });
  await sleep(3000);
  await page.locator('[data-testid="sofia-ops-toggle"]').click();
  await page.locator('[data-testid="sofia-tab-projects"]').click();
  await page.getByRole('button', { name: /clinica-norte/ }).click();
  const projInspector = await page.locator('[data-testid="sofia-inspector"]').textContent().catch(() => '');
  check('inspector: project shows health/summary/activity', /saúde/.test(projInspector) && /eventos/.test(projInspector), projInspector.slice(0, 160));
  await page.locator('[data-testid="sofia-ops-toggle"]').click();

  // --- functional floors: a deploy belongs to Infra (4th floor); chip jumps there
  await harness({ kind: 'deploy.started' });
  await sleep(3000);
  const focusFloor = await page.evaluate(() => window.__SOFIA_WORLD.world.focus?.floorId);
  check('floors: World Director places deploy activity on the Infra floor', focusFloor === 'infra-fourth', focusFloor);
  const floorChip = page.locator('[data-testid="sofia-focus-chip"]').getByRole('button', { name: /Infra/ });
  check('floors: chip offers the activity floor', (await floorChip.count()) > 0);
  const mountsBefore = await page.evaluate(() => window.__canvasMounts);
  await floorChip.click();
  let floorState = null;
  for (let i = 0; i < 40; i += 1) {
    await sleep(1000);
    floorState = await page.evaluate(() => ({ anchors: window.__SOFIA_ANCHORS, pos: window.__SOFIA_AGENT_POS?.['railway-ops'], zone: window.__SOFIA_WORLD.world.agents['railway-ops']?.zone }));
    if (floorState.anchors && floorState.anchors.infra && floorState.anchors.infra.y > 400 && floorState.pos) break;
  }
  check('floors: Infra floor loads its own stations (server rack/terminal)', floorState?.anchors?.infra?.y > 400, floorState?.anchors?.infra);
  await sleep(5000);
  const infraFloorPos = await page.evaluate(() => window.__SOFIA_AGENT_POS?.['railway-ops']);
  check('floors: Railway Ops routed to the Infra floor server area', infraFloorPos && infraFloorPos.pose === 'stand' && (infraFloorPos.path > 0 || Math.hypot(infraFloorPos.x - infraFloorPos.tx, infraFloorPos.y - infraFloorPos.ty) < 30), infraFloorPos);
  await page.screenshot({ path: OUT + '/04-infra-floor.png' });
  const mountsAfter = await page.evaluate(() => window.__canvasMounts);
  console.log('INFO canvas mounts across floor switch', mountsBefore, '->', mountsAfter);

  // --- gateway drop: RECONNECTING, scene preserved, then reconciled
  if (RECONNECT) {
    const mounts0 = await page.evaluate(() => window.__canvasMounts);
    execSync('pkill -f "[s]ofia-demo-gw.js" || true');
    let state = null;
    for (let i = 0; i < 30; i += 1) {
      await sleep(1000);
      state = await page.evaluate(() => ({ gw: window.__SOFIA_WORLD.gateway.state, banner: Boolean(document.querySelector('[data-testid="sofia-reconnecting"]')), canvases: document.querySelectorAll('canvas').length, agents: Object.keys(window.__SOFIA_AGENT_POS ?? {}).length }));
      if (state.gw === 'reconnecting') break;
    }
    check('gateway drop: RECONNECTING shown', state?.gw === 'reconnecting' && state.banner, state);
    await sleep(4000);
    const during = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, agents: Object.keys(window.__SOFIA_AGENT_POS ?? {}).length, mounts: window.__canvasMounts }));
    check('gateway drop: scene not destroyed (canvas + NPCs kept)', during.canvases === 1 && during.agents >= 5 && during.mounts === mounts0, during);
    await page.screenshot({ path: OUT + '/05-reconnecting.png' });
    const gw = spawn('node', ['/home/user/work/gw/sofia-demo-gw.js'], { env: { ...process.env, NODE_PATH: '/home/user/work/cand/node_modules' }, detached: true, stdio: 'ignore' });
    gw.unref();
    let back = null;
    for (let i = 0; i < 60; i += 1) {
      await sleep(1000);
      back = await page.evaluate(() => ({ gw: window.__SOFIA_WORLD.gateway.state, agents: Object.keys(window.__SOFIA_WORLD.world.agents).length, mounts: window.__canvasMounts }));
      if (back.gw === 'connected') break;
    }
    check('gateway back: reconciled without rebuilding the world', back?.gw === 'connected' && back.agents >= 5 && back.mounts === mounts0, back);
  }

  await goFloor('1º · Operação');

  // --- first floor identity: same furniture set as the v2.7 baseline (75 legacy + migrated rooms)
  const floor1Items = await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('sofia-ops-office-furniture-v3:openclaw-ground') || '[]');
    return { count: items.length, desks: items.filter((i) => i.type === 'desk_cubicle').map((i) => i._uid + '@' + i.x + ',' + i.y) };
  });
  check('first floor: furniture identity preserved (108 items, 5 Sofia desks)', floor1Items.count === 108 && floor1Items.desks.length === 5 && floor1Items.desks.includes('office_0@610,180'), floor1Items);

  // --- expensive features stay OFF and say so
  await page.locator('[data-testid="sofia-ops-toggle"]').click();
  await page.locator('[data-testid="sofia-tab-system"]').click();
  const systemText = await page.locator('[data-testid="sofia-panel"]').textContent();
  check('flags: GPU / deep history / long simulation / XR are OFF', /GPU GENERATION · OFF/.test(systemText) && /DEEP HISTORY · OFF/.test(systemText) && /LONG SIMULATION · OFF/.test(systemText) && /XR · OFF/.test(systemText));
  await page.locator('[data-testid="sofia-ops-toggle"]').click();

  // --- WebGL context loss + restore: scene recovers without reloading the world
  const mountsBeforeLoss = await page.evaluate(() => window.__canvasMounts);
  const lost = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), 1500);
    return true;
  });
  await sleep(9000);
  const afterLoss = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, lost: (() => { const c = document.querySelector('canvas'); const g = c && (c.getContext('webgl2') || c.getContext('webgl')); return g ? g.isContextLost() : null; })(), agents: Object.keys(window.__SOFIA_AGENT_POS ?? {}).length, world: Object.keys(window.__SOFIA_WORLD?.world?.agents ?? {}).length }));
  check('webgl: context lost/restored -> scene alive, world kept', lost && afterLoss.canvases === 1 && afterLoss.lost === false && afterLoss.agents >= 5 && afterLoss.world >= 5, { ...afterLoss, mountsBeforeLoss });

  // --- background / foreground (mobile tab switch)
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  await sleep(4000);
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await sleep(5000);
  const resumed = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, agents: Object.keys(window.__SOFIA_AGENT_POS ?? {}).length, gw: window.__SOFIA_WORLD?.gateway?.state }));
  check('lifecycle: frozen -> active keeps the scene and the gateway', resumed.canvases === 1 && resumed.agents >= 5 && resumed.gw === 'connected', resumed);

  check('stability: no page errors', errors.length === 0, errors.slice(0, 4));
  const passed = results.filter((r) => r.ok).length;
  console.log(`RESULT ${passed}/${results.length}`);
  fs.writeFileSync(OUT + '/result.json', JSON.stringify(results, null, 1));
  await browser.close();
  process.exit(passed === results.length ? 0 : 1);
})().catch((error) => {
  console.error('E2E crashed', error);
  process.exit(2);
});
