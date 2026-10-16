# Foundry v14: o essencial para o Leverage: Liberty City (T-002)

Pesquisa feita em 2026-10-16. Núcleo atual: **14.368 Stable** (v14 estável saiu em 1/abr/2026, build 14.359).
Legenda: **[OK]** = visto em fonte primária (API v14 ou código do dnd5e 6.0.6, que declara `minimum 14.367`);
**[CONFIRMAR]** = veio de fonte secundária ou da v13; testar no Foundry real (docs/13) antes de depender.

## 1. Pergunta

Quais são as APIs e convenções da v14 que o sistema precisa usar (manifesto, DataModel, fichas ApplicationV2,
registro de fichas, settings/menus, controles de cena, hooks de chat, CSS layers, sockets) e o que mudou da v13?

## 2. Respostas curtas

- **Fonte de verdade da API:** https://foundryvtt.com/api/v14/ (URLs de funções: `/api/v14/functions/hookEvents.<hook>.html`;
  classes: `/api/v14/classes/foundry.applications.api.ApplicationV2.html`). Não há guia de migração v13 -> v14 linkado;
  as mudanças estão nas notas 14.349 a 14.368: https://foundryvtt.com/releases/14.349 e https://foundryvtt.com/releases/14.359.
- **Modelo vivo:** dnd5e 6.0.6 (branch `6.1.x`, `master`), `system.json` com `"compatibility": {"minimum":"14.367","verified":"14"}`.
  Clonado em `.cache/research/dnd5e` (ignorado pelo git).
- Instalar a v14 exige reinstalar o Foundry (não atualiza pelo app). Usar `compatibility.minimum` >= `14` no nosso manifesto.

### 2.1 Manifesto `system.json` [OK, copiado do dnd5e]

Campos que o dnd5e usa: `id, title, description, version, compatibility{minimum,verified}, url, manifest, download,
authors[{name,url,flags}], esmodules[], styles[], documentTypes{}, packs[], packFolders[], languages[], socket, grid{distance,units},
primaryTokenAttribute, background, flags{}`. Notas:

- `documentTypes.Actor.<tipo>` aceita `htmlFields` (caminhos de `HTMLField`, com `*` para coringa) e `filePathFields`.
  Declare `htmlFields` para `background`/notas, senão o núcleo não trata o texto como HTML (enriquecimento, busca).
- `"socket": true` liga o canal `system.leverage-gta`.
- `primaryTokenAttribute` = caminho em `system` (dnd5e: `"attributes.hp"`). O nosso: `"life"`.
- `flags` é livre; o dnd5e guarda `needsMigrationVersion`, `compatibleMigrationVersion` e `hotReload` ali.
  `hotReload: {extensions:["css","hbs","json"], paths:["styles","templates","lang"]}` ajuda no desenvolvimento.
- `esmodules` aponta para o arquivo de entrada; `styles` para o CSS índice.

```json
{
  "id": "leverage-gta", "title": "Leverage: Liberty City", "version": "0.1.0",
  "compatibility": { "minimum": "14", "verified": "14.368" },
  "esmodules": ["leverage-gta.mjs"], "styles": ["styles/leverage-gta.css"],
  "documentTypes": {
    "Actor": { "crew": { "htmlFields": ["background"] }, "npc": {}, "location": {} },
    "Item": { "distinction": {}, "talent": {}, "specialty": {}, "asset": {}, "job": {} }
  },
  "languages": [{ "lang": "en", "name": "English", "path": "lang/en.json" },
                { "lang": "pt-BR", "name": "Português (Brasil)", "path": "lang/pt-BR.json" }],
  "socket": true, "primaryTokenAttribute": "life",
  "flags": { "hotReload": { "extensions": ["css","hbs","json"], "paths": ["styles","templates","lang"] } }
}
```

### 2.2 DataModel / TypeDataModel [OK]

- Classe estende `foundry.abstract.TypeDataModel`; campos de `foundry.data.fields` (`NumberField, SchemaField, StringField,
  SetField, ArrayField, HTMLField, BooleanField, ObjectField, ...`). Registro em `init`:
  `CONFIG.Actor.dataModels = { crew: CrewData, ... }` (dnd5e.mjs:158-161) e o mesmo para `CONFIG.Item.dataModels`.
- Métodos: `static defineSchema()`, `prepareBaseData()`, `prepareDerivedData()`, `static migrateData(source)`
  (dnd5e `system-data-model.mjs:241`), `static LOCALIZATION_PREFIXES = ["LEVERAGE.Crew"]` (rótulos automáticos dos campos).
