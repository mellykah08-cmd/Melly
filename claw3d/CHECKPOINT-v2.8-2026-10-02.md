# Sofia Claw3D — Spatial OS v2.8/v2.9 checkpoint 2026-10-02

Escopo: somente `openclaw-sofia-ops`. `zooming-sparkle` não tocar.

## Estável
- v2.8.2 commit `0e53008`
- building deploy `8cbb9810`
- rollback: `sofia-claw3d-live` deploy `26151804`

## v2.9 em validação
Foco: corrigir regressão de performance mobile e tornar o Spatial OS perceptível sem adicionar arquitetura nova.

Mudanças:
- remove PointLight global caro do Spatial Layer;
- remove labels 3D ociosos;
- oculta project towers sem atividade;
- assinatura geométrica leve e distinta nos andares 2–6;
- botão rápido `▶ DEMO ESPACIAL`, usando o harness/Event Fabric real;
- primeiro andar preservado.

Gate: staging `sofia-claw3d-next` -> build/health/logs -> só então promoção.
