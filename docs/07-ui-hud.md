# 07 — HUD (estrelas, Grana, Plot Points)

Alvo visual: `reference/mockups/png/hud-sidebar-open.png`, `hud-sidebar-collapsed.png`, `hud-empty-state.png`.

## Posição e comportamento

- **Canto superior direito do canvas, à esquerda da barra lateral do Foundry**, sempre a **16 px** dela. Quando o
  jogador recolhe ou expande a barra lateral, o HUD acompanha.
  - Implementação sugerida: o HUD fica dentro da camada de interface do Foundry (`#interface` ou equivalente na v14,
    pesquise) e usa `right: calc(var(--lv-sidebar-width) + 16px)`. Atualize `--lv-sidebar-width` com um
    `ResizeObserver` no elemento da barra lateral e nos hooks de recolher/expandir. Sem polling.
  - Não pode ficar por cima de janelas abertas de forma que atrapalhe: `z-index` abaixo das janelas de aplicação,
    acima do canvas. `pointer-events` só nos controles.
- **Não é arrastável.** Pode ser **minimizado** (clique no `$` com Shift, ou botão discreto que aparece no hover):
  minimizado mostra só as estrelas. O estado é configuração de cliente.
- Cada jogador pode **esconder** partes nas configurações de cliente (estrelas / Grana / Plot Points).
- **Personagem mostrado:** o personagem do usuário (`game.user.character`). Se não tiver, o token controlado. Se não
  houver nenhum, Grana e Plot Points aparecem vazios e apagados com o tooltip "No character assigned".
- **Mestre:** as estrelas são clicáveis. Grana e Plot Points mostram o token selecionado (se houver) ou ficam
  ocultos; a visão de grupo fica no Rastreador do Job (`docs/09`).
- Some quando as regras da casa correspondentes estão desligadas (estrelas e Grana); Plot Points sempre aparecem.

## Grana dos jogadores (só mestre, opcional)

- Opção de cliente `hud.showPartyMoney` ("Mostrar grana dos jogadores"), **desligada por padrão**, nas configurações e
  num botão discreto (ícone de pessoas, no hover) ao lado do minimizar. Desligada, o HUD não muda nada.
- Ligada: painel compacto abaixo da Grana principal, "GRANA DO GRUPO · N", com uma linha por personagem de jogador
  (nome com reticências + dados de Grana de 28 px, ou o d4 tracejado vazio). Cabeçalho clicável **recolhe/expande**
  (`hud.partyCollapsed`). Mais de ~5 linhas rolam, com a calha da barra reservada.
- Personagens de jogador = personagem atribuído a cada usuário não-mestre + atores Crew que um jogador possui de forma
  explícita. Some minimizado ou com a regra de Grana desligada. Jogadores nunca veem a lista; veem só a própria Grana.
- Mestre sem token selecionado: a Grana principal fica oculta; com a lista ligada ele ainda vê a Grana de todos
  (útil sem selecionar nada); desligada, vê as estrelas.

## Estrelas

- Cinco estrelas de **50 px**, em linha, sem contorno preto (só uma sombra suave, `--lv-hud-soft-shadow`). Ativas: amarelo `#ffcf1f`, rótulo escuro. Inativas:
  `#3b3313` com opacidade 0,8, rótulo `#857232`: escuras, mas claramente presentes.
- Dentro de cada estrela, o **dado principal** daquele nível na escala da cidade atual (d8, d10, d12…), em Anton 13 px.
- Tooltip de cada estrela: "3 stars · police roll d12 + d6".
- **Só o mestre clica.** Clicar na estrela N define o nível N; clicar na estrela do nível atual baixa para N−1
  (permite zerar clicando na primeira). Mudança é anunciada no chat de forma curta ("WANTED LEVEL ★★★").
- O nível e a cidade ficam na configuração de mundo `wanted`; todos os clientes re-renderizam pelo `onChange`.

## Grana

- `$` em Anton 40 px verde-dinheiro com sombra suave (sem contorno preto) + dados verde-dinheiro de 38 px com o número dentro, **maior à
  direita**, dados novos nascendo à esquerda. Sem dinheiro: `$` + um contorno tracejado de d4 com "0".
