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

## T-506 - Dice So Nice
- `registerDiceSoNice()` roda no `init` (nao no `ready`): o hook `diceSoNiceReady` pode disparar antes do `ready` do sistema. O hook so existe com o modulo ativo, entao sem ele nada roda.
- Um colorset por tamanho de dado (`leverage-d4`..`d12`, cor de `dieStyles`) e `leverage-cash` (cor de `money.color`). Texto branco e contorno preto fixos em `module/dice/dsn.mjs`.
- `evaluateDice(sizes, kinds)` poe `options.appearance` em cada termo; so a rolagem da Pool passa `kinds` (Grana fica verde). Dano e oposicao usam a cor do tamanho.

## HUD sem contorno preto (pedido do dono)
- Desvio dos mockups `hud-*.png`: estrelas, Grana, Plot Points e textos do HUD não têm mais contorno preto duro. Usam o token `--lv-hud-soft-shadow` (`text-shadow`) e `--lv-hud-soft-glow` (`drop-shadow`), ambos `0 1px 2px` a 35% de preto. As estrelas mantêm um traço de 0,75 px a 30% só para a apagada não sumir.
- O resto do HUD e o `--lv-hud-shadow` das fichas continuam como estavam. Alternativa descartada: remover toda sombra (some em cena clara).

## Logo oficial na title bar (ícone da janela)

- Contexto: o dono trocou o hexágono amarelo pelo logo do sistema (três arcos com bolinhas).
- Escolha: o logo oficial mantém as cores originais (branco e vermelho), não herda o amarelo da title bar. Cores nos tokens `--lv-logo-white` e `--lv-logo-red` (`styles/tokens.css`). Na title bar usamos duas máscaras SVG (`assets/sheet/window-icon.svg` e `window-icon-accent.svg`) com traço mais grosso para ler em 16px. Versão fiel (traço 52) em `assets/logo.svg`, usada como ícone do sistema em `system.json` (`media`). Fundo da title bar é escuro, então o branco tem contraste e não precisou de contorno.
- Descartado: `currentColor` (amarelo) e PNG.

## "Fixer" vira "GM" nos textos em inglês da interface

- Contexto: a revisão de T-901/T-903 achou "Fixer" em vários textos de `lang/en.json`; o termo do livro é para o papel, mas na interface o jogador procura "GM".
- Escolha: `lang/en.json` usa "GM" em todo texto de interface (o pt-BR já usa "mestre"). "Fixer" fica só no glossário e no CHANGELOG.
- Descartado: manter "Fixer" na interface.

## Migração de mundo nunca derruba o `ready`

- Contexto: `await migrateWorld()` rodava antes do socket e do HUD, sem tratamento de erro.
- Escolha: `migrateWorld` captura o erro, loga, avisa o mestre (`LEVERAGE.Migration.failed`) e não grava a versão nova. Grava `systemMigrationVersion` depois de cada passo. Em downgrade (versão gravada maior que a instalada) não mexe em nada, só avisa no console.
- Descartado: deixar o erro subir (quebraria o HUD e o socket).

## Mensagem de Plot Points do mestre usa plural

- Escolha: `LEVERAGE.GM.Chat.plotPoints` virou `one`/`other` (concordância de "recebe/recebem" pelo número de personagens), via `tn`.

## Novo Job leva cada um a *pelo menos* `jobStartPlotPoints` (R-F9)

- Contexto: `newJob` somava `jobStartPlotPoints` ao que o personagem já tinha. O livro diz "everybody gets 1 Plot Point to start the Job" e "you only start the Job with one of them", e `docs/09` falava em "dar".
- Escolha: no início do Job cada personagem fica com pelo menos o valor da configuração (padrão 1). Quem tem mais guarda os seus; ninguém perde PP nem ganha por cima. Código (`job-actions.mjs`), textos (`Chat.newJob`, hint da configuração), `docs/09` e `docs/USO.md` alinhados.
- Descartado: somar (quem sobrou de um Job anterior acumularia sem fim) e definir o valor exato (tiraria PP ganho no fim do Job anterior).


## R-FINAL passada 1: regras que mudaram nas correções

