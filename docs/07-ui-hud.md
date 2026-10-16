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

## Estrelas

- Cinco estrelas de **50 px**, em linha, com contorno preto. Ativas: amarelo `#ffcf1f`, rótulo escuro. Inativas:
  `#3b3313` com opacidade 0,8, rótulo `#857232`: escuras, mas claramente presentes.
- Dentro de cada estrela, o **dado principal** daquele nível na escala da cidade atual (d8, d10, d12…), em Anton 13 px.
- Tooltip de cada estrela: "3 stars · police roll d12 + d6".
- **Só o mestre clica.** Clicar na estrela N define o nível N; clicar na estrela do nível atual baixa para N−1
  (permite zerar clicando na primeira). Mudança é anunciada no chat de forma curta ("WANTED LEVEL ★★★").
- O nível e a cidade ficam na configuração de mundo `wanted`; todos os clientes re-renderizam pelo `onChange`.

## Grana

- `$` em Anton 40 px verde-dinheiro com contorno + dados verde-dinheiro de 38 px com o número dentro, **maior à
  direita**, dados novos nascendo à esquerda. Sem dinheiro: `$` + um contorno tracejado de d4 com "0".
- **Clique esquerdo: +1 degrau. Clique direito: −1 degrau.** Só dono do personagem e mestre. Para pagar um preço em
  dados (ex.: d12 + d6) há um item no menu de contexto ("Pay…") que abre um diálogo com a tabela de preços.
- Tooltip: "Grana · 7 steps · left click +1, right click −1".

## Plot Points

- Ficha de cassino amarela (30 px) + número em Anton 34 px amarelo com contorno, botões − e + (22 px) à esquerda.
- Sempre visível, inclusive com 0.
- Animação curta (pulso) quando o valor muda, para o jogador perceber que ganhou um PP.

## Qualidade

- Nada do HUD pode cobrir os controles do Foundry (barra lateral, navegação de cenas, botões do canto).
- Fica nítido em escala de interface 100% e 125%.
- Atualiza em tempo real para todos (estrelas) e para o dono (Grana/PP) sem recarregar.
