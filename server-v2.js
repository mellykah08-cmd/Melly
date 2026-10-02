const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const UPSTREAM_HOST = String(process.env.UPSTREAM_HOST || 'sofia-claw3d-live.railway.internal').trim();
const UPSTREAM_PROTOCOL = String(process.env.UPSTREAM_PROTOCOL || 'http').trim().toLowerCase();
const UPSTREAM_TLS = UPSTREAM_PROTOCOL === 'https' || UPSTREAM_PROTOCOL === 'wss';
const UPSTREAM_PORT = Number(process.env.UPSTREAM_PORT || (UPSTREAM_TLS ? 443 : 3000));
const TOKEN = String(process.env.STUDIO_ACCESS_TOKEN || '').trim();
// Optional canary channel: browsers holding the sofia_channel=next cookie are
// proxied to the staging Studio instead (same origin, so a gateway-paired
// device keeps working). Unset = everyone stays on the stable upstream.
const CANARY_HOST = String(process.env.CANARY_UPSTREAM_HOST || '').trim();
const CANARY_TLS = ['https', 'wss'].includes(String(process.env.CANARY_UPSTREAM_PROTOCOL || 'https').trim().toLowerCase());
const CANARY_PORT = Number(process.env.CANARY_UPSTREAM_PORT || (CANARY_TLS ? 443 : 3000));
const STABLE = { host: UPSTREAM_HOST, port: UPSTREAM_PORT, tls: UPSTREAM_TLS };
const CANARY = CANARY_HOST ? { host: CANARY_HOST, port: CANARY_PORT, tls: CANARY_TLS } : null;

if (!TOKEN) {
  console.error('STUDIO_ACCESS_TOKEN is required');
  process.exit(1);
}

function parseCookies(header='') {
  const out = {};
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0,i).trim();
    const v = part.slice(i+1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function safeEqual(a,b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A,B);
}

function authed(req) {
  return safeEqual(parseCookies(req.headers.cookie || '').studio_access || '', TOKEN);
}

function loginHtml(error='') {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Claw3D</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#100c09;color:#f5eadc;font-family:system-ui,-apple-system,sans-serif}.card{width:min(420px,100%);background:#1d1510;border:1px solid #4a3324;border-radius:18px;padding:24px;box-shadow:0 18px 60px #0009}h1{margin:0 0 8px;font-size:26px}p{margin:0 0 20px;opacity:.72}input{width:100%;padding:14px;border-radius:12px;border:1px solid #5b4332;background:#120e0b;color:#fff;font-size:16px}button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:12px;background:#d2a35e;color:#17100a;font-size:16px;font-weight:800}.err{color:#ff9c9c;margin-bottom:12px;font-size:14px}</style></head><body><form class="card" method="POST" action="/login"><h1>Entrar no Claw3D</h1><p>Use o mesmo token do OpenClaw Gateway.</p>${error ? `<div class="err">${error}</div>` : ''}<input name="token" type="password" placeholder="Token" autocomplete="current-password" required><button type="submit">Entrar</button></form></body></html>`;
}

function targetFor(req) {
  return CANARY && parseCookies(req.headers.cookie || '').sofia_channel === 'next' ? CANARY : STABLE;
}

function hostHeader(target = STABLE) {
  if ((target.tls && target.port === 443) || (!target.tls && target.port === 80)) return target.host;
  return `${target.host}:${target.port}`;
}

function authCookie() {
  return `studio_access=${encodeURIComponent(TOKEN)}`;
}

function upstreamHeaders(req, target = STABLE) {
  const incomingCookie = String(req.headers.cookie || '').trim();
  const cookie = authCookie();
  return {
    ...req.headers,
    host: hostHeader(target),
    cookie: incomingCookie ? `${incomingCookie}; ${cookie}` : cookie,
    'x-forwarded-host': req.headers.host || '',
    'x-forwarded-proto': 'https'
  };
}

function upstreamRequestOptions(method, path, headers, target = STABLE) {
  return {
    host: target.host,
    port: target.port,
    method,
    path,
    headers,
    ...(target.tls ? { servername: target.host, rejectUnauthorized: true } : {})
  };
}