- **Empréstimo (Lend):** `docs/02` diz que os dois donos concordam. O código atual deixa o dono do emprestador mandar (o mestre confere saldo e posse pelo socket). Decisão: manter assim por ora; não há pedido de consentimento ao receptor. Descartado por enquanto: janela de aceite no receptor (mais socket e estado, pouco ganho na mesa pequena).
- **Cidade atual:** uma só fonte, `wanted.city`. O campo `city` do Local é só informativo. Trocar de cidade é a ação de estrelas `setCity` (fila serial, nível vai a 0, linha no chat), porque `docs/02` diz que as estrelas zeram quando a Equipe sai da cidade.
- **Fiança:** tudo ou nada. Sem os degraus todos, não paga nada e o personagem espera resgate. Só o hospital aceita pagamento parcial, com a dívida mostrada no card.
- **Ganging Up:** o sistema não mostra "−1 thug" no card do jogador nem mexe na gangue do NPC. O mestre diminui `gang.size` na ficha. `thugsDown` foi apagada; `docs/08` e `USO.md` dizem isso. Descartado: ligar o card do jogador ao card da gangue (exige achar o NPC da gangue a partir de uma oposição montada com vários atalhos).
- **Oposição com um dado só:** completa com um d6 (`LEVERAGE.defaultOppositionDice[0]`), pelo livro (mínimo de dois dados, Traço que falta vale d6).

## Painel da Cena (Traços de cena, Complications e Traços de NPCs sempre à vista)

- **Onde fica:** faixa `#leverage-scene-panel` logo abaixo do HUD (`top` = fundo do HUD + 8 px, lido por `ResizeObserver`), a 16 px da barra lateral, `z-index: 30` como o HUD. É uma aplicação própria (`module/applications/scene-panel/`), não parte do `hud.hbs`, para não mexer no HUD nem na camada de testes dele. Descartado: pôr dentro do HUD (o HUD é só `pointer-events` nos controles e tem outro dono).
- **O que mostra:** Traços de cena e Complications do `activeJob` (dado + nome), e os Traços (`system.traits` com dado) de NPCs e Locais cujos tokens estão na cena vista. Tokens do mesmo ator viram uma linha com "×N". Sem nada: um estado vazio discreto de uma linha. Recolhível por cliente (`scenePanel.collapsed`); recolhido mostra a contagem. O mestre tem um lápis que abre o Rastreador do Job.
- **Esconder:** a noção não existia. Regras novas: jogadores nunca veem tokens escondidos (`token.hidden`); o mestre os vê com o ícone de olho cortado. Configuração de mundo `scenePanel.showActorTraits` (padrão ligado) esconde dos jogadores todos os Traços de NPC. Configuração de cliente `scenePanel.show` esconde o painel. Complications e Traços de cena são sempre públicos (o livro os trata assim na mesa).
- **Tempo real:** atualiza em `activeJobChanged`, `hudChanged`, criar/atualizar/apagar token, atualizar ator e cena, `canvasReady` (debounce de 50 ms).
- **Card de rolagem:** o chip de um dado de Traço de cena ganha a etiqueta "SCENE" (borda azul-esverdeada) e o de uma Complication na oposição do mestre (ref `job.<id>`) ganha "COMPLICATION" (borda vermelha). Não mexi em `module/dice/*`: a decisão sai do `kind`/`ref` que o card já guarda.

## Minimizar por duplo clique, menu "+ DADO" completo e camada do HUD (pós R-FINAL)

- **Minimizar:** o Foundry já trata o duplo clique na barra de título (`#onWindowDoubleClick`). A ficha entrava em
  `minimized`, mas `min-height`/`min-width` das fichas (Crew 1100x900, NPC, Local) seguravam a janela grande.
  Escolha: zerar os mínimos em `.minimizing`/`.minimized` em `styles/window.css`. Descartado: tratar o clique em JS.
- **Menu "+ DADO":** passa a listar, em grupos (`LEVERAGE.poolMenuGroups`): dados avulsos, Grana, Traços de cena,
  Assets, Specialties, Distinctions, Talents, Atributos, Roles. Talent só aparece se tem dado (regra: Talent não
  rola sozinho, seu dado é um bônus declarado). Distinction entra como d8 (clicar no chip leva a d4). Atributo/Role
  sem dado ficam de fora. O que já está na Pool não é oferecido de novo (dados avulsos podem repetir).
