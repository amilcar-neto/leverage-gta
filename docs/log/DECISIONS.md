# Decisões

Decisões que não estavam nos documentos, tomadas durante a construção. Formato:
`## <data> — <assunto>` · **Contexto** · **Escolha** · **Alternativa descartada** · **Tarefa**

## 2026-10-16 — Decisões tomadas antes do código (na conversa de design)
- **id do sistema:** `leverage-gta`, título "Leverage: Liberty City". Trocar antes da primeira versão pública se o dono quiser.
- **Fonte de destaque:** Anton (OFL) no lugar da Pricedown até a licença da Pricedown ser confirmada.
- **Vida e Colete** em pontos pequenos (10 + Vitality; coletes 4/6/10), visual de GTA (coração e escudo com número).
- **Grana** em escada de degraus exibida como dados verde-dinheiro; preços em dados.
- **HUD** só com estrelas, Grana e Plot Points, no canto superior direito, preso à barra lateral.
- **Testes** no Foundry do VPS do dono via deploy por SSH; o Claude roda no PC do dono.

- **signatureAsset em DEFAULT_PRICES:** preco base d8; o d4 extra depende do item e nao entra na tabela (T-101, correcao da revisao).
- **Fontes:** entram por @font-face em T-201, nao pelo manifesto.
- **CONFIG.LEVERAGE:** objeto raiz e padroes aninhados ficam congelados de proposito; extensoes (ex. outros modulos) devem usar hooks/settings, nao mutar a configuracao.
- **system.json:** compatibility.verified = "14" (build exato nao confirmado); secondaryTokenAttribute "vest" adicionado.

## 2026-10-16 — Fontes e CSS (T-201)
- Special Elite vem sob Apache 2.0 no google/fonts (não OFL). Licença salva em `fonts/`. Só o subset Latin (cobre en e pt-BR).
- As cores `--lv-d*` em `tokens.css` repetem as de `config.mjs` (CSS não importa JS). Valores idênticos hoje; se mudar um, mudar o outro.
- Todo CSS do sistema entra com `@import ... layer(system)` no índice `styles/leverage-gta.css`. Ainda falta conferir no Foundry real que a layer carrega (T-202 mostra pela galeria).

## 2026-10-16 — Estrutura da ficha da Equipe (T-301)
- **Layer `system` vence o núcleo (verificado no Foundry v14 real):** ordem das layers lida de `document.styleSheets`:
  `reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions`. Dentro da
  ficha, `.lv-panel-head` mostrou nosso fundo `rgb(216,194,74)` e a fonte Anton, e `button.lv-xbtn` mostrou 18px, sem
  borda e fundo transparente (`tests/foundry/sheet-structure.mjs`). Ponto de atenção: botões do núcleo trazem
  `min-height`; por isso `crew.css` zera `min-height` dos botões da ficha (sem isso o `.lv-xbtn` saía com 28px de altura).
  Também zeramos a margem do `h2.lv-panel-head`.
- **`PARTS[].container` não existe no núcleo v14** (é extensão do dnd5e; conferido em `handlebars-application.mjs` do
  servidor). As três colunas são criadas por `CrewSheet#groupColumns`, em `_onRender`, que move as partes para
  `.lv-col--left/middle/right` (idempotente). Alternativa descartada: grade CSS plana com as partes soltas (as
  colunas teriam alturas de linha acopladas).
- **Selo da trava** é inserido por `_renderFrame` depois do `.window-title` e atualizado pelo hook
  `leverage.traitsLockedChanged` (que também re-renderiza a ficha). Botões SHEET/TOKEN do mockup continuam nos controles
  nativos da janela (menu "⋮" e ícone); só estilizamos a barra.
- **Partials:** nenhuma parte compartilhada por enquanto; o ApplicationV2 carrega os templates das PARTS sozinho.

## 2026-10-16 - Assets, pasta e callback (T-305)
- **Callback:** ao marcar a caixa, a ficha so avisa no chat (o Job citado vale 1 PP gasto na rolagem). Nao ha PP temporario automatico; desmarcar nao gera mensagem. Alternativa descartada: PP temporario so para a proxima rolagem (exigiria estado na Pool, T-501).
- **Orelha da pasta:** guardada em localStorage por usuario e ator (com try/catch). Alternativa descartada: flag de usuario (gravaria no servidor a cada clique).
- **Duplo clique** num Asset abre o item (listener delegado no hook renderCrewSheet; data-action so trata clique simples).
- **Asset sem PP suficiente:** o aviso aparece e nada e criado nem cobrado. Signature nao custa PP.
- **Trava:** Assets e Jobs nao sao Traits; a trava nao os afeta.