function proxyHttp(req,res) {
  const target = targetFor(req);
  const client = target.tls ? https : http;
  const up = client.request(upstreamRequestOptions(req.method, req.url, upstreamHeaders(req, target), target), r => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  up.setTimeout(120000, () => up.destroy(new Error('upstream timeout')));
  up.on('error', e => {
    console.error('upstream http error:', e.message);
    if (!res.headersSent) res.writeHead(502, {'content-type':'text/plain; charset=utf-8'});
    res.end('Claw3D indisponível.');
  });
  req.pipe(up);
}

function probeUpstream(res) {
  const client = UPSTREAM_TLS ? https : http;
  const headers = { host: hostHeader(), cookie: authCookie(), 'user-agent': 'sofia-claw3d-login-health/2' };
  const up = client.request(upstreamRequestOptions('GET', '/healthz', headers), r => {
    r.resume();
    r.on('end', () => {
      const ok = (r.statusCode || 500) >= 200 && (r.statusCode || 500) < 300;
      res.writeHead(ok ? 200 : 502, {'content-type':'text/plain; charset=utf-8'});
      res.end(ok ? 'ok' : `upstream ${r.statusCode || 502}`);
    });
  });
  up.setTimeout(30000, () => up.destroy(new Error('upstream health timeout')));
  up.on('error', e => {
    console.error('upstream health error:', e.message);
    if (!res.headersSent) res.writeHead(502, {'content-type':'text/plain; charset=utf-8'});
    res.end('upstream unavailable');
  });
  up.end();
}

const server = http.createServer((req,res) => {
  const path = String(req.url || '/').split('?')[0];
  if (path === '/healthz') {
    res.writeHead(200, {'content-type':'text/plain'});
    return res.end('ok');
  }
  if (path === '/upstream-health' || path === '/upstream_health') {
    return probeUpstream(res);
  }
  if (path === '/login' && req.method === 'GET') {
    res.writeHead(200, {'content-type':'text/html; charset=utf-8'});
    return res.end(loginHtml());
  }
  if ((path === '/canary/on' || path === '/canary/off') && req.method === 'GET') {
    if (!authed(req)) {
      res.writeHead(302, {location:'/login'});
      return res.end();
    }
    const on = path === '/canary/on' && Boolean(CANARY);
    res.writeHead(303, {
      'set-cookie': on
        ? 'sofia_channel=next; Path=/; Secure; SameSite=Lax; Max-Age=604800'
        : 'sofia_channel=; Path=/; Secure; SameSite=Lax; Max-Age=0',
      'location': '/office'
    });
    return res.end();
  }
  if (path === '/login' && req.method === 'POST') {
    let body='';
    req.on('data', c => { if (body.length < 8192) body += c.toString('utf8'); });
    req.on('end', () => {
      const submitted = new URLSearchParams(body).get('token') || '';
      if (!safeEqual(submitted,TOKEN)) {
        res.writeHead(401, {'content-type':'text/html; charset=utf-8'});
        return res.end(loginHtml('Token inválido.'));
      }
      res.writeHead(303, {
        'set-cookie': `studio_access=${encodeURIComponent(TOKEN)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
        'location': '/office'
      });
      res.end();
    });
    return;
  }
  // Sofia Ops external event ingress (n8n, Railway, WhatsApp, other projects).
  // Machine callers have no browser cookie: pass Bearer-authenticated POSTs to
  // this single path through; the upstream route validates the Bearer token
  // (SOFIA_OPS_EVENT_TOKEN) itself and rejects everything else with 401.
  if (path === '/api/sofia-ops/events' && req.method === 'POST' && /^Bearer\s+\S+/.test(String(req.headers.authorization || ''))) {
    return proxyHttp(req,res);
  }
  if (!authed(req)) {
    res.writeHead(302, {location:'/login'});
    return res.end();
  }
  proxyHttp(req,res);
});

server.on('upgrade', (req,socket,head) => {
  if (!authed(req)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    return socket.destroy();
  }

  const target = targetFor(req);
  const onConnect = (upstream) => {
    let raw = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (const [k,v] of Object.entries(upstreamHeaders(req, target))) {
      if (Array.isArray(v)) {
        for (const x of v) raw += `${k}: ${x}\r\n`;
      } else if (v !== undefined) {
        raw += `${k}: ${v}\r\n`;
      }
    }
    raw += '\r\n';
    upstream.write(raw);
    if (head?.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  };

  const upstream = target.tls
    ? tls.connect({host:target.host, port:target.port, servername:target.host, rejectUnauthorized:true}, () => onConnect(upstream))
    : net.connect(target.port, target.host, () => onConnect(upstream));

  upstream.on('error', e => {
    console.error('upstream ws error:', e.message);
    socket.destroy();
  });
  socket.on('error', () => upstream.destroy());
});

server.listen(PORT,'0.0.0.0',() => {
  console.log(`Claw3D access v2 ready on :${PORT} -> ${UPSTREAM_PROTOCOL}://${UPSTREAM_HOST}:${UPSTREAM_PORT}` + (CANARY ? ` (canary channel -> ${CANARY.host})` : ''));
});