- **HUD:** z-index 30, abaixo das janelas como a barra de macros; `tests/foundry/hud-layer.mjs` reescrito.

## 2026-10-21 - Correcoes do playtest
- **Dialogo com campo obrigatorio vazio:** o `DialogV2.prompt` troca um `null` do callback pela acao ("ok"), entao o callback nao consegue recusar. Escolha: `components/dialog-guard.mjs` (`requireTextField`) segura o clique (e o Enter) no botao de confirmar, avisa com notificacao i18n e deixa o dialogo aberto. Aplicado em Novo Asset, Complication, Novo Job e Encerrar Job (este ultimo passava a string "ok" para `endJob`). `isAnswer` descarta qualquer resultado que nao seja objeto. Descartado: lancar erro no callback (comportamento incerto na v14).
- **Ficha minimizada:** o selo da trava mostra so o icone enquanto a janela esta minimizada, para o nome ter espaco.
- **Objetivo do Job:** campo opcional de texto (`goal`, ate 200 caracteres). No Job ativo (setting `activeJob`, ObjectField) e no Item `job` (StringField com padrao ""). Sem migracao: Jobs antigos recebem "" pelo padrao do modelo. Aparece no Rastreador (editavel), no painel de cena (leitura, publico como Complications e Tracos de cena) e na ficha do Job. Encerrar Job copia o objetivo para o Job de cada ficha.
- **Visibilidade dos Traits de inimigos:** regra conferida (DECISIONS 2026-10, painel de cena). Jogadores nunca veem tokens escondidos; `scenePanel.showActorTraits` (padrao ligado) esconde todos os Traits de NPC. Nao ha vazamento: o painel segue a regra documentada, e o mestre decide mostrando ou nao o token. Nada alterado. A Trava de Tracos (`traitsLocked`) tem padrao ligado; o mundo de teste estava desligado, e isso e dado do mundo, nao mexi.

## 2026-10-21 — Fichas de NPC e Local com identidade própria
- **Contexto:** o dono gostou da ficha da Crew, mas NPC e Local usavam a mesma moldura (mugshot) e não funcionavam bem.
- **Escolha:** mesmos tokens e componentes, mas NPC ganha crachá (silhueta por tier, cor do tier, polícia em azul) e barra de ROLAR COMO OPOSIÇÃO sob o cabeçalho; Local ganha banner de imagem com nome e cidade por cima e lista de NPCs ligados (campo novo `npcs`, UUIDs). Mugshot ficou só na Crew.
- **"Gangue":** o conceito (cada capanga soma um dado, Ganging Up) estava certo, o nome não. Virou **Capangas / Henchmen** na ficha, no rolador e nos rótulos de campo; o campo de dados continua `gang`. Resolvido por nome e estrutura (número × dado), sem texto explicativo.
- **Correção do dono no meio da tarefa:** nada de dicas, tooltips ou legendas explicativas nas fichas. Removidos `policeHint`, `rollHint`, `cityHint`, `traitsHint`; estados vazios só com o rótulo ("Nenhum Traço", "Nenhum NPC"). Ficam só `aria-label` e nomes de controles.
- **Descartado:** Jobs ligados ao Local (Jobs vivem em configuração do mundo, não são documentos); fica para depois.

## Faixa da cena: Traços por cena, Complications globais (sessão atual)

- **Contexto:** o "quadradão" do painel de cena no HUD (com Traços, Complications e Traços de NPCs) foi rejeitado pelo dono.
- **Escolha:** Traços de cena viram o flag `leverage-gta.sceneTraits` da cena **ativa** (`game.scenes.active`, não a
  vista). Complications continuam em `activeJob`. Faixa compacta de chips, pública, abaixo de `#scene-navigation`.
  O rastreador de NPCs/lugares e a opção `scenePanel.showActorTraits` foram removidos junto com `scenePanelChanged` e
  `LEVERAGE.scenePanel.actorTypes`.
- **Migração:** no `ready`, o mestre move `activeJob.sceneTraits` para a cena ativa (se ela não tem Traços) e esvazia a
  lista no setting (o setting faz merge de objetos, então a chave fica como `[]`).