## T-306 - arrastar e soltar
- **Job entre fichas de Equipe:** mover (cria no destino e apaga na origem) so quando o usuario e dono dos dois atores e do item; senao copia. Itens de outros tipos sempre copiam (nao sao tirados da origem). A copia so apaga o original se foi realmente criada (a trava e o limite de 3 Distinctions podem recusar). Alternativa descartada: sempre copiar (deixaria Jobs duplicados na tabela de pagamento).
- **Foundry v14:** o ActorSheetV2 liga o arrastar pelo seletor fixo `.draggable` (sem `options.dragDrop`), entao as linhas ganham a classe `draggable` nos templates.
- **Reordenar:** so entre itens do mesmo tipo e da mesma lista (irmaos do mesmo elemento pai), com `performIntegerSort`; o item entra antes da linha sob o ponteiro (linha amarela no topo). Com a trava ativa o aviso de trava aparece (o guard do item recusa o update).
- **Destaque do drop:** `dragover` nao le o conteudo do arraste, entao o tipo do item vai num tipo MIME proprio (`application/x-leverage-item-<tipo>`). Arraste interno destaca a linha; arraste de fora destaca a ficha toda (moldura tracejada).
- **Macro de Traco:** `game.leverage?.rollPool ? game.leverage.rollPool({ actor: fromUuidSync(uuid), refs: [ref] }) : ui.notifications.warn(...)`. Distinction arrasta como d8 (ajuda); se o arraste comecou no botao d4, vira d4 (nome da macro ganha " d4"). Itens sem dado (Talent sem dado, Job) nao viram macro. Macro igual (mesmo comando, mesmo autor) e reaproveitada.
- **Titulo da janela:** so o nome em maiusculas, icone `fa-hexagon`.

## 2026-10-17 — Ações do card (T-503)
- Complication nova nasce d6 (`LEVERAGE.complicationDie`); subir segue d6→d8→d10→d12 e d12 fica d12.
- `complicationsResolved` guarda os índices (entry) dos 1s resolvidos, como em docs/05.
- Caminho "+1 PP · KEEP 3RD DIE": quem pode editar a mensagem aplica local; os demais pedem ao mestre pelo socket, que confere se o solicitante é dono do ator. PP é devolvido se a escrita falhar.
- Complication roda só no cliente do mestre: grava `activeJob`, dá 1 PP ao ator, marca o 1 como resolvido.
- Risco aceito: o id do solicitante vai dentro do pacote do socket; o mestre revalida a posse do ator.

## T-504 — Rolador de oposição (decisões)

- **Card de disputa (opcional): não feito.** Ligar a rolagem do jogador à do mestre exige saber qual rolagem responde a qual
  (hoje as duas são cards independentes) e o desfecho útil (margem, +5, dano) já é da T-602 (APPLY DAMAGE) e do Ganging Up.
  Alternativa descartada: card extra no chat; aumenta ruído sem a regra de quem vence estar modelada. Revisitar na T-602.
- **Sem escolha = 2d6.** Rolar sem nenhum dado (rolador ou `rollOpposition({})`) usa 2d6 ("nenhuma oposição", docs/02). Por isso o
  botão ROLL nunca fica desabilitado.
- **Local da cena:** Traços do Local vêm do token `location` selecionado; sem seleção, dos atores `location` com token na cena
  atual. Não existe flag de "local da cena" nos docs.
- **Card de oposição:** mesmo template do card de Pool; flags `opposition: true` e `source` (ex.: `manual+police+gang+picked`),
  `actorUuid` vazio. Sem botões de PP e sem aviso de 1s (os 1s do mestre só não contam).
- **Núcleo de rolagem compartilhado:** `module/dice/roll-core.mjs` (fórmula, valores, `buildRollData`, `evaluateDice`); o
  `roll-handler.mjs` reexporta para manter os testes.