- `getRollData` vive no DataModel e o Document delega (ver `dnd5e-patterns.md`).
- Novo na v14: `DataModel.cleanData` consolidado, `updateSource` aceita DataModel, ciclos `_updateDiff`/`_updateCommit`,
  `SchemaField` ganha `#extendFields/#removeFields`, `updateSource` com chaves `-=`/`==` está **deprecado** (usar `DataFieldOperator`).
  Para nós: continuar usando `update({"system.x": v})` e `-=key` só se necessário.
- Futuro: `ActiveEffect` virou documento primário (v14) e `ActiveEffectData#origin` não tem mais atribuição no núcleo.
  Só importa se usarmos efeitos (provavelmente não).

### 2.3 Fichas: ActorSheetV2 / ItemSheetV2 + HandlebarsApplicationMixin [OK]

- Classes: `foundry.applications.sheets.ActorSheetV2`, `foundry.applications.sheets.ItemSheetV2`,
  `foundry.applications.api.HandlebarsApplicationMixin`, `foundry.applications.api.DocumentSheetV2`.
- `ActorSheetV2` (v14) já traz: `_onDragStart`, `_onDrop` -> `_onDropActor/_onDropItem/_onDropFolder/_onDropDocument/_onDropActiveEffect`,
  `_onSortItem`, `_canDragStart/_canDragDrop`, getter `_dragDrop`. Ou seja, **não** é preciso criar `new DragDrop(...)` à mão:
  sobrescreva `_onDropItem`. Também: `detachWindow()/attachWindow()` (pop-out em outra janela do navegador, novo na v14),
  `renderChild`, `changeTab`, `tabGroups`.
- `DocumentSheetV2.DEFAULT_OPTIONS.form`: `{ submitOnChange, closeOnSubmit, handler }`. `isEditable` usa `editPermission` (3).
- `static PARTS = { nome: { template, id?, classes?, container?: {classes,id}, templates?: [...parciais], scrollable?: [""] } }`.
  `scrollable: [""]` preserva a posição de rolagem do próprio elemento da parte entre re-renders (bom para nossas listas).
- `static TABS` é padrão do dnd5e (lista `{tab,label,icon,condition}` + `tabGroups.primary`). Não é do núcleo: o núcleo expõe
  `static TABS` como `Record<group, {tabs[],initial}>` no ApplicationV2; **[CONFIRMAR]** o formato exato lendo a classe
  no Foundry real antes de usar. Para a nossa ficha (sem abas, só a pasta BACKGROUND/JOBS) basta alternar uma `data-` com `actions`.
- Ciclo: `_prepareContext(options)` -> `_preparePartContext(partId, ctx, options)` -> `_onFirstRender` -> `_onRender(ctx, options)`
  (ligue só o que não dá para fazer com `data-action`: clique direito, `dragstart` personalizado). `this.render({ parts: ["tray"] })`
  re-renderiza só a parte.
- `static DEFAULT_OPTIONS = { classes: ["leverage-gta","sheet","crew"], position:{width,height}, window:{resizable:true, controls:[...]},
  form:{submitOnChange:true}, actions:{ nome: Classe.#metodo } }` — handlers de `actions` são `static` ou função solta, com
  `this` = a aplicação, assinatura `(event, target)`. `DEFAULT_OPTIONS` e `PARTS` são **mesclados** com os da classe pai.
- Sem moldura (HUD): `window: { frame: false }` e `window: { positioned: false }` (campos listados em `DEFAULT_OPTIONS`;
  **[CONFIRMAR]** o comportamento exato de `positioned:false`).

```js
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
export default class CrewSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["leverage-gta", "crew"], position: { width: 1100, height: 760 },
    window: { resizable: true }, form: { submitOnChange: true },
    actions: { toggleDie: CrewSheet.#onToggleDie }
  };
  static PARTS = {
    header: { template: "systems/leverage-gta/templates/actor/crew/header.hbs" },
    roles:  { template: "systems/leverage-gta/templates/actor/crew/roles.hbs", scrollable: [""] }
  };
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.system = this.actor.system; ctx.config = CONFIG.LEVERAGE;
    return ctx;
  }
  static #onToggleDie(event, target) { this.pool.toggle(target.dataset.ref); }
}
```

### 2.4 Registro de fichas [OK] (dnd5e.mjs:170-218)

O caminho certo na v14 (igual à v13): `foundry.applications.apps.DocumentSheetConfig`.
O global `DocumentSheetConfig` antigo está deprecado/removido: usar o namespace.