- **Clique esquerdo: Pagar** (abre o diálogo com a tabela de preços; Shift + clique minimiza o HUD). **Clique direito:
  Emprestar** (abre o diálogo de empréstimo). Só dono do personagem e mestre.
- Tooltip: "Grana · 7 steps · click to pay, right click to lend".

## Plot Points

- Ficha de cassino amarela (30 px) + número em Anton 34 px amarelo com sombra suave, botão − (22 px) à esquerda; o botão + só aparece para o mestre (e o clique no número também dá +1 só ao mestre; botão direito no número gasta 1).
- Sempre visível, inclusive com 0.
- Animação curta (pulso) quando o valor muda, para o jogador perceber que ganhou um PP.

## Plot Points de todos e Mesa (só mestre)

- Painel compacto abaixo dos PP principais (some minimizado ou com `hud.showPlotPoints` desligado): linha **"Mesa"**
  (contador do narrador, `[-] n [+]`) e, abaixo, uma linha por personagem de jogador (mesma lista da Grana do grupo):
  nome com reticências + `[-] n [+]`. Linhas de altura fixa (32 px, painel de 230 px); mais de 5 linhas (160 px) rolam, com a calha reservada.
  Sem textos de ajuda, só rótulos curtos.
- **Mesa** é o setting de mundo `tablePlotPoints` (Number, inteiro, mínimo 0, sem limite), só um marcador (não é
  reserva do Fixer). `-` e `+` mudam de 1 em 1; o `-` apaga em 0.
- `-`/`+` de um jogador usam `game.leverage.plotPoints.add` (mínimo 0). Atualiza em tempo real (`updateActor` e o
  `onChange` do setting via `leverage.hudChanged`), com o mesmo pulso dos PP principais. Jogador não vê o painel.
- Lógica pura em `hud-logic.mjs` (`plotPointRows`, `clampTablePoints`, `changedKeys`).

## Faixa da cena (Traits, Traços de Lugar e Complications)

Não faz parte do bloco do HUD: é uma faixa compacta e pública, logo abaixo do seletor de cenas do Foundry
(`#scene-navigation`), alinhada à borda esquerda dele e no mesmo z-index do HUD (sobre a cena, sob as janelas).

- **Traits globais** (setting `globalTraits`) e **Complications** (setting `complications`) são estado da mesa:
  valem em qualquer cena, independentes do Job, até o mestre remover. Só o mestre cria, troca o dado e remove.
- **Traços de Lugar**: os Traços dos Locais ligados à Cena vista (campo Cena do Local) entram na mesma faixa, com
  ícone de pino e o nome do Local; sem X e sem edição de dado (edita-se na ficha do Local).
- Cada item é um chip `[dado] nome` (borda verde-água para Traço, vermelha para Complication). Nome longo vira
  reticências + tooltip. O objetivo do Job aparece como um chip com ícone de alvo, quando existe.
- **Edição do mestre**, na própria faixa: dois botões **+** (borda verde-água para Trait, vermelha para Complication)
  abrem uma linha com campo de nome (Enter confirma, Esc cancela; o texto digitado e o foco sobrevivem a
  atualizações da faixa); o dado do chip é um botão que troca o chip por d4..d12 para escolher (o dado atual fica em
  destaque e o nome do chip continua visível); o **X** remove. O lápis abre o Rastreador do Job. Os dois **+** e o lápis
  ficam num grupo único que nunca quebra de linha separado; o ícone de cada **+** tem a cor da sua lista.
- Aba de recolher (por cliente): recolhida mostra só as contagens. Sem nada para mostrar fica só a aba, discreta, sem
  frase de ajuda.
- Atualiza em tempo real (`leverage.tableStateChanged`, `leverage.activeJobChanged` e `canvasReady`). Mundos antigos:
  a migração 0.1.1 move `activeJob.complications` e `activeJob.sceneTraits` para os settings da mesa.
- Não há mais lista de Traços de NPCs/lugares nem a opção `scenePanel.showActorTraits`: o mestre consulta as fichas.

## Qualidade

- Nada do HUD pode cobrir os controles do Foundry (barra lateral, navegação de cenas, botões do canto).
- Fica nítido em escala de interface 100% e 125%.
- Atualiza em tempo real para todos (estrelas) e para o dono (Grana/PP) sem recarregar.
