# 04 — Arquitetura

Modelo de referência: o **dnd5e** (organização de pastas, DataModels, `getRollData`, ApplicationV2). Antes de
codar cada parte, confirme o padrão na versão do dnd5e compatível com **Foundry v14** e na API oficial v14
(`docs/12-pesquisa.md`). Onde este documento e a API v14 discordarem, a API vence: ajuste e registre em `DECISIONS.md`.

## Princípios

1. **Dados no DataModel, lógica no Document, tela na Application.** Nada de regra dentro de template ou de handler de
   clique.
2. **Uma fonte da verdade por conceito.** Cores e formas dos dados, chaves de Attributes/Roles, tipos de Asset,
   escalas de cidade e preços vivem em `module/config.mjs` (exposto como `CONFIG.LEVERAGE`) ou nas configurações.
   O desenho de um dado existe **uma vez** (`module/applications/components/die.mjs`) e é usado na ficha, na bandeja,
   no chat e no HUD.
3. **Lógica pura separada e testável.** Matemática da Pool, da escada de Grana, das estrelas e do dano fica em
   `module/dice/` e `module/rules/`, sem depender de `game`, e tem teste em `tests/unit/`.
4. **Tudo endereçável.** Cada Traço tem um caminho estável usado na ficha, em macros, no chat e na API
   (veja "Referências").
5. **ES modules, sem bundler.** O Foundry carrega `leverage-gta.mjs` diretamente. Sem jQuery. JSDoc nos tipos
   públicos. Classes com campos privados `#` quando fizer sentido.
6. **i18n sempre.** `game.i18n.localize("LEVERAGE.…")` no código e `{{localize "LEVERAGE.…"}}` nos templates.

## Estrutura de pastas

```
leverage-gta/                       ← raiz do repositório = pasta do sistema no Foundry
├── system.json                     manifesto
├── leverage-gta.mjs                entrada: importa tudo, registra no hook init/setup/ready
├── module/
│   ├── config.mjs                  CONFIG.LEVERAGE: dados, traços, tipos, escalas padrão, preços padrão
│   ├── settings.mjs                registra todas as configurações (mundo e cliente) e menus
│   ├── api.mjs                     game.leverage: rollPool, money, stars, plot points (para macros)
│   ├── socket.mjs                  ações que precisam do mestre (estrelas, transferências de Grana)
│   ├── enrichers.mjs               [[/pool …]] em diários e chat (opcional, fase final)
│   ├── utils.mjs                   helpers pequenos e genéricos
│   ├── scene-location.mjs          Locais da Cena vista, Traços de Local como Traços de cena, avisos de mudança
│   ├── data/
│   │   ├── fields.mjs              DieField e outros campos reutilizáveis
│   │   ├── actor/  crew.mjs  npc.mjs  location.mjs  _module.mjs
│   │   └── item/   distinction.mjs  talent.mjs  specialty.mjs  asset.mjs  job.mjs  _module.mjs
│   ├── documents/  actor.mjs  item.mjs  chat-message.mjs  _module.mjs
│   ├── dice/
│   │   ├── die.mjs                 tamanhos, passos (step up/down), validação
│   │   ├── pool.mjs                DicePool: estado da montagem (cliente), refs → dados
│   │   └── pool-roll.mjs           rolar, separar 1s, escolher mantidos, total, PP extras
│   ├── rules/
│   │   ├── money.mjs               escada de Grana: degraus ↔ dados, preços, pagar, rolar
│   │   ├── stars.mjs               escalas por cidade, Pool da polícia
│   │   └── combat.mjs              dano (margem + arma), cobertura, colete, Wasted/Busted
│   └── applications/
│       ├── components/die.mjs      renderDie(): o único desenho de dado (helper Handlebars {{lvDie}})
│       ├── actor/  crew-sheet.mjs  npc-sheet.mjs  location-sheet.mjs  base-actor-sheet.mjs
│       ├── item/   item-sheet.mjs  (uma classe base + PARTS por tipo)
│       ├── chat/   roll-card.mjs   (render e ações do card)
│       ├── hud/    leverage-hud.mjs
│       └── gm/     opposition-roller.mjs  job-tracker.mjs  city-scales-config.mjs  price-list-config.mjs
├── templates/      actor/crew/*.hbs  item/*.hbs  chat/*.hbs  hud/*.hbs  gm/*.hbs  partials/*.hbs
├── styles/         leverage-gta.css (índice) + fonts.css tokens.css base.css die.css sheets/*.css chat.css hud.css gm.css
├── fonts/          Anton, Barlow Condensed, Special Elite (OFL) + licenças
├── assets/         ícones e texturas próprios (parede do mugshot, etc.)
├── lang/           en.json  pt-BR.json
├── packs/          compêndios de exemplo (fonte em packs/_source, gerados por script)
├── tests/          unit/ (node --test)   foundry/ (Playwright)
├── tools/          build-packs.mjs, release.mjs (zip sem docs/reference/tests)
├── docs/ reference/ scripts/ .claude/      ← não vão no pacote de release
└── package.json  .gitignore  eslint.config.mjs
```

## Registro (hook `init`)

- `CONFIG.LEVERAGE = LEVERAGE` (de `config.mjs`).
- `CONFIG.Actor.documentClass`, `CONFIG.Item.documentClass`, `CONFIG.ChatMessage.documentClass` (se precisar).
- `CONFIG.Actor.dataModels = { crew, npc, location }`, `CONFIG.Item.dataModels = { distinction, talent, specialty,
  asset, job }`. Os tipos também ficam declarados em `system.json` → `documentTypes`.
- Registrar fichas com a API de configuração de fichas da v14 (no v13 era
  `foundry.applications.apps.DocumentSheetConfig.registerSheet`; confirme o caminho na v14).
