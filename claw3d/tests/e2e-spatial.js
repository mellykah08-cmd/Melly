// Sofia Spatial OS E2E: drives the Event Fabric through the harness and proves the
// behaviour is observable in /office (world state + physical agent positions +
// banners + screenshots). Usage: node e2e-spatial.js <baseUrl> <label> [cookieToken]
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');

const BASE = process.argv[2] || 'http://127.0.0.1:3100';
const LABEL = process.argv[3] || 'local';
const TOKEN = process.argv[4] || 'local-test-token';
const OUT = '/home/user/work/shots/' + LABEL;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' :: ' + JSON.stringify(detail).slice(0, 300) : ''));
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  // Pixel 7 geometry/touch, DPR 1 so software GL in CI renders more frames.
  const context = await browser.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1 });
  const url = new URL(BASE);
  await context.addCookies([{ name: 'studio_access', value: TOKEN, domain: url.hostname, path: '/', secure: url.protocol === 'https:' }]);
  await context.addInitScript(() => {
    try { localStorage.setItem('claw3d-onboarding-complete', 'true'); localStorage.setItem('claw3d:onboarding:completed', 'true'); } catch {}
    window.__canvasMounts = 0;
    window.__loadingSeen = 0;
    const seen = new WeakSet();
    const scan = () => {
      for (const c of document.querySelectorAll('canvas')) if (!seen.has(c)) { seen.add(c); window.__canvasMounts += 1; }
      if (document.querySelector('[aria-label="Loading office"]')) window.__loadingSeen += 1;
    };
    new MutationObserver(scan).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|WebSocket|status of 400/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });

  await page.goto(BASE + '/office', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('canvas', { timeout: 120000 });
  const closeBtn = page.locator('[aria-label="Close onboarding"]');
  await sleep(5000);
  if (await closeBtn.count()) await closeBtn.first().click().catch(() => {});
  const connectBtn = page.getByRole('button', { name: /^Connect$/ });
  if (await connectBtn.count()) await connectBtn.first().click().catch(() => {});

  // Wait for the world store to see the gateway agents and their render positions.
  let ready = null;
  for (let i = 0; i < 60; i += 1) {
    ready = await page.evaluate(() => ({
      agents: Object.keys(window.__SOFIA_WORLD?.world?.agents ?? {}),
      pos: Object.keys(window.__SOFIA_AGENT_POS ?? {}),
      gateway: window.__SOFIA_WORLD?.gateway?.state,
    }));
    if (ready.agents.length >= 5 && ready.pos.length >= 5) break;
    await sleep(1000);
  }
  check('gateway agents reach the world store', ready.agents.length >= 5, ready);
  await sleep(4000);
  await page.screenshot({ path: OUT + '/00-idle.png' });
  // Stability is measured from here on (initial lobby->floor mount is upstream behaviour).
  await page.evaluate(() => { window.__canvasMounts = document.querySelectorAll('canvas').length; window.__loadingSeen = 0; });
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n += 1; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(Math.round((n / 3) * 10) / 10); }; requestAnimationFrame(f); }));
  console.log('INFO headless fps', fps);
  // Physical progress: either arrived, or a real A* route exists and the agent got closer.
  const progress = async (id, waitMs) => {
    const a = (await pos())[id];
    await sleep(waitMs);
    const b = (await pos())[id];
    const d0 = Math.hypot(a.x - a.tx, a.y - a.ty);
    const d1 = Math.hypot(b.x - b.tx, b.y - b.ty);
    return { ok: d1 < 30 || (b.path > 0 && d1 < d0), d0: Math.round(d0), d1: Math.round(d1), path: b.path, pose: b.pose, state: b.state, at: [b.x, b.y], target: [b.tx, b.ty] };
  };

  const harness = (body) => page.evaluate(async (b) => {
    const r = await fetch('/api/sofia-ops/harness', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sofia-harness': '1' }, body: JSON.stringify(b) });
    return r.status;
  }, body);
  const world = () => page.evaluate(() => window.__SOFIA_WORLD);
  const pos = () => page.evaluate(() => window.__SOFIA_AGENT_POS ?? {});
  const waitFor = async (fn, ms = 20000) => {
    const end = Date.now() + ms;
    let last;
    while (Date.now() < end) {
      last = await page.evaluate(fn);
      if (last && last.ok) return last;
      await sleep(500);
    }
    return last;
  };

  await harness({ scenario: 'reset' });
  check('harness requires the custom header', (await page.evaluate(async () => (await fetch('/api/sofia-ops/harness', { method: 'POST', body: '{}' })).status)) === 400);

  // 1. deploy -> Railway Ops walks to the server room (Infra)
  const before = await pos();
  check('harness deploy accepted', (await harness({ kind: 'deploy.started' })) === 202);
  const deploy = await waitFor(() => {
    const w = window.__SOFIA_WORLD?.world;
    const p = window.__SOFIA_AGENT_POS?.['railway-ops'];
    return { ok: w?.agents?.['railway-ops']?.zone === 'infra' && p?.pose === 'stand' && p.tx < 340 && p.ty < 330, zone: w?.agents?.['railway-ops']?.zone, p, mode: w?.mode };
  });
  check('deploy: Railway Ops assigned to Infra, target = server room (floor-1 top-left)', deploy?.ok, deploy);
  const deployMove = await progress('railway-ops', 8000);
  check('deploy: Railway Ops walks a real A* route toward the server room', deployMove.ok, deployMove);
  await page.screenshot({ path: OUT + '/01-deploy.png' });

  // 2. audit -> n8n Reviewer to the QA/Audit lab
  await harness({ kind: 'audit.started' });
  const audit = await waitFor(() => {
    const w = window.__SOFIA_WORLD?.world;
    const p = window.__SOFIA_AGENT_POS?.['n8n-reviewer'];
    return { ok: w?.agents?.['n8n-reviewer']?.state === 'auditing' && p?.pose === 'stand' && p.tx > 950 && p.ty < 200, p, mode: w?.mode };
  });
  check('audit: n8n Reviewer auditing, target = review board (sealed lab fallback)', audit?.ok, audit);
  const auditMove = await progress('n8n-reviewer', 6000);
  check('audit: n8n Reviewer walks a real A* route', auditMove.ok, auditMove);
  const immersive = await page.evaluate(() => /walking to the QA Lab|Code Review room/i.test(document.body.innerText));
  check('audit: no upstream immersive QA/GitHub overlay hijacks the screen', !immersive);
  await sleep(8000);
  await page.screenshot({ path: OUT + '/02-audit.png' });

  // 3. shadow candidate/human/compare -> Sofia Monitor to the shadow station + twin pair
  await harness({ kind: 'shadow.candidate' });
  await sleep(1500);
  await harness({ kind: 'shadow.human' });
  await sleep(1500);
  await harness({ kind: 'shadow.compare' });
  const shadow = await waitFor(() => {
    const w = window.__SOFIA_WORLD?.world;
    const p = window.__SOFIA_AGENT_POS?.['sofia-monitor'];
    return { ok: w?.shadow?.active && w.shadow.candidate && w.shadow.human && w.shadow.compare?.score === 82 && p?.pose === 'stand' && Math.abs(p.tx - 729) < 60 && p.ty < 140, shadow: w?.shadow?.compare, p };
  });
  check('shadow: twin pair + comparison 82% + Sofia Monitor sent to the shadow booth', shadow?.ok, shadow);
  const shadowMove = await progress('sofia-monitor', 6000);
  check('shadow: Sofia Monitor walks a real A* route', shadowMove.ok, shadowMove);
  await sleep(7000);
  await page.screenshot({ path: OUT + '/03-shadow.png' });

  // 4. critical -> War Room convocation, agents walk to meeting seats
  await harness({ kind: 'deploy.failed' });
  const war = await waitFor(() => {
    const w = window.__SOFIA_WORLD?.world;
    const P = window.__SOFIA_AGENT_POS ?? {};
    const resp = w?.incident?.responsible ?? [];
    return { ok: w?.mode === 'incident' && resp.length === 3 && resp.every((id) => P[id]?.pose === 'sit' && P[id].tx > 600 && P[id].tx < 1000 && P[id].ty < 260), incident: w?.incident && { state: w.incident.state, responsible: resp }, targets: resp.map((id) => P[id] && [P[id].pose, P[id].tx, P[id].ty, P[id].path]) };
  });
  check('critical: War Room opened, 3 responsible agents get War Room seats', war?.ok, war);
  const banner = await page.locator('[data-testid="sofia-war-banner"]').textContent().catch(() => null);
  check('critical: War Room banner visible', /WAR ROOM/.test(banner || ''), banner);
  const warMoves = [];
  for (const id of ['railway-ops', 'supervisor', 'main']) warMoves.push({ id, ...(await progress(id, 3000)) });
  check('critical: responsible agents walk real A* routes to the War Room', warMoves.every((m) => m.ok), warMoves);
  await page.screenshot({ path: OUT + '/04-warroom.png' });

  // 5. recovery -> agents released, alert fading, banner switches to RECUPERADO
  await harness({ kind: 'recovery' });
  const rec = await waitFor(() => {
    const w = window.__SOFIA_WORLD?.world;
    return { ok: w?.mode === 'recovery' && w.incident?.state === 'recuperando' && !Object.values(w.zoneByAgentId).includes('warroom'), mode: w?.mode, alert: w?.alertLevel };
  });
  check('recovery: incident recovering, War Room released', rec?.ok, rec);
  const recBanner = await page.locator('[data-testid="sofia-war-banner"]').textContent().catch(() => null);
  check('recovery: RECUPERADO banner', /RECUPERADO/.test(recBanner || ''), recBanner);
  await sleep(6000);
  await page.screenshot({ path: OUT + '/05-recovery.png' });

  // 6. replay: jump to a War Room snapshot; the scene re-routes agents; LIVE restores
  const snapIndex = await page.evaluate(() => {
    const snaps = window.__SOFIA_WORLD.snapshots;
    for (let i = snaps.length - 1; i >= 0; i -= 1) if (snaps[i].mode === 'incident') return i;
    return -1;
  });
  check('replay: an incident snapshot exists in RAM', snapIndex >= 0, snapIndex);
  await page.locator('[data-testid="sofia-ops-toggle"]').click();
  await page.locator('[data-testid="sofia-tab-replay"]').click();
  await page.locator('[data-testid="sofia-replay-slider"]').fill(String(snapIndex));
  const replay = await waitFor(() => {
    const v = window.__SOFIA_WORLD;
    const P = window.__SOFIA_AGENT_POS ?? {};
    const resp = v?.world?.incident?.responsible ?? [];
    return { ok: v?.replay?.active && v.world.mode === 'incident' && resp.length > 0 && resp.every((id) => P[id]?.pose === 'sit'), active: v?.replay?.active, mode: v?.world?.mode, targets: resp.map((id) => P[id] && [P[id].pose, P[id].tx, P[id].ty]) };
  });
  check('replay: scene restores the War Room instant (agents re-routed)', replay?.ok, replay);
  check('replay: REPLAY banner', await page.locator('[data-testid="sofia-replay-banner"]').count() > 0);
  await sleep(5000);
  await page.screenshot({ path: OUT + '/06-replay.png' });
  await page.locator('[data-testid="sofia-replay-banner"] button').click();
  const live = await waitFor(() => {
    const v = window.__SOFIA_WORLD;
    const P = window.__SOFIA_AGENT_POS ?? {};
    return { ok: !v.replay.active && v.world.mode !== 'incident' && !Object.values(P).some((a) => a.pose === 'sit'), mode: v.world.mode };
  });
  check('replay: LIVE restores the current world', live?.ok, live);

  // 7. inspector: agent from the live tab
  await page.locator('[data-testid="sofia-tab-live"]').click();
  await page.getByRole('button', { name: /Railway Ops/ }).first().click();
  const inspector = await page.locator('[data-testid="sofia-inspector"]').textContent().catch(() => '');
  check('inspector: agent shows state/session/run', /estado espacial/.test(inspector) && /session/.test(inspector), inspector.slice(0, 160));
  await page.screenshot({ path: OUT + '/07-inspector.png' });

  // 8. multi-project: an event with project creates a tower
  await harness({ kind: 'deploy.started', project: 'clinica-norte' });
  const proj = await waitFor(() => ({ ok: (window.__SOFIA_WORLD?.world?.projects ?? []).some((p) => p.id === 'clinica-norte'), ids: (window.__SOFIA_WORLD?.world?.projects ?? []).map((p) => p.id) }));
  check('multi-project: project tower appears for project events', proj?.ok, proj);

  // 9. incident fully clears after the recovery window
  const cleared = await waitFor(() => ({ ok: window.__SOFIA_WORLD?.world?.incident === null, inc: window.__SOFIA_WORLD?.world?.incident?.state }), 50000);
  check('recovery: incident cleared after fade window', cleared?.ok, cleared);

  const final = await page.evaluate(() => ({ mounts: window.__canvasMounts, loading: window.__loadingSeen, canvases: document.querySelectorAll('canvas').length }));
  check('stability: canvas mounted once, no Loading fallback', final.mounts === 1 && final.loading === 0, final);
  check('stability: no page errors', errors.length === 0, errors.slice(0, 5));
  await page.screenshot({ path: OUT + '/08-final.png' });

  const passed = results.filter((r) => r.ok).length;
  console.log(`RESULT ${passed}/${results.length}`);
  fs.writeFileSync(OUT + '/result.json', JSON.stringify(results, null, 1));
  await browser.close();
  process.exit(passed === results.length ? 0 : 1);
})().catch((error) => {
  console.error('E2E crashed', error);
  process.exit(2);
});