## 2026-10-17 - Correcoes R-F3, parte B (JS da ficha da Equipe)
- **Nomes das actions:** mantidos os nomes atuais (`setDie`, `togglePool`, `addTraitItem`, `deleteTraitItem`...), mesmo fora da lista do docs/04. Para nao haver colisao silenciosa, `partActions` (parts/_module.mjs) passa por `mergeActions`, que lanca erro se duas partes usarem o mesmo nome. Alternativa descartada: renomear tudo (muito ruido nos templates e testes sem ganho).
- **Selo da trava:** uma regra so (`components/lock-seal.mjs`). O selo sempre reflete a configuracao `traitsLocked`. Para o mestre, a dica diz que ele edita tudo mesmo travado (`Seal.lockedGmHint`). Antes a ficha do item mostrava "destravado" para o mestre.
- **Nomes de permissao:** `canEdit` = `sheet.isEditable` (cabecalho, Assets, Jobs, pasta). `canEditTraits` = editavel e a trava deixa (listas de Tracos e escadas de dados). Acabaram `canEditHeader` e `assetsEditable`.
- **Apagar:** so Job e Signature Asset pedem confirmacao (docs/03). O dialogo e um so (`Dialog.Delete.*`), em `components/confirm-delete.mjs`. Distinction, Talent, Specialty e Asset comum saem na hora (a trava e a permissao sao checadas antes).
- **BACKGROUND:** continua com EDIT/SAVE. O texto digitado fica num rascunho (copiado do editor antes de cada render), entao renderizar a ficha inteira nao perde nada. Alternativa descartada: `<prose-mirror toggled>` com `name` (o submit automatico do formulario salvaria e re-renderizaria a cada alteracao).
- **Listeners:** todos os listeners e hooks duradouros nascem em `CrewSheet#_onFirstRender` (via `attachParts`, com um `AbortController`) e morrem em `_onClose`. Os hooks globais `renderCrewSheet`/`closeCrewSheet` e o `leverage.houseRulesChanged` global sairam; `afterRender` das partes roda no `_onRender` da ficha.
- **Teclado:** nome de Asset e nome de Talent viram `role="button" tabindex="0"` (Enter/Espaco clicam, `activateOnKey`). Abrir o Asset continua so por duplo clique (sem atalho de teclado ainda).
- **Segundo navegador nos testes:** `openBrowser(env, { secondary: true })` nao pega a trava de `.cache/foundry.lock` (o primeiro navegador da mesma execucao ja a tem; esperar causaria deadlock). `phase1.mjs` usa isso para o jogador.

## 2026-10-17 — Altura das linhas de Attributes/Roles
- O mockup deixa folga no pé da coluna esquerda (~77px) e as linhas têm ~40px. Mantive `max-height: 46px` nas linhas e o teste T-303 aceita até 48px de folga (antes 16). docs/06 "sem espaço morto" vale para as listas que rolam, não para as escadas.