```js
const { DocumentSheetConfig } = foundry.applications.apps;
DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);   // opcional
DocumentSheetConfig.registerSheet(Actor, "leverage-gta", CrewSheet,
  { types: ["crew"], makeDefault: true, label: "LEVERAGE.Sheet.Crew" });
DocumentSheetConfig.registerSheet(Item, "leverage-gta", LeverageItemSheet,
  { types: ["distinction","talent","specialty","asset","job"], makeDefault: true, label: "LEVERAGE.Sheet.Item" });
```

### 2.5 Settings e menus [OK] (dnd5e `settings.mjs:385`)

```js
game.settings.register("leverage-gta", "stars", { scope: "world", config: false, type: Number, default: 0,
  onChange: () => Hooks.callAll("leverage.starsChanged") });
game.settings.registerMenu("leverage-gta", "cityScales", {
  name: "LEVERAGE.Settings.CityScales.Name", label: "LEVERAGE.Settings.CityScales.Label",
  hint: "LEVERAGE.Settings.CityScales.Hint", icon: "fa-solid fa-city",
  type: CityScalesConfig,    // subclasse de HandlebarsApplicationMixin(ApplicationV2); tem que ser classe, não instância
  restricted: true           // só o mestre vê o botão
});
```

- `scope: "world"` só o GM grava; `"client"` é por navegador; `"user"` (v13+) fica na conta, vale em qualquer navegador **[CONFIRMAR]**.
- `type` pode ser `Number/String/Boolean` ou um `DataField` (`new foundry.data.fields.ObjectField()`); para JSON complexo
  (escalas, tabela de preços) use `ObjectField`/`ArrayField` e valide.
- `requiresReload: true` quando exigir recarregar a página. Ler: `game.settings.get(...)`; gravar: `await game.settings.set(...)`.
- Registrar tudo no `init` (não esperar `ready`), exceto o que depende de dados do mundo.

### 2.6 Controles de cena: `getSceneControlButtons` [OK, API v14]

Assinatura: `getSceneControlButtons(controls: Record<string, SceneControl>): void` — o **parâmetro é um objeto indexado por nome**
(`controls.tokens`), não mais um array (mudança da v12 para a v13, mantida na v14). Exemplo do núcleo adiciona
`controls.tokens.tools.myTool = {...}`.

- `SceneControl`: `name, title, icon, order, visible?, activeTool?, tools?{}, onChange?(event, active), onToolChange?(event, tool, active)`.
  **v14:** `onToolChange` recebe o novo argumento booleano `active`; uma camada pode ter **zero ferramentas**
  (`SceneControls#tool` e `game.activeTool` podem ser `null`).
- `SceneControlTool`: `name, title, icon, order, visible?, toggle?, active?, button?, onChange?(event, active), toolclip?`.
  `button: true` age ao clicar e não vira ferramenta ativa; `toggle: true` liga/desliga e usa `active`.
- Payload de ativação: `SceneControlsActivationChange { controlChange, event, toggleChanges, toolChange }`.

```js
Hooks.on("getSceneControlButtons", controls => {
  controls.tokens.tools.leverageOpposition = {
    name: "leverageOpposition", title: "LEVERAGE.GM.Opposition", icon: "fa-solid fa-dice",
    order: 90, button: true, visible: game.user.isGM,
    onChange: () => new OppositionRoller().render({ force: true })
  };
  controls.tokens.tools.leverageHud = {          // toggle: mostra/oculta o HUD
    name: "leverageHud", title: "LEVERAGE.HUD.Toggle", icon: "fa-solid fa-star",
    order: 91, toggle: true, active: game.settings.get("leverage-gta", "hudVisible"),
    onChange: (event, active) => game.settings.set("leverage-gta", "hudVisible", active)
  };
});
```
Não existe mais `activeTool` no estilo v11. Se quisermos grupo próprio, `controls.leverage = { name:"leverage", title, icon, order, tools:{...}, activeTool:"..." }`.

### 2.7 Hooks de chat [OK]

- `renderChatMessageHTML(message, html: HTMLElement, context?)` — **HTMLElement puro, sem jQuery**. É o hook para ligar listeners no card.
  O antigo `renderChatMessage` (jQuery) foi deprecado na v13; não use.
  `context` só existe quando o template padrão do núcleo é usado.
- Preferir `data-action` no card e **um** listener delegado:
  ```js
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!message.getFlag("leverage-gta", "roll")) return;
    html.querySelectorAll("[data-lv-action]").forEach(b => b.addEventListener("click", ev => RollCard.onAction(message, ev)));
  });
  ```
