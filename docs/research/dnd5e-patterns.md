# dnd5e: padrões a copiar (T-002)

Fonte: https://github.com/foundryvtt/dnd5e, branch `6.1.x` / tag `release-6.0.6`. `system.json` declara
`"compatibility": {"minimum": "14.367", "verified": "14"}` (ou seja, vale para a v14). Clone local (ignorado pelo git):
`.cache/research/dnd5e`. Caminhos abaixo são relativos a essa pasta.

## 1. Pergunta

Como o dnd5e organiza o código e quais padrões (estrutura, DataModels, `getRollData`, macros arrastáveis, migração, packs,
CSS, fichas) devemos copiar para o Leverage: Liberty City, sem copiar volume?

## 2. Respostas

### 2.1 Estrutura

- Entrada na raiz: `dnd5e.mjs` (um arquivo, hooks `init`, `setup`, `i18nInit`, `ready`). Sem bundler no uso; o `rollup` do
  `package.json` só gera `dnd5e-compiled.mjs` para release. Nós: sem bundler (doc 04).
- `module/` em subpastas por tipo: `applications/ (actor, item, api, components, hud, settings, dice...)`, `data/ (abstract, actor, item, fields, settings...)`,
  `documents/ (actor, item, chat-message, macro, ...)`, `dice/`, `canvas/`, `config.mjs`, `settings.mjs`, `migration.mjs`, `utils.mjs`,
  `enrichers.mjs`, `registry.mjs`, `drag-drop.mjs`.
- **Cada pasta tem um `_module.mjs`** que reexporta tudo; `dnd5e.mjs` faz `import * as applications from "./module/applications/_module.mjs"`.
  Resultado: `applications.actor.CharacterActorSheet`, `dataModels.actor.config`. Copiar: dá nomes curtos e um índice por pasta.
  Arquitetura do doc 04 já prevê `_module.mjs`.
- `dnd5e.mjs` define o namespace global: `globalThis.dnd5e = game.dnd5e = Object.assign(game.system, globalThis.dnd5e)` — mescla a API
  no `game.system` (assim `game.system.version` e a API vivem juntos). Nós: `game.leverage` conforme doc 04; mesclar com `game.system` é opcional.
- Hook `init` (dnd5e.mjs:61): `CONFIG.DND5E = DND5E`; `CONFIG.Actor.documentClass`; `CONFIG.Item.documentClass`; `registerSystemSettings()`;
  `CONFIG.Actor.dataModels = ...` (linha 158); `DocumentSheetConfig.registerSheet(...)` (linha 171+); `utils.preloadHandlebarsTemplates()` (linha 277);
  helpers via `Handlebars.registerHelper({...})` (`module/utils.mjs:1347`).
- `preloadHandlebarsTemplates` termina em `foundry.applications.handlebars.loadTemplates(paths)` (utils.mjs:1179): é o caminho v13/v14,
  não o global `loadTemplates`.

### 2.2 TypeDataModel e esquemas

- Base própria `SystemDataModel` (`module/data/abstract/system-data-model.mjs`) com:
  `static mergeSchema(a, b)` (`Object.assign`), `static mixin(...templates)` (mistura "templates" de esquema),
  `static migrateData/_migrateData/shimData`, `static LOCALIZATION_PREFIXES`, `static metadata`.
- Modelos de ator (`data/actor/character.mjs`) herdam de uma base `ActorDataModel`; item de uma `ItemDataModel`. Reuso por
  **templates**: `class LootData extends ItemDataModel.mixin(ItemDescriptionTemplate, PhysicalItemTemplate)` (data/item/loot.mjs).
- Os tipos ficam num objeto `config` (`dataModels.actor.config = { character, npc, ... }`) e vão para `CONFIG.Actor.dataModels`.
- Ciclo: `prepareBaseData()` (antes de efeitos) e `prepareDerivedData()` (depois), no DataModel; o Document (`Actor5e`) só orquestra.
- Mirar: **uma base nossa fina** (`LeverageActorData`) com `getRollData`, e templates só se repetirem (ex.: `DescriptionTemplate`).
  Para 3+2 tipos não precisamos do `mixin`; use herança simples.