- **Edição:** clicar num chip (mestre) abre o Rastreador do Job, que já tem +/-/remover; o Rastreador grava os Traços
  no flag via `writeJob`. Sem cena ativa, adicionar Traço não grava nada.
- **Encerrar cena** limpa os Traços da cena ativa. **Novo Job / Encerrar Job** não mexem nos Traços (pertencem às cenas).
- **Sem texto de ajuda** na faixa (pedido do dono): estado vazio mostra só a aba discreta; tooltips são só o nome.
- **Descartado:** editar no próprio chip com diálogo; manter o objetivo fora da faixa (ficou como chip pequeno).

## Trava por ficha e Grana do grupo no HUD

- **Trava:** a trava passou a ser por ficha (flag `sheetUnlocked`, ausente = travada, como o padrão antigo). A
  configuração de mundo `traitsLocked` foi trocada por `playersCanUnlock` (padrão ligado), com sentido invertido: o
  mestre só tira a liberdade. `game.leverage.lock/unlock/isLocked` seguem existindo (lock = desligar o destravamento).
  Os guardas dos documentos (`canEditTraits(user, actor)`) leem o flag do ator dono; o mestre sempre passa.
  Descartado: guardar a trava por usuário (não sobrevive a troca de personagem) ou manter as duas configurações.
- Selo desabilitado pelo mestre: só o visual (cadeado, apagado), **sem tooltip**, a pedido do dono (sem textos
  explicativos). Tooltips dos outros estados ficaram de uma frase curta; frases "O mestre pode destravar a ficha"
  dos estados vazios foram cortadas.
- **Grana do grupo:** `hud.showPartyMoney` (cliente, desligada) + botão discreto no HUD + recolhível
  (`hud.partyCollapsed`). "Personagens de jogadores" = personagem atribuído a usuários não-mestre + atores Crew com
  posse explícita de um jogador (não conta posse padrão). Dados de 28 px (tamanho mínimo permitido em `DIE_GEOMETRY`).
- Testes antigos em `tests/foundry/` que ainda gravam `traitsLocked` (phase1, T-30x, T-401, T-505, T-702...) ficam
  desatualizados; o novo `tests/foundry/sheet-lock-party.mjs` cobre o comportamento atual.

## Janela "Montar Pool" e Background editável no lugar (feedback do dono)

- **Contexto:** o "+ dado" abria uma lista reta; o Background tinha botão grande e editor com "Salvar" enorme.
- **Escolha (Pool):** o "+ Dado" abre uma janela própria (`module/applications/dialogs/pool-builder.mjs`) com busca, abas por tipo
  (Tudo + os grupos de `poolMenuGroups`), chips com dado e nome, itens já na Pool marcados (verde, com check) e prévia da Pool
  com Limpar / Pronto / Rolar. `poolMenuGroups` ganhou `includePooled` (devolve também o que já está na Pool, com `pooled: true`);
  o menu antigo não existe mais. Regras de rolagem intocadas. O módulo da janela é carregado sob demanda (precisa das classes do Foundry).
- **Escolha (texto):** por ordem do dono, nada de textos de ajuda ou tooltips explicativos: só rótulos curtos (nome do dado, aba, botões).
- **Escolha (Background):** lápis pequeno na faixa das abas, à direita (não toma espaço da página). Editar troca o lápis por check (salvar) e X
  (cancelar). Edição no lugar com ProseMirror sem barra de ferramentas (atalhos e digitação estilo Markdown funcionam). Salva ao sair do campo
  ou com Ctrl+Enter; Escape cancela; duplo clique no texto começa a editar. A altura da página não muda.
- **Descartado:** textarea simples (o campo é HTML); manter barra do ProseMirror (clique na barra tira o foco e salvaria cedo).

## Decisões do dono sobre as pendências (2026-10-21, pelo celular)