- Alternativa do dnd5e: subclasse de `ChatMessage` com `renderHTML()` (chat-message.mjs:141) que dispara um hook próprio.
  Usar `CONFIG.ChatMessage.documentClass` só se precisarmos disso.
- Outros hooks úteis: `renderChatLog`, `chatMessage` (interceptar `/pool`), `getChatMessageContextOptions` (menu do card; na v14 o menu usa `fixed`).
- Dados do card: `ChatMessage.create({ rolls:[roll], flags:{"leverage-gta":{...}}, content })`. `ChatMessage` também aceita `CONFIG.ChatMessage.dataModels`
  e `documentTypes.ChatMessage` no manifesto (o dnd5e faz), útil para um tipo `poolRoll` **[opcional]**.

### 2.8 CSS layers [OK a meio]

- Desde a v13 o núcleo usa `@layer`. Ordem (cópia de folha de terceiros, **[CONFIRMAR]** em `document.styleSheets` no Foundry real):
  `reset, variables, elements, blocks, applications, layouts, system, modules, exceptions`.
  Fontes: https://foundryvtt.wiki/en/development/guides/css-cascade-layers (válida para 13.334) e issue do núcleo citada por ela.
- **CSS fora de qualquer layer vence todas as layers** (regra do CSS). Se não usarmos `@layer`, nosso CSS ganha de tudo do núcleo
  e não precisamos de hacks de especificidade, mas também deixamos de "perder" para `exceptions`.
  O dnd5e só declara `@layer variables { ... }` para as variáveis e escreve o resto sem layer, com escopo `.dnd5e2`.
- **Recomendação para nós:** `styles/leverage-gta.css` importa os parciais dentro da layer `system`:
  `@import url("tokens.css") layer(system);` (idem base, sheets, chat, hud, gm). A layer `system` vem depois de `applications`,
  então ganha do núcleo sem hacks de especificidade, e ainda deixa `modules`/`exceptions` vencerem. O núcleo já declara a ordem
  das layers antes (a folha dele carrega primeiro), então só citar `system` não a reordena. Escopo `.leverage-gta` continua obrigatório.
  Registrar em DECISIONS.md e conferir no Foundry real (`getComputedStyle` de um elemento da ficha) que nada do núcleo sobrepõe.
- `all: revert-layer` (usado no dnd5e) desfaz a camada atual, útil para zerar estilo de `h1` do núcleo dentro de uma ficha.
- Variáveis do núcleo (tema claro/escuro) ficam em `:root`/`.themed`; nossas cores ficam em `tokens.css` sob `.leverage-gta`.

### 2.9 Sockets [OK conceitual]

- `"socket": true` no manifesto; canal **`system.leverage-gta`**. `game.socket.on(channel, handler)` no `ready`; 
  `game.socket.emit(channel, payload)` **não** devolve ao emissor: quem emite precisa executar a própria ação localmente.
- Padrão para ações do mestre (doc 04): jogador emite `{ action, ... , userId }`; **só o GM ativo** processa:
  `if (game.users.activeGM?.id !== game.user.id) return;` valida permissões (quem é dono do ator de origem) e aplica `actor.update`.
  Nunca confiar em dados vindos do cliente sem validar. Para atualizar documentos que o jogador não possui, só o GM consegue.
- Como o dnd5e não usa socket, não há modelo; implementar em `module/socket.mjs` com uma tabela `HANDLERS[action]`.
- Alternativa sem socket (v13+): `Actor#update` com permissão de dono para a própria grana. Só a **transferência** precisa de socket.

### 2.10 HUD fixo e largura da barra lateral [CONFIRMAR]

- A aplicação do HUD: `ApplicationV2` com `window: { frame: false }`, renderizada em `#interface` (v13/v14 monta `#interface` com
  `#ui-left`, `#ui-middle`, `#ui-right`; a lateral é `#sidebar`, `ui.sidebar`). Em vez de inserir dentro da barra, ancore
  com `position: fixed; right: calc(var(--lv-sidebar-w) + 12px)`.
- Medir: `ui.sidebar.element.getBoundingClientRect().width` e um `ResizeObserver` no elemento. A classe `Sidebar` tem
  `expand()/collapse()/toggleExpanded()/expanded` (API v14); não há hook `renderSidebar` documentado na página, então use o
  `ResizeObserver` (mais robusto) e escreva `--lv-sidebar-w` no `:root`.

### 2.11 ProseMirror / HTMLField em ApplicationV2 [OK, dnd5e]