```js
// module/data/actor/crew.mjs
const { NumberField, SchemaField, HTMLField, StringField } = foundry.data.fields;
export default class CrewData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Crew"];
  static defineSchema() {
    return {
      life: new SchemaField({ value: new NumberField({ integer: true, initial: 14, min: 0 }),
                              max:   new NumberField({ integer: true, initial: 14, min: 1 }) }),
      background: new HTMLField()
    };
  }
  prepareDerivedData() { this.life.value = Math.min(this.life.value, this.life.max); }
  getRollData() { return { ...this.toObject(false), /* atalhos @attributes.agility.die */ }; }
}
```

### 2.3 `getRollData` e `@`-referências

- `Actor5e#getRollData(options)` (documents/actor/actor.mjs:590): se `this.system.getRollData` existe usa-o, senão `{...super.getRollData()}`;
  depois acrescenta `flags`, `name`, `statuses`. O dado "de verdade" mora no DataModel (`data/abstract/actor-data-model.mjs:99`):
  `const data = { ...this; data.prof = new Proficiency(...); return data; }` — **copia rasa de `system`** mais atalhos.
- `Item5e#getRollData` (data/abstract/item-data-model.mjs:386) = `{ ...actorRollData, item: { ...this } }`.
- Opção `{ deterministic }` para fórmulas sem rolagem aleatória. Para nós: `getRollData()` devolve `attributes.agility.die` etc. (doc 04),
  e `Roll.replaceFormulaData` resolve `@attributes.agility.die`.
- As `@`-referências em fórmulas do núcleo são resolvidas por `new Roll(formula, rollData)`. Nossas referências de Traço
  (`attributes.agility`, `item:<id>`) **não** são fórmulas: resolva em `DicePool` (módulo `dice/pool.mjs`), não em `Roll`.

### 2.4 Macros arrastáveis (hotbar)

- Hook `hotbarDrop` registrado no `ready` (dnd5e.mjs:609):
  `Hooks.on("hotbarDrop", (bar, data, slot) => { if (["Item","Activity","ActiveEffect"].includes(data.type)) { create5eMacro(data, slot); return false; } })`.
  `return false` impede o comportamento padrão do núcleo.
- `documents/macro.mjs`: `create5eMacro(dropData, slot)` monta `macroData = { type:"script", scope:"actor", name, img, command, flags:{"dnd5e.itemMacro":true} }`,
  reutiliza macro igual (`game.macros.find(name+command+isAuthor)`) senão `Macro.create(macroData)`, e `game.user.assignHotbarMacro(macro, slot)`.
- O `command` chama uma função **exportada pela API**, por **nome** (não por id), para sobreviver a cópias do ator:
  `dnd5e.documents.macro.rollItem("Nome", { event })` -> `getMacroTarget(name, "Item")` acha o token selecionado/ator do usuário e o item por nome.
- Para nós: arrastar um Traço/Asset da ficha gera macro `game.leverage.rollPool({ actor: ..., refs: [...] })`. Padrão:

```js
Hooks.on("hotbarDrop", (bar, data, slot) => {
  if (data.type !== "LeverageTrait") return;        // o dragstart da ficha define dataTransfer: {type:"LeverageTrait", actorUuid, ref}
  createTraitMacro(data, slot); return false;       // retornar false é obrigatório
});
async function createTraitMacro({ actorUuid, ref, label, img }, slot) {
  const command = `game.leverage.rollPool({ actorUuid: "${actorUuid}", refs: ["${ref}"] });`;
  const macro = game.macros.find(m => m.command === command && m.isAuthor)
    ?? await Macro.create({ name: label, img, type: "script", scope: "actor", command, flags: { "leverage-gta": { traitMacro: true } } });
  game.user.assignHotbarMacro(macro, slot);
}
```
- No `dragstart` da ficha: `event.dataTransfer.setData("text/plain", JSON.stringify({ type: "LeverageTrait", ... }))`.
  Para Itens, `ActorSheetV2` já traz `_onDragStart` com o payload padrão `{type:"Item", uuid}`; aí basta tratar `"Item"` no hook.