- **Cortex Prime: aprovado, com o fluxo ajustado pelo dono.** Não existe rolagem automática.
  1. O jogador monta a Pool e clica ROLL.
  2. O card entra no chat **inativo** (pendente, sem total) e, na máquina de quem rolou, abre a janela **Escolher dados**
     (estilo "Roll & Keep" do L5R5e).
  3. O jogador escolhe 2 dados para o total e 1 para o efeito e **lança no card**. Só então o card vale.
  4. Card **resumido** no chat: só o decidido (os 2 dados do total, a soma e o dado de efeito).
  5. Card **expandido** (clique): a rolagem inteira (todos os dados, hitches, dados pagos com PP).
  6. Fechar a janela sem confirmar **não** resolve nada: o card segue inativo e tem o botão "Escolher dados".
  Isto substitui a "escolha automática inicial" e o `status: pending` com total automático de
  `docs/research/cortex-prime-upgrade.md` (seções 2, 5.1, 5.3). `autoSelection` vira só um atalho "Máx. total" dentro
  da janela. O modo `classic` (rede de segurança) continua só como configuração `rules.rollMode`.
  Oposição do Fixer: sem janela por padrão (`rules.oppositionChoice = "auto"`), como estava.
- **Job como Item de mundo: aprovado, com um só tipo.** O dono perguntou por que `heist` e não `job`: o tipo se chama
  `job`. O Item de mundo é o Job (planejado/ativo/concluído); o Item embutido na ficha continua sendo o Record
  (cópia criada ao encerrar o Job, como hoje). Diferença por `item.isEmbedded`. Campos enxutos: nome, status,
  objetivo, notas, Complications, Traços de cena, pagamento. **Fora:** ligações a NPCs/Locais/Cenas (J-08), pack de
  golpes (J-09), `gmNotes`. Substitui a seção A.4 do `docs/research/jobs-e-locais.md` ("dois tipos").
- **Local ligado à Cena por flag: aprovado** como em `jobs-e-locais.md` (Parte B).
- **Painel único do mestre: rejeitado.** Não implementar o P1.2 de `REVIEW-USABILIDADE.md`.
- **Scripts antigos de `tests/foundry` com `traitsLocked`: atualizar** (tarefa T-1100).

## Job enxuto: sem Traços de cena nem Complications dentro dele (dono, 2026-10-21)

- **Contexto:** o dono lembrou que Job = o trampo da sessão; Traços e Complications parecem coisa de cena/lugar.
- **Escolha:** o Item `job` de mundo guarda só nome, status (planned/active/done), objetivo, notas e pagamento (total e
  parte de cada Crew no fim). **Traços de cena** ficam na Cena (flag, como já está desde o commit 601cfeb).
  **Complications** continuam globais da mesa (setting de mundo, como hoje), sem ficar no Job; `endJob` segue limpando.
- **Efeito no backlog:** J-01 vira camada só de nome/objetivo do Job ativo; J-05 migra só nome e objetivo; J-03 e J-07 sem
  listas de Complications/Traços; o Rastreador continua mostrando as Complications a partir do estado global.
  Substitui o campo `complications`/`sceneTraits` do esquema em `jobs-e-locais.md` A.4-1.
- **Descartado:** Complications dentro do Job (somem do histórico só por não estarem lá); Complications na Cena (um mapa
  abriga várias cenas narrativas, e a Complication vale entre cenas).

## Traits e Complications globais no HUD do mestre; Lugar escolhe a Cena (dono, 2026-10-21)

- **Escolha:**
  1. **Traits e Complications globais** (valem em qualquer cena até serem removidas). O mestre cria e remove pelo HUD do
     mestre. Complications seguem como estado global da mesa; Traits globais passam a ter o mesmo tratamento.
  2. **Traits da cena vêm do Lugar.** A ficha de Lugar ganha um campo **Cena**: um seletor com as Cenas do mundo (grava o
     UUID no próprio Lugar, campo validado no modelo de dados). Quando uma Cena está sendo vista, os Traços dos Lugares
     ligados a ela entram sozinhos no painel de cena, na Pool e no rolador de oposição. Vários Lugares podem apontar para a
     mesma Cena; um Lugar aponta para uma Cena.
  3. **Sem flag na Cena, sem arrastar Cena para a ficha, sem botão "Criar mapa".** A ligação mora só no Lugar; o lado
     contrário (Cena -> Lugares) é calculado. Tokens de Lugar continuam valendo (união sem repetir).
  4. **Lugar continua sendo Ator** (`location`), não Item: ficha, compêndio `locais`, tokens e testes já existem; um lugar
     não pertence a nenhum personagem.
  5. Os Traços por Cena guardados em flag (commit 601cfeb) deixam de existir: quem quiser Traços por cena cria um Lugar.
