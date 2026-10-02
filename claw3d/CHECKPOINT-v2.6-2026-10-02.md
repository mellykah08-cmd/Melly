# Sofia Claw3D v2.6 — checkpoint — 2026-10-02

Escopo: somente o projeto Railway `openclaw-sofia-ops`. `zooming-sparkle` não foi tocado.

## Diagnóstico (o que estava quebrado)
- `sofia-claw3d-next` (upstream ativo do login) estava SUCCESS no Railway mas com 0 réplicas rodando:
  a cadeia v1+v2+v2.1 não compilava (erro de TypeScript no `subscribe` do `patch-ops-v2.js`) e o
  serviço compilava no start com `set -e` → processo saía → 502 no `/office`.
- `patch-ops-v2.2.js`: crases não escapadas dentro do template literal do HUD (SyntaxError).
- Celular: o texto 3D (drei/troika) baixava fonte do jsDelivr e **suspendia**; o r3f propaga a
  suspensão para fora do Canvas e a página inteira virava "Loading..." (cenário/NPCs sumiam e voltavam).
  O HDR do ambiente vinha do githack e uma falha derrubava a página inteira.
- Gateway público (`wss://openclaw-gateway-production-32cd...`) recusa conexões vindas da borda do
  Railway (403 "Proxy client attribution is required", `gateway.trustedProxies` não configurado).
  O servidor do Claw3D deve usar a rede privada `ws://openclaw-gateway.railway.internal:8080`
  (o navegador nunca fala direto com o gateway; ele usa `/api/gateway/ws` do próprio Claw3D).

## Estado entregue
- Código: branch `sofia-claw3d-max-v2`, commit `a413241` (cadeia v1 → health → v2 → v2.1 → v2.2 → v2.3 → v2.4 → v2.5 → v2.6).
- Imagem: `claw3d/Dockerfile` (upstream Claw3D fixado em `claw3d/UPSTREAM_COMMIT`; patches + `next build` no build da imagem).
- `sofia-claw3d-building`: fonte = Melly@a413241 (commit fixado), `claw3d/Dockerfile`, healthcheck `/healthz`, sleep desligado.
- `sofia-claw3d-login`: `server-v2.js` (main `eca3ec2`), healthcheck `/upstream_health`, upstream = building via HTTPS público.
- Ingress externo: `POST /api/sofia-ops/events` com `Authorization: Bearer <SOFIA_OPS_EVENT_TOKEN>` passa pelo login sem cookie.

## Rollback
1. Imediato (1º andar antigo): no `sofia-claw3d-login` definir
   `UPSTREAM_HOST=sofia-claw3d-live-production.up.railway.app`, `UPSTREAM_PROTOCOL=https`, `UPSTREAM_PORT=443`
   e healthcheck `/healthz` (o `live` não tem `/healthz`; responde 307).
2. Código: fixar o `building` em outro commit via "connect source" com `commitSha`.

## Desligado por custo (preparado)
GPU, histórico profundo persistente, simulação de longo prazo.