### 2.5 Fichas ApplicationV2 (resumo do que o dnd5e faz)

- Mixin próprio `ApplicationV2Mixin(Base, {handlebars})` (`applications/api/application-v2-mixin.mjs`) adiciona `classes: ["dnd5e2"]`,
  `actions` comuns, `_prepareContext` com `context.CONFIG = CONFIG.DND5E` e `context.inputs = foundry.applications.fields`.
  Copiar a ideia: **uma base** `LeverageSheetMixin` que injeta `CONFIG.LEVERAGE`, `classes: ["leverage-gta"]`, helper `lvDie`.
- `static PARTS` com `container: {classes, id}` (agrupa partes num wrapper, ex.: `tab-body`) e `scrollable: [""]`; `static TABS` e `tabGroups.primary`
  são do dnd5e (PrimarySheetMixin), com `changeTab` sobrescrito; `condition` oculta aba. `_preparePartContext(partId, ctx, options)` prepara dados por parte
  (character-sheet.mjs:204).
- `DEFAULT_OPTIONS`: `classes`, `form:{submitOnChange:true}`, `window:{resizable:true, controls:[...]}`, `actions:{...}` com métodos `static #privados`.
- Arrastar: `DragDropApplicationMixin` próprio só para a regra "mover vs copiar" (`drag-drop-mixin.mjs`); a base do núcleo já cuida
  de `_onDropItem`. Sobrescrever `_onDragStart/_onDrop` e chamar `super`.
- Preferências por usuário: tamanho da janela em `game.user.getFlag("dnd5e", "sheetPrefs.<tipo>")` lido no construtor
  (base-actor-sheet.mjs:~60). Mesmo padrão serve para lembrar a orelha da pasta (doc 04): `game.user.setFlag("leverage-gta", "crewTab.<actorId>", tab)`.
- Campo de texto rico: `<prose-mirror name="system.details.biography.value" value="{{source...}}" document-uuid="{{actor.uuid}}">` (character-biography.hbs:47).

### 2.6 Settings e menus

- `module/settings.mjs`: `registerSystemSettings()` com `game.settings.register("dnd5e", key, {...})` agrupado por assunto e comentado.
  `registerMenu` (linhas 385, 411, 441, 482): `{ name, label, hint, icon, type: <ApplicationV2>, restricted: true }`.
  Configurações internas: `config: false` (ex.: `systemMigrationVersion`, `firstRun`).
- Há `registerDeferredSettings` (chamada depois do `setup`) para settings que dependem de dados que só existem depois.
- Cada menu é uma subclasse própria em `applications/settings/*` (um arquivo por tela). Nós: `applications/gm/city-scales-config.mjs`, `price-list-config.mjs` (doc 04).

### 2.7 Migração

- Arquivo `module/migration.mjs`; chamada no `ready` por `_handleMigration()` (dnd5e.mjs:652) **somente pelo GM**:
  lê a setting de mundo `systemMigrationVersion` (`config:false`), compara com `game.system.flags.needsMigrationVersion` (declarado no `system.json` > `flags`)
  com `foundry.utils.isNewerVersion(needs, current)`; mundo novo (sem documentos) só grava a versão atual; versão menor que
  `compatibleMigrationVersion` mostra erro; senão `migrateWorld()`.
- `migrateWorld` percorre atores, itens, macros, tabelas, tokens e packs com barra de progresso (`ui.notifications.info(..., {progress:true, permanent:true})`),
  chama `migrateActorData(actor, source, ...)` por tipo e aplica `actor.update(updateData, {enforceTypes:false, diff:..., render:false})`.
  Os documentos também guardam `_stats.systemVersion` (versão que os gravou) e as migrações usam `isNewerVersion("4.0.0", source._stats.systemVersion)` por degrau.
- **Complementar:** `static migrateData(source)` no DataModel corrige dados antigos **na leitura** (sem escrever), que é o jeito leve; a migração de mundo grava.
  Para nós (sistema novo): só a setting `systemMigrationVersion`, `flags.needsMigrationVersion` e o esqueleto de `migrateWorld` vazio; usar `migrateData` quando mudar o esquema.