- **Efeito no backlog:** L-01 lê o campo `scene` dos Lugares; L-03 vira só o seletor de Cena na ficha do Lugar (sem
  arrastar, sem "Criar mapa"); nova tarefa L-06 tira os Traços por flag da Cena e põe criar Traço/Complication global
  no HUD do mestre. Substitui `jobs-e-locais.md` B.4 itens 1, 3 e 4.
- **Descartado:** flag na Cena (exigia arrastar ou botão); Lugar como Item (migração sem ganho).

## Local não nasce OBSERVER (2026-10-21)

- **Contexto:** o Local nascia com `ownership.default = OBSERVER` para os jogadores lerem os Traços.
- **Escolha:** removido. Jogadores leem os Traços por `game.actors` (todo ator de mundo está lá), sem permissão. OBSERVER vazava Notas do mestre e Locais ocultos. Quem quiser que o jogador abra a ficha dá a permissão na mão.
- **Também:** o id do Traço do Local na Pool é `<idDoLocal>-<slug>-<n>` (estável ao reordenar; apagar ou renomear faz a referência deixar de resolver, com aviso "referência desconhecida"). O Rolador de oposição usa o mesmo id nas escolhas.

## Plot Points no HUD: de todos os jogadores e do narrador (dono, 2026-10-21)

- **Contexto:** o HUD mostra só os PP do próprio personagem; o mestre vê o token selecionado, e o grupo todo só no Rastreador.
- **Escolha:**
  1. O HUD do mestre ganha uma **linha com os PP de cada jogador** (nome/retrato curto + número), com − e + em cada um
     (o mestre administra). Jogador continua vendo e gastando o seu.
  2. O **narrador também tem um contador de PP** ("Mesa"): setting de mundo, com − e +. Serve para contar o que o Fixer
     gasta e o que fica no meio da mesa, e para lembrar de passar 1 PP ao jogador quando o Fixer gasta contra ele.
     Não é uma reserva com limite: continua valendo "o Fixer não tem reserva própria" (docs/01 l.62); é só um marcador.
  3. Atualiza em tempo real para todos, com o mesmo pulso de hoje. Jogadores podem esconder pelas configurações de cliente.
- **Efeito:** `docs/07` (seção Plot Points e "Mestre") passa a descrever isso; tarefa T-1101 no backlog.
- **Descartado:** dar ao Fixer uma reserva com limite (bank do Prime); a pile do Prime já equivale ao marcador.

## Traits e Complications globais da mesa; Traços por flag da Cena descartados (L-06, dono, 2026-10-21)

- **Contexto:** executa a decisão "Traits e Complications globais no HUD do mestre; Lugar escolhe a Cena".
- **Escolha:**
  1. Dois settings escondidos, `globalTraits` e `complications` (`[{ id, name, die }]`), lidos e escritos só por
     `module/table-state.mjs` (escritas em fila, só o mestre). Aviso novo: `leverage.tableStateChanged` (o
     `activeJobChanged` ficou só para nome e objetivo do Job; telas que mostram os dois ouvem os dois).
  2. O `activeJob` guarda só `{ name, goal }`. Descartados: `activeJob.complications` e `activeJob.sceneTraits`.
  3. **Descartados por decisão do dono:** os Traços por flag da Cena (`flags.leverage-gta.sceneTraits`). A migração
     0.1.1 apaga o flag das Cenas e **não** o converte. Já `activeJob.sceneTraits` virou `globalTraits` e
     `activeJob.complications` virou `complications` (junta por id, sem repetir; pode rodar duas vezes).
  4. Referências de Pool não mudam: `scene:<id>` (Trait global ou de Lugar) e o prefixo `job.` das Complications no
     rolador de oposição, para não quebrar macros. `game.leverage.job.get()` continua devolvendo `complications` e
     `sceneTraits` (globais mais Lugares da Cena vista).
  5. `Encerrar cena` limpa os Traits globais; `Novo Job` e `Encerrar Job` limpam as Complications.
  6. Rastreador do Job: só a lista de Complications (visível mesmo sem Job); Traits se criam na faixa da cena.
  7. O Rolador de oposição não ganhou grupo de Traits globais (só as Complications, como antes).
