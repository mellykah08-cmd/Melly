# Sofia Claw3D MAX v2 — checkpoint 2026-10-02

## Escopo
Somente projeto Railway `openclaw-sofia-ops`. `zooming-sparkle` permanece fora de escopo.

## Estado ativo
- `openclaw-gateway`: SUCCESS
- `sofia-claw3d-next`: SUCCESS
- `sofia-claw3d-login`: SUCCESS
- proxy público apontado para `sofia-claw3d-next.railway.internal:3000`
- `sofia-claw3d-building`: preservado como rollback
- `sofia-claw3d-live`: preservado como rollback anterior

## Implementado nesta evolução
- branch isolada `sofia-claw3d-max-v2`
- evolução modular da v1 sem apagar rollback
- 1º andar antigo incorporado como layout padrão real, não apenas dependente do localStorage
- 2º andar Auditoria Lab preservado
- expansão para múltiplos andares funcionais da arquitetura Sofia Ops
- estabilização gráfica: Canvas persistente, menor churn de WebGL, tratamento de perda/restauração de contexto e perfil mobile mais conservador
- zoom mobile ampliado mantendo limite de câmera
- Sofia Ops Event Fabric em memória
- ingresso de eventos externos autenticado para futuras integrações n8n/Railway/WhatsApp/outros projetos
- HUD operacional do Digital Twin
- War Room orientada por eventos
- Shadow Twin preparado e visualmente reativo
- replay/timeline curta em RAM, sem retenção pesada
- diretor de estado para sugerir/representar modos e áreas conforme eventos
- reatividade visual do ambiente a incidentes/estados
- hologramas leves para Shadow Mode
- representação procedural de projetos/eventos e portais de simulação
- marcadores de memória de sessão
- feature flags / arquitetura preparada para GPU, geração 3D pesada e histórico profundo futuros, sem ativar custos agora

## Custos deliberadamente não ativados
- GPU dedicada: desligada
- armazenamento massivo de histórico: desligado
- replay histórico de dias/meses: não persistente por enquanto
- geração 3D/vídeo pesada: preparada conceitualmente/por flags, não executada

## Segurança
- segredos permanecem em variáveis Railway
- nenhum token foi gravado no repositório/checkpoint
- evento externo usa token dedicado interno
- serviço público continua atrás de `sofia-claw3d-login`

## Validação realizada
- builds do candidato passaram em `SUCCESS`
- healthcheck Railway passou
- proxy final iniciou apontando para `sofia-claw3d-next`
- Gateway permaneceu `SUCCESS`
- rollbacks permaneceram `SUCCESS`
- promoção foi feita somente após builds isoladas bem-sucedidas

## Limitação de validação
A validação automatizada de infraestrutura/build/healthcheck foi concluída. O ambiente de ferramentas desta sessão não conseguiu resolver externamente o domínio Railway para renderização/screenshot, então a inspeção visual final em um navegador móvel físico não foi automatizada aqui.

## Rollback
Trocar `sofia-claw3d-login` `UPSTREAM_HOST` para:
1. `sofia-claw3d-building.railway.internal` para rollback imediato anterior;
2. `sofia-claw3d-live.railway.internal` para rollback estável mais antigo.

## Continuidade
Qualquer nova evolução deve partir da branch `sofia-claw3d-max-v2`, preservar os dois serviços de rollback e manter módulos de GPU/histórico profundo desligados até existir infraestrutura/custo aprovado.
