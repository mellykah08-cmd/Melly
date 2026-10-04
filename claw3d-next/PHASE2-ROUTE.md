# Fase 2 — percurso físico do main

Correção opcional e restrita ao staging `sofia-claw3d-next`, sobre Claw3D upstream `0565b7892909eca7bbc8f2d9b0fad171dd75ad7c`, cadeia Sofia até v3.4 e o Director já instalado. Não altera autenticação, Gateway, workflow do bot ou produção.

O fallback anterior trocava as coordenadas diretamente pelo destino quando A* não encontrava rota. O renderer suavizava esse salto, dando aparência de arrastar o avatar. A altura dependia apenas de y, inclusive quando um desvio no segundo andar passava atrás do laboratório. A discretização das paredes também fechava o corredor de 64px entre laboratório QA e parede sul.

`ThirdFloorRoute.ts` planeja separadamente o piso térreo e o audit existente. O percurso visita a rampa x=1050, y=720→1020, segue A* no piso de altura 4.8, visita a rampa x=1390, y=1480→1710 e termina em altura 9.6 com offset (5.2,-1.4). Cada waypoint carrega a posição física obtida por `toWorld` da cena. A correção da grade superior preserva clearance de parede de 15px e obstáculos sólidos, usando o centro da célula para não apagar o corredor real. Se faltar rota, o avatar fica parado, sem salto ou passagem forçada. A descida usa as mesmas rampas em sentido inverso.

Somente avatares com percurso do terceiro andar usam movimento baseado em delta, com sobra de distância consumida entre waypoints; os demais mantêm o comportamento anterior. A caminhada usa os mesmos braços e pernas do AgentModel. O renderer acompanha a posição física sem interpolar cortes nos cantos. O mecanismo legado de colisão deixa de redirecionar esse percurso para um destino aleatório no térreo.

O Director consome exclusivamente `source=n8n`, `floorId=dev-third`. Terminal é imutável: depois de completed/failed nenhum evento do mesmo run muda seu estado. A proteção contra terminal de outro run e o listener do preview são preservados. A conclusão antecipada mantém o percurso por até cinco minutos; depois da chegada, o resultado fica por 30s. Não é confirmação de chegada real sem observação do navegador.

O ícone aparece só na chegada física ao terceiro andar. running `#38bdf8`, completed `#4ade80`, failed `#fb7185`. `toneMapped=false` evita a alteração dos tons pelo tone mapping da cena. O estado genérico do Gateway continua separado.

## Instalação

Baixar **a mesma revisão imutável** destes componentes, verificar cada SHA256 e colocar no mesmo diretório antes de executar:

- `ThirdFloorRoute.ts`
- `ThirdFloorDirector.ts`
- `ThirdFloorStatusIcon.tsx`
- `patch-phase2-route.cjs`
- `telemetry-bridge.cjs` (usado pelo instalador existente do bridge)

Executar depois do patch antigo do Director: `SOFIA_THIRD_FLOOR_TELEMETRY=1 node patch-phase2-route.cjs`. O instalador confere todos os anchors antes de gravar e rejeita instalação parcial. A segunda execução é idempotente. Instalar o bridge pelo patch existente e reconstruir o Next com um marcador de build novo. Manter integralmente os overlays de autenticação já presentes.

## Validação reproduzível

Copiar `sofia.phase2Route.test.ts` para `tests/unit/` do checkout reconstruído e executar:

```sh
npx vitest run tests/unit/sofia.phase2Route.test.ts tests/unit/navigation.astarFallback.test.ts tests/unit/navigation.diagonalCorner.test.ts tests/unit/navigation.navBlockers.test.ts
node /caminho/telemetry-bridge.phase2.test.cjs
NEXT_TELEMETRY_DISABLED=1 npx next build --webpack
```

O canvas expõe `data-sofia-main` com coordenadas, posição física, estado, tamanho da rota, bloqueio, fase, runId e frame, apenas para diagnóstico da homologação; não contém conversa ou paciente. Usar junto a capturas visuais, sem tratar dados de posição ou HTTP202 isoladamente como aprovação visual. Android ainda exige conferência final do usuário.

## Atualização R2 — parada após sincronização

Uma atualização de pose/status podia executar o planejador legado e substituir a rota física por waypoints sem `sofiaWorld`, mesmo quando o destino não mudava. O avanço físico rejeitava esse caminho incompatível e ficava parado. `synchronizeThirdFloorRoute` agora preserva o percurso físico para o mesmo destino, reconstrói rotas que perderam metadados e planeja a descida quando há mudança real de destino. O overlay R2 também atualiza uma instalação R1 existente e permanece idempotente. Três regressões executam o sincronizador e o movimento reais, incluindo atualização na saída da primeira rampa. A confirmação do usuário validou caminhada, primeira subida e velocidade no Android; chegada final e cores continuam pendentes.

## Diagnóstico R3 — sem nova alteração de movimento

O feedback Android depois de R2 ainda mostrou main parado. A causa desse caso não está confirmada. O teste visual agora mostra revisão da cena, posição/altura, destino, quantidade de waypoints, bloqueio e fase. O cliente envia até oito amostras de metadata de navegação de main, espaçadas por dez segundos, para a rota de diagnóstico já existente no mesmo staging autenticado. Não envia token, runId, conversa, paciente ou dados de outros NPCs. A leitura distingue cliente antigo, falta de ordem, rota bloqueada e falha de avanço. Não foi alterada a rota/movimento nesta revisão.

Para executar a regressão do diagnóstico, copiar access-check-client.js para tests/fixtures/sofia-access-check-client.js e sofia.routeDiagnostics.test.ts para tests/unit/ no checkout reconstruído; executar npx vitest run tests/unit/sofia.routeDiagnostics.test.ts.
