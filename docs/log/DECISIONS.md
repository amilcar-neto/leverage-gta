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
