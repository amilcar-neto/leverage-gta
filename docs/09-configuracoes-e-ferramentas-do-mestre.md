# 09 — Configurações do sistema e ferramentas do mestre

## Configurações de mundo (engrenagem → Configurações → Leverage: Liberty City)

| Chave | Tipo | Padrão | O que faz |
| --- | --- | --- | --- |
| `houseRules.stars` | Boolean | `true` | Liga Estrelas (HUD, rolador da polícia) |
| `houseRules.life` | Boolean | `true` | Liga Vida e Colete (cabeçalho, barra do token, dano) |
| `houseRules.money` | Boolean | `true` | Liga Grana (HUD, bandeja, preços, Wasted/Busted pagos) |
| `lifeBase` | Number | `10` | Vida máxima = isto + Vitality |
| `moneyStart` | Number | `2` | Degraus de novos personagens |
| `jobStartPlotPoints` | Number | `1` | PP de cada um em "Novo Job" |
| `playersCanUnlock` | Boolean | `true` | "Jogadores podem destravar suas fichas". Ligado: cada dono trava/destrava a própria ficha pelo selo. Desligado: fichas travadas à força (também no controle do mestre) |
| `wanted` | Object | `{city:"liberty", level:0}` | Nível atual (escondido; mudado pelo HUD/controle) |
| `cityScales` | Menu → app `CityScalesConfig` | 3 cidades de `docs/02` | Editar cidades e a Pool de cada estrela |
| `prices` | Menu → app `PriceListConfig` | tabela de `docs/02` | Editar preços em dados |
| `trainingCosts` | Menu (ou dentro do Price list) | do livro | Custo em Jobs de cada evolução |
| `activeJob` | Object | vazio | `{ name, goal }` do Job atual (escondido; Rastreador e faixa da cena) |
| `globalTraits` | Array | `[]` | Traits globais da mesa, `[{ id, name, die }]`: valem em qualquer cena até o mestre remover (escondido; faixa da cena) |
| `complications` | Array | `[]` | Complications da mesa, `[{ id, name, die }]`, independentes do Job e da cena (escondido; faixa da cena, Rastreador, card do 1, Rolador de oposição). As duas listas são lidas e escritas só por `module/table-state.mjs`; mudar uma avisa `leverage.tableStateChanged` |
| `systemMigrationVersion` | String | — | Escondido |

## Configurações de cliente

| Chave | Padrão | O que faz |
| --- | --- | --- |
| `hud.showStars` / `hud.showMoney` / `hud.showPlotPoints` | `true` | Esconder partes do HUD |
| `hud.showPartyMoney` | `false` | Só mestre: lista compacta da Grana de todos os personagens de jogadores no HUD (também botão no HUD) |
| `hud.partyCollapsed` | `false` | Escondido: lista recolhida |
| `hud.minimized` | `false` | HUD só com estrelas |
| `pool.keepAfterRoll` | `false` | Não limpar a Pool depois de rolar |
| `debug` | `false` | Log detalhado no console |

## Controles do mestre (barra da esquerda)

Um grupo próprio "Leverage" (ícone de estrela/distintivo) nos controles de cena, só para o mestre. Na v13 o hook
`getSceneControlButtons` recebe um objeto de controles; confirme o formato na v14.

| Ferramenta | Tipo | Ação |
| --- | --- | --- |
| **Jogadores podem destravar fichas** | toggle | Liga/desliga `playersCanUnlock` (desligado = fichas travadas à força); avisa no chat |
| **Nível de procurado** | botão | Popover com 0–5 estrelas e a cidade |
| **Rolador de oposição** | botão | Abre o rolador (`docs/08`) |
| **Rastreador do Job** | botão | App com: nome e objetivo do Job, Complications da mesa (nome + dado, subir/descer/remover), visão da Equipe (Vida, Colete, Grana, PP de cada um, com +/−) |
| **Encerrar cena** | botão | Apaga Assets `scene` de todos os personagens (com confirmação e resumo no chat) e limpa os Traits globais (`globalTraits`) |
| **Novo Job** | botão | Define o Job ativo, leva cada um a pelo menos `jobStartPlotPoints` PP (quem tem mais mantém; o livro dá 1 a todos no início), limpa as Complications da mesa |
| **Encerrar Job** | botão | Diálogo: nome, rendimento total em degraus, divisão por personagem → cria item `job` em cada ficha, soma Grana, apaga Assets `job` e limpa as Complications |
| **Nova sessão** | botão | Zera `callbackUsed` de todos os Jobs |
| **Dar Plot Point** | botão | Escolhe personagem(ns) e dá 1 PP |

Tudo que essas ferramentas fazem também está na API (`game.leverage.*`) para macros.