### 2.8 Packs

- `system.json > packs[]` por pack: `name, label, path, type, system, ownership{PLAYER:"OBSERVER",ASSISTANT:"OWNER"}, flags`.
  `packFolders[]` agrupa os packs na barra lateral.
- **Fonte**: `packs/_source/<pack>/**/*.yml` (YAML, uma entidade por arquivo, subpastas = pastas do pack). Binário gerado em `packs/<pack>/` (LevelDB).
- `utils/packs.mjs` usa `@foundryvtt/foundryvtt-cli` (`compilePack(src, dest, {recursive, log, transformEntry, yaml:true})` e `extractPack(...)`).
  `transformEntry` = `cleanPackEntry` limpa `_stats`, `ownership`, `sort`, `_id` etc. para diffs limpos.
  Scripts npm: `build:db` (compilar), `build:json`/`build:source`/`extract` (extrair), `build:clean` (limpar), `postinstall` roda `build:css && build:db`.
- Nós (doc 04): `tools/build-packs.mjs` com o mesmo CLI; fonte JSON ou YAML; `.gitignore` para `packs/*/` binários, versionar só `_source`.
  Packs binários não vão para o git; o `tools/release.mjs` os compila antes de zipar.

```js
import { compilePack } from "@foundryvtt/foundryvtt-cli";
await compilePack("packs/_source/examples", "packs/examples", { recursive: true, yaml: true, log: true });
```

### 2.9 CSS

- Fonte em **LESS** (`less/dnd5e.less` -> `dnd5e.css`; `lessc`), importa parciais. Declara só `@layer variables { ... }`; o resto sem layer, com escopo `.dnd5e2` (classe da aplicação) — ver a conclusão em `foundry-v14-essentials.md` §2.8.
- Variáveis (`less/variables/base.less, light.less, dark.less`) tema claro/escuro. Nós: CSS puro com `@import`, sem LESS (doc 04 diz "sem bundler").
- `all: revert-layer` aparece em `v2/apps.less:1137` para desfazer estilo do núcleo em `h1`.

### 2.10 Chat

- `documents/chat-message.mjs`: `renderHTML(options)` (linha 141) chama `super`, monta o cartão e dispara `Hooks.callAll("dnd5e.renderChatMessage", this, html)`.
  Não usa `renderChatMessageHTML` direto. Botões do card usam `data-action` e a classe `ChatMessage5e` tem `static onRenderChatLog(html)`.
  `Hooks.on("renderChatLog", ...)` e `renderChatPopout` (janela solta do chat) ligam os listeners; considerar o popout também.
- `ChatMessage` tem `dataModels` por tipo (`CONFIG.ChatMessage.dataModels`, system.json `documentTypes.ChatMessage`) — pode ser um bom lugar
  para guardar o estado do card (pool, mantidos, PP) em vez de `flags`. **Opcional** para nós; começar com `flags["leverage-gta"]`.

## 3. Gotchas / notas de versão

- O `dnd5e` 6.x exige Foundry >= 14.367. Não copiar código de `5.x` (v13).
- O dnd5e é enorme (Activities, Advancement, Bastions); **copie padrões, não features**. O que nos serve: `_module.mjs`, `init`, `SystemDataModel`
  simples, `getRollData`, `hotbarDrop`, `registerMenu`, `_handleMigration`, `compilePack`.
- `Object.assign(game.system, globalThis.dnd5e)` pode conflitar com propriedades de `game.system` (`id`, `version`, `title`...). Se mesclar, use chaves que não existem.
- A migração de mundo do dnd5e roda sobre `game.actors` etc. no cliente do GM: pode demorar e deve ter barra de progresso.
- `Macro.create` de jogadores sem permissão `MACRO_SCRIPT` falha; macros criadas pelo arrastar pedem permissão de script ao jogador (padrão: Trusted).
  **[CONFIRMAR]** no mundo de teste com o usuário `Tester` (Player).
- Os arquivos copiados (YAML de packs, textos) são conteúdo de regras da WotC: **não** copiamos nada de `packs/`.