- `registerSettings()`, helpers e partials do Handlebars (`{{lvDie}}`), enrichers.
- `game.leverage = api` (no `init` ou `setup`, antes de macros rodarem).
- `CONFIG.Actor.trackableAttributes` para `life.value` e `vest.value` (barras do token); `primaryTokenAttribute`
  no `system.json` = `life`.

## Referências (`@`) e API para macros

`Actor#getRollData()` devolve uma cópia de `system` mais atalhos, para fórmulas e macros:

| Caminho | Valor |
| --- | --- |
| `@attributes.agility.die` | `10` (tamanho do dado; `null` se não houver) |
| `@roles.thief.die` | `10` |
| `@life.value` / `@life.max` | `14` / `18` |
| `@vest.value` / `@vest.max` | `4` / `6` |
| `@money.steps` | `7` |
| `@plotPoints.value` | `3` |

**Referência de Traço** (usada na Pool, na API e no card): uma string estável.

| Ref | Significa |
| --- | --- |
| `attributes.agility` | o Attribute |
| `roles.thief` | a Role |
| `item:<id>` | um Item do ator (Specialty, Asset, Talent que dá dado) |
| `item:<id>:d8` / `item:<id>:d4` | uma Distinction e o modo escolhido |
| `money` | o maior dado de Grana (regra da casa) |
| `scene:<id>` | um Traço de cena: flag `sceneTraits` da Cena ativa (`applications/gm/scene-traits.mjs`) ou Traço de um Local da Cena vista (`scene-location.mjs`, id `<idDoLocal>-<slug>-<n>`); `currentSceneTraits()` junta os dois; `rollPool` e a bandeja aceitam |
| `d6` | um dado avulso |

API pública (`game.leverage`), documentada com JSDoc e exemplos em `docs/macros.md` (crie):

```js
await game.leverage.rollPool({ actor, refs: ["attributes.agility", "roles.thief", "d6"], flavor: "Cracks the safe" });
await game.leverage.opposition({ dice: [10, 6], label: "Police (2★)" });   // rolagem do mestre
await game.leverage.money.add(actor, 2);  await game.leverage.money.pay(actor, [12, 6]);
await game.leverage.stars.set(3);          // só mestre
await game.leverage.plotPoints.add(actor, 1);
```

## Padrões de UI (ApplicationV2)

- Fichas: `HandlebarsApplicationMixin(ActorSheetV2)` com `static PARTS` (header, attributes, roles, distinctions,
  talents, specialties, assets, folder, tray), cada parte em seu template. Re-render por parte quando possível.
- Cliques: `static DEFAULT_OPTIONS.actions = { toggleDie, addToPool, removeFromPool, roll, createItem, deleteItem,
  openItem, … }` com `data-action` no HTML. Sem `addEventListener` manual exceto para drag & drop e clique direito.
- Arrastar e soltar: itens para a ficha, reordenação dentro da lista, Jobs entre fichas.
- O estado da Pool é **do cliente** (não salva no ator): vive numa instância `DicePool` ligada à ficha aberta.
- Pasta BACKGROUND/JOBS: lembra a orelha por ator e por usuário (flag do usuário ou `localStorage` com try/catch).
- HUD: uma `ApplicationV2` sem moldura de janela, inserida na camada de UI, posicionada por CSS relativo à barra
  lateral (veja `docs/07-ui-hud.md`).

## CSS

- Tudo com escopo: `.leverage-gta` na raiz de cada aplicação; nada de seletor global.
- Use **CSS layers** como o núcleo do Foundry v13+ espera (confirme o nome da layer de sistemas na v14 e o padrão do
  dnd5e).
- Tokens em `styles/tokens.css` (os da tabela de `docs/03`). Componentes reutilizáveis: `.lv-panel`, `.lv-panel-head`,
  `.lv-row` (plana) / `.lv-row.is-pooled` (acesa), `.lv-die`, `.lv-chip`, `.lv-paper`, `.lv-xbtn`, `.lv-scroll`.
- Listas que rolam: `overflow-y: auto; scrollbar-gutter: stable;` + `padding-inline-end` para folga.

## Sockets e permissões

- Estrelas e escalas: **configuração de mundo**, só o mestre grava. Jogador não tem botão ativo nas estrelas.
- Grana: o dono altera a própria; **transferência** entre personagens passa pelo mestre via socket
  (`system.leverage-gta`), que valida e aplica as duas atualizações.
- Plot Points: o dono altera os próprios; o mestre altera de todos.
- **Quem pediu:** o servidor entrega o evento de socket de um sistema como `(dados, idDoEmissor)`, e o id vem da sessão
  autenticada (conferido em `dist/server/sockets.mjs`, `handleCustomSocket`). O pacote **não** leva `userId`: o mestre
  usa só esse segundo argumento e confere posse (`testUserPermission(user, "OWNER")`) antes de agir. Um jogador não
  consegue se passar por outro. O mestre executa por conta própria o que ele mesmo pede, com o próprio id.
- "+1 PP" do card (manter outro dado): só o jogador dono da personagem (o mestre usa `plotPoints.add`) e só na
  rolagem mais recente da personagem no chat. O pedido por socket trava a mensagem também no lado do mestre.
- Trava: configuração de mundo; os métodos de criação/remoção/alteração de Traço checam a trava (não só a interface).

## Qualidade

- ESLint (config plana) + `npm test` (node:test) obrigatórios antes de commit.
- Sem `console.log` solto: use um logger com prefixo `Leverage |` e nível debug por configuração de cliente.
- Erros de usuário com `ui.notifications.warn(localize(...))`, nunca exceções cruas.
- Nada de dados do livro copiados em compêndio além de exemplos próprios.