- **Descartado:** manter o flag na Cena (pedia arrastar ou botão); ligar Complications ao Job (o mestre as carrega
  entre Jobs até remover).

## Job como Item de mundo, tipo `job` único (J-01..J-07, 2026-10-22)

- **Contexto:** executa a decisão do dono "Job enxuto" sobre `docs/research/jobs-e-locais.md` Parte A.
- **Escolha:**
  1. Um só tipo, `job`. O Item de mundo (`game.items`, sem Ator) é o Job do mestre; o embutido na ficha segue sendo o
     Record por personagem (Callback, `spent`, `payout.share`, Training Up inalterados). Sem tipo `heist`.
  2. Campos do Job: nome, `status` (`planned|active|done`), `goal`, `notes`, `payout.total`. `status` entrou no
     esquema com inicial `planned`; Record antigo continua válido e o ignora. Sem Complications, Traços, NPCs, Locais.
  3. Um `active` por vez: `startJob` põe os outros em `planned`; mudar o status à mão para `active` (cliente do
     mestre) faz o mesmo. Se mesmo assim houver dois, vale o primeiro por `sort` e o console avisa uma vez.
  4. Única porta: `module/job-store.mjs` (`readJob`, `saveJob`, `createJob`, `startJob`, ganchos).
     `leverage.activeJobChanged` agora dispara em create/update/deleteItem de Job de mundo. `game.leverage.job.*` não mudou.
  5. **Visibilidade (revista no review J):** o Job de mundo `planned` nasce com `ownership.default = NONE` (a trama futura
     não vaza aos jogadores). Iniciar (`startJob`, ou trocar o status para `active` na ficha) sobe para OBSERVER, porque um
     documento sem ao menos LIMITED não chega ao cliente do jogador; encerrar mantém OBSERVER; voltar a `planned` (inclusive
     a demoção do ativo) volta a NONE. Regra pura em `rules/jobs.mjs` (`jobVisibility`). Um Job visível não guarda segredos
     (nome, objetivo, notas e pagamento são lidos por todos; `docs/05` e `USO.md`). Testado com jogador: antes de iniciar ele não tem permissão LIMITED (fora do diretório, sem ficha); ao iniciar ganha OBSERVER ao vivo.
     Limite do Foundry v14: o cliente do jogador recebe o documento mesmo com NONE (`game.items.get` o devolve), então o NONE esconde da
     interface, não do console. Nada do Job planejado é segredo forte.
     Um Record arrastado da ficha para o diretório de Itens vira Job de mundo limpo no `preCreateItem` (planned, NONE, sem
     share/Callback/spent/vínculo); o `createJob` do sistema passa a opção `lvWorldJob` e não é normalizado.
  6. `endJob`: o Job fica `done` com `payout.total` e o nome do diálogo, o Record de cada Crew leva
     `flags.leverage-gta.jobUuid`, o chat usa `@UUID[Item.x]{nome}`. O Job de mundo guarda também a parte de cada Crew em `payout.crew` (`{actorUuid, name, share}`), mostrada na ficha do Job. Sem Job ativo (macro) cria um Job `done` para o histórico.
  7. Migração 0.1.2: `activeJob` com nome ou objetivo vira Job `active` ("Job sem nome" se só houver objetivo) e o
     setting é zerado; vazio não faz nada; pode rodar duas vezes. O setting segue registrado, sem uso.
  8. Rastreador: o nome do Job virou botão que abre a ficha (renomear é na ficha); só o objetivo se edita ali.
     "Novo Job" sempre aparece; "Iniciar" abre a lista dos planejados e fica desligado sem nenhum.
- **Descartado:** tipo `heist` separado (a nota original); ownership LIMITED (jogador não leria o objetivo na faixa
  da cena); pack de Jobs, ligações a NPCs/Locais/Cenas (J-08/J-09).