- Schema: `new foundry.data.fields.HTMLField()` + declarar em `documentTypes.<Doc>.<tipo>.htmlFields`.
- Template: `<prose-mirror name="system.background" value="{{source.background}}" document-uuid="{{actor.uuid}}" toggled="true"></prose-mirror>`
  (dnd5e `templates/actors/tabs/character-biography.hbs:47`). Elemento nativo do núcleo, grava com `submitOnChange`.
- Texto enriquecido: `await foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { secrets: actor.isOwner, relativeTo: actor, rollData })`
  no `_prepareContext`; no template `{{{enriched.background}}}`. **[CONFIRMAR]** o namespace `foundry.applications.ux.TextEditor`.

## 3. O que mudou da v13 para a v14 (resumo para este projeto)

| Tema | Mudança | Impacto |
| --- | --- | --- |
| Instalação | v14 não atualiza no app; reinstalar | Ambiente de teste precisa de Foundry 14 limpo |
| Cenas | Multi-nível nativo (`Level`), Measured Templates removidos (viram Regions) | Irrelevante, não usamos |
| Active Effects v2 | AE é documento primário; `origin` sem atribuição no núcleo | Só se usarmos efeitos |
| ApplicationV2 | Pop-out em janela do navegador (`detachWindow`), `ApplicationV2.instances`, `auxclick` dispara `actions`, kebab usa `ContextMenu` | Ficha funciona em pop-out: não usar `document` global, usar `this.element` |
| Scene controls | Camada sem ferramentas; `onToolChange(event, tool, active)` | Ver 2.6 |
| Chat/UI | Menus de contexto do chat com `fixed`; `parseHTML` devolve `null`; `ContextMenuEntry#icon` aceita classes; `<code>` inline | Sem impacto direto |
| Utilitários | `foundry.utils.equals()` substitui `objectsEqual`; novo `isPlainObject` | Usar os novos |
| DataModel | `cleanData` consolidado; `updateSource` aceita DataModel; `-=`/`==` deprecados | Ver 2.2 |
| Limpeza | APIs deprecadas desde a v12 removidas | Evitar globais antigos: `Application`, `FormApplication`, `renderChatMessage`, `TextEditor` global, `loadTemplates` global |
| Fix conhecido (14.359) | Rolagens "para o jogador e o GM" aparecem como `???` no modo GM privado/`/gmroll` | Evitar `/gmroll` nos testes dos cards |
| Registro de ficha | `foundry.applications.apps.DocumentSheetConfig` (igual v13) | Sem mudança |

Namespaces corretos (v13+, ainda válidos): `foundry.applications.handlebars.loadTemplates/renderTemplate`,
`foundry.applications.api.{ApplicationV2,HandlebarsApplicationMixin,DialogV2}`, `foundry.applications.sheets.*`,
`foundry.applications.ux.*`, `foundry.applications.fields.*` (helpers `createFormGroup`, `createSelectInput`...).

## 4. Gotchas

1. **Não use jQuery** nem `html.find`. `html` é `HTMLElement`; use `querySelector(All)`.
2. `static PARTS`/`DEFAULT_OPTIONS` se mesclam com a classe base; declare apenas o que muda e **nunca mute o objeto do pai**.
3. Cada `PART` precisa de **um único elemento raiz** no template; partes soltas quebram o re-render parcial.
4. Dentro da ficha em pop-out, `document.querySelector` aponta para a janela errada: sempre `this.element.querySelector`.
5. `submitOnChange` com `<input>` sem `name` não grava; botões dentro de `<form>` precisam de `type="button"`.
6. `game.socket.emit` não chega ao próprio emissor.
7. Não desenhe CSS fora de `.leverage-gta`; use layer `system` (ver 2.8) e confirme a ordem real no navegador.
8. Itens marcados [CONFIRMAR] devem ser verificados por `tests/foundry/` na primeira tarefa que os usar.

## 5. Fontes

- API v14: https://foundryvtt.com/api/v14/ (SceneControls, SceneControl, SceneControlTool, ActorSheetV2, DocumentSheetV2, ApplicationV2, Sidebar, hookEvents)
- Notas: https://foundryvtt.com/releases/14.349 (dev-facing v14) e https://foundryvtt.com/releases/14.359 (Stable 1)
- CSS layers: https://foundryvtt.wiki/en/development/guides/css-cascade-layers
- dnd5e: https://github.com/foundryvtt/dnd5e (branch `6.1.x`, tag `release-6.0.6`)
