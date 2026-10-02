# Sofia Claw3D — Spatial OS v2.8 (checkpoint 2026-10-02)

Escopo: somente o projeto Railway `openclaw-sofia-ops`. `zooming-sparkle` não foi tocado.
Segredos: só em variáveis do Railway (referências `${{serviço.VAR}}`); nenhum valor lido, impresso ou comitado.
GPU, histórico profundo, simulação longa e XR: preparados e **desligados**.

## O que mudou (v2.7 → v2.8.x)

| Camada | Arquivo (árvore Claw3D) | Papel |
|---|---|---|
| Event Fabric (runtime) | `src/lib/sofia-ops/eventBus.ts` | Frames do gateway OpenClaw viram fatos estruturais (agente, run, fase, ferramenta, aprovação). **Nenhum conteúdo de conversa é guardado.** |
| Event Fabric (externa) | `serverEventStore.ts`, `api/sofia-ops/events` | Ingress Bearer (n8n/Railway/WhatsApp/outros projetos), RAM com `seq`; o cliente busca só o que é novo (`?after=`). |
| Harness | `api/sofia-ops/harness` | Eventos simulados entram pela **mesma** fabric (`pushSofiaOpsServerEvent`), marcados `SIM`. Cookie do Studio + header `x-sofia-harness`. Desliga com `SOFIA_OPS_HARNESS=0`. |
| World Director | `src/lib/sofia-ops/worldState.ts` | Reducer determinístico `(eventos, agentes, agora) → WorldState`: modo global, foco, andar, estados por agente (idle/working/thinking/auditing/meeting/incident/shadow), zonas, incidente/War Room com recuperação gradual, Shadow Twin, projetos, atividade por andar, substituição de agente indisponível. |
| World Store | `src/lib/sofia-ops/worldStore.ts` | Fonte única para cena e HUD; snapshots do World State em RAM (replay espacial); auto-follow; inspector; estado do gateway. |
| Espaço físico | `src/features/sofia-ops/spatialTargets.ts` | Onde cada zona existe em cada andar, a partir da mobília real; tudo validado com o A* da própria cena. Sala selada → fallback semântico (quadro de revisão, arco diante do kanban). |
| Cena | `SofiaSpatialLayer.tsx` + `RetroOffice3D.tsx` | Agentes caminham por rotas A* reais até as estações; estações reagem (anel/pilar/rótulo); farol da War Room; hologramas violeta (Sofia candidata) e ciano (humano) com feixe/painel de comparação; auras de estado; torres de projeto; luz de alerta com transição suave (contagem de luzes constante); auto-follow suave. |
| Navegação | `core/navigation.ts` | Portas voltam a ser passáveis na grade A* (o acolchoamento das paredes selava portas estreitas). |
| HUD | `SofiaOpsHud.tsx` | Banners War Room/recuperação/replay/RECONNECTING; inspectors (agente, estação, incidente, projeto); timeline de replay; andares; projetos; simular; sistema. |

## Mapeamento evento → espaço (1º andar da Sofia)

| Evento | Quem | Para onde |
|---|---|---|
| `railway.*`, deploy | Railway Ops | Sala de servidores (canto superior esquerdo, pela porta) |
| `n8n.*`, audit, review | n8n Reviewer | Quadro de revisão (o laboratório QA deste andar é selado no layout) |
| test/qa/github | Supervisor | Mesa do lounge sul |
| `shadow.*` | Sofia Monitor | Cabine (estação Shadow) + par de hologramas |
| `critical` / `incident.*` | dono da origem + Supervisor + Sofia Core | War Room (arco diante do kanban) |
| `*.resolved` / recovery | — | War Room libera os agentes, alerta reduz gradualmente |
| runs reais do OpenClaw | o próprio agente | mesa (pensando/trabalhando) |

Nos andares 2–6 as zonas usam a mobília de cada andar (Infra → racks/terminal do 4º, War Room → mesa redonda do 6º, etc.).

## Como acompanhar pelo celular

- Estável (produção): `https://sofia-claw3d-login-production.up.railway.app`
- Canário (staging, mesma origem, mesmo dispositivo pareado): abrir `/canary/on` após o login; voltar com `/canary/off`.
- Painel **SOFIA** → **SIMULAR** → "Cenário completo" (deploy → auditoria → shadow → crítico → recuperação, ~70 s).

## Testes

- `tests/unit/sofiaWorldState.test.ts` (11) e `tests/unit/sofiaSpatialTargets.test.ts` (7, A* no layout real do 1º andar e nos andares 2–6).
- `claw3d/tests/e2e-spatial.js` (24 verificações) e `claw3d/tests/e2e-stage2.js` (20) — Playwright, perfil Pixel 7.
- `claw3d/init.sh` prepara, sobe (gateway de teste com os IDs reais) e testa localmente.

## Rollback

1. Canário: `/canary/off` (só o navegador do usuário).
2. Produção: `sofia-claw3d-building` → redeploy do deployment anterior no Railway, ou fixar o commit anterior.
3. Emergência: no login, `UPSTREAM_HOST` → `sofia-claw3d-live` (layout v1 original).

## Estado final (encerramento, escopo congelado)

- Produção: `sofia-claw3d-building` deploy `8cbb9810` — commit `0e53008` (v2.8.2).
- Staging: `sofia-claw3d-next` deploy `ac3216de` — mesmo commit; canário `/canary/on`.
- Login: `sofia-claw3d-login` deploy `2aef5470` — Melly `main` `8a8dbf4` (canal canário).

### Backlog não crítico (não iniciado)
- Ingress externo: campos com nomes não óbvios ainda podem carregar texto; recomendar que o n8n envie só metadados.
- Agentes da War Room sentam no arco do 1º andar sem cadeira (cosmético; manter "em pé" causava colisões).
- Laboratório QA e sala de servidores do 1º andar são selados pelo próprio layout (fallbacks semânticos em uso).
- Harness ligado por padrão (protegido por cookie+header, rate limit, sempre marcado SIM); desligar com `SOFIA_OPS_HARNESS=0` se quiser.
- Ordem de colisão com vários agentes no mesmo destino; rótulos 3D podem se sobrepor em zoom muito afastado.
- E2E remoto autenticado não automatizado (exigiria nova credencial); validação no navegador real é via canário.
- 9 testes unitários do upstream já falhavam antes (5 do upstream puro, 4 da cadeia v1/v2).