## 2026-10-17 - Correcoes R-F4/R-F5, parte A (JS e regras)
- **Autenticidade no socket:** o servidor do Foundry v14 chama `socket.emit(canal, dados, idDoEmissor)` para os listeners dos pacotes de sistema (lido em `dist/server/sockets.mjs`, `handleCustomSocket`: `this.broadcast.emit(e, t, this.user.id)`). O listener agora usa so esse segundo argumento; o pacote nao leva mais `userId`. Alternativa descartada: gravar o pedido em flag do ator/mensagem e o mestre aplicar em `updateActor`/`updateChatMessage` (mais codigo e corrida entre dois mestres, sem ganho, ja que o id do emissor e confiavel). Os handlers continuam conferindo posse (`OWNER`) do emissor sobre o ator, e a trava de Grana/estrelas valida saldo de novo no mestre.
- **"+1 PP" so para o dono, nao para o mestre:** docs/08 diz "so o dono". `isCharacterOwner` exclui o mestre (ele e dono de tudo). O mestre dá Plot Points por `plotPoints.add/give`. O pedido por socket tambem recusa o mestre como solicitante.
- **KEEP so na rolagem mais recente do ator:** manter dado em um card antigo mudaria um resultado ja usado. So o card mais novo do ator (sem contar oposicao) mostra o botao; criar nova rolagem e mudar PP redesenham o card (hooks `createChatMessage` e `updateActor`). Sem PP, o botao aparece desabilitado com dica ("sem Plot Points") em vez de sumir, e um clique mesmo assim avisa.
- **Trava por mensagem tambem no mestre:** `onKeepDieRequest` usa o mesmo `exclusive` do clique; o PP e a mensagem sao conferidos de novo depois de cada `await` (e o PP e devolvido se algo mudou).
- **Rolagem cega ou sussurrada:** `paint` nao desenha o card se `!message.isContentVisible`.
- **Efeitos depois do card:** PP de Distinction e degrau de Grana so se aplicam depois que `toMessage` criou a mensagem (antes, uma falha deixava o custo sem card).
- **`scene:<id>` em `rollPool`:** usa os Traços de cena do Job ativo, como a bandeja.
- **Campos so do Mestre nos Items:** `LEVERAGE.protectedItemFields` (Asset: `die`, `duration`; Job: `payout.share`, `spent`). A ficha esconde via `canEditProtected`, recusa as acoes `setDie`/`setDuration` e descarta os campos protegidos do formulario de jogador. Nao ha guarda em `preUpdateItem` (so a ficha), registrado em ISSUES como risco baixo.
- **`plotPoints.add` e `money.set` livres para o dono:** o dono ja edita os proprios valores na ficha; a API nao cria barreira que a ficha nao tem. Nao ha limite diferente do `checkAmount` (inteiro >= 0).
- **Constantes unicas:** 2d6 de "sem oposicao" so em `LEVERAGE.defaultOppositionDice`; `LEVERAGE.gangMax` (12) e `LEVERAGE.looseDiceMax`; `hasRealPortrait(img)` em `config.mjs`; tamanhos de dado fora das fichas em `LEVERAGE.dieGeometry.uses` (card 50, linha de Grana 28, antes 24 que nao existe no `die.mjs`).
- **i18n:** `Roll.ppSpentOne/ppSpentMany` (plural por duas chaves), botao de manter dado com ordinal (`Roll.Ordinal.*`, pelas regras do idioma), `Opposition.poolCount` com `{keep}`, `Api.Pool.kind.*` para o aviso de "tooMany", opcao de subir Complication escondida quando ela ja e d12.

## 2026-10-17 — HUD (T-701)
- **Personagem em foco:** jogador = `game.user.character`, senão o token controlado (Crew); mestre = token controlado primeiro, senão o `game.user.character`. Mestre sem nenhum: só as estrelas (Grana e Plot Points ficam ocultos, como em `docs/07`). Jogador sem nenhum: Grana e Plot Points aparecem apagados com a dica "No character assigned".
- **Cliques:** Grana, clique esquerdo = Pagar (`payDialog`), direito = Emprestar (`lendDialog`) — pedido da tarefa, no lugar do +1/−1 degrau de `docs/07`. Shift+clique no `$` minimiza. Plot Points: botões − e +, e o número (esquerdo +1, direito −1).
- **Posição:** o HUD é um `ApplicationV2` sem moldura filho de `#interface`, `position: fixed; right: calc(var(--lv-sidebar-w) + 16px)`. `--lv-sidebar-w` = largura da janela − `left` do `#sidebar` (a faixa de abas tem 48 px recolhida e 348 px aberta). Verificado na v14 real: `#sidebar` é recriado a cada render, então o `ResizeObserver` é religado nos hooks `collapseSidebar` e `renderSidebar` (o hook dispara também ao expandir).
- **Estrelas:** o clique do mestre usa `stars-actions.setLevel` (muda `wanted` e posta a linha curta no chat).
- **Avisos do núcleo** (ex.: aceleração de hardware) aparecem em `top: 108px` com z-index 99999 e cobrem a parte baixa do HUD enquanto durarem. É comportamento do núcleo; não mexemos.

## 2026-10-17 — T-704 coberta pela T-702/T-703
- As ações Encerrar cena, Novo Job, Encerrar Job, Nova sessão e Dar PP foram implementadas em `module/applications/gm/job-actions.mjs` e ligadas ao controle de cena na T-702; testadas em `tests/foundry/T-702.mjs` e `T-703.mjs`. T-704 marcada [x] sem tarefa separada.
