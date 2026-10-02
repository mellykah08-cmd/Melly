# Sofia Claw3D v2.5 — checkpoint final — 2026-10-02

## Escopo
Somente `openclaw-sofia-ops`. Não tocar em `zooming-sparkle`.

## Estado ativo
- `openclaw-gateway` — `6d2af749-42a1-4dc4-ac1a-54ed68dd04fc` — SUCCESS.
- `sofia-claw3d-building` — `64004096-6306-4176-9194-fafe2aa8c77d` — v2.5 ativo — SUCCESS.
- `sofia-claw3d-login` — `52cd56cd-8e62-4cc5-8e0c-5e608ac1d0b6` — SUCCESS, upstream `sofia-claw3d-building.railway.internal:3000`.
- `sofia-claw3d-live` — `a5859f6d-837f-49c6-83c1-e5794ed6a4d2` — rollback antigo preservado.
- `sofia-claw3d-next` — `a1bd20be-7079-4590-863e-29e44d1750ce` — staging/rollback v2.5 com `sleepApplication=true`.

## Implementado
- Primeiro andar Sofia original preservado como default real, independente de localStorage.
- Segundo andar Auditoria Lab preservado.
- Estrutura expandida para 6 andares funcionais: Operação, Auditoria, Desenvolvimento/QA, Infraestrutura, Inteligência/Analytics e Command Center.
- Event Fabric em memória para eventos internos e externos.
- Endpoint de ingresso externo autenticado preparado para n8n/Railway/WhatsApp/outros projetos, sem expor token.
- HUD Digital Twin / War Room / Shadow-ready.
- Replay curto em RAM e timeline de sessão, sem armazenamento histórico massivo.
- Shadow Twin visual com presenças/hologramas leves.
- War Room e estados reativos do ambiente.
- Diretor de estado/eventos com recomendação de andar conforme evento.
- Estruturas procedurais para projetos externos, simulações e marcadores de memória de sessão.
- Feature flags/módulos preparados para GPU, histórico profundo e simulações pesadas, mantidos desligados por custo.
- Estabilização mobile/WebGL: Canvas persistente, menor risco de remount/context loss, DPR/controladores ajustados e zoom ampliado.
- `/healthz` interno antes do access gate; `/office`, APIs sensíveis e WebSocket continuam protegidos.

## Código versionado
Patch chain usado pelo serviço ativo, fixado no commit `487f6dfe32646e790b4825ef1d26992721382473`:
- `claw3d/patch-building-v1.js`
- `claw3d/patch-ops-v2.js`
- `claw3d/patch-ops-v2.1.js`
- `claw3d/patch-ops-v2.2.js`
- `claw3d/patch-ops-v2.3.js`
- `claw3d/patch-ops-v2.4.js`
- `claw3d/patch-ops-v2.5.js`

## Validação final conhecida
- Build v2.5 no `sofia-claw3d-building`: SUCCESS.
- Login/proxy após promoção: SUCCESS e apontado ao building.
- Gateway: SUCCESS.
- Staging next: SUCCESS + sleepApplication=true.
- Nenhum segredo foi salvo neste arquivo.

## Rollback
1. Preferencial: apontar `sofia-claw3d-login` para `sofia-claw3d-next.railway.internal:3000` para rollback v2.5/staging.
2. Rollback antigo: `sofia-claw3d-live.railway.internal:3000`.

## Futuro
Quando houver capacidade, ativar por feature flag: histórico persistente/replay longo, GPU e geração 3D, simulações massivas e integrações de projetos reais. A arquitetura atual foi preparada para receber isso sem reconstrução central.
