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
| `traitsLocked` | Boolean | `true` | Trava de Traços (também no controle do mestre) |
| `wanted` | Object | `{city:"liberty", level:0}` | Nível atual (escondido; mudado pelo HUD/controle) |
| `cityScales` | Menu → app `CityScalesConfig` | 3 cidades de `docs/02` | Editar cidades e a Pool de cada estrela |
| `prices` | Menu → app `PriceListConfig` | tabela de `docs/02` | Editar preços em dados |
| `trainingCosts` | Menu (ou dentro do Price list) | do livro | Custo em Jobs de cada evolução |
| `activeJob` | Object | vazio | Job atual e suas Complications (escondido; usado pelo Rastreador) |
| `systemMigrationVersion` | String | — | Escondido |

## Configurações de cliente

| Chave | Padrão | O que faz |
| --- | --- | --- |
| `hud.showStars` / `hud.showMoney` / `hud.showPlotPoints` | `true` | Esconder partes do HUD |
| `hud.minimized` | `false` | HUD só com estrelas |
| `pool.keepAfterRoll` | `false` | Não limpar a Pool depois de rolar |
| `debug` | `false` | Log detalhado no console |

## Controles do mestre (barra da esquerda)

Um grupo próprio "Leverage" (ícone de estrela/distintivo) nos controles de cena, só para o mestre. Na v13 o hook
`getSceneControlButtons` recebe um objeto de controles; confirme o formato na v14.

| Ferramenta | Tipo | Ação |
| --- | --- | --- |
| **Trava de Traços** | toggle | Liga/desliga `traitsLocked`; avisa no chat |
| **Nível de procurado** | botão | Popover com 0–5 estrelas e a cidade |
| **Rolador de oposição** | botão | Abre o rolador (`docs/08`) |
| **Rastreador do Job** | botão | App com: nome do Job, Complications (nome + dado, subir/descer/remover), Traços de cena, visão da Equipe (Vida, Colete, Grana, PP de cada um, com +/−) |
| **Encerrar cena** | botão | Apaga Assets `scene` de todos os personagens (com confirmação e resumo no chat) e limpa Traços de cena |
| **Novo Job** | botão | Define o Job ativo, dá `jobStartPlotPoints` a cada um, limpa Complications antigas |
| **Encerrar Job** | botão | Diálogo: nome, rendimento total em degraus, divisão por personagem → cria item `job` em cada ficha, soma Grana, apaga Assets `job` |
| **Nova sessão** | botão | Zera `callbackUsed` de todos os Jobs |
| **Dar Plot Point** | botão | Escolhe personagem(ns) e dá 1 PP |

Tudo que essas ferramentas fazem também está na API (`game.leverage.*`) para macros.
